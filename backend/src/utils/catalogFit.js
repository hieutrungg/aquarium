import { computeWarnings } from './tankScene.js';

export const catalogStyles = (item) => [...new Set((item.tags || [])
  .filter((tag) => tag.startsWith('style:')).map((tag) => tag.slice(6)))];

// context is owner-only, with resolved livestock metadata and the latest water log.
// Scores estimate the addition of one fish; unknown measurements incur no penalty.
export function catalogFit(item, context = null) {
  if (!context?.tank) return null;
  const { tank, water = null, livestock = [] } = context;
  let score = 100;
  const reasons = [];
  const deduct = (points, reason) => { score -= points; reasons.push(reason); };
  const outside = (value, range) => Number.isFinite(value) && range
    && ((range.min != null && value < range.min) || (range.max != null && value > range.max));
  if (outside(water?.temp, item.tempRange)) deduct(20, 'Nhiệt độ ngoài khoảng phù hợp.');
  if (outside(water?.pH ?? water?.ph, item.phRange)) deduct(20, 'pH ngoài khoảng phù hợp.');
  if (Number.isFinite(tank.volume) && tank.volume < item.minTankSize) deduct(25, 'Thể tích bể quá nhỏ.');
  const styles = catalogStyles(item);
  if (tank.style && styles.length && !styles.includes(tank.style)) deduct(10, 'Chưa hợp phong cách bể.');
  if (item.speciesKey) {
    const warnings = computeWarnings({ tank, livestock: [...livestock, { ...item, quantity: 1 }] });
    if (warnings.some((warning) => warning.code === 'FIN_NIPPER' && warning.species.includes(item.speciesKey))) {
      deduct(25, 'Có nguy cơ cắn vây với cá đang nuôi.');
    }
    if (Number.isFinite(tank.volume) && warnings.some((warning) => warning.code === 'OVERSTOCK')) {
      deduct(25, 'Thêm cá sẽ vượt sức chứa của bể.');
    }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export function buildCatalog(species, plants, context = null) {
  return {
    species: species.map((item) => ({ speciesKey: item.speciesKey, slug: item.slug ?? null,
      name: item.commonName, sciName: item.sciName ?? null, adultSize: item.adultSize,
      render: item.render ?? null, tempRange: item.tempRange ?? null, phRange: item.phRange ?? null,
      temperament: item.temperament, styles: catalogStyles(item), fit: catalogFit(item, context) })),
    plants: plants.map((item) => ({ plantKey: item.plantKey, name: item.name, position: item.position,
      light: item.light, co2: item.co2, styles: catalogStyles(item), fit: catalogFit(item, context) })),
  };
}
