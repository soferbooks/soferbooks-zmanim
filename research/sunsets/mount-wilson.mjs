// Mount Wilson (Rarogiewicz, 250 sunsets over the Pacific, 1987-1991, binoculars, 1,739 / 1,725 m). The times are not
// published; Hilton's note (USNO/AA TN 2014-05, DTIC AD1094328) gives only their statistics, observed minus a standard
// computation: Hohenkerk & Sinclair's ray trace through the US Standard Atmosphere (6.5 K/km), the upper limb on the sea
// horizon. Mean +68 s for all 250, +41 s (median 35, sd 58) for the 178 with no mirage noted.
//
// So this script finds, over the same season, how much the engine's visible sunset differs from that standard
// computation, and carries Hilton's figures across: observed - engine = (observed - standard) + (standard - engine).
// The standard is redone here with the engine's own ray tracer (raytrace.js), 6.5 K/km, set to the month's normals at
// the site. Hilton's note asks whether the dip was right; both readings of it are shown (the sea horizon lifted by
// ordinary terrestrial refraction, k = 0.13, and the purely geometric dip).
//
// Run: node research/sunsets/mount-wilson.mjs   (downloads Open-Meteo normals on the first run into cache/).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as AE from 'astronomy-engine';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay, horizonDip } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, traceRefraction } = await import(Z + 'src/raytrace.js');
const CACHE = new URL('./cache/', import.meta.url); mkdirSync(CACHE, { recursive: true });

