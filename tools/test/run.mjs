import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readPalette, parsePalette, nearest, distance } from '../lib/palette.mjs';
import { createPng, readPng, writePng, pixel, rgbKey } from '../lib/png.mjs';
import { normalize } from '../lib/normalize.mjs';
import { inspectSprite, contactSheet } from '../lib/qa.mjs';

const tools = fileURLToPath(new URL('..', import.meta.url));
const outputRoot = resolve(tools, 'test/out');
await mkdir(outputRoot, { recursive: true });
const temp = await mkdtemp(join(outputRoot, 'run-'));
const palette = await readPalette(new URL('../../art/palette/aquaverse.gpl', import.meta.url));
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const color = name => { const c = palette.find(c => c.name.split(' ')[0] === name); assert(c, name); return c; };
const rgb = name => { const c = color(name); return [c.r, c.g, c.b, 255]; };
function cli(script, args, expected = 0) {
  const run = spawnSync(process.execPath, [join(tools, script, 'index.mjs'), ...args], { cwd: tools, encoding: 'utf8' });
  assert.ifError(run.error);
  assert.equal(run.status, expected, `${script}: ${run.stderr}\n${run.stdout}`);
  return run;
}
function original() {
  const png = createPng(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const body = ((x - 36.5) / 17) ** 2 + ((y - 31.5) / 10.5) ** 2 <= 1;
    const tail = x >= 10 && x <= 21 && Math.abs(y - 31.5) <= 2 + (21 - x) * 0.8;
    const fin = x >= 29 && x <= 39 && y >= 18 && y <= 45;
    if (!body && !tail && !fin) continue;
    let name = y < 30 ? 'neon_blue_1' : y < 34 ? 'neon_blue_2' : 'red_1';
    if (fin && !body) name = y < 32 ? 'neon_blue_0' : 'red_0';
    // Enclosed white eye: flood-fill must preserve this detail.
    if (x >= 46 && x <= 49 && y >= 27 && y <= 30) name = 'white';
    if (x === 48 && y === 28) name = 'soft_black';
    png.data.set(rgb(name), (y * 64 + x) * 4);
  }
  return png;
}
const reference = original();
function rawImage({ checker = false, cell = 16, offset = 3, gray = false } = {}) {
  const size = 64 * cell, png = createPng(size, size);
  let seed = 1837;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 13 - 6; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const lx = Math.floor((x - offset) / cell), ly = Math.floor((y - offset) / cell);
    const src = (ly * 64 + lx) * 4;
    const inside = lx >= 0 && ly >= 0 && lx < 64 && ly < 64 && reference.data[src + 3];
    // Deliberately unrelated checker period, so it cannot reveal the sprite grid.
    const bg = checker && (Math.floor(x / 23) + Math.floor(y / 23)) % 2 ? 211 : gray ? 225 : 255;
    const out = (y * size + x) * 4;
    const px = ((x - offset) % cell + cell) % cell, py = ((y - offset) % cell + cell) % cell;
    const border = px < 2 || px >= cell - 2 || py < 2 || py >= cell - 2;
    for (let k = 0; k < 3; k++) png.data[out + k] = Math.max(0, Math.min(255, (inside ? reference.data[src + k] : bg) + (border ? noise() : 0)));
    png.data[out + 3] = 255;
  }
  return png;
}
function compare(actual, expected = reference) {
  assert.equal(actual.width, 64); assert.equal(actual.height, 64);
  let match = 0, foregroundMatch = 0, visible = 0;
  for (let i = 0; i < expected.data.length; i += 4) {
    const same = actual.data.subarray(i, i + 4).equals(expected.data.subarray(i, i + 4));
    if (same) match++;
    if (expected.data[i + 3]) { visible++; if (same) foregroundMatch++; }
  }
  assert(match / 4096 >= 0.98, `Total pixel match: ${(match / 4096 * 100).toFixed(2)}%`);
  assert(foregroundMatch / visible >= 0.98, `Foreground match: ${(foregroundMatch / visible * 100).toFixed(2)}%`);
  return `${(match / 4096 * 100).toFixed(2)}% total, ${(foregroundMatch / visible * 100).toFixed(2)}% foreground`;
}

