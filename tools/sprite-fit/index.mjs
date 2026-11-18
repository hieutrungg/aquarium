// Chuẩn hoá 2 lượt: lượt 1 đo bbox trên canvas lớn, lượt 2 xuất với canvas vừa khít (cạnh chẵn).
// Dùng khi tỉ lệ ảnh AI khác khung dự kiến (cây, đá, lũa).
// Usage: node sprite-fit/index.mjs --in raw.png --out out.png (--target-w N | --target-h N) [--anchor bottom|center] [--padding N] [--palette gpl]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const input = get('--in');
const output = get('--out');
const targetW = get('--target-w');
const targetH = get('--target-h');
const anchor = get('--anchor', 'bottom');
const padding = Number(get('--padding', '2'));
const holes = get('--holes');
const palette = get('--palette');
if (!input || !output || (!targetW && !targetH)) {
  console.error('Usage: node sprite-fit/index.mjs --in raw.png --out out.png (--target-w N | --target-h N) [--anchor bottom|center] [--padding N]');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const normalize = path.join(here, '..', 'sprite-normalize', 'index.mjs');
const base = ['--in', input, '--anchor', anchor, '--padding', String(padding),
  ...(targetW ? ['--target-w', targetW] : ['--target-h', targetH]),
  ...(palette ? ['--palette', palette] : []),
  ...(holes ? ['--holes', holes] : [])];

const run = (out, canvas) => JSON.parse(execFileSync(process.execPath, [normalize, ...base, '--out', out, '--canvas', canvas], { encoding: 'utf8' }));

const probePath = path.join(os.tmpdir(), `sprite-fit-probe-${process.pid}.png`);
const probe = run(probePath, '400x400');
for (const file of [probePath, `${probePath}.json`]) fs.rmSync(file, { force: true });
const even = (n) => n + (n % 2);
const width = even(probe.bbox.width + 2 * padding);
const height = even(probe.bbox.height + padding + (anchor === 'center' ? padding : 0));
const result = run(output, `${width}x${height}`);
console.log(JSON.stringify({ out: output, canvas: `${width}x${height}`, bbox: result.bbox, colors: result.colors }));
