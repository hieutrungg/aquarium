import { toTankSceneDTO } from './toTankSceneDTO.js';

export const TANK_STYLES = Object.freeze({
  nature: 'Thiên nhiên',
  iwagumi: 'Iwagumi (bố cục đá)',
  dutch: 'Hà Lan',
  biotope_amazon: 'Biotope Nam Mỹ',
  biotope_asia: 'Biotope châu Á',
  stream: 'Hệ suối',
  paludarium: 'Bán cạn',
  balcony_jar: 'Chum ban công',
  foam_box: 'Thùng xốp',
  lowtech: 'Low-tech (không CO₂)',
});

export function findFeedingTask(tasks = []) {
  return tasks.find((task) => task.type === 'feeding' && !task.done && (task._id || task.id));
}

export function canFeed(now, lastAttempt) {
  return lastAttempt == null || now - lastAttempt >= 30_000;
}

// Only an absent endpoint activates the legacy adapter; auth/server errors propagate.
export async function fetchTankScene(api, id, getTank, signal) {
  try {
    return (await api.get(`/tanks/${id}/scene`, { signal })).data;
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    return toTankSceneDTO(await getTank());
  }
}
