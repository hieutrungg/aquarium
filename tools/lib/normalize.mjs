import { createPng, bounds, pixel, rgbKey, fromKey } from './png.mjs';
import { nearest } from './palette.mjs';

const near = (a, b, tol) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) <= tol;
const lightNeutral = c => Math.min(c.r, c.g, c.b) >= 160 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 30;

export function foregroundMask(png, tolerance = 24) {
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h);
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { hasAlpha = true; break; }
  if (hasAlpha) {
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
    return mask;
  }

  // Estimate one solid background, or two light neutral checkerboard colors.
  const edge = [];
  for (let x = 0; x < w; x++) { edge.push(x); if (h > 1) edge.push((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { edge.push(y * w); if (w > 1) edge.push(y * w + w - 1); }
  const bins = new Map();
  for (const i of edge) {
    const c = pixel(data, i * 4);
    const key = `${c.r >> 3},${c.g >> 3},${c.b >> 3}`;
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bin.r += c.r; bin.g += c.g; bin.b += c.b; bin.n++;
    bins.set(key, bin);
  }
  const ranked = [...bins.values()].sort((a, b) => b.n - a.n)
    .map(c => ({ r: Math.round(c.r / c.n), g: Math.round(c.g / c.n), b: Math.round(c.b / c.n), n: c.n }));
  const backgrounds = [ranked[0]];
  const second = ranked.find(c => !near(c, ranked[0], tolerance) && lightNeutral(c) && c.n >= edge.length * 0.05);
  if (lightNeutral(ranked[0]) && second) backgrounds.push(second);

  // Only remove connected background: white details enclosed by the fish survive.
  mask.fill(1);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const visit = i => {
    if (mask[i] && backgrounds.some(c => near(pixel(data, i * 4), c, tolerance))) {
      mask[i] = 0; queue[tail++] = i;
    }
  };
  for (const i of edge) visit(i);
  while (head < tail) {
    const i = queue[head++], x = i % w;
    if (x > 0) visit(i - 1);
    if (x + 1 < w) visit(i + 1);
    if (i >= w) visit(i - w);
    if (i + w < mask.length) visit(i + w);
  }
  return mask;
}

function scanRuns(png, mask) {
  const lengths = [], edges = { x: [], y: [] };
  const scan = (axis, fixed) => {
    const size = axis === 'x' ? png.width : png.height;
    const at = p => axis === 'x' ? fixed * png.width + p : p * png.width + fixed;
    const segments = [];
    let start = 0, reference = pixel(png.data, at(0) * 4), active = mask[at(0)];
    for (let p = 1; p <= size; p++) {
      const i = p < size ? at(p) : 0;
      if (p < size && mask[i] === active && (!active || near(reference, pixel(png.data, i * 4), 18))) continue;
      segments.push({ start, end: p, active });
      if (active && start > 0 && p < size && p - start >= 4) lengths.push(p - start);
      start = p;
      if (p < size) { active = mask[i]; reference = pixel(png.data, i * 4); }
    }
    for (let j = 1; j < segments.length; j++) {
      const a = segments[j - 1], b = segments[j];
      if ((a.active || b.active) && a.end - a.start >= 4 && b.end - b.start >= 4) edges[axis].push(b.start);
    }
  };
  // Sample both axes; ignoring removed background stops checker tiles driving the grid.
  for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 160))) scan('x', y);
  for (let x = 0; x < png.width; x += Math.max(1, Math.floor(png.width / 160))) scan('y', x);
  return { lengths, edges };
}

export function detectGrid(png, mask, forced = 'auto', warnings = []) {
  const { lengths, edges } = scanRuns(png, mask);
  let cell = forced;
  if (cell === 'auto') {
    if (!lengths.length) throw new Error('Cannot detect grid: no foreground runs; try --cell <n>');
    let bestScore = -Infinity;
    for (let candidate = 4; candidate <= 32; candidate++) {
      let score = 0;
      for (const length of lengths) {
        const multiple = Math.round(length / candidate);
        const error = Math.abs(length - multiple * candidate);
        if (multiple >= 1 && error <= Math.min(2, candidate * 0.12)) {
          // Popular common divisor; prefer the fundamental cell over its sub-divisors.
          score += (0.8 + 0.2 / Math.sqrt(multiple)) * (1 - error / candidate);
        }
      }
      score /= lengths.length;
      if (score > bestScore) { cell = candidate; bestScore = score; }
    }
    if (bestScore < 0.65 || lengths.length < 8) warnings.push('Low-confidence cell estimate; inspect the result or force --cell.');
  }
  const phase = axis => {
    const votes = new Uint32Array(cell);
    for (const position of edges[axis]) votes[position % cell]++;
    let best = 0;
    for (let i = 1; i < cell; i++) if (votes[i] > votes[best]) best = i;
    if (!edges[axis].length) warnings.push(`No ${axis}-axis grid evidence; using offset 0.`);
    return best;
  };
  return { cell, offset: { x: phase('x'), y: phase('y') } };
}

