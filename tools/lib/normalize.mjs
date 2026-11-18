import { createPng, bounds, pixel, rgbKey, fromKey, seamScore } from './png.mjs';
import { nearest } from './palette.mjs';

const near = (a, b, tol) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) <= tol;
const lightNeutral = c => Math.min(c.r, c.g, c.b) >= 160 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 30;

export function foregroundMask(png, tolerance = 24, holes = 0) {
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
  if (holes > 0) removeEnclosedBackground(data, w, mask, backgrounds, tolerance, holes);
  return mask;
}

// Enclosed background (e.g. white gaps between leaves) is not reachable from the edge.
// Clear background-coloured islands of at least `minArea` raw pixels; smaller ones are real highlights.
function removeEnclosedBackground(data, w, mask, backgrounds, tolerance, minArea) {
  const seen = new Uint8Array(mask.length);
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || !mask[start] || !backgrounds.some(c => near(pixel(data, start * 4), c, tolerance))) continue;
    const region = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      region.push(i);
      for (const n of [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        if (!backgrounds.some(c => near(pixel(data, n * 4), c, tolerance))) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (region.length >= minArea) for (const i of region) mask[i] = 0;
  }
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

export function sampleGrid(png, mask, { cell, cellY = cell, offset }) {
  const firstX = offset.x === 0 ? 0 : offset.x - cell;
  const firstY = offset.y === 0 ? 0 : offset.y - cellY;
  // Convert real grid boundaries only when indexing raw pixels. Epsilon avoids
  // floating-point roundoff adding a stray row/column on an exact boundary.
  const ceil = n => Math.ceil(n - 1e-9);
  const width = ceil((png.width - firstX) / cell), height = ceil((png.height - firstY) / cellY);
  const sampled = createPng(width, height);
  for (let gy = 0; gy < height; gy++) for (let gx = 0; gx < width; gx++) {
    const x0 = firstX + gx * cell, y0 = firstY + gy * cellY;
    const left = Math.max(0, ceil(x0)), top = Math.max(0, ceil(y0));
    const right = Math.min(png.width, ceil(x0 + cell)), bottom = Math.min(png.height, ceil(y0 + cellY));
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
    tally(Math.max(left, ceil(x0 + cell * 0.2)), Math.max(top, ceil(y0 + cellY * 0.2)),
      Math.min(right, ceil(x0 + cell * 0.8)), Math.min(bottom, ceil(y0 + cellY * 0.8)));
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

export function normalize(png, palette, options = {}) {
  const { canvas = 64, cell = 'auto', padding = 4, maxColors = 16, bgTol = 24,
    holes = 0,
    targetW, targetH, anchor = 'center', tile } = options;
  const modes = [options.cell, targetW, targetH, tile].filter(v => v !== undefined);
  if (modes.length > 1) throw new Error('--cell, --target-w, --target-h and --tile are mutually exclusive');
  if (!['center', 'bottom'].includes(anchor)) throw new Error('--anchor must be center or bottom');
  for (const [name, n] of [['target-w', targetW], ['target-h', targetH], ['tile', tile]]) {
    if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > 1024)) throw new Error(`--${name} must be an integer in 1..1024`);
  }
  const warnings = [];
  if (tile !== undefined) {
    const grid = { cell: png.width / tile, ...(png.width === png.height ? {} : { cellY: png.height / tile }), offset: { x: 0, y: 0 } };
    const output = sampleGrid(png, new Uint8Array(png.width * png.height).fill(1), grid);
    const colors = quantize(output, palette, maxColors, warnings);
    const bbox = { x: 0, y: 0, width: tile, height: tile };
    return { output, summary: { ...grid, tile, logicalSize: { width: tile, height: tile }, bbox, colors, warnings, seamScore: seamScore(output) } };
  }
  const { width: canvasW, height: canvasH } = typeof canvas === 'number' ? { width: canvas, height: canvas } : canvas;
  const mask = foregroundMask(png, bgTol, holes);
  let grid;
  if (targetW !== undefined || targetH !== undefined) {
    let left = png.width, top = png.height, right = -1, bottom = -1;
    for (let i = 0; i < mask.length; i++) if (mask[i]) {
      const x = i % png.width, y = Math.floor(i / png.width);
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < 0) throw new Error('No foreground remains after background removal');
    const size = targetW !== undefined ? (right - left + 1) / targetW : (bottom - top + 1) / targetH;
    grid = { cell: size, offset: { x: left % size, y: top % size } };
  } else grid = detectGrid(png, mask, cell, warnings);
  const logical = sampleGrid(png, mask, grid);
  const colors = quantize(logical, palette, maxColors, warnings);
  const sourceBox = bounds(logical);
  if (!sourceBox) throw new Error('No foreground remains after background removal and sampling');
  if (sourceBox.width + padding * 2 > canvasW || sourceBox.height + padding * (anchor === 'bottom' ? 1 : 2) > canvasH) {
    const error = new Error(`Foreground ${sourceBox.width}x${sourceBox.height} + ${padding}px padding (${anchor} anchor) does not fit ${canvasW}x${canvasH}; use a larger --canvas or correct --cell`);
    error.exitCode = 2;
    throw error;
  }
  if (mask.subarray(0, png.width).some(Boolean) || mask.subarray(-png.width).some(Boolean) ||
    mask.some((v, i) => v && (i % png.width === 0 || i % png.width === png.width - 1))) {
    warnings.push('Foreground touches the input edge; the source may be clipped.');
  }
  const bbox = { x: Math.floor((canvasW - sourceBox.width) / 2), y: anchor === 'bottom' ? canvasH - sourceBox.height : Math.floor((canvasH - sourceBox.height) / 2), width: sourceBox.width, height: sourceBox.height };
  const output = createPng(canvasW, canvasH);
  for (let y = 0; y < bbox.height; y++) for (let x = 0; x < bbox.width; x++) {
    const src = ((sourceBox.y + y) * logical.width + sourceBox.x + x) * 4;
    output.data.set(logical.data.subarray(src, src + 4), ((bbox.y + y) * canvasW + bbox.x + x) * 4);
  }
  const summary = { ...grid, logicalSize: { width: logical.width, height: logical.height }, bbox, colors, warnings, anchor };
  return { output, summary, pivot: { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / (anchor === 'bottom' ? 1 : 2) } };
}
