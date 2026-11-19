// Mount Wilson, sunset by sunset: Lucian Rarogiewicz's 250 sunsets over the Pacific, 1987-1991, from 1,739 / 1,725 m,
// almost all with 7x50 binoculars. The log (ssobs.dat, cleaned by J. Bangert 2010) was sent by the USNO Library in
// November 2026, approved for public release (Distribution A); it is here as rarogiewicz-mount-wilson.dat.
//
// Record: YYMMDD, then three PST times (after calibration with WWV): first contact (lower limb on the horizon), half
// disk (centre), last light (upper limb gone); location A or B; pressure (in Hg at Mount Wilson), temperature and dew
// point (F), from the NWS station within ~5 min of 15:50 PST; NE / BI (naked eye / binoculars); quality A B C Q U;
// Novaya Zemlya effect 0 / P / N. Remarks: YYMMDDR text.
//
// Each sunset is computed four ways, observed minus computed in seconds:
//   engine     the engine's visible sunset (Bennett scaled to the day's measured temperature and pressure), sea horizon
//   real       the same over the real skyline (Copernicus GLO-30 to 250 km: the Santa Monica Mountains, the islands)
//   normals    the engine as printed: the month's normal air instead of the day's
//   standard   Hilton's computation redone: ray trace through 6.5 K/km from the measured air, upper limb on the
//              sea horizon (his dip: ordinary terrestrial refraction, k = 0.13)
// and the lower-limb and centre contacts the same way (sea horizon).
//
// Run: node research/sunsets/mount-wilson-obs.mjs   (the skylines and Open-Meteo normals are cached in cache/).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as AE from 'astronomy-engine';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet, refractionAt } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay, horizonDip, horizonRefraction } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, traceRefraction } = await import(Z + 'src/raytrace.js');
const { computeSkyline } = await import(Z + 'src/terrain/skyline.js');
const CACHE = new URL('./cache/', import.meta.url); mkdirSync(CACHE, { recursive: true });

// The two observing points (Rarogiewicz's memo of 15 June 1994; heights at the eye, 5705 and 5660 ft).
const SITES = {
  A: { lat: 34 + 13 / 60 + 34.6 / 3600, lon: -(118 + 3 / 60 + 56.2 / 3600), alt: 1739 },
  B: { lat: 34 + 13 / 60 + 37.0 / 3600, lon: -(118 + 4 / 60 + 1.7 / 3600), alt: 1725 },
};

// ---- the log ----------------------------------------------------------------------------------------------------------
const lines = readFileSync(new URL('./rarogiewicz-mount-wilson.dat', import.meta.url), 'utf8').split(/\r?\n|\r/);
const remarks = {};
for (const l of lines) if (/^\d{6}R/.test(l)) (remarks[l.slice(0, 6)] ??= []).push(l.slice(8).trim());
const hms = (s) => (s && s.trim() ? s.trim() : null);
const obs = lines.filter((l) => /^\d{6} /.test(l)).map((l) => {
  const ymd = l.slice(0, 6), y = 1900 + +ymd.slice(0, 2), m = +ymd.slice(2, 4), d = +ymd.slice(4, 6);
  const t = (s) => { s = hms(s); return s ? Date.UTC(y, m - 1, d, +s.slice(0, 2) + 8, +s.slice(2, 4), +s.slice(4, 6)) : null; };
  const num = (s) => (s.trim() === '' ? null : +s);
  const rest = l.slice(29).trim().split(/\s+/); // press temp dew type quality nz (blank fields are rare; checked below)
  return {
    ymd, date: { y, m, d }, first: t(l.slice(7, 13)), half: t(l.slice(14, 20)), last: t(l.slice(21, 27)), loc: l[28],
    inHg: num(l.slice(29, 41)), tF: num(l.slice(41, 51)), dF: num(l.slice(51, 61)),
    type: l.slice(61, 66).trim(), q: l.slice(66, 71).trim(), nz: l.slice(71, 76).trim() || '0', remark: !!remarks[ymd], raw: rest,
  };
});

// ---- air: the day's (measured at 15:50 PST) and the month's normals --------------------------------------------------
const fN = new URL('climate_MountWilson_1739.json', CACHE);
const CL = JSON.parse(readFileSync(fN)); // written by mount-wilson.mjs
const normalAir = (s, date) => { const t = normalForDay(CL.tempC, date), p = normalForDay(CL.pressure, date);
  return { tempC: t - 0.0065 * (s.alt - CL.elevation), pressure: (p * stationPressure(1, s.alt)) / stationPressure(1, CL.elevation) }; };
