import { suggestLayout } from './layout.js';

const id = (value) => value == null ? null : String(value._id ?? value.id ?? value);
const slug = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const plain = (value) => value?.toObject ? value.toObject() : (value || {});
const resolve = (reference, lookup) => {
  const found = lookup instanceof Map ? lookup.get(id(reference)) : lookup?.[id(reference)];
  return plain(found || (reference && typeof reference === 'object' ? reference : {}));
};
const time = (value) => value == null ? NaN : new Date(value).getTime();
const iso = (value) => Number.isFinite(time(value)) ? new Date(value).toISOString() : null;
const latest = (items, field) => items.reduce((best, item) =>
  Number.isFinite(time(item[field])) && (!best || time(item[field]) > time(best[field])) ? item : best, null);
const range = (value) => value ? { min: value.min ?? null, max: value.max ?? null } : null;

// Accept only the scene contract; return a fresh, whitelisted value for persistence.
// Invalid input throws TypeError so callers can translate it into HTTP 400.
export function validateSceneInput(input) {
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const coordinate = (value) => typeof value === 'number' && Number.isFinite(value) && value >= -2000 && value <= 4000;
  const invalid = () => { throw new TypeError('Bố cục bể không hợp lệ'); };
  if (!object(input) || !Array.isArray(input.props) || input.props.length > 200
      || !object(input.camera) || !coordinate(input.camera.x)) invalid();
  const props = input.props.map((prop) => {
    if (!object(prop) || !['plant', 'hardscape'].includes(prop.refType)
        || typeof prop.refId !== 'string' || !prop.refId.trim()
        || typeof prop.key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(prop.key)
        || !coordinate(prop.x) || (prop.y !== undefined && !coordinate(prop.y))
        || !['back', 'mid', 'front'].includes(prop.layer)
        || (prop.flip !== undefined && typeof prop.flip !== 'boolean')) invalid();
    return {
      refType: prop.refType, refId: prop.refId, key: prop.key, x: prop.x,
      ...(prop.y !== undefined ? { y: prop.y } : {}), layer: prop.layer, flip: prop.flip ?? false,
    };
  });
  return { props, camera: { x: input.camera.x } };
}

// livestock contains resolved species metadata (including adultSize) at this boundary.
export function computeWarnings({ tank = {}, livestock = [], hardscape = [], water = null } = {}) {
  const warnings = [];
  const add = (code, species, message) => warnings.push({ code, species, message });
  const present = new Set(livestock.filter((fish) => fish.quantity > 0).map((fish) => fish.speciesKey));
  if (present.has('tiger_barb')) {
    for (const key of ['betta', 'angelfish', 'guppy']) {
      if (present.has(key)) add('FIN_NIPPER', ['tiger_barb', key], 'Tứ vân có thể rỉa vây cá nuôi chung.');
    }
  }
  // Group separate livestock entries of the same species for schooling checks.
  const groups = new Map();
  for (const fish of livestock) {
    if (!(fish.quantity > 0)) continue;
    const existing = groups.get(fish.speciesKey);
    if (existing) existing.quantity += fish.quantity;
    else groups.set(fish.speciesKey, { ...fish });
  }
  for (const fish of groups.values()) {
    const outside = (value, limits) => typeof value === 'number' && Number.isFinite(value) && limits
      && ((limits.min != null && value < limits.min) || (limits.max != null && value > limits.max));
    if (outside(water?.temp, fish.tempRange)) add('TEMP_MISMATCH', [fish.speciesKey], `Nhiệt độ chưa phù hợp với ${fish.name}.`);
    if (outside(water?.ph, fish.phRange)) add('PH_MISMATCH', [fish.speciesKey], `pH chưa phù hợp với ${fish.name}.`);
    if (fish.render?.behavior === 'school' && fish.quantity < (fish.render.schoolMin ?? 6)) {
      add('SCHOOL_TOO_SMALL', [fish.speciesKey], `Đàn ${fish.name} còn quá ít cá.`);
    }
  }
  const total = livestock.reduce((sum, fish) => sum + (fish.adultSize || 0) * fish.quantity, 0);
  if (total > (tank.volume || 0)) add('OVERSTOCK', [...present], 'Bể đang nuôi quá nhiều cá so với dung tích.');
  if (tank.style === 'dutch' && hardscape.length) add('STYLE_NO_HARDSCAPE', [], 'Bể Hà Lan nên bố trí cây, không dùng đá hoặc lũa.');
  return warnings;
}

