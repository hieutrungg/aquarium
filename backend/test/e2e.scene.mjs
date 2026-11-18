// E2E thủ công cho /scene: cần MongoDB + backend chạy và đã `npm run seed`. Chạy: node test/e2e.scene.mjs
const B = 'http://localhost:5000/api';
const j = async (method, path, body, token) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t.slice(0, 200)}`);
  return d;
};
const login = await j('POST', '/auth/login', { email: 'admin@aquaverse.app', password: 'admin123' });
const token = login.token ?? login.accessToken;
const species = (await j('GET', '/species?limit=100')).items;
const neon = species.find((s) => s.speciesKey === 'neon_tetra');
const tank = await j('POST', '/tanks', { name: 'E2E Bể test', dimensions: { length: 60, width: 30, height: 36 }, type: 'planted' }, token);
const tankId = tank._id ?? tank.tank?._id;
await j('POST', `/tanks/${tankId}/livestock`, { speciesId: neon._id, name: neon.commonName, quantity: 10 }, token);
await j('POST', `/tanks/${tankId}/hardscape`, { type: 'rock', name: 'Đá Seiryu', quantity: 1 }, token);
let scene = await j('GET', `/tanks/${tankId}/scene`, null, token);
console.log('1) livestock:', scene.livestock.map((l) => `${l.speciesKey} x${l.quantity}`).join(', '), '| style:', scene.tank.style, '| warnings:', scene.warnings.map((w) => w.code).join(',') || '-');
const rock = scene.hardscape[0];
const saved = await j('PUT', `/tanks/${tankId}/scene`, { props: [{ refType: 'hardscape', refId: rock.id, key: rock.spriteKey, x: 420, layer: 'mid', flip: true }], camera: { x: 0 } }, token);
scene = await j('GET', `/tanks/${tankId}/scene`, null, token);
console.log('2) props after reload:', JSON.stringify(scene.scene.props));
try { await j('PUT', `/tanks/${tankId}/scene`, { props: [{ refType: 'x', refId: 'a', key: 'BAD KEY', x: 1e9, layer: 'top' }] }, token); console.log('3) validation: NOT rejected (bug)'); }
catch (e) { console.log('3) invalid body rejected:', e.message.split(' -> ')[1].slice(0, 60)); }
console.log('TANK_ID=' + tankId);