const dayAir = (o, s) => {
  const n = normalAir(s, o.date);
  return { tempC: o.tF == null ? n.tempC : (o.tF - 32) / 1.8, pressure: o.inHg == null ? n.pressure : o.inHg * 33.8639 };
};

// ---- skylines --------------------------------------------------------------------------------------------------------
const sea = (s) => { const side = (az0) => ({ az0, step: 0.1, angle: new Array(1801).fill(-10), dist: new Array(1801).fill(150e3) });
  return { vantage: { lat: s.lat, lon: s.lon, eye: s.alt }, params: { k: 0.13 }, east: side(0), west: side(180) }; };
const realSky = {};
for (const [id, s] of Object.entries(SITES)) {
  const f = new URL(id === 'A' ? 'sky_MountWilson_1739_250km.json' : 'sky_MountWilson_B_1725_250km.json', CACHE);
  if (!existsSync(f)) writeFileSync(f, JSON.stringify(await computeSkyline({ lat: s.lat, lon: s.lon }, { vantage: { lat: s.lat, lon: s.lon, eye: s.alt }, maxKm: 250, source: 'copernicus' })));
  realSky[id] = JSON.parse(readFileSync(f));
}

// ---- the Sun ---------------------------------------------------------------------------------------------------------
const sun = (ms, s) => { const t = AE.MakeTime(new Date(ms)), ob = new AE.Observer(s.lat, s.lon, s.alt);
  const e = AE.Equator(AE.Body.Sun, t, ob, true, true), h = AE.Horizon(t, ob, e.ra, e.dec);
  return { alt: h.altitude, az: h.azimuth, sd: 959.63 / 3600 / e.dist }; };
