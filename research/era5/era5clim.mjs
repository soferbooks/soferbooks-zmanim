// The usable form of the experiment: ERA5's typical air for that site and calendar month at sunrise (all the other
// years' mornings averaged, the observation's own date left out), ray traced, against the normals.
import { readFileSync } from 'node:fs';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, refractionTable } = await import(Z + 'src/raytrace.js');
const R = new URL('../../test/fixtures/', import.meta.url);
const fx = JSON.parse(readFileSync(new URL('observations.json', R)));
const skies = JSON.parse(readFileSync(new URL('fixture-skylines-observations-1200-auto-bare.json', R)));
const NORM = JSON.parse(readFileSync(new URL('fixture-climate-israel.json', R))).sites;
const P = JSON.parse(readFileSync(process.argv[2] ?? new URL('./profiles.json', import.meta.url))).rows;
const STEP = 25, TOP = 5500, HS = []; for (let h = -100; h <= TOP; h += STEP) HS.push(h);
function grid(pr) { // temperature on the height grid (null below ground), and surface h / p
  const lv = [{ h: pr.surface.h, t: pr.surface.t }, ...pr.levels].sort((a, b) => a.h - b.h);
  const t = HS.map((h) => { if (h < lv[0].h) return null; for (let i = 1; i < lv.length; i++) if (h <= lv[i].h) { const f = (h - lv[i - 1].h) / (lv[i].h - lv[i - 1].h); return lv[i - 1].t + f * (lv[i].t - lv[i - 1].t); } return null; });
  return { t, h: pr.surface.h, p: pr.surface.p };
}
const rows = P.map((o) => ({ o, g: [o.land, ...o.profiles.slice(1)].map(grid), key: o.site + '|' + o.date.slice(5, 7) }));
const sums = new Map();
for (const r of rows) {
  let s = sums.get(r.key); if (!s) sums.set(r.key, s = r.g.map(() => ({ t: HS.map(() => 0), n: HS.map(() => 0), h: 0, p: 0, c: 0 })));
  r.g.forEach((g, i) => { g.t.forEach((v, j) => { if (v !== null) { s[i].t[j] += v; s[i].n[j]++; } }); s[i].h += g.h; s[i].p += g.p; s[i].c++; });
}
function climAtm(r, lat) { // the month's mean minus this morning
  const s = sums.get(r.key);
  const cols = s.map((c, i) => { const g = r.g[i]; return { t: HS.map((_, j) => { const n = c.n[j] - (g.t[j] !== null ? 1 : 0); return n > 0 ? (c.t[j] - (g.t[j] ?? 0)) / n : null; }), h: (c.h - g.h) / (c.c - 1), p: (c.p - g.p) / (c.c - 1) }; });
  const levels = [];
  HS.forEach((h, j) => { if (h < cols[0].h - 1) return; const ts = cols.map((c) => c.t[j]).filter((v) => v !== null); if (ts.length) levels.push({ h, t: ts.reduce((a, b) => a + b, 0) / ts.length }); });
  return makeAtmosphere(levels, { h: levels[0].h, p: cols[0].p }, { lat });
}
const climateAt = (id, date, eye) => { const c = NORM[id === 'zuriel' ? 'telaviv' : 'jerusalem']; const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date); return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) }; };
const res = [];
for (const r of rows) {
  const o = r.o, site = fx.sites[o.site], sky = skies[o.site], eye = sky.vantage.eye;
  if (sums.get(r.key)[0].c < 3) continue;
  const [y, m, d] = o.date.split('-').map(Number), [hh, mi, ss] = o.time.split(':').map(Number);
  const obs = Date.UTC(y, m - 1, d, hh - 2, mi, ss);
  const run = (refraction) => { const v = visibleRiseSet({ y, m, d }, sky, { refraction }).sunrise; return v ? (obs - v.raw) / 1000 : null; };
  let clim; try { clim = run({ sunrise: refractionTable(climAtm(r, site.lat), eye) }); } catch { continue; }
  const normals = run({ sunrise: climateAt(o.site, { y, m, d }, eye) });
  if (clim === null || normals === null || Math.abs(normals) > 300) continue;
  res.push({ id: o.site, y, normals, clim });
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length, rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const sd = (v) => { const mm = mean(v); return Math.sqrt(mean(v.map((b) => (b - mm) ** 2))); };
for (const [g, t] of Object.entries({ druk: (r) => r.id === 'druk', golan: (r) => r.id === 'golan', zuriel: (r) => r.id === 'zuriel', all: () => true })) {
  const s = res.filter(t);
  for (const k of ['normals', 'clim']) console.log(g.padEnd(7), k.padEnd(8), `n ${s.length}  mean ${mean(s.map((r) => r[k])).toFixed(1)}  rms ${rms(s.map((r) => r[k])).toFixed(1)}  sd ${sd(s.map((r) => r[k])).toFixed(1)}`);
}
