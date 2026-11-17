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
