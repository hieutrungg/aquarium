import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Species from '../src/models/Species.js';
import Plant from '../src/models/Plant.js';
import { species, plants, seedCatalog } from '../src/seed/seed.js';

test('seed contains exactly the 32 plan keys with matching render metadata', () => {
  const plan = readFileSync(new URL('../../plan.md', import.meta.url), 'utf8');
  const table = plan.split('### 5.3')[1].split('### 5.4')[0];
  const rows = [...table.matchAll(/^\| `([a-z_]+)` \|.*$/gm)];
  const keyed = species.filter((item) => item.speciesKey);
  assert.equal(keyed.length, 32);
  assert.equal(new Set(keyed.map((item) => item.speciesKey)).size, 32);
  assert.deepEqual(keyed.map((item) => item.speciesKey).sort(), rows.map((row) => row[1]).sort());
  for (const row of rows) {
    const fish = keyed.find((item) => item.speciesKey === row[1]);
    const columns = row[0].split('|');
    assert.equal(fish.render.spriteKey, fish.speciesKey);
    assert.equal(fish.render.canvas, Number(columns[4].replace(/\D/g, '')));
    assert.equal(fish.render.bodyPx, Number(columns[5].match(/\d+/)[0]));
    assert.ok(fish.render.schoolMin >= 1 && fish.render.speed > 0);
    assert.ok(fish.render.swimZone.every((zone) => ['top', 'mid', 'bottom'].includes(zone)));
    assert.equal(fish.category, 'fish');
    for (const field of ['commonName', 'sciName', 'difficulty', 'careLevel', 'temperament', 'diet', 'description']) {
      assert.ok(fish[field], `${fish.speciesKey}: ${field}`);
    }
    assert.ok(fish.adultSize > 0 && fish.minTankSize > 0);
    assert.ok(fish.tempRange.min < fish.tempRange.max && fish.phRange.min < fish.phRange.max);
    assert.ok(fish.tags.some((tag) => tag.startsWith('style:')));
    assert.equal(new Species(fish).validateSync(), undefined);
  }
  assert.ok(keyed.find((fish) => fish.speciesKey === 'white_cloud').tags.includes('cần xác nhận loài'));
  assert.ok(species.some((fish) => !fish.speciesKey && fish.category === 'shrimp'));
});

test('plant mapping contains all additions with valid enums and unique keys', () => {
  assert.equal(new Set(plants.map((plant) => plant.plantKey)).size, plants.length);
  for (const key of ['ludwigia_red', 'alternanthera', 'hygrophila', 'dwarf_sag', 'cryptocoryne', 'bucephalandra', 'hornwort', 'frogbit']) {
    assert.ok(plants.some((plant) => plant.plantKey === key));
  }
  for (const plant of plants) {
    assert.equal(new Plant(plant).validateSync(), undefined);
    assert.ok(plant.light && plant.co2 && plant.difficulty && plant.position);
    assert.ok(plant.tags.some((tag) => tag.startsWith('style:')));
  }
  assert.equal(plants.find((p) => p.plantKey === 'frogbit').position, 'floating');
  assert.equal(plants.find((p) => p.plantKey === 'bucephalandra').position, 'midground');
});

test('reseed upserts by stable keys and preserves unkeyed library records', async () => {
  const legacy = { _id: 'legacy', sciName: 'Otocinclus vittatus', commonName: 'Otto cũ' };
  const fishRecords = [legacy];
  const plantRecords = [{ _id: 'old-plant', name: 'Cây cũ' }];
  const model = (records, key) => ({ findOneAndUpdate(filter, update, options) {
    assert.equal(options.upsert, true);
    assert.equal(options.runValidators, true);
    const item = update.$set;
    if (item[key]) assert.deepEqual(filter, { [key]: item[key] });
    else assert.deepEqual(filter, { sciName: item.sciName, [key]: { $exists: false } });
    let found = records.find((record) => item[key] ? record[key] === item[key]
      : !record[key] && record.sciName === item.sciName);
    if (!found) {
      found = { _id: `id-${records.length}`, ...update.$setOnInsert };
      records.push(found);
    }
    Object.assign(found, item);
    return Promise.resolve(found);
  } });
  const fishModel = model(fishRecords, 'speciesKey');
  const plantModel = model(plantRecords, 'plantKey');
  await seedCatalog(fishModel, plantModel);
  const before = JSON.stringify({ fishRecords, plantRecords });
  await seedCatalog(fishModel, plantModel);
  assert.equal(JSON.stringify({ fishRecords, plantRecords }), before);
  assert.equal(fishRecords.length, species.length + 1);
  assert.equal(plantRecords.length, plants.length + 1);
  assert.deepEqual(fishRecords[0], legacy);
});
