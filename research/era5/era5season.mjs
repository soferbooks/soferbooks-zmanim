// Step 1 of the worldwide plan (2026-11-12): does ERA5's 1991-2020 mean dawn layering, kept to the normals' yearly
// average at each place, improve the observed sunrises everywhere, or at least harm none?
// For each site and month: k = traced refraction through the month's mean ERA5 dawn air / traced refraction through a
// standard atmosphere at the normals (model against model, no observations). f = k / (the year's mean k), so the
// year's average refraction stays the normals'; f blends day by day like the normals and multiplies their pressure.
import { readFileSync } from 'node:fs';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, refractionTable, traceRefraction } = await import(Z + 'src/raytrace.js');
const R = new URL('../../test/fixtures/', import.meta.url);
const fx = JSON.parse(readFileSync(new URL('observations.json', R)));
const skies = JSON.parse(readFileSync(new URL('fixture-skylines-observations-1200-auto-bare.json', R)));
const NORM = JSON.parse(readFileSync(new URL('fixture-climate-israel.json', R))).sites;
const CL = JSON.parse(readFileSync(process.argv[2] ?? new URL('./clim_profiles.json', import.meta.url)));

const STEP = 25, TOP = 5500;
function column(pr) {
  const lv = [{ h: pr.surface.h, t: pr.surface.t }, ...pr.levels].sort((a, b) => a.h - b.h);
  const tAt = (h) => { if (h < lv[0].h) return null; for (let i = 1; i < lv.length; i++) if (h <= lv[i].h) { const f = (h - lv[i - 1].h) / (lv[i].h - lv[i - 1].h); return lv[i - 1].t + f * (lv[i].t - lv[i - 1].t); } return null; };
  return { tAt, ground: lv[0].h, sfcP: pr.surface.p };
}
function atmosphereOf(prs, lat) {
  const cols = prs.map(column), levels = [];
  for (let h = Math.ceil(Math.min(...cols.map((c) => c.ground)) / STEP) * STEP; h <= TOP; h += STEP) {
    const ts = cols.map((c) => c.tAt(h)).filter((v) => v !== null);
    if (ts.length) levels.push({ h, t: ts.reduce((a, b) => a + b, 0) / ts.length });
  }
  return makeAtmosphere(levels, { h: cols[0].ground, p: cols[0].sfcP }, { lat });
}
const climateAt = (id, date, eye) => {
  const c = NORM[id === 'zuriel' ? 'telaviv' : 'jerusalem'];
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) };
};
const stdAtm = (c, eye, lat) => makeAtmosphere([{ h: eye - 300, t: c.tempC + 1.95 }, { h: eye + 6000, t: c.tempC - 39 }], { h: eye, p: c.pressure }, { lat });

const F = {}, ATM = {};
for (const id of ['druk', 'golan', 'zuriel']) {
  const site = fx.sites[id], eye = skies[id].vantage.eye;
  ATM[id] = []; const k = [];
  for (let m = 1; m <= 12; m++) {
    const a = atmosphereOf(CL[id][m], site.lat); ATM[id].push(a);
    const n = climateAt(id, { y: 2001, m, d: 15 }, eye);
    k.push(traceRefraction(a, eye, 0) / traceRefraction(stdAtm(n, eye, site.lat), eye, 0));
  }
  const mk = k.reduce((s, v) => s + v, 0) / 12;
  F[id] = k.map((v) => v / mk);
  console.log(id.padEnd(7), 'k mean', mk.toFixed(3), ' f by month', F[id].map((v) => v.toFixed(3)).join(' '));
}