// When the point `frac` of the disk (+1 upper limb, 0 centre, -1 lower limb) has geometric altitude `target(sd)`.
const when = (near, s, frac, target) => { let lo = near - 3600e3, hi = near + 3600e3;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2, p = sun(mid, s); if (p.alt + frac * p.sd - target > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2; };

const rows = [];
for (const o of obs) {
  const s = SITES[o.loc], air = dayAir(o, s), nAir = normalAir(s, o.date);
  const e0 = -horizonDip(s.alt);
  const cfg = (a) => ({ refraction: { sunrise: a, sunset: a }, diskin: true });
  const eng = visibleRiseSet(o.date, sea(s), cfg(air)).sunset;
  const real = visibleRiseSet(o.date, realSky[o.loc], { refraction: { sunrise: air, sunset: air } }).sunset;
  const norm = visibleRiseSet(o.date, sea(s), cfg(nAir)).sunset;
  // The engine's refraction at the sea horizon, for the lower limb and the centre: the point is at apparent altitude e0.
  const Re = refractionAt(e0, horizonRefraction(air));
  const engAt = (frac) => when(eng.raw, s, frac, e0 - Re);
  // Hilton's standard: 6.5 K/km from the observer's air, ray traced.
  const t0 = air.tempC + 0.0065 * s.alt;
  const atm = makeAtmosphere([{ h: 0, t: t0 }, { h: 11000, t: t0 - 71.5 }], { h: s.alt, p: air.pressure }, { lat: s.lat });
  const Rs = traceRefraction(atm, s.alt, e0);
  const stdAt = (frac) => when(eng.raw, s, frac, e0 - Rs);
  const sec = (a, b) => (a == null || b == null ? null : (a - b) / 1000);
  rows.push({ ...o, az: sun(o.last, s).az,
    engine: sec(o.last, eng.raw), real: sec(o.last, real?.raw), normals: sec(o.last, norm.raw), standard: sec(o.last, stdAt(1)),
    engUpperCheck: sec(engAt(1), eng.raw),
    llEngine: sec(o.first, engAt(-1)), llStandard: sec(o.first, stdAt(-1)),
    cEngine: sec(o.half, engAt(0)), cStandard: sec(o.half, stdAt(0)),
    blocked: real ? (eng.raw - real.raw) / 1000 : null, realDist: real?.dist, realAngle: real?.angle });
}

// ---- report ----------------------------------------------------------------------------------------------------------
const stat = (v) => { v = v.filter((x) => x != null && Number.isFinite(x)); if (!v.length) return '   -';
  const n = v.length, m = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  const md = [...v].sort((a, b) => a - b)[Math.floor(n / 2)];
  return `${String(n).padStart(3)} ${m.toFixed(1).padStart(6)} ${md.toFixed(0).padStart(5)} ${sd.toFixed(1).padStart(5)}`; };
const check = rows.map((r) => Math.abs(r.engUpperCheck));
console.log(`${rows.length} sunsets (A ${rows.filter((r) => r.loc === 'A').length}, B ${rows.filter((r) => r.loc === 'B').length}); `
  + `own upper-limb formula vs engine: max ${Math.max(...check).toFixed(1)} s`);
const groups = [['No mirage noted (0)', (r) => r.nz === '0'], ['Possible (P)', (r) => r.nz === 'P'], ['Noted (N)', (r) => r.nz === 'N'], ['All', () => true],
  ['0, without remarks', (r) => r.nz === '0' && !r.remark], ['0, quality A or B', (r) => r.nz === '0' && 'AB'.includes(r.q)]];
console.log('\nLast light (sunset), observed - computed (s): n / mean / median / sd');
console.log('                       engine (day air)       real horizon           engine (normals)       standard (Hilton)');
for (const [g, f] of groups) { const s = rows.filter(f); console.log(`${g.padEnd(22)} ${stat(s.map((r) => r.engine))}   ${stat(s.map((r) => r.real))}   ${stat(s.map((r) => r.normals))}   ${stat(s.map((r) => r.standard))}`); }
console.log('\nLower limb and centre on the sea horizon, observed - computed (s): n / mean / median / sd');
console.log('                       LL engine              LL standard            centre engine          centre standard');
for (const [g, f] of groups.slice(0, 4)) { const s = rows.filter(f); console.log(`${g.padEnd(22)} ${stat(s.map((r) => r.llEngine))}   ${stat(s.map((r) => r.llStandard))}   ${stat(s.map((r) => r.cEngine))}   ${stat(s.map((r) => r.cStandard))}`); }
const azs = rows.map((r) => r.az).sort((a, b) => a - b);
console.log(`\nAzimuths of the observed sunsets: ${azs[0].toFixed(1)} to ${azs.at(-1).toFixed(1)}; between 255 and 264: ${azs.filter((a) => a >= 255 && a <= 264).length}`);
const bl = rows.filter((r) => r.blocked > 0.5);
console.log(`Behind land on the real skyline: ${bl.length} sunsets, ${stat(bl.map((r) => r.blocked))} s earlier than over the sea`);
for (const r of bl.sort((a, b) => b.blocked - a.blocked).slice(0, 12)) console.log(`  ${r.ymd} ${r.loc} az ${r.az.toFixed(1)}  ${r.blocked.toFixed(0)} s, land ${(r.realDist / 1000).toFixed(0)} km  O-C engine ${r.engine.toFixed(0)}  real ${r.real.toFixed(0)}  NZ ${r.nz}`);
// Does the day's air explain anything? correlation of O-C (engine) with the measured temperature, no-mirage nights.
const z = rows.filter((r) => r.nz === '0' && r.tF != null), mx = z.reduce((a, r) => a + r.tF, 0) / z.length, my = z.reduce((a, r) => a + r.engine, 0) / z.length;
const cov = z.reduce((a, r) => a + (r.tF - mx) * (r.engine - my), 0), vx = z.reduce((a, r) => a + (r.tF - mx) ** 2, 0), vy = z.reduce((a, r) => a + (r.engine - my) ** 2, 0);
console.log(`\nNo-mirage nights: O-C vs measured temperature r = ${(cov / Math.sqrt(vx * vy)).toFixed(2)}, slope ${(cov / vx).toFixed(2)} s/F`);
const months = {}; for (const r of rows.filter((r) => r.nz === '0')) (months[r.date.m] ??= []).push(r.engine);
console.log('By month (no mirage), engine: ' + [9, 10, 11, 12, 1, 2, 3].map((m) => `${m}: ${months[m] ? `${months[m].length} ${(months[m].reduce((a, b) => a + b, 0) / months[m].length).toFixed(0)}` : '-'}`).join(' | '));
writeFileSync(new URL('mount-wilson-omc.json', CACHE), JSON.stringify(rows, null, 1));
