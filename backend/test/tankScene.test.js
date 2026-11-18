import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTankScene, computeWarnings, validateSceneInput } from '../src/utils/tankScene.js';
import { suggestLayout } from '../src/utils/layout.js';
import Tank from '../src/models/Tank.js';
import Species from '../src/models/Species.js';

test('maps library IDs, populated documents, keys, render and tooltip metadata', () => {
  const species = { _id: 's', speciesKey: 'neon_tetra', slug: 'neon', commonName: 'Neon xanh', sciName: 'Paracheirodon innesi',
    tempRange: { min: 22, max: 26 }, phRange: { min: 5.5, max: 7 },
    render: { spriteKey: 'other', behavior: 'school', speed: 1.2, schoolMin: 8 } };
  const dto = buildTankScene({ tank: { _id: 't', volume: 65, equipment: [{ type: 'filter' }, 'light'] },
    livestock: [{ _id: 'l', speciesId: 's', name: 'Neon', quantity: 12 }], speciesById: new Map([['s', species]]),
    plants: [{ _id: 'p', plantId: 'library-p', quantity: 2 }], plantById: { 'library-p': { plantKey: 'java_fern', name: 'Dương xỉ' } } });
  assert.equal(dto.version, 1);
  assert.deepEqual(dto.tank.equipment, ['filter', 'light']);
  assert.deepEqual(dto.livestock[0], { id: 'l', speciesKey: 'neon_tetra', speciesSlug: 'neon', name: 'Neon', quantity: 12,
    variant: null, render: { canvas: 64, bodyPx: 38, swimZone: ['mid'], behavior: 'school', speed: 1.2, schoolMin: 8, spriteKey: 'other' },
    nameVi: 'Neon xanh', sciName: 'Paracheirodon innesi', tempRange: { min: 22, max: 26 }, phRange: { min: 5.5, max: 7 } });
  assert.equal(dto.plants[0].plantKey, 'java_fern');
  const populated = buildTankScene({ livestock: [{ speciesId: species }] });
  assert.equal(populated.livestock[0].speciesKey, 'neon_tetra');
});

test('fallback order and defaults with missing library references', () => {
  const dto = buildTankScene({ livestock: [
    { speciesId: { render: { spriteKey: 'betta' } } },
    { speciesId: { sciName: 'Corydoras panda', commonName: 'Chuột' } },
    { speciesId: null, name: 'Cá Đẹp' }, {},
  ], plants: [{ plantId: { render: { spriteKey: 'moss' } } }],
  hardscape: [{ type: 'rock' }, { type: 'driftwood' }, { type: 'decoration' }, { type: 'rock', spriteKey: 'seiryu_l' }] });
  assert.deepEqual(dto.livestock.map((fish) => fish.speciesKey), ['betta', 'corydoras_panda', 'ca_dep', 'unknown']);
  assert.deepEqual(dto.livestock[3].render, { canvas: 64, bodyPx: 38, swimZone: ['mid'], behavior: 'wander', speed: 1 });
  assert.deepEqual(dto.hardscape.map((item) => item.spriteKey), ['seiryu_m', 'driftwood_branch', 'seiryu_s', 'seiryu_l']);
  assert.equal(dto.plants[0].plantKey, 'moss');
  assert.equal(dto.water, null);
  assert.deepEqual(dto.care, { overdue: [], daysSinceWaterChange: null, lastFed: null });
  assert.deepEqual(dto.tank.lightSchedule, { on: '08:00', off: '18:00' });
  assert.deepEqual(dto.scene, { props: [], camera: { x: 0 } });
});

test('style inference preserves legacy layout fields and supports explicit styles', () => {
  const tank = { volume: 65 };
  const contents = { hardscape: [{ type: 'rock' }] };
  const suggestion = suggestLayout(tank, {}, contents);
  assert.equal(suggestion.style, 'Iwagumi');
  assert.equal(buildTankScene({ tank, ...contents }).tank.style, suggestion.styleKey);
  assert.equal(buildTankScene({ tank: { ...tank, shape: 'jar' } }).tank.style, 'balcony_jar');
  for (const style of ['nature', 'iwagumi', 'dutch', 'biotope_amazon', 'biotope_asia', 'stream', 'paludarium', 'balcony_jar', 'foam_box', 'lowtech']) {
    assert.equal(buildTankScene({ tank: { style } }).tank.style, style);
  }
});

test('filters orphan props by reference type without mutating input', () => {
  const tank = { scene: { props: [
    { refType: 'plant', refId: 'p', key: 'moss', x: 10, layer: 'back' },
    { refType: 'hardscape', refId: 'h', key: 'seiryu_m', x: 20, layer: 'mid' },
    { refType: 'plant', refId: 'h' }, { refType: 'plant', refId: 'deleted' }, { refType: 'fish', refId: 'p' },
  ], camera: { x: 7 } } };
  const before = JSON.stringify(tank);
  const dto = buildTankScene({ tank, plants: [{ _id: 'p' }], hardscape: [{ _id: 'h' }] });
  assert.equal(dto.scene.props.length, 2);
  assert.equal(dto.scene.camera.x, 7);
  assert.equal(JSON.stringify(tank), before);
});

