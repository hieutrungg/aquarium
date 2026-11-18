import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFit, buildCatalog } from '../src/utils/catalogFit.js';

const fish = { speciesKey: 'betta', adultSize: 7, minTankSize: 20,
  tempRange: { min: 24, max: 28 }, phRange: { min: 6.5, max: 7.5 }, tags: ['style:lowtech'] };
const context = { tank: { volume: 100, style: 'lowtech' }, water: { temp: 26, pH: 7 }, livestock: [] };

test('no tank context means null fit; compatible tank scores 100', () => {
  assert.equal(catalogFit(fish), null);
  assert.deepEqual(catalogFit(fish, context), { score: 100, reasons: [] });
});

for (const [label, change, expected] of [
  ['temperature below', { water: { temp: 23 } }, 'Nhiệt độ'],
  ['temperature above', { water: { temp: 29 } }, 'Nhiệt độ'],
  ['pH below', { water: { pH: 6 } }, 'pH'],
  ['pH above, scene spelling', { water: { ph: 8 } }, 'pH'],
  ['small volume', { tank: { ...context.tank, volume: 19 } }, 'Thể tích'],
  ['style mismatch', { tank: { ...context.tank, style: 'dutch' } }, 'phong cách'],
  ['fin nipper', { livestock: [{ speciesKey: 'tiger_barb', adultSize: 7, quantity: 1 }] }, 'cắn vây'],
  ['overstock after addition', { livestock: [{ speciesKey: 'neon_tetra', adultSize: 4, quantity: 24 }] }, 'sức chứa'],
]) {
  test(`deducts for ${label}`, () => {
    const fit = catalogFit(fish, { ...context, ...change });
    assert.ok(fit.score < 100);
    assert.equal(fit.reasons.length, 1);
    assert.ok(fit.reasons[0].includes(expected));
  });
}

test('fin nipper warning applies in both addition directions; ignores empty entries', () => {
  const barb = { speciesKey: 'tiger_barb', adultSize: 7 };
  for (const key of ['betta', 'angelfish', 'guppy']) {
    const livestock = [{ speciesKey: key, adultSize: 5, quantity: 1 }];
    assert.ok(catalogFit(barb, { ...context, livestock }).reasons.some((r) => r.includes('cắn vây')));
  }
  assert.equal(catalogFit(barb, { ...context, livestock: [{ speciesKey: 'betta', quantity: 0 }] }).score, 100);
});

test('inclusive limits, unknown water and missing volume incur no penalties', () => {
  for (const water of [null, {}, { temp: 24, pH: 6.5 }, { temp: 28, pH: 7.5 }]) {
    assert.equal(catalogFit(fish, { ...context, water }).score, 100);
  }
  assert.equal(catalogFit(fish, { tank: {} }).score, 100);
});

test('penalties accumulate, clamp at zero, and do not mutate inputs', () => {
  const ctx = { tank: { volume: 1, style: 'dutch' }, water: { temp: 10, pH: 9 },
    livestock: [{ speciesKey: 'tiger_barb', quantity: 2, adultSize: 7 }] };
  const before = JSON.stringify({ fish, ctx });
  const fit = catalogFit(fish, ctx);
  assert.equal(fit.score, 0);
  assert.equal(fit.reasons.length, 6);
  assert.equal(JSON.stringify({ fish, ctx }), before);
});

test('plants use style fit without fish load or compatibility penalties', () => {
  const plant = { plantKey: 'frogbit', tags: ['style:lowtech'] };
  assert.equal(catalogFit(plant, { ...context, tank: { volume: 0, style: 'lowtech' } }).score, 100);
  assert.equal(catalogFit(plant, { ...context, tank: { style: 'dutch' } }).score, 90);
});

test('catalog DTO whitelists fields and returns public null fits', () => {
  const dto = buildCatalog([{ ...fish, commonName: 'Betta', secret: 'hidden' }],
    [{ plantKey: 'frogbit', name: 'Bèo Nhật', tags: ['style:lowtech', 'style:lowtech', 'nổi'] }]);
  assert.equal(dto.species[0].name, 'Betta');
  assert.equal(dto.species[0].fit, null);
  assert.equal(dto.plants[0].fit, null);
  assert.deepEqual(dto.plants[0].styles, ['lowtech']);
  assert.equal('secret' in dto.species[0], false);
});
