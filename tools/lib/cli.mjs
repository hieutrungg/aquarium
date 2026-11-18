import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const defaultPalette = fileURLToPath(new URL('../../art/palette/aquaverse.gpl', import.meta.url));
export function args(options, argv = process.argv.slice(2)) {
  return parseArgs({ args: argv, options: { ...options, help: { type: 'boolean', short: 'h' } }, strict: true }).values;
}
export function integer(value, name, min = 1, max = 16384) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(+value) || +value < min || +value > max) {
    throw new Error(`--${name} must be an integer in ${min}..${max}`);
  }
  return +value;
}
export function required(values, names) {
  for (const name of names) if (!values[name]) throw new Error(`Missing --${name}; use --help`);
}

export function dimensions(value, name = 'canvas', allowSquare = true) {
  const match = (allowSquare ? /^(\d+)(?:x(\d+))?$/i : /^(\d+)x(\d+)$/i).exec(String(value));
  if (!match) throw new Error(`--${name} must be ${allowSquare ? 'a size or ' : ''}WxH`);
  return { width: integer(match[1], name, 1, 1024), height: integer(match[2] ?? match[1], name, 1, 1024) };
}

export function anchorOption(value = 'center') {
  if (!['center', 'bottom'].includes(value)) throw new Error('--anchor must be center or bottom');
  return value;
}
