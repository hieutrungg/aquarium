import assert from 'node:assert/strict';
import test from 'node:test';
import { canFeed, fetchTankScene, findFeedingTask, TANK_STYLES } from './tankSceneActions.js';

test('feeding selects an unfinished task with an id, never another care type', () => {
  const pending = { _id: 'feed-2', type: 'feeding', done: false };
  const tasks = [
    { _id: 'water', type: 'water_change', done: false },
    { _id: 'feed-1', type: 'feeding', done: true },
    { type: 'feeding', done: false },
    pending,
  ];
  assert.equal(findFeedingTask(tasks), pending);
  assert.equal(findFeedingTask(), undefined);
  assert.equal(findFeedingTask(tasks.slice(0, 3)), undefined);
  assert.equal(findFeedingTask([{ id: 'legacy-id', type: 'feeding' }]).id, 'legacy-id');
});

test('feeding throttle accepts the first attempt and the exact 30-second boundary', () => {
  assert.equal(canFeed(0, null), true);
  assert.equal(canFeed(0, 0), false);
  assert.equal(canFeed(29_999, 0), false);
  assert.equal(canFeed(30_000, 0), true);
  assert.equal(canFeed(60_000, 30_000), true);
  assert.equal(canFeed(99, 100), false);
});

test('all ten contract styles have distinct Vietnamese labels', () => {
  assert.deepEqual(Object.keys(TANK_STYLES), [
    'nature', 'iwagumi', 'dutch', 'biotope_amazon', 'biotope_asia',
    'stream', 'paludarium', 'balcony_jar', 'foam_box', 'lowtech',
  ]);
  assert.equal(new Set(Object.values(TANK_STYLES)).size, 10);
  assert.equal(TANK_STYLES.dutch, 'Hà Lan');
  assert.equal(TANK_STYLES.biotope_asia, 'Biotope châu Á');
  assert.equal(TANK_STYLES.foam_box, 'Thùng xốp');
});

test('scene endpoint forwards the DTO unchanged without reading the legacy tank', async () => {
  const dto = { version: 1, tank: { id: 'a', style: 'dutch' }, warnings: [] };
  const signal = new AbortController().signal;
  const api = { get: async (path, options) => {
    assert.equal(path, '/tanks/a/scene');
    assert.equal(options.signal, signal);
    return { data: dto };
  } };
  assert.equal(await fetchTankScene(api, 'a', () => assert.fail('unexpected fallback'), signal), dto);
});

test('404 scene endpoint falls back to the existing tank adapter', async () => {
  const api = { get: async () => { throw { response: { status: 404 } }; } };
  let reads = 0;
  const dto = await fetchTankScene(api, 'a', async () => {
    reads++;
    return { tank: { _id: 'a', name: 'Bể cũ', style: 'stream' } };
  });
  assert.equal(reads, 1);
  assert.equal(dto.tank.name, 'Bể cũ');
  assert.equal(dto.tank.style, 'stream');
});

test('network, auth and server failures never activate fallback', async () => {
  for (const error of [new Error('offline'), { response: { status: 401 } }, { response: { status: 403 } }, { response: { status: 500 } }]) {
    await assert.rejects(fetchTankScene({ get: async () => { throw error; } }, 'a',
      () => assert.fail('unexpected fallback')), (cause) => cause === error);
  }
});

test('legacy tank failure propagates after a missing scene endpoint', async () => {
  const failure = new Error('tank missing');
  await assert.rejects(fetchTankScene({ get: async () => { throw { response: { status: 404 } }; } }, 'a',
    async () => { throw failure; }), (error) => error === failure);
});
