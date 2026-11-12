// Sampson (1994), "Atmospheric refraction and its effects on sunrise and sunset", MSc thesis, University of Alberta
// (doi:10.7939/R3T14V04F), Appendix D: 244 sunrises and 125 sunsets timed in central Edmonton, Dec 1990 - Feb 1994,
// with 7x20 binoculars, to about 2 s, at the first / last point of sunlight over the real horizon (the halachic
// visible sunrise and sunset), with the horizon's altitude at that azimuth measured by theodolite (trees and buildings
// included). The thesis may not be reproduced, so its table is not in this repository: transcribe Appendix D into
// research/sunsets/cache/sampson-1994.tsv (columns: page table date time T_ev p_ev dTdh_ev h_ev T_sv p_sv dTdh_sv h_sv
// a_hor d R) to run this.
//
// Three computations of each event:
//   seen       over the horizon he measured (its altitude and distance), with the engine's refraction;
//   halachic   over the bare-earth terrain (the engine's visible sunrise: hills count, trees and buildings do not);
//   almanac    the secular sunrise / sunset (the centre 50' below a level horizon).
// Refraction: the place's monthly normals (the kept method), and, for "seen", also the air measured at the time.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as AE from 'astronomy-engine';
const Z = new URL('../../', import.meta.url).href;
const { computeSkyline } = await import(Z + 'src/terrain/skyline.js');
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay } = await import(Z + 'src/refraction.js');
const CACHE = new URL('./cache/', import.meta.url);
mkdirSync(CACHE, { recursive: true });
const SOURCE = process.argv[2] ?? 'gedtm';

// The sites (thesis section 2.2). A: the apartment building; B: the Henry Marshall Tory Building roof.
const A = { lat: 53.52599, lon: -113.48732 }, B = { lat: 53.5281, lon: -113.5194 };
const siteFor = (rise, y, m, d) => {
  const md = m * 100 + d;
  if (rise) return md >= 1103 || md <= 202 ? { ...A, eye: 687, id: 'A687' } : { ...A, eye: 704, id: 'A704' };
  if ((y === 1992 && md >= 1005) || (y === 1993 && (md <= 326 || (md >= 510 && md <= 717)))) return { ...B, eye: 728, id: 'B728' };
  if (md >= 914 && md <= 1003) return { ...A, eye: 704, id: 'A704' };
  return { ...A, eye: 687, id: 'A687' };
};

