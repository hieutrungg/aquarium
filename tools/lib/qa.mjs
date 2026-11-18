import { createPng, bounds, pixel, rgbKey, seamScore } from './png.mjs';

const check = (ok, details) => ({ status: ok ? 'PASS' : 'FAIL', ...details });
export function inspectSprite(png, palette, { maxColors = 16, padding = 4, sizes = [{ width: 64, height: 64 }, { width: 96, height: 96 }], anchor = 'center', tile = false } = {}) {
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
    padding: tile ? check(true, { skipped: true, reason: 'Tile mode' }) :
      check(!!bbox && margins.left >= padding && margins.top >= padding && margins.right >= padding &&
        (anchor === 'bottom' ? margins.bottom === 0 : margins.bottom >= padding),
      { minimum: padding, actual: margins, ...(anchor === 'bottom' ? { anchor, bottomRequired: 0 } : {}), ...(bbox ? {} : { reason: 'Empty sprite' }) }),
    canvas: check(sizes.some(s => png.width === s.width && png.height === s.height), { width: png.width, height: png.height })
  };
  return { status: Object.values(checks).every(c => c.status === 'PASS') ? 'PASS' : 'FAIL', checks, bbox, ...(tile ? { seamScore: seamScore(png) } : {}) };
}

const hex = value => [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
const overall = hex('EAF6F2'), water = hex('B8E1D5'), wall = hex('76B5A5');
const cream = hex('F9F5E9'), ink = hex('35574F');
function fill(png, x, y, width, height, rgb) {
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    png.data.set([...rgb, 255], ((y + dy) * png.width + x + dx) * 4);
  }
}

export function contactSheet(sprites, { tile = false } = {}) {
  if (!sprites.length) {
    const png = createPng(40, 40); fill(png, 0, 0, 40, 40, overall); return png;
  }
  const repeat = tile ? 3 : 1;
  const gap = 8, maxWidth = Math.max(...sprites.map(p => p.width)) * repeat;
  const columns = [maxWidth, maxWidth * 4, maxWidth * 4, maxWidth];
  const width = columns.reduce((a, b) => a + b, gap * 5);
  const height = sprites.reduce((sum, p) => sum + p.height * repeat * 4 + gap, gap);
  const sheet = createPng(width, height);
  fill(sheet, 0, 0, width, height, overall);
  let rowY = gap;
  for (const sprite of sprites) {
    let columnX = gap;
    for (let column = 0; column < 4; column++) {
      const scale = column === 1 || column === 2 ? 4 : 1;
      const w = sprite.width * repeat * scale, h = sprite.height * repeat * scale;
      const x = columnX + Math.floor((columns[column] - w) / 2);
      const y = rowY + Math.floor((sprite.height * repeat * 4 - h) / 2);
      fill(sheet, x, y, w, h, column === 2 ? cream : column === 3 ? wall : water);
      // Explicit integer replication: nearest-neighbor at 4x, no native canvas.
      for (let sy = 0; sy < sprite.height * repeat; sy++) for (let sx = 0; sx < sprite.width * repeat; sx++) {
        const i = ((sy % sprite.height) * sprite.width + sx % sprite.width) * 4, alpha = sprite.data[i + 3] / 255;
        if (!alpha) continue;
        const rgb = column === 2 ? ink : [...sprite.data.subarray(i, i + 3)];
        const bg = column === 2 ? cream : column === 3 ? wall : water;
        const blended = rgb.map((c, k) => Math.round(c * alpha + bg[k] * (1 - alpha)));
        fill(sheet, x + sx * scale, y + sy * scale, scale, scale, blended);
      }
      columnX += columns[column] + gap;
    }
    rowY += sprite.height * repeat * 4 + gap;
  }
  return sheet;
}
