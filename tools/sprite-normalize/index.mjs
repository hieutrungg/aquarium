#!/usr/bin/env node
import { resolve } from 'node:path';
import { args, integer, required, defaultPalette, dimensions, anchorOption } from '../lib/cli.mjs';
import { readPalette } from '../lib/palette.mjs';
import { readPng, writePng, writeJson } from '../lib/png.mjs';
import { normalize } from '../lib/normalize.mjs';

const help = `Normalize AI pixel-art PNGs to clean RGBA sprites or tiles.
Usage: node sprite-normalize/index.mjs --in <raw.png> --out <out.png> --canvas <n|WxH> [options]
  --cell auto|<n>   Detect cell (4..32px), or force a positive integer (default: auto)
  --target-w <n>    Set logical foreground width using a real-valued cell
  --target-h <n>    Set logical foreground height using a real-valued cell
  --anchor <mode>   center (default) or bottom; bottom has zero bottom padding
  --tile <n>        Sample full image to nxn; no background removal/crop/padding
  --palette <gpl>   GIMP palette (default: art/palette/aquaverse.gpl in this repo)
  --padding <n>     Minimum transparent pixels on EACH side (default: 4)
  --max-colors <n>  Maximum opaque colors (default: 16)
  --bg-tol <n>      Background per-channel tolerance, 0..255 (default: 24)
  --holes <n>       Also clear enclosed background islands of >= n raw pixels (plants/props; default 0 = off)
  --help, -h        Show this help
Writes <out.png>.json; stdout is a JSON summary. Exit 2: foreground does not fit.
--cell, --target-w, --target-h and --tile are mutually exclusive.
Tile mode does not require --canvas; if supplied, canvas is ignored.
`;
try {
  const values = args(Object.fromEntries(['in', 'out', 'canvas', 'cell', 'target-w', 'target-h', 'anchor', 'tile', 'palette', 'padding', 'max-colors', 'bg-tol', 'holes'].map(k => [k, { type: 'string' }])));
  if (values.help) console.log(help);
  else {
    required(values, values.tile === undefined ? ['in', 'out', 'canvas'] : ['in', 'out']);
    if (resolve(values.in) === resolve(values.out)) throw new Error('--in and --out must differ');
    if (['cell', 'target-w', 'target-h', 'tile'].filter(k => values[k] !== undefined).length > 1) {
      throw new Error('--cell, --target-w, --target-h and --tile are mutually exclusive');
    }
    const options = {
      ...(values.canvas === undefined ? {} : { canvas: dimensions(values.canvas) }),
      ...(values.cell === undefined ? {} : { cell: values.cell === 'auto' ? 'auto' : integer(values.cell, 'cell', 1, 1024) }),
      ...(values['target-w'] === undefined ? {} : { targetW: integer(values['target-w'], 'target-w', 1, 1024) }),
      ...(values['target-h'] === undefined ? {} : { targetH: integer(values['target-h'], 'target-h', 1, 1024) }),
      ...(values.tile === undefined ? {} : { tile: integer(values.tile, 'tile', 1, 1024) }),
      anchor: anchorOption(values.anchor),
      padding: integer(values.padding ?? 4, 'padding', 0, 1024),
      maxColors: integer(values['max-colors'] ?? 16, 'max-colors', 1, 256),
      bgTol: integer(values['bg-tol'] ?? 24, 'bg-tol', 0, 255),
      holes: integer(values.holes ?? 0, 'holes', 0, 1000000)
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