test('selects latest water and care dates, excludes done and not-yet-due tasks', () => {
  const now = new Date('2026-11-18T08:00:00Z');
  const dto = buildTankScene({ now, waterLogs: [
    { date: '2026-11-17', temp: 25.5, pH: 6.8, no3: 15 }, { date: '2026-11-01', temp: 30 },
  ], careTasks: [
    { type: 'water_change', nextDue: '2026-11-17', lastDone: '2026-11-09T08:00:00Z' },
    { type: 'water_change', nextDue: '2026-11-01', lastDone: '2026-11-01' },
    { type: 'feeding', done: true, nextDue: '2026-11-01', lastDone: '2026-11-17T07:30:00Z' },
    { type: 'feeding', nextDue: '2026-11-19', lastDone: '2026-11-16' },
    { type: 'cleaning', nextDue: now }, { type: 'other', nextDue: 'bad' },
  ] });
  assert.deepEqual(dto.water, { temp: 25.5, ph: 6.8, nitrate: 15, measuredAt: '2026-11-17T00:00:00.000Z' });
  assert.deepEqual(dto.care, { overdue: ['water_change'], daysSinceWaterChange: 9, lastFed: '2026-11-17T07:30:00.000Z' });
});

test('all warning codes use resolved species metadata and Vietnamese messages', () => {
  const dto = buildTankScene({ tank: { style: 'dutch', volume: 5 }, hardscape: [{ type: 'rock' }],
    waterLogs: [{ date: '2026-11-17', temp: 30, pH: 8 }], livestock: [
      { speciesId: { speciesKey: 'tiger_barb', adultSize: 7 }, quantity: 2 },
      { name: 'Betta', speciesId: { speciesKey: 'betta', tempRange: { min: 22, max: 26 }, phRange: { min: 6, max: 7 } } },
      { name: 'Neon', quantity: 3, speciesId: { speciesKey: 'neon_tetra', render: { behavior: 'school' } } },
    ] });
  assert.deepEqual(new Set(dto.warnings.map((warning) => warning.code)), new Set([
    'FIN_NIPPER', 'TEMP_MISMATCH', 'PH_MISMATCH', 'OVERSTOCK', 'SCHOOL_TOO_SMALL', 'STYLE_NO_HARDSCAPE',
  ]));
  assert.deepEqual(dto.warnings.find((warning) => warning.code === 'FIN_NIPPER').species, ['tiger_barb', 'betta']);
  assert.ok(dto.warnings.every((warning) => warning.message.length > 0));
});

test('warning boundaries, split schools and absent water produce no false positives', () => {
  const fish = { speciesKey: 'neon_tetra', quantity: 3, adultSize: 2, tempRange: { min: 22, max: 26 },
    phRange: { min: 6, max: 7 }, render: { behavior: 'school', schoolMin: 6 } };
  const args = { tank: { volume: 12, style: 'nature' }, livestock: [fish, { ...fish }], water: { temp: 22, ph: 7 } };
  assert.deepEqual(computeWarnings(args), []);
  assert.deepEqual(computeWarnings({ ...args, water: null }), []);
  assert.equal(fish.quantity, 3);
  assert.equal(computeWarnings({ ...args, livestock: [{ ...fish, quantity: 5 }] })[0].code, 'SCHOOL_TOO_SMALL');
  for (const key of ['betta', 'angelfish', 'guppy']) {
    assert.ok(computeWarnings({ tank: { volume: 100 }, livestock: [
      { speciesKey: 'tiger_barb', quantity: 1 }, { speciesKey: key, quantity: 1 },
    ] }).some((warning) => warning.code === 'FIN_NIPPER'));
  }
});

const valid = () => ({ props: [{ refType: 'plant', refId: 'p', key: 'java_fern', x: -2000, y: 4000, layer: 'back', flip: false }], camera: { x: 0 } });
test('scene validation accepts boundaries, optional y/flip and strips unknown fields', () => {
  const input = valid();
  input.extra = 'ignored'; input.props[0].extra = 'ignored';
  const result = validateSceneInput(input);
  assert.deepEqual(result, valid());
  delete input.props[0].y; delete input.props[0].flip;
  assert.equal(validateSceneInput(input).props[0].flip, false);
  assert.equal(validateSceneInput({ props: Array.from({ length: 200 }, () => valid().props[0]), camera: { x: 4000 } }).props.length, 200);
});

test('scene validation rejects malformed bodies, props, coordinates, keys and camera', () => {
  for (const body of [null, [], {}, { props: [], camera: null }, { props: [], camera: {} },
    { props: Array(201).fill(valid().props[0]), camera: { x: 0 } }]) {
    assert.throws(() => validateSceneInput(body), TypeError);
  }
  for (const patch of [{ refType: 'fish' }, { refId: '' }, { refId: 1 }, { key: 'Bad-key' }, { key: '' },
    { key: 'a'.repeat(41) }, { key: 'java_fern\n' }, { x: NaN }, { x: Infinity }, { x: '2' }, { x: -2001 },
    { x: 4001 }, { y: null }, { y: -Infinity }, { y: 4001 }, { layer: 'middle' }, { flip: 1 }]) {
    const body = valid(); Object.assign(body.props[0], patch);
    assert.throws(() => validateSceneInput(body), TypeError, JSON.stringify(patch));
  }
  for (const x of [NaN, Infinity, null, '0', -2001, 4001]) {
    assert.throws(() => validateSceneInput({ props: [], camera: { x } }), TypeError);
  }
  assert.throws(() => validateSceneInput({ props: [null], camera: { x: 0 } }), TypeError);
});

test('model defaults and sparse species keys work without MongoDB', async () => {
  const tank = new Tank({ name: 'Test', userId: '000000000000000000000001' });
  await tank.validate();
  assert.equal(tank.style, null);
  assert.equal(tank.shape, 'rect');
  const dto = buildTankScene({ tank });
  assert.deepEqual(JSON.parse(JSON.stringify(dto.scene)), { props: [], camera: { x: 0 } });
  assert.equal(Species.schema.path('speciesKey').options.sparse, true);
  const fish = new Species({ commonName: 'Test' });
  assert.equal(buildTankScene({ livestock: [{ speciesId: fish }] }).livestock[0].render.swimZone[0], 'mid');
  fish.speciesKey = 'bad-key';
  await assert.rejects(fish.validate());
});
