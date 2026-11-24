// How far the skyline must reach, and how coarse the far part may be, day by day: every day of a year at each of
// Keller's observation points, the visible sunrise with the skyline searched to 60 km (the old default), to 150 km at
// full resolution (the reference), and to 100 km with the maps' 4″ overview beyond 60 km (the phone's light download).
// Reads the skylines test/compare-observations.js saves (run it with --maxkm=150, and --maxkm=100 --farlevel=2).
import { readFileSync } from 'node:fs';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay } = await import(Z + 'src/refraction.js');
const F = new URL('../../test/fixtures/', import.meta.url);
const J = (f) => JSON.parse(readFileSync(new URL(f, F)));
const sky60 = J('fixture-skylines-observations-1200-auto-bare.json');
const sky150 = J('fixture-skylines-observations-1200-auto-bare-150km.json');
const skyLight = J('fixture-skylines-observations-1200-auto-bare-100km-far2.json');
const CLIMATE = J('fixture-climate-israel.json').sites;
const air = (id, date, eye) => { const c = CLIMATE[id === 'zuriel' ? 'telaviv' : 'jerusalem'];
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) }; };

const year = 2026, stat = (v) => { const a = v.map(Math.abs); return `mean ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1).padStart(5)} s, max ${Math.max(...a).toFixed(1).padStart(5)} s, days over 1 s ${String(a.filter((x) => x > 1).length).padStart(3)}`; };
for (const id of Object.keys(sky150)) {
  const d60 = [], dLight = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86400e3) {
    const g = new Date(t), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
    const cfg = { refraction: { sunrise: air(id, date, sky150[id].vantage.eye) } };
    const ref = visibleRiseSet(date, sky150[id], cfg).sunrise?.raw, a = visibleRiseSet(date, sky60[id], cfg).sunrise?.raw, b = visibleRiseSet(date, skyLight[id], cfg).sunrise?.raw;
    if (ref == null) continue;
    d60.push((a - ref) / 1000); dLight.push((b - ref) / 1000);
  }
  console.log(`${id.padEnd(7)} 60 km full     vs 150 km full: ${stat(d60)}`);
  console.log(`${''.padEnd(7)} 100 km light   vs 150 km full: ${stat(dLight)}`);
}