export function buildTankScene({ tank = {}, livestock = [], plants = [], hardscape = [], waterLogs = [],
  careTasks = [], speciesById = {}, plantById = {}, now = Date.now() } = {}) {
  tank = plain(tank);
  const fishWithMetadata = livestock.map((entry) => {
    const item = plain(entry);
    const species = resolve(item.speciesId, speciesById);
    const render = Object.fromEntries(Object.entries(plain(species.render)).filter(([, value]) => value != null));
    return {
      id: id(item._id ?? item.id),
      speciesKey: species.speciesKey || render.spriteKey || slug(species.sciName || species.commonName || item.name) || 'unknown',
      speciesSlug: species.slug ?? null,
      name: item.name || species.commonName || 'Cá', quantity: item.quantity ?? 1, variant: item.variant ?? null,
      render: { canvas: 64, bodyPx: 38, swimZone: ['mid'], behavior: 'wander', speed: 1, ...render },
      nameVi: species.commonName || item.name || 'Cá', sciName: species.sciName ?? null,
      tempRange: range(species.tempRange), phRange: range(species.phRange), adultSize: species.adultSize ?? 0,
    };
  });
  const mappedPlants = plants.map((entry) => {
    const item = plain(entry);
    const plant = resolve(item.plantId, plantById);
    return { id: id(item._id ?? item.id), plantKey: plant.plantKey || plant.render?.spriteKey || item.plantKey
      || slug(plant.sciName || plant.name || item.name) || 'unknown', name: item.name || plant.name || 'Cây',
    position: item.position || plant.position || 'midground', quantity: item.quantity ?? 1 };
  });
  const mappedHardscape = hardscape.map((item) => ({ id: id(item._id ?? item.id), type: item.type,
    spriteKey: item.spriteKey || ({ rock: 'seiryu_m', driftwood: 'driftwood_branch' }[item.type] || 'seiryu_s'),
    name: item.name || 'Vật liệu', quantity: item.quantity ?? 1 }));
  const newestWater = latest(waterLogs, 'date');
  const water = newestWater ? { temp: newestWater.temp ?? null, ph: newestWater.pH ?? newestWater.ph ?? null,
    nitrate: newestWater.no3 ?? newestWater.nitrate ?? null, measuredAt: iso(newestWater.date) } : null;
  const lastWaterChange = latest(careTasks.filter((task) => task.type === 'water_change'), 'lastDone');
  const lastFeeding = latest(careTasks.filter((task) => task.type === 'feeding'), 'lastDone');
  const mappedTank = { id: id(tank._id ?? tank.id), name: tank.name || 'Bể cá',
    style: tank.style || suggestLayout(tank, {}, { plants, hardscape, livestock }).styleKey,
    shape: tank.shape || 'rect', dimensions: { length: tank.dimensions?.length ?? 0,
      width: tank.dimensions?.width ?? 0, height: tank.dimensions?.height ?? 0 }, volume: tank.volume ?? 0,
    equipment: (tank.equipment || []).map((item) => typeof item === 'string' ? item : item.type),
    lightSchedule: { on: tank.lightSchedule?.on ?? '08:00', off: tank.lightSchedule?.off ?? '18:00' } };
  const refs = { plant: new Set(mappedPlants.map((item) => item.id)), hardscape: new Set(mappedHardscape.map((item) => item.id)) };
  const props = (tank.scene?.props || []).filter((prop) => prop && refs[prop.refType]?.has(id(prop.refId)))
    .map((prop) => ({ ...prop, refId: id(prop.refId) }));
  return {
    version: 1, tank: mappedTank, livestock: fishWithMetadata.map(({ adultSize, ...fish }) => fish),
    plants: mappedPlants, hardscape: mappedHardscape, water,
    care: {
      overdue: [...new Set(careTasks.filter((task) => !task.done && time(task.nextDue) < time(now)).map((task) => task.type))],
      daysSinceWaterChange: lastWaterChange ? Math.max(0, Math.floor((time(now) - time(lastWaterChange.lastDone)) / 86400000)) : null,
      lastFed: iso(lastFeeding?.lastDone),
    },
    scene: { props, camera: { x: tank.scene?.camera?.x ?? 0 } },
    warnings: computeWarnings({ tank: mappedTank, livestock: fishWithMetadata, hardscape: mappedHardscape, water }),
  };
}