export function sampleGrid(png, mask, { cell, offset }) {
  const firstX = offset.x === 0 ? 0 : offset.x - cell;
  const firstY = offset.y === 0 ? 0 : offset.y - cell;
  const width = Math.ceil((png.width - firstX) / cell), height = Math.ceil((png.height - firstY) / cell);
  const sampled = createPng(width, height);
  for (let gy = 0; gy < height; gy++) for (let gx = 0; gx < width; gx++) {
    const x0 = firstX + gx * cell, y0 = firstY + gy * cell;
    const left = Math.max(0, x0), top = Math.max(0, y0);
    const right = Math.min(png.width, x0 + cell), bottom = Math.min(png.height, y0 + cell);
    let foreground = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) foreground += mask[y * png.width + x];
    if (foreground * 2 < (right - left) * (bottom - top) || !foreground) continue;

    // Mode of the central 60%, excluding background and blurred block borders.
    const counts = new Map();
    const tally = (x1, y1, x2, y2) => {
      for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
        const i = y * png.width + x;
        if (!mask[i]) continue;
        const key = rgbKey(pixel(png.data, i * 4));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    };
    tally(Math.max(left, x0 + Math.ceil(cell * 0.2)), Math.max(top, y0 + Math.ceil(cell * 0.2)),
      Math.min(right, x0 + Math.ceil(cell * 0.8)), Math.min(bottom, y0 + Math.ceil(cell * 0.8)));
    // A clipped edge cell may have no visible core.
    if (!counts.size) tally(left, top, right, bottom);
    let key = 0, count = 0;
    for (const [k, n] of counts) if (n > count) { key = k; count = n; }
    const c = fromKey(key), out = (gy * width + gx) * 4;
    sampled.data.set([c.r, c.g, c.b, 255], out);
  }
  return sampled;
}

function quantize(png, palette, maxColors, warnings) {
  const cache = new Map(), counts = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    if (!png.data[i + 3]) continue;
    const source = rgbKey(pixel(png.data, i));
    if (!cache.has(source)) cache.set(source, rgbKey(nearest(fromKey(source), palette)));
    const key = cache.get(source), c = fromKey(key);
    png.data.set([c.r, c.g, c.b], i);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const initial = counts.size;
  while (counts.size > maxColors) {
    const [least, usage] = [...counts].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
    const target = rgbKey(nearest(fromKey(least), [...counts.keys()].filter(k => k !== least).map(fromKey)));
    const c = fromKey(target);
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] && rgbKey(pixel(png.data, i)) === least) png.data.set([c.r, c.g, c.b], i);
    }
    counts.delete(least); counts.set(target, counts.get(target) + usage);
  }
  if (initial > maxColors) warnings.push(`Merged ${initial} palette colors down to ${counts.size}.`);
  return counts.size;
}

export function normalize(png, palette, { canvas = 64, cell = 'auto', padding = 4, maxColors = 16, bgTol = 24 } = {}) {
  const warnings = [];
  const mask = foregroundMask(png, bgTol);
  const grid = detectGrid(png, mask, cell, warnings);
  const logical = sampleGrid(png, mask, grid);
  const colors = quantize(logical, palette, maxColors, warnings);
  const sourceBox = bounds(logical);
  if (!sourceBox) throw new Error('No foreground remains after background removal and sampling');
  if (sourceBox.width + padding * 2 > canvas || sourceBox.height + padding * 2 > canvas) {
    const error = new Error(`Foreground ${sourceBox.width}x${sourceBox.height} + ${padding}px padding on each side does not fit ${canvas}x${canvas}; use a larger --canvas or correct --cell`);
    error.exitCode = 2;
    throw error;
  }
  if (mask.subarray(0, png.width).some(Boolean) || mask.subarray(-png.width).some(Boolean) ||
    mask.some((v, i) => v && (i % png.width === 0 || i % png.width === png.width - 1))) {
    warnings.push('Foreground touches the input edge; the source may be clipped.');
  }
  const bbox = { x: Math.floor((canvas - sourceBox.width) / 2), y: Math.floor((canvas - sourceBox.height) / 2), width: sourceBox.width, height: sourceBox.height };
  const output = createPng(canvas, canvas);
  for (let y = 0; y < bbox.height; y++) for (let x = 0; x < bbox.width; x++) {
    const src = ((sourceBox.y + y) * logical.width + sourceBox.x + x) * 4;
    output.data.set(logical.data.subarray(src, src + 4), ((bbox.y + y) * canvas + bbox.x + x) * 4);
  }
  const summary = { ...grid, logicalSize: { width: logical.width, height: logical.height }, bbox, colors, warnings };
  return { output, summary, pivot: { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 } };
}
