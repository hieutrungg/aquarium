import { createPng, bounds, pixel, rgbKey } from './png.mjs';

const check = (ok, details) => ({ status: ok ? 'PASS' : 'FAIL', ...details });
export function inspectSprite(png, palette, { maxColors = 16, padding = 4 } = {}) {
  const allowed = new Set(palette.map(rgbKey)), colors = new Set();
  let invalidPalette = 0, invalidAlpha = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const alpha = png.data[i + 3];
    if (alpha !== 0 && alpha !== 255) invalidAlpha++;
    // RGB under alpha=0 is invisible and is not part of the sprite palette.
    if (!alpha) continue;
    const key = rgbKey(pixel(png.data, i));
    colors.add(key);
    if (!allowed.has(key)) invalidPalette++;
  }
  const bbox = bounds(png);
  const margins = bbox ? { left: bbox.x, top: bbox.y, right: png.width - bbox.x - bbox.width, bottom: png.height - bbox.y - bbox.height } : null;
  const checks = {
    palette: check(invalidPalette === 0, { invalidPixels: invalidPalette }),
    alpha: check(invalidAlpha === 0, { invalidPixels: invalidAlpha }),
    colors: check(colors.size <= maxColors, { actual: colors.size, maximum: maxColors }),
    padding: check(!!bbox && Object.values(margins).every(n => n >= padding), { minimum: padding, actual: margins, ...(bbox ? {} : { reason: 'Empty sprite' }) }),
    canvas: check(png.width === png.height && [64, 96].includes(png.width), { width: png.width, height: png.height })
  };
  return { status: Object.values(checks).every(c => c.status === 'PASS') ? 'PASS' : 'FAIL', checks, bbox };
}

const hex = value => [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
const overall = hex('EAF6F2'), water = hex('B8E1D5'), wall = hex('76B5A5');
const cream = hex('F9F5E9'), ink = hex('35574F');
function fill(png, x, y, width, height, rgb) {
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    png.data.set([...rgb, 255], ((y + dy) * png.width + x + dx) * 4);
  }
}

export function contactSheet(sprites) {
  if (!sprites.length) {
    const png = createPng(40, 40); fill(png, 0, 0, 40, 40, overall); return png;
  }
  const gap = 8, maxWidth = Math.max(...sprites.map(p => p.width));
  const columns = [maxWidth, maxWidth * 4, maxWidth * 4, maxWidth];
  const width = columns.reduce((a, b) => a + b, gap * 5);
  const height = sprites.reduce((sum, p) => sum + p.height * 4 + gap, gap);
  const sheet = createPng(width, height);
  fill(sheet, 0, 0, width, height, overall);
  let rowY = gap;
  for (const sprite of sprites) {
    let columnX = gap;
    for (let column = 0; column < 4; column++) {
      const scale = column === 1 || column === 2 ? 4 : 1;
      const w = sprite.width * scale, h = sprite.height * scale;
      const x = columnX + Math.floor((columns[column] - w) / 2);
      const y = rowY + Math.floor((sprite.height * 4 - h) / 2);
      fill(sheet, x, y, w, h, column === 2 ? cream : column === 3 ? wall : water);
      // Explicit integer replication: nearest-neighbor at 4x, no native canvas.
      for (let sy = 0; sy < sprite.height; sy++) for (let sx = 0; sx < sprite.width; sx++) {
        const i = (sy * sprite.width + sx) * 4, alpha = sprite.data[i + 3] / 255;
        if (!alpha) continue;
        const rgb = column === 2 ? ink : [...sprite.data.subarray(i, i + 3)];
        const bg = column === 2 ? cream : column === 3 ? wall : water;
        const blended = rgb.map((c, k) => Math.round(c * alpha + bg[k] * (1 - alpha)));
        fill(sheet, x + sx * scale, y + sy * scale, scale, scale, blended);
      }
      columnX += columns[column] + gap;
    }
    rowY += sprite.height * 4 + gap;
  }
  return sheet;
}