try {
  await test('GPL parser and perceptual nearest color', () => {
    assert.equal(palette.length, 44);
    assert.equal(nearest({ r: 63, g: 183, b: 233 }, palette), color('neon_blue_1'));
    assert.equal(palette.nearest(color('white')), color('white'));
    assert.equal(distance(color('ink'), color('ink')), 0);
    assert.throws(() => parsePalette('RGB\n1 2 3'), /GIMP/);
    assert.throws(() => parsePalette('GIMP Palette\n256 0 0 bad'), /line 2/);
  });
  for (const checker of [false, true]) await test(`1024x1024 shifted/noisy ${checker ? 'checkerboard' : 'white'} background, CLI`, async () => {
    const input = join(temp, `${checker ? 'checker' : 'white'}-raw.png`);
    const output = join(temp, 'sprites', `${checker ? 'checker' : 'white'}.png`);
    await writePng(input, rawImage({ checker }));
    const run = cli('sprite-normalize', ['--in', input, '--out', output, '--canvas', '64']);
    const summary = JSON.parse(run.stdout), sidecar = JSON.parse(await readFile(`${output}.json`, 'utf8'));
    assert.equal(summary.cell, 16);
    assert.deepEqual(summary.offset, { x: 3, y: 3 });
    assert.deepEqual(summary.bbox, { x: 10, y: 18, width: 44, height: 28 });
    assert.deepEqual(sidecar.pivot, { x: 32, y: 32 });
    assert.deepEqual(sidecar, { ...summary, pivot: sidecar.pivot });
    console.log(`  ${compare(await readPng(output))}`);
  });
  await test('gray background and other cell sizes/offsets', () => {
    for (const cell of [8, 12, 20, 24, 32]) {
      const result = normalize(rawImage({ gray: true, cell, offset: 3 }), palette);
      assert.equal(result.summary.cell, cell, `cell ${cell}`);
      assert.deepEqual(result.summary.offset, { x: 3, y: 3 });
      compare(result.output);
    }
  });
  await test('forced cell still detects both offsets', () => {
    const result = normalize(rawImage({ checker: true, offset: 5 }), palette, { cell: 16 });
    assert.deepEqual(result.summary.offset, { x: 5, y: 5 });
    compare(result.output);
  });
  await test('true alpha uses threshold 128, preserves white and ignores RGB beneath alpha=0', () => {
    const source = original(), expected = original();
    for (let i = 0; i < source.data.length; i += 4) {
      if (!source.data[i + 3]) source.data.set([63, 184, 232, 0], i);
      else if ((i / 4) % 5 === 0) source.data[i + 3] = 128;
    }
    // Interior pixel below threshold must become transparent.
    const hole = (32 * 64 + 35) * 4;
    source.data[hole + 3] = 127; expected.data.fill(0, hole, hole + 4);
    const result = normalize(source, palette, { cell: 1 });
    assert.deepEqual(result.output.data, expected.data);
  });
  await test('least-used colors merge to perceptually nearest surviving color', () => {
    const source = createPng(64, 64);
    source.data.set(rgb('neon_blue_1'), (31 * 64 + 30) * 4);
    source.data.set(rgb('neon_blue_1'), (31 * 64 + 31) * 4);
    source.data.set(rgb('red_1'), (32 * 64 + 30) * 4);
    source.data.set(rgb('red_1'), (32 * 64 + 31) * 4);
    source.data.set(rgb('neon_blue_2'), (31 * 64 + 32) * 4);
    const result = normalize(source, palette, { cell: 1, maxColors: 2 });
    assert.equal(result.summary.colors, 2);
    assert(result.summary.warnings.some(w => /Merged/.test(w)));
    const counts = new Map();
    for (let i = 0; i < result.output.data.length; i += 4) if (result.output.data[i + 3]) {
      const key = rgbKey(pixel(result.output.data, i)); counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    assert.equal(counts.get(rgbKey(color('neon_blue_1'))), 3);
    assert.equal(counts.get(rgbKey(color('red_1'))), 2);
  });
  await test('oversize exits 2 and writes no output', async () => {
    const output = join(temp, 'too-small.png');
    const run = cli('sprite-normalize', ['--in', join(temp, 'white-raw.png'), '--out', output, '--canvas', '32', '--cell', '16'], 2);
    assert.match(run.stderr, /does not fit/);
    await assert.rejects(readFile(output), { code: 'ENOENT' });
  });
  await test('QA PASS report, exact contact sheet colors, scales and repeatability', async () => {
    const dir = join(temp, 'sprites'), reportPath = join(temp, 'qa.json'), sheetPath = join(dir, 'contact.png');
    const run = () => cli('sprite-qa', ['--dir', dir, '--report', reportPath, '--sheet', sheetPath]);
    run(); run();
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.status, 'PASS'); assert.equal(report.files.length, 2);
    assert.deepEqual(report.summary, { total: 2, passed: 2, failed: 0 });
    const sheet = await readPng(sheetPath);
    assert.equal(sheet.width, 680); assert.equal(sheet.height, 536);
    const at = (x, y) => [...sheet.data.subarray((y * sheet.width + x) * 4, (y * sheet.width + x) * 4 + 4)];
    assert.deepEqual(at(0, 0), [234, 246, 242, 255]);
    assert.deepEqual(at(8, 104), [184, 225, 213, 255]);
    assert.deepEqual(at(344, 8), [249, 245, 233, 255]);
    assert.deepEqual(at(608, 104), [118, 181, 165, 255]);
    const source = await readPng(join(dir, report.files[0].file));
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      if (!source.data[i + 3]) continue;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
        assert.deepEqual(at(80 + x * 4 + dx, 8 + y * 4 + dy), [...source.data.subarray(i, i + 4)]);
        assert.deepEqual(at(344 + x * 4 + dx, 8 + y * 4 + dy), [53, 87, 79, 255]);
      }
    }
  });
  await test('QA detects all five violations, corrupt PNG, empty directory and nested files', async () => {
    const png = createPng(32, 32);
    png.data.set([1, 2, 3, 128], 0); png.data.set(rgb('red_1'), 4);
    const result = inspectSprite(png, palette, { maxColors: 1 });
    for (const name of ['palette', 'alpha', 'colors', 'padding', 'canvas']) assert.equal(result.checks[name].status, 'FAIL', name);
    const dir = join(temp, 'bad'), report = join(temp, 'bad.json'), sheet = join(temp, 'bad-contact.png');
    await mkdir(join(dir, 'nested'), { recursive: true });
    cli('sprite-qa', ['--dir', dir, '--report', report, '--sheet', sheet], 1);
    assert.match(await readFile(report, 'utf8'), /No PNG/);
    await writePng(join(dir, 'nested/bad.PNG'), png);
    await writeFile(join(dir, 'corrupt.png'), 'not a png');
    cli('sprite-qa', ['--dir', dir, '--report', report, '--sheet', sheet, '--max-colors', '1'], 1);
    const data = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(data.summary.failed, 2);
    assert.equal(data.files[0].sheetRow, null);
    assert.equal(data.files[1].file, 'nested/bad.PNG');
  });
  await test('96x96 canvas, exact padding boundary, empty sprite rejection, mixed sheet dimensions', () => {
    const png = createPng(96, 96);
    png.data.set(rgb('ink'), (4 * 96 + 4) * 4);
    png.data.set(rgb('ink'), (91 * 96 + 91) * 4);
    assert.equal(inspectSprite(png, palette).status, 'PASS');
    assert.equal(inspectSprite(png, palette, { padding: 5 }).checks.padding.status, 'FAIL');
    assert.equal(inspectSprite(createPng(64, 64), palette).status, 'FAIL');
    assert.throws(() => normalize(createPng(64, 64), palette, { cell: 1 }), /No foreground/);
    const mixed = contactSheet([reference, png]);
    assert.equal(mixed.width, 1000); assert.equal(mixed.height, 664);
  });
  await test('CLI help, required parameters and invalid numeric options', () => {
    for (const name of ['sprite-normalize', 'sprite-qa']) {
      assert.match(cli(name, ['--help']).stdout, /Usage:/);
      assert.match(cli(name, [], 1).stderr, /Missing --/);
    }
    assert.match(cli('sprite-normalize', ['--in', 'x', '--out', 'y', '--canvas', '64', '--cell', '0'], 1).stderr, /--cell/);
    assert.match(cli('sprite-qa', ['--dir', temp, '--report', 'x', '--sheet', 'y', '--padding', '-1'], 1).stderr, /--padding/);
  });
  console.log(`\n${passed} tests passed.`);
} finally {
  // Verify the resolved target before recursive cleanup on Windows.
  const target = resolve(temp);
  assert(target.startsWith(outputRoot + sep), 'Refusing cleanup outside test/out');
  await rm(target, { recursive: true, force: true });
}
