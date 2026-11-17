import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

export const rgbKey = ({ r, g, b }) => (r << 16) | (g << 8) | b;
export const fromKey = key => ({ r: (key >>> 16) & 255, g: (key >>> 8) & 255, b: key & 255 });
export const pixel = (data, i) => ({ r: data[i], g: data[i + 1], b: data[i + 2] });
export const createPng = (width, height) => new PNG({ width, height });
export const readPng = async path => PNG.sync.read(await readFile(path), { checkCRC: true });
export async function writePng(path, png) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, PNG.sync.write(png, { colorType: 6 }));
}
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function bounds(png) {
  let left = png.width, top = png.height, right = -1, bottom = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (!png.data[(y * png.width + x) * 4 + 3]) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