const S = { lat: 34 + 13 / 60 + 34.6 / 3600, lon: -(118 + 3 / 60 + 56.2 / 3600), alt: 1739 }; // Hilton Table 1, site 1
const f = new URL('climate_MountWilson_1739.json', CACHE);
if (!existsSync(f)) {
  const a = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${S.lat}&longitude=${S.lon}&start_date=2011-01-01&end_date=2020-12-31&daily=temperature_2m_mean,surface_pressure_mean&timezone=GMT`)).json();
  const T = Array.from({ length: 12 }, () => []), P = Array.from({ length: 12 }, () => []);
  a.daily.time.forEach((d, i) => { const m = +d.slice(5, 7) - 1; if (a.daily.temperature_2m_mean[i] != null) T[m].push(a.daily.temperature_2m_mean[i]); if (a.daily.surface_pressure_mean[i] != null) P[m].push(a.daily.surface_pressure_mean[i]); });
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  writeFileSync(f, JSON.stringify({ elevation: a.elevation, tempC: T.map(mean), pressure: P.map(mean) }));
}
const CL = JSON.parse(readFileSync(f));
const airAt = (date) => { const t = normalForDay(CL.tempC, date), p = normalForDay(CL.pressure, date);
  return { tempC: t - 0.0065 * (S.alt - CL.elevation), pressure: (p * stationPressure(1, S.alt)) / stationPressure(1, CL.elevation) }; };

// The sea horizon only (the Channel Islands touch a few dates; Hilton found them negligible).
const side = (az0) => ({ az0, step: 0.1, angle: new Array(1801).fill(-10), dist: new Array(1801).fill(150e3) });
const sky = { vantage: { lat: S.lat, lon: S.lon, eye: S.alt }, params: { k: 0.13 }, east: side(0), west: side(180) };

const sunAlt = (ms) => { const t = AE.MakeTime(new Date(ms)), ob = new AE.Observer(S.lat, S.lon, S.alt); const e = AE.Equator(AE.Body.Sun, t, ob, true, true); return AE.Horizon(t, ob, e.ra, e.dec).altitude + 959.63 / 3600 / e.dist; };
const setWhen = (near, limb) => { let lo = near - 3600e3, hi = near + 3600e3; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (sunAlt(mid) - limb > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
const dipGeo = Math.acos(6378137 / (6378137 + S.alt)) * 180 / Math.PI;

// Hilton Table 7: the season split in four, with the number of sunsets in each.
const PERIODS = [[[9, 19], [11, 4], 62], [[11, 5], [12, 20], 83], [[12, 21], [2, 5], 64], [[2, 6], [3, 24], 41]];
// The real horizon (Copernicus GLO-30 to 250 km: past the Channel Islands; beyond, only sea in the sunset directions).
const { computeSkyline } = await import(Z + 'src/terrain/skyline.js');
const fs = new URL('sky_MountWilson_1739_250km.json', CACHE);
if (!existsSync(fs)) writeFileSync(fs, JSON.stringify(await computeSkyline({ lat: S.lat, lon: S.lon }, { vantage: { lat: S.lat, lon: S.lon, eye: S.alt }, maxKm: 250, source: 'copernicus' })));
const real = JSON.parse(readFileSync(fs));
const rows = [];
for (const [[m0, d0], [m1, d1], n] of PERIODS) {
  const start = Date.UTC(1988, m0 - 1, d0), end = Date.UTC(m1 < m0 ? 1989 : 1988, m1 - 1, d1), days = [];
  for (let t = start; t <= end; t += 86400e3) days.push(t);
  for (const t of days) {
    const dt = new Date(t), date = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const air = airAt(date), v = visibleRiseSet(date, sky, { refraction: { sunrise: air, sunset: air }, diskin: true }).sunset;
    const t0 = air.tempC + 0.0065 * S.alt;
    const atm = makeAtmosphere([{ h: 0, t: t0 }, { h: 11000, t: t0 - 71.5 }], { h: S.alt, p: air.pressure }, { lat: S.lat });
    const std = (dip) => setWhen(v.raw, -dip - traceRefraction(atm, S.alt, -dip));
    const vr = visibleRiseSet(date, real, { refraction: { sunrise: air, sunset: air }, diskin: true }).sunset;
    rows.push({ w: n / days.length, date, engine: v.raw, realEngine: vr.raw, open: vr.open, angle: vr.angle, dist: vr.dist, az: vr.azimuth, stdK: std(horizonDip(S.alt)), stdGeo: std(dipGeo) });
  }
}
const wmean = (k) => rows.reduce((a, r) => a + r.w * k(r), 0) / rows.reduce((a, r) => a + r.w, 0);
const dK = wmean((r) => (r.stdK - r.engine) / 1000), dG = wmean((r) => (r.stdGeo - r.engine) / 1000);
console.log(`Mount Wilson, 1,739 m. Dip: refracted ${horizonDip(S.alt).toFixed(3)} deg, geometric ${dipGeo.toFixed(3)} deg.`);
console.log(`standard ray trace - engine (s), season mean weighted as Hilton's sunsets: refracted dip ${dK.toFixed(1)}, geometric dip ${dG.toFixed(1)}`);
const span = (k) => { const v = rows.map(k); return `${Math.min(...v).toFixed(0)} to ${Math.max(...v).toFixed(0)}`; };
console.log(`  range over the season: ${span((r) => (r.stdK - r.engine) / 1000)} / ${span((r) => (r.stdGeo - r.engine) / 1000)}`);
const blocked = rows.filter((r) => r.realEngine < r.engine - 500);
console.log(`real horizon: the Sun sets behind land on ${blocked.length} of ${rows.length} season days; weighted mean shift ${wmean((r) => (r.engine - r.realEngine) / 1000).toFixed(1)} s earlier`);
for (const r of blocked) console.log(`  ${r.date.y}-${r.date.m}-${r.date.d}  ${((r.engine - r.realEngine) / 1000).toFixed(0)} s earlier, terrain ${r.angle?.toFixed?.(3)} deg at ${(r.dist / 1000).toFixed(0)} km, az ${r.az?.toFixed?.(1)}`);
for (const [label, oc] of [['all 250', 68], ['no mirage noted (178), mean', 41], ['no mirage noted, median', 35]])
  console.log(`observed - engine, ${label}: ${(oc + dK).toFixed(0)} s (refracted dip) / ${(oc + dG).toFixed(0)} s (geometric dip)`);
