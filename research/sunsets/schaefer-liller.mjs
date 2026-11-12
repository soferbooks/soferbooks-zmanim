// Schaefer & Liller (1990), "Refraction near the horizon", PASP 102:796, Table 1: 110 sunsets timed at the last gleam
// of the Sun over the Pacific, from Hawaii and Chile (Vina del Mar on its hills at 200 m, La Serena, Cerro Tololo at
// 2,215 m), 1987-1989, mostly with the unaided eye. The last gleam is the halachic visible sunset, so they are scored
// here as one: over the real horizon (terrain from GEDTM30 out to 150 km, and beyond it the open sea, whichever is
// higher; Copernicus GLO-30, whose counting of roofs and trees does not matter for horizons tens of km away), with the engine's refraction from the place's monthly weather normals. For comparison, two secular
// definitions: the upper limb at the sea horizon (geometric dip, as the paper reduced them) and the almanac sunset
// (the centre 50' below a level horizon).
//
// Run: node research/sunsets/schaefer-liller.mjs   (downloads terrain blocks and Open-Meteo normals on the first run,
// kept in research/sunsets/cache/).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as AE from 'astronomy-engine';
const Z = new URL('../../', import.meta.url).href;
const { computeSkyline } = await import(Z + 'src/terrain/skyline.js');
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay, horizonDip } = await import(Z + 'src/refraction.js');
const HERE = new URL('./', import.meta.url), CACHE = new URL('./cache/', HERE);
mkdirSync(CACHE, { recursive: true });

const rows = readFileSync(new URL('schaefer-liller-1990.tsv', HERE), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [n, site, lat, lon, alt, obs, date, ut, note, gf, Zp, R0] = l.split('\t');
  return { n: +n, site, lat: +lat, lon: +lon, alt: +alt, obs, date, ut, note, gf, Zp: +Zp, R0: +R0 };
});
const key = (r) => `${r.lat},${r.lon},${r.alt}`;
const sites = new Map(rows.map((r) => [key(r), r]));

