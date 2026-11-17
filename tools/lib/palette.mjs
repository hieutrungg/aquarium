import { readFile } from 'node:fs/promises';

export function parsePalette(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.shift()?.trim() !== 'GIMP Palette') throw new Error('Not a GIMP .gpl palette');
  const colors = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || /^\s*(#|Name:|Columns:)/.test(line)) continue;
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?\s*$/);
    if (!match || match.slice(1, 4).some(v => Number(v) > 255)) {
      throw new Error(`Invalid GPL color at line ${index + 2}`);
    }
    colors.push({ r: +match[1], g: +match[2], b: +match[3], name: (match[4] ?? '').trim() });
  }
  if (!colors.length) throw new Error('Palette contains no colors');
  return colors;
}

// Redmean: perceptual RGB distance, without a color-management dependency.
export function distance(a, b) {
  const mean = (a.r + b.r) / 2;
  return (2 + mean / 256) * (a.r - b.r) ** 2 +
    4 * (a.g - b.g) ** 2 + (2 + (255 - mean) / 256) * (a.b - b.b) ** 2;
}

export function nearest(rgb, colors) {
  if (!colors?.length) throw new Error('nearest() needs a non-empty palette');
  let best = colors[0], score = Infinity;
  for (const color of colors) {
    const d = distance(rgb, color);
    if (d < score) { best = color; score = d; }
  }
  return best;
}

export async function readPalette(path) {
  const colors = parsePalette(await readFile(path, 'utf8'));
  // Still an array of {r,g,b,name}; also supports palette.nearest(rgb).
  Object.defineProperty(colors, 'nearest', { value: rgb => nearest(rgb, colors) });
  return colors;
}