const rows = readFileSync(new URL('sampson-1994.tsv', CACHE), 'utf8').trim().split('\n').slice(1).map((l) => {
  const c = l.split('\t'); const [mm, dd, yy] = c[2].split('/').map(Number);
  return { page: c[0], table: c[1], y: 1900 + yy, m: mm, d: dd, time: c[3], Tev: parseFloat(c[4]), pev: parseFloat(c[5]), a: parseFloat(c[12]), dkm: parseFloat(c[13]), R: parseFloat(c[14]) };
});
const cached = async (name, make) => {
  const f = new URL(name, CACHE);
  if (existsSync(f)) return JSON.parse(readFileSync(f));
  const v = await make(); writeFileSync(f, JSON.stringify(v)); return v;
};
const climate = await cached('climate_edmonton.json', async () => {
  const a = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${A.lat}&longitude=${A.lon}&start_date=2011-01-01&end_date=2020-12-31&daily=temperature_2m_mean,surface_pressure_mean&timezone=GMT`)).json();
  const T = Array.from({ length: 12 }, () => []), P = Array.from({ length: 12 }, () => []);
  a.daily.time.forEach((d, i) => { const m = +d.slice(5, 7) - 1; if (a.daily.temperature_2m_mean[i] != null) T[m].push(a.daily.temperature_2m_mean[i]); if (a.daily.surface_pressure_mean[i] != null) P[m].push(a.daily.surface_pressure_mean[i]); });
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  return { elevation: a.elevation, tempC: T.map(mean), pressure: P.map(mean) };
});
const SKY = {};
for (const s of [{ ...A, eye: 687, id: 'A687' }, { ...A, eye: 704, id: 'A704' }, { ...B, eye: 728, id: 'B728' }])
  SKY[s.id] = await cached(`sky_edmonton_${s.id}_${SOURCE}.json`, () => computeSkyline({ lat: s.lat, lon: s.lon }, { vantage: { lat: s.lat, lon: s.lon, eye: s.eye }, maxKm: 60, source: SOURCE }));
const normals = (date, eye) => {
  const t = normalForDay(climate.tempC, date), p = normalForDay(climate.pressure, date);
  return { tempC: t - 0.0065 * (eye - climate.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, climate.elevation) };
};
// A skyline that is the measured horizon all round (only its value at the Sun's azimuth matters).
const flatSky = (s, a, dkm) => {
  const n = 1801, side = (az0) => ({ az0, step: 0.1, angle: new Array(n).fill(a), dist: new Array(n).fill(dkm * 1000) });
  return { vantage: { lat: s.lat, lon: s.lon, eye: s.eye }, params: { k: 0.13 }, east: side(0), west: side(180) };
};
const sunAlt = (ms, s) => { const t = AE.MakeTime(new Date(ms)), ob = new AE.Observer(s.lat, s.lon, s.eye); const e = AE.Equator(AE.Body.Sun, t, ob, true, true); return AE.Horizon(t, ob, e.ra, e.dec).altitude; };
const almanacNear = (ms, s, rise) => { let lo = ms - 3600e3, hi = ms + 3600e3; const f = (t) => (sunAlt(t, s) + 50 / 60) * (rise ? 1 : -1); for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };

const res = [];
for (const r of rows) {
  if (!r.time || !Number.isFinite(r.a)) continue;
  const obs = Date.parse(`${r.y}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}T${r.time}Z`);
  const rise = r.table === 'D.1'; // Table D.1 sunrises, D.2 sunsets
  const loc = new Date(obs + (A.lon / 15) * 3600e3), date = { y: loc.getUTCFullYear(), m: loc.getUTCMonth() + 1, d: loc.getUTCDate() };
  const s = siteFor(rise, loc.getUTCFullYear(), date.m, date.d);
  const ev = rise ? 'sunrise' : 'sunset';
  const pick = (sky, air) => { const v = visibleRiseSet(date, sky, { refraction: { sunrise: air, sunset: air } })[ev]; return v ? (obs - v.raw) / 1000 : null; };
  const n = normals(date, s.eye);
  const measured = Number.isFinite(r.Tev) && Number.isFinite(r.pev) ? { tempC: r.Tev, pressure: r.pev } : null;
  const out = { ...r, rise, site: s.id,
    seen: pick(flatSky(s, r.a, r.dkm || 15), n),
    seenMeasuredAir: measured ? pick(flatSky(s, r.a, r.dkm || 15), measured) : null,
    halachic: pick(SKY[s.id], n),
    almanac: (obs - almanacNear(obs, s, rise)) / 1000 };
  res.push(out);
}
writeFileSync(new URL(`sampson-results-${SOURCE}.json`, CACHE), JSON.stringify(res, null, 1));

const ok = (k) => (r) => Number.isFinite(r[k]);
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length, rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((b) => (b - m) ** 2))); };
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log(`observed - computed (s), terrain ${SOURCE}: n / mean / sd / rms / median |error|`);
for (const [g, t] of [['Sunrises', (r) => r.rise], ['Sunsets', (r) => !r.rise], ['All', () => true]]) {
  console.log(`\n${g}`);
  for (const [k, label] of [['seen', 'Visible, over the horizon he measured'], ['seenMeasuredAir', '  the same, with the air measured then'], ['halachic', 'Visible, bare-earth terrain (halachic)'], ['almanac', 'Secular almanac (level)']]) {
    const v = res.filter(t).filter(ok(k)).map((r) => r[k]);
    console.log('  ' + label.padEnd(40), String(v.length).padStart(4), mean(v).toFixed(1).padStart(7), sd(v).toFixed(1).padStart(6), rms(v).toFixed(1).padStart(6), med(v.map(Math.abs)).toFixed(1).padStart(6));
  }
}
