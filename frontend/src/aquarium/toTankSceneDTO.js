const slug = (name = '') => String(name)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const quantity = (value) => {
  const number = Number(value ?? 1);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 1;
};

const latestDate = (items, field) => items.reduce((latest, item) => {
  const date = item[field];
  return date && (!latest || Date.parse(date) > Date.parse(latest)) ? date : latest;
}, null);

// `now` is explicit/replaceable so this adapter can also produce deterministic snapshots.
export function toTankSceneDTO(data = {}, now = Date.now()) {
  const { tank = {}, livestock = [], plants = [], hardscape = [], waterLogs = [], careTasks = [] } = data;
  const newestWater = waterLogs.reduce((latest, log) => (
    !latest || Date.parse(log.date) > Date.parse(latest.date) ? log : latest
  ), null);
  const lastWaterChange = latestDate(careTasks.filter((task) => task.type === 'water_change'), 'lastDone');
  const lastFed = latestDate(careTasks.filter((task) => task.type === 'feeding'), 'lastDone');

  return {
    version: 1,
    tank: {
      id: tank._id ?? tank.id ?? null,
      name: tank.name ?? 'Bể cá',
      style: tank.style ?? 'nature',
      shape: tank.shape ?? 'rect',
      dimensions: { ...tank.dimensions },
      volume: tank.volume ?? null,
      equipment: (tank.equipment ?? []).map((item) => typeof item === 'string' ? item : item.type),
      lightSchedule: tank.lightSchedule ?? { on: '08:00', off: '18:00' },
    },
    livestock: livestock.map((item) => {
      const species = typeof item.speciesId === 'object' && item.speciesId ? item.speciesId : {};
      const render = { ...species.render, ...item.render };
      return {
        speciesKey: item.speciesKey ?? species.speciesKey ?? render.spriteKey
          ?? (slug(item.nameEn || species.nameEn || item.name || species.name) || 'unknown'),
        name: item.name ?? species.name ?? 'Cá',
        quantity: quantity(item.quantity),
        variant: item.variant ?? null,
        render: { canvas: 64, bodyPx: 38, swimZone: ['mid'], behavior: 'wander', speed: 1, ...render },
      };
    }),
    plants: plants.map((item) => ({
      plantKey: item.plantKey ?? (slug(item.nameEn || item.name) || 'unknown'),
      position: item.position ?? 'midground',
      quantity: quantity(item.quantity),
    })),
    hardscape: hardscape.map((item) => ({
      type: item.type,
      spriteKey: item.spriteKey ?? (slug(item.name) || item.type),
      quantity: quantity(item.quantity),
    })),
    water: {
      temp: newestWater?.temp ?? null,
      ph: newestWater?.ph ?? newestWater?.pH ?? null,
      nitrate: newestWater?.nitrate ?? newestWater?.no3 ?? null,
      measuredAt: newestWater?.date ?? null,
    },
    care: {
      overdue: [...new Set(careTasks
        .filter((task) => !task.done && Date.parse(task.nextDue) < Number(now))
        .map((task) => task.type))],
      daysSinceWaterChange: lastWaterChange
        ? Math.max(0, Math.floor((Number(now) - Date.parse(lastWaterChange)) / 86400000)) : null,
      lastFed,
    },
    scene: tank.scene ?? { props: [], camera: { x: 0 } },
    warnings: data.warnings ?? [],
  };
}
