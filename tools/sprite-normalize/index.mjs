#!/usr/bin/env node
import { resolve } from 'node:path';
import { args, integer, required, defaultPalette } from '../lib/cli.mjs';
import { readPalette } from '../lib/palette.mjs';
import { readPng, writePng, writeJson } from '../lib/png.mjs';
import { normalize } from '../lib/normalize.mjs';

const help = `Normalize AI pixel-art PNGs to clean, centered RGBA sprites.
Usage: node sprite-normalize/index.mjs --in <raw.png> --out <out.png> --canvas 64 [options]
  --cell auto|<n>   Detect cell (4..32px), or force a positive integer (default: auto)
  --palette <gpl>   GIMP palette (default: art/palette/aquaverse.gpl in this repo)
  --padding <n>     Minimum transparent pixels on EACH side (default: 4)
  --max-colors <n>  Maximum opaque colors (default: 16)
  --bg-tol <n>      Background per-channel tolerance, 0..255 (default: 24)
  --help, -h        Show this help
Writes <out.png>.json; stdout is a JSON summary. Exit 2: foreground does not fit.
`;
try {
  const values = args(Object.fromEntries(['in', 'out', 'canvas', 'cell', 'palette', 'padding', 'max-colors', 'bg-tol'].map(k => [k, { type: 'string' }])));
  if (values.help) console.log(help);
  else {
    required(values, ['in', 'out', 'canvas']);
    if (resolve(values.in) === resolve(values.out)) throw new Error('--in and --out must differ');
    const options = {
      canvas: integer(values.canvas, 'canvas', 1, 1024),
      cell: !values.cell || values.cell === 'auto' ? 'auto' : integer(values.cell, 'cell', 1, 1024),
      padding: integer(values.padding ?? 4, 'padding', 0, 1024),
      maxColors: integer(values['max-colors'] ?? 16, 'max-colors', 1, 256),
      bgTol: integer(values['bg-tol'] ?? 24, 'bg-tol', 0, 255)
    };
    const palette = await readPalette(values.palette ?? defaultPalette);
    const result = normalize(await readPng(values.in), palette, options);
    await writePng(values.out, result.output);
    await writeJson(`${values.out}.json`, { ...result.summary, pivot: result.pivot });
    console.log(JSON.stringify(result.summary));
  }
} catch (error) {
  console.error(`sprite-normalize: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
}
