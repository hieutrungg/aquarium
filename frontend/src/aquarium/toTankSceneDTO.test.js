import assert from 'node:assert/strict';
import test from 'node:test';
import { toTankSceneDTO } from './toTankSceneDTO.js';

test('adapts current API fields without mutating or forwarding private data', () => {
  const data = {
    tank: { _id: 'tank-1', name: 'Bể phòng khách', userId: 'private', dimensions: { length: 60, height: 36 }, equipment: [{ type: 'filter', name: 'Lọc' }] },
    livestock: [{ name: 'Cá Bảy Màu Đỏ', quantity: 8 }],
    plants: [{ name: 'Dương xỉ', quantity: 2, position: 'midground' }],
    waterLogs: [
      { date: '2026-11-10T08:00:00Z', temp: 24, pH: 7, no3: 5 },
      { date: '2026-11-16T08:00:00Z', temp: 25.5, pH: 6.8, no3: 15 },
    ],
    careTasks: [
      { type: 'water_change', done: false, nextDue: '2026-11-16T00:00:00Z', lastDone: '2026-11-08T08:00:00Z' },
      { type: 'water_change', done: false, nextDue: '2026-11-15T00:00:00Z' },
      { type: 'cleaning', done: true, nextDue: '2026-11-15T00:00:00Z' },
      { type: 'feeding', done: false, nextDue: '2026-11-18T00:00:00Z', lastDone: '2026-11-17T07:30:00Z' },
    ],
  };
  const before = structuredClone(data);
  const dto = toTankSceneDTO(data, Date.parse('2026-11-17T08:00:00Z'));
  assert.equal(dto.tank.style, 'nature');
  assert.equal(dto.tank.id, 'tank-1');
  assert.equal(dto.tank.userId, undefined);
  assert.deepEqual(dto.tank.equipment, ['filter']);
  assert.equal(dto.livestock[0].speciesKey, 'ca_bay_mau_do');
  assert.deepEqual(dto.livestock[0].render, { canvas: 64, bodyPx: 38, swimZone: ['mid'], behavior: 'wander', speed: 1 });
  assert.equal(dto.plants[0].plantKey, 'duong_xi');
  assert.deepEqual(dto.water, { temp: 25.5, ph: 6.8, nitrate: 15, measuredAt: '2026-11-16T08:00:00Z' });
  assert.deepEqual(dto.care, { overdue: ['water_change'], daysSinceWaterChange: 9, lastFed: '2026-11-17T07:30:00Z' });
  assert.deepEqual(data, before);
});

test('keeps explicit scene metadata and handles empty API collections', () => {
  const dto = toTankSceneDTO({
    tank: { style: 'dutch', scene: { props: [{ x: 3 }], camera: { x: 8 } } },
    livestock: [{ nameEn: 'Neon Tetra', quantity: 12, render: { speed: 0.5 } }, { name: 'Betta', speciesKey: 'betta_blue', quantity: 0, render: { swimZone: ['top'] } }],
  }, 0);
  assert.equal(dto.tank.style, 'dutch');
  assert.equal(dto.livestock[0].speciesKey, 'neon_tetra');
  assert.equal(dto.livestock[0].render.speed, 0.5);
  assert.equal(dto.livestock[1].speciesKey, 'betta_blue');
  assert.equal(dto.livestock[1].quantity, 0);
  assert.deepEqual(dto.scene.camera, { x: 8 });
  assert.deepEqual(toTankSceneDTO({}, 0).care.overdue, []);
  assert.equal(toTankSceneDTO({}, 0).water.measuredAt, null);
});
