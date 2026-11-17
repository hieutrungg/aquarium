#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { args, integer, required, defaultPalette } from '../lib/cli.mjs';
import { readPalette } from '../lib/palette.mjs';
import { readPng, writePng, writeJson } from '../lib/png.mjs';
import { inspectSprite, contactSheet } from '../lib/qa.mjs';

const help = `Check sprite palette, binary alpha, color count, padding and canvas.
Usage: node sprite-qa/index.mjs --dir <sprites> --report <out.json> --sheet <contact.png> [options]
  --palette <gpl>   GIMP palette (default: art/palette/aquaverse.gpl in this repo)
  --max-colors <n>  Maximum visible colors (default: 16)
  --padding <n>     Minimum transparent pixels on each side (default: 4)
  --help, -h        Show this help
Scans PNGs recursively in sorted order. Contact sheet columns:
1x water, 4x water, 4x silhouette on cream, 1x wall. Gap: 8px.
Transparent RGB is ignored. Empty directories/sprites fail. Exit 1: any FAIL or error.
`;
async function collect(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile() && /\.png$/i.test(entry.name)) files.push(path);
  }
  return files.sort();
}

try {
  const values = args(Object.fromEntries(['dir', 'palette', 'max-colors', 'padding', 'report', 'sheet'].map(k => [k, { type: 'string' }])));
  if (values.help) console.log(help);
  else {
    required(values, ['dir', 'report', 'sheet']);
    if (resolve(values.report) === resolve(values.sheet)) throw new Error('--report and --sheet must differ');
    const options = { maxColors: integer(values['max-colors'] ?? 16, 'max-colors', 1, 256), padding: integer(values.padding ?? 4, 'padding', 0, 1024) };
    const palette = await readPalette(values.palette ?? defaultPalette);
    // Exclude our own generated sheet when QA is run again in the same directory.
    const paths = (await collect(values.dir)).filter(p => resolve(p).toLowerCase() !== resolve(values.sheet).toLowerCase());
    if (paths.some(p => resolve(p).toLowerCase() === resolve(values.report).toLowerCase())) throw new Error('--report must not overwrite an input PNG');
    const files = [], sprites = [];
    for (const path of paths) {
      const file = relative(values.dir, path).replaceAll('\\', '/');
      try {
        const png = await readPng(path);
        files.push({ file, sheetRow: sprites.length, ...inspectSprite(png, palette, options) });
        sprites.push(png);
      } catch (error) {
        files.push({ file, sheetRow: null, status: 'FAIL', error: error.message,
          checks: Object.fromEntries(['palette', 'alpha', 'colors', 'padding', 'canvas'].map(k => [k, { status: 'FAIL', reason: 'Cannot read PNG' }])) });
      }
    }
    const passed = files.filter(f => f.status === 'PASS').length;
    const report = { status: paths.length > 0 && passed === files.length ? 'PASS' : 'FAIL',
      summary: { total: files.length, passed, failed: files.length - passed },
      options, ...(paths.length ? {} : { errors: ['No PNG sprites found'] }), files };
    await writePng(values.sheet, contactSheet(sprites));
    await writeJson(values.report, report);
    console.log(JSON.stringify(report));
    if (report.status === 'FAIL') process.exitCode = 1;
  }
} catch (error) {
  console.error(`sprite-qa: ${error.message}`);
  process.exitCode = 1;
}