const cached = async (name, make) => {
  const f = new URL(name, CACHE);
  if (existsSync(f)) return JSON.parse(readFileSync(f));
  const v = await make(); writeFileSync(f, JSON.stringify(v)); return v;
};
const SK = {}, CL = {};
for (const [k, s] of sites) {
  const id = `${s.site.replace(/\W/g, '')}_${s.alt}`;
  SK[k] = await cached(`sky_${id}.json`, () => computeSkyline({ lat: s.lat, lon: s.lon }, { vantage: { lat: s.lat, lon: s.lon, eye: s.alt }, maxKm: 150, source: 'copernicus' }));
  CL[k] = await cached(`climate_${id}.json`, async () => {
    const a = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${s.lat}&longitude=${s.lon}&start_date=2011-01-01&end_date=2020-12-31&daily=temperature_2m_mean,surface_pressure_mean&timezone=GMT`)).json();
    const T = Array.from({ length: 12 }, () => []), P = Array.from({ length: 12 }, () => []);
    a.daily.time.forEach((d, i) => { const m = +d.slice(5, 7) - 1; if (a.daily.temperature_2m_mean[i] != null) T[m].push(a.daily.temperature_2m_mean[i]); if (a.daily.surface_pressure_mean[i] != null) P[m].push(a.daily.surface_pressure_mean[i]); });
    const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
    return { elevation: a.elevation, tempC: T.map(mean), pressure: P.map(mean) };
  });
  console.error('site ready', s.site, s.alt, 'm');
}
const airAt = (c, date, eye) => {
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) };
};
// Secular sunsets, found by bisection on the Sun's topocentric geometric altitude.
const sunAlt = (ms, s) => { const t = AE.MakeTime(new Date(ms)), ob = new AE.Observer(s.lat, s.lon, s.alt); const e = AE.Equator(AE.Body.Sun, t, ob, true, true); return { alt: AE.Horizon(t, ob, e.ra, e.dec).altitude, sd: 959.63 / 3600 / e.dist }; };
const setWhen = (obsMs, s, f) => { let lo = obsMs - 3600e3, hi = obsMs + 3600e3; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (f(sunAlt(mid, s)) > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
const dipGeo = (h) => Math.acos(6378000 / (6378000 + h)) * 180 / Math.PI;

// Ray traced instead (the engine's raytrace.js through a standard atmosphere, 6.5 K/km, set to the normals): the sea
// horizon is the lowest ray that clears the sea, and the limb sets when its apparent altitude reaches it. Bennett's
// formula, used above, is fitted to the sky above the horizon; below it, from a height, it bends the light too much.
const { makeAtmosphere, traceRefraction } = await import(Z + 'src/raytrace.js');
const traced = (s, air) => {
  const t0 = air.tempC + 0.0065 * s.alt;
  const atm = makeAtmosphere([{ h: 0, t: t0 }, { h: 11000, t: t0 - 71.5 }], { h: s.alt, p: air.pressure }, { lat: s.lat });
  const e0 = -horizonDip(s.alt), R0 = traceRefraction(atm, s.alt, e0); // the sea horizon (standard terrestrial refraction)
  return { e0, R0 }; // the limb sets when its geometric altitude is e0 - R0
};
const res = [];
for (const r of rows) {
  const k = key(r), sky = SK[k];
  const obsMs = Date.parse(`${r.date}T${r.ut}Z`);
  const loc = new Date(obsMs + (r.lon / 15) * 3600e3); // the civil date at the place
  const date = { y: loc.getUTCFullYear(), m: loc.getUTCMonth() + 1, d: loc.getUTCDate() };
  const air = airAt(CL[k], date, r.alt);
  const v = visibleRiseSet(date, sky, { refraction: { sunrise: air, sunset: air }, diskin: true }).sunset;
  // Sea horizon only (no terrain): the same engine with the skyline emptied.
  const flat = { ...sky, west: { ...sky.west, angle: sky.west.angle.map(() => -10) }, east: { ...sky.east, angle: sky.east.angle.map(() => -10) } };
  const vs = visibleRiseSet(date, flat, { refraction: { sunrise: air, sunset: air }, diskin: true }).sunset;
  const almanac = setWhen(obsMs, r, (x) => x.alt + 50 / 60);                                   // centre 50' below level
  const seaGeo = setWhen(obsMs, r, (x) => x.alt + x.sd + 34 / 60 + dipGeo(r.alt));             // upper limb, 34', geometric dip
  if (!v || !vs) { console.error('no sunset', r.n); continue; }
  const tr = traced(r, air);
  const tracedSet = setWhen(obsMs, r, (x) => x.alt + x.sd - (tr.e0 - tr.R0));
  res.push({ ...r, tracedDip: -tr.e0, tracedR: tr.R0, traced: (obsMs - tracedSet) / 1000, halachic: (obsMs - v.raw) / 1000, seaOnly: (obsMs - vs.raw) / 1000, terrainAngle: v.angle, open: v.open, dist: v.dist,
    almanac: (obsMs - almanac) / 1000, sea34: (obsMs - seaGeo) / 1000 });
}
writeFileSync(new URL('schaefer-liller-results.json', CACHE), JSON.stringify(res, null, 1));

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length, rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((b) => (b - m) ** 2))); };
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const groups = { 'Vina del Mar (200 m)': (r) => r.site === 'Vina del Mar', 'La Serena (300 m)': (r) => r.site === 'La Serena',
  'Cerro Tololo (2,215 m)': (r) => r.site === 'Cerro Tololo', 'Hawaii (8)': (r) => r.lat > 0, All: () => true };
const M = [['halachic', 'Visible, real horizon (halachic)'], ['traced', 'Visible, sea horizon, ray traced'],['seaOnly', 'Visible, sea horizon only'], ['sea34', "Secular: 34' + geometric dip"], ['almanac', 'Secular: almanac (level)']];
console.log('observed - computed (s): mean / sd / rms / median |error|');
for (const [g, t] of Object.entries(groups)) {
  const s = res.filter(t);
  console.log(`\n${g}  n=${s.length}`);
  for (const [k, label] of M) console.log('  ' + label.padEnd(36), mean(s.map((r) => r[k])).toFixed(1).padStart(7), sd(s.map((r) => r[k])).toFixed(1).padStart(6), rms(s.map((r) => r[k])).toFixed(1).padStart(6), med(s.map((r) => Math.abs(r[k]))).toFixed(1).padStart(6));
  const blocked = s.filter((r) => !r.open);
  if (blocked.length) console.log(`  set behind terrain (not the sea) on ${blocked.length} of ${s.length}: mean terrain ${mean(blocked.map((r) => r.terrainAngle)).toFixed(3)} deg at ${(mean(blocked.map((r) => r.dist)) / 1000).toFixed(0)} km`);
}