const res = [];
for (const o of fx.rows) {
  const sky = skies[o.site], eye = sky.vantage.eye;
  const [y, m, d] = o.date.split('-').map(Number), [hh, mi, ss] = o.time.split(':').map(Number);
  const obs = Date.UTC(y, m - 1, d, hh - 2, mi, ss), date = { y, m, d };
  const run = (refraction) => { const v = visibleRiseSet(date, sky, { refraction }).sunrise; return v ? (obs - v.raw) / 1000 : null; };
  const base = climateAt(o.site, date, eye);
  const r = {
    id: o.site, normals: run({ sunrise: base }),
    seasonal: run({ sunrise: { ...base, pressure: base.pressure * normalForDay(F[o.site], date) } }),
    monthAbs: run({ sunrise: refractionTable(ATM[o.site][m - 1], eye) }),
  };
  if (Object.values(r).some((v) => v === null) || Math.abs(r.normals) > 300) continue;
  const tn = obs - r.normals * 1000, ts = obs - r.seasonal * 1000;  // the computed sunrises
  r.minute = Math.ceil(tn / 60000) !== Math.ceil(ts / 60000);  // shown to the minute (sunrise rounded up)
  res.push(r);
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length, rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const sd = (v) => { const mm = mean(v); return Math.sqrt(mean(v.map((b) => (b - mm) ** 2))); };
for (const [g, t] of Object.entries({ druk: (r) => r.id === 'druk', golan: (r) => r.id === 'golan', zuriel: (r) => r.id === 'zuriel', all: () => true })) {
  const s = res.filter(t);
  for (const k of ['normals', 'seasonal', 'monthAbs']) console.log(g.padEnd(7), k.padEnd(9), `n ${s.length}  mean ${mean(s.map((r) => r[k])).toFixed(1).padStart(5)}  rms ${rms(s.map((r) => r[k])).toFixed(1)}  sd ${sd(s.map((r) => r[k])).toFixed(1)}`);
  // paired bootstrap: chance the seasonal version's rms is worse than the normals'
  let worse = 0; const B = 2000;
  for (let b = 0; b < B; b++) { const x = Array.from({ length: s.length }, () => s[Math.floor(Math.random() * s.length)]); if (rms(x.map((r) => r.seasonal)) > rms(x.map((r) => r.normals))) worse++; }
  // how far the times move, and how often a displayed minute would change
  const mv = s.map((r) => r.normals - r.seasonal);
  console.log(g.padEnd(7), `  P(seasonal worse) ${(worse / B).toFixed(2)}  shift: mean |${mean(mv.map(Math.abs)).toFixed(1)}| s, max ${Math.max(...mv.map(Math.abs)).toFixed(1)} s, displayed minute changes on ${(100 * s.filter((r) => r.minute).length / s.length).toFixed(0)}% of days`);
}

// Version 2: ERA5's monthly traced table itself, times one constant per place s, chosen (model against model, every
// day of a year, no observations) so the year's mean computed sunrise equals the normals'.
const scaled = (tbl, s) => ({ ...tbl, refraction: (e) => s * tbl.refraction(e) });
const S2 = {};
for (const id of ['druk', 'golan', 'zuriel']) {
  const sky = skies[id], eye = sky.vantage.eye, days = [];
  for (let doy = 0; doy < 365; doy += 3) { const t = new Date(Date.UTC(2001, 0, 1 + doy)); days.push({ y: 2001, m: t.getUTCMonth() + 1, d: t.getUTCDate() }); }
  const TB = ATM[id].map((a) => refractionTable(a, eye));
  const meanDiff = (s) => mean(days.map((dt) => visibleRiseSet(dt, sky, { refraction: { sunrise: scaled(TB[dt.m - 1], s) } }).sunrise.raw
    - visibleRiseSet(dt, sky, { refraction: { sunrise: climateAt(id, dt, eye) } }).sunrise.raw));
  let lo = 0.8, hi = 1.2; for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (meanDiff(mid) > 0) lo = mid; else hi = mid; }
  S2[id] = { s: (lo + hi) / 2, TB };
  console.log(id, 'scale', S2[id].s.toFixed(4), 'unscaled mean shift', (meanDiff(1) / 1000).toFixed(1), 's');
}
const res2 = [];
for (const o of fx.rows) {
  const sky = skies[o.site];
  const [y, m, d] = o.date.split('-').map(Number), [hh, mi, ss] = o.time.split(':').map(Number);
  const obs = Date.UTC(y, m - 1, d, hh - 2, mi, ss), date = { y, m, d };
  const base = climateAt(o.site, date, sky.vantage.eye);
  const vn = visibleRiseSet(date, sky, { refraction: { sunrise: base } }).sunrise;
  const vs = visibleRiseSet(date, sky, { refraction: { sunrise: scaled(S2[o.site].TB[m - 1], S2[o.site].s) } }).sunrise;
  if (!vn || !vs || Math.abs(obs - vn.raw) > 300000) continue;
  res2.push({ id: o.site, normals: (obs - vn.raw) / 1000, kept: (obs - vs.raw) / 1000, minute: Math.ceil(vn.raw / 60000) !== Math.ceil(vs.raw / 60000) });
}
console.log('\nversion 2: monthly ERA5 table, yearly mean kept to the normals');
for (const [g, t] of Object.entries({ druk: (r) => r.id === 'druk', golan: (r) => r.id === 'golan', zuriel: (r) => r.id === 'zuriel', all: () => true })) {
  const s = res2.filter(t);
  for (const k of ['normals', 'kept']) console.log(g.padEnd(7), k.padEnd(8), `n ${s.length}  mean ${mean(s.map((r) => r[k])).toFixed(1).padStart(5)}  rms ${rms(s.map((r) => r[k])).toFixed(1)}  sd ${sd(s.map((r) => r[k])).toFixed(1)}`);
  let worse = 0; const B = 2000;
  for (let b = 0; b < B; b++) { const x = Array.from({ length: s.length }, () => s[Math.floor(Math.random() * s.length)]); if (rms(x.map((r) => r.kept)) > rms(x.map((r) => r.normals))) worse++; }
  const mv = s.map((r) => Math.abs(r.normals - r.kept));
  console.log(g.padEnd(7), `  P(worse) ${(worse / B).toFixed(2)}  moves: mean ${mean(mv).toFixed(1)} s, max ${Math.max(...mv).toFixed(1)} s, displayed minute changes on ${(100 * s.filter((r) => r.minute).length / s.length).toFixed(0)}% of days`);
}
