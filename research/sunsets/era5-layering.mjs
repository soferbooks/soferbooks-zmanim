// Does ERA5's typical layering (2011-2020 monthly means at that hour, ray traced along the line of sight) predict the
// observed sunrises / sunsets of Edmonton (Sampson 1994) and the Chilean coast (Schaefer & Liller 1990) better than the
// engine's normals? Three refractions for each event, over the horizon actually seen (Sampson's measured horizon; the
// sea horizon in Chile, where no terrain blocks it):
//   normals   the engine's kept method: Bennett scaled to the month's mean temperature and pressure;
//   era5      the month's mean ERA5 air at that hour, ray traced;
//   era5kept  the same, times one constant per place and event (model against model, no observations) so the average
//             computed time equals the normals': ERA5 adds only the shape through the year and the day.
// Run after fetch_clim.py and extract_clim.py (and with cache/sampson-1994.tsv, see sampson-edmonton.mjs).
import { readFileSync, writeFileSync } from 'node:fs';
import * as AE from 'astronomy-engine';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet, refractionAt } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay, horizonRefraction, horizonDip } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, refractionTable } = await import(Z + 'src/raytrace.js');
const C = new URL('./cache/', import.meta.url);
const PROF = JSON.parse(readFileSync(new URL('clim_events.json', C)));

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
const climateAir = (c, date, eye) => {
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) };
};
const scaled = (tbl, s) => ({ ...tbl, refraction: (e) => s * tbl.refraction(e) });
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length, rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((b) => (b - m) ** 2))); };
// Choose s so that the mean computed time with era5 x s equals the normals' (bisection; time(s) is monotonic).
const keepMean = (events, timeOf) => {
  const diff = (s) => mean(events.map((e) => timeOf(e, s) - timeOf(e, null)).filter(Number.isFinite));
  let lo = 0.6, hi = 1.6; const sign = Math.sign(diff(1.2) - diff(0.8));
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (Math.sign(diff(mid)) === sign) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
};
const report = (title, groups, res) => {
  console.log(`\n${title}: observed - computed (s): n / mean / sd / rms`);
  for (const [g, t] of groups) {
    const s = res.filter(t).filter((r) => ['normals', 'era5', 'era5kept'].every((k) => Number.isFinite(r[k]))); console.log(` ${g}`);
    for (const k of ['normals', 'era5', 'era5kept']) console.log(`   ${k.padEnd(9)} ${String(s.length).padStart(4)} ${mean(s.map((r) => r[k])).toFixed(1).padStart(7)} ${sd(s.map((r) => r[k])).toFixed(1).padStart(6)} ${rms(s.map((r) => r[k])).toFixed(1).padStart(6)}`);
  }
};

// ---- Edmonton -------------------------------------------------------------------------------------------------------
{
  const A = { lat: 53.52599, lon: -113.48732 }, B = { lat: 53.5281, lon: -113.5194 };
  const siteFor = (rise, y, m, d) => {
    const md = m * 100 + d;
    if (rise) return md >= 1103 || md <= 202 ? { ...A, eye: 687, id: 'A687' } : { ...A, eye: 704, id: 'A704' };
    if ((y === 1992 && md >= 1005) || (y === 1993 && (md <= 326 || (md >= 510 && md <= 717)))) return { ...B, eye: 728, id: 'B728' };
    if (md >= 914 && md <= 1003) return { ...A, eye: 704, id: 'A704' };
    return { ...A, eye: 687, id: 'A687' };
  };
  const climate = JSON.parse(readFileSync(new URL('climate_edmonton.json', C)));
  const flatSky = (s, a, dkm) => { const n = 1801, side = (az0) => ({ az0, step: 0.1, angle: new Array(n).fill(a), dist: new Array(n).fill(dkm * 1000) }); return { vantage: { lat: s.lat, lon: s.lon, eye: s.eye }, params: { k: 0.13 }, east: side(0), west: side(180) }; };
  const ev = [];
  for (const l of readFileSync(new URL('sampson-1994.tsv', C), 'utf8').trim().split('\n').slice(1)) {
    const c = l.split('\t'), [mm, dd, yy] = c[2].split('/').map(Number), a = parseFloat(c[12]), dkm = parseFloat(c[13]) || 15;
    if (!Number.isFinite(a)) continue;
    const obs = Date.parse(`19${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T${c[3]}Z`), rise = c[1] === 'D.1';
    const loc = new Date(obs + (A.lon / 15) * 3600e3), date = { y: loc.getUTCFullYear(), m: loc.getUTCMonth() + 1, d: loc.getUTCDate() };
    const s = siteFor(rise, date.y, date.m, date.d), prof = PROF[`edm|${c[2]}|${c[3]}`];
    ev.push({ obs, rise, date, s, sky: flatSky(s, a, dkm), air: climateAir(climate, date, s.eye), tbl: refractionTable(atmosphereOf(prof, s.lat), s.eye), group: `${rise ? 'rise' : 'set'}|${s.id}` });
  }
  const timeOf = (e, s) => visibleRiseSet(e.date, e.sky, { refraction: s === null ? { sunrise: e.air, sunset: e.air } : { sunrise: scaled(e.tbl, s), sunset: scaled(e.tbl, s) } })[e.rise ? 'sunrise' : 'sunset']?.raw;
  const S = {};
  for (const g of new Set(ev.map((e) => e.group))) { S[g] = keepMean(ev.filter((e) => e.group === g), timeOf); }
  console.log('Edmonton scale per site/event:', Object.entries(S).map(([g, s]) => `${g} ${s.toFixed(3)}`).join(', '));
  const res = ev.map((e) => ({ rise: e.rise, tempC: e.air.tempC, normals: (e.obs - timeOf(e, null)) / 1000, era5: (e.obs - timeOf(e, 1)) / 1000, era5kept: (e.obs - timeOf(e, S[e.group])) / 1000 }));
  report('Edmonton (Sampson 1994), over the horizon he measured', [['Sunrises', (r) => r.rise], ['Sunsets', (r) => !r.rise], ['All', () => true]], res);
  // Cold-dawn test: by the day's normal mean temperature at the eye, and the rule "ERA5's layering only below T".
  const ok = res.filter((r) => Number.isFinite(r.normals) && Number.isFinite(r.era5));
  const st = (v) => `${String(v.length).padStart(4)} ${mean(v).toFixed(1).padStart(7)} ${rms(v).toFixed(1).padStart(6)}`;
  for (const [lab, isRise] of [['sunrises', true], ['sunsets', false]]) {
    console.log(`\n Edmonton ${lab} by the normal temperature: n / mean / rms, normals | era5`);
    for (const [lo, hi] of [[-40, -10], [-10, -5], [-5, 0], [0, 5], [5, 40]]) {
      const s = ok.filter((r) => r.rise === isRise && r.tempC >= lo && r.tempC < hi);
      if (s.length) console.log(`   ${String(lo).padStart(3)} to ${String(hi).padStart(3)} C ${st(s.map((r) => r.normals))} | ${st(s.map((r) => r.era5))}`);
    }
    for (const T of [-10, -5, 0, 5, 99]) {
      const s = ok.filter((r) => r.rise === isRise);
      console.log(`   rule: era5 below ${T === 99 ? 'any' : T + ' C'}: ${st(s.map((r) => (r.tempC < T ? r.era5 : r.normals)))}`);
    }
  }
  writeFileSync(new URL('cold-dawn-edmonton.json', C), JSON.stringify(ok));
}

// ---- Chile ----------------------------------------------------------------------------------------------------------
{
  const rows = readFileSync(new URL('../schaefer-liller-1990.tsv', C), 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t')).filter((c) => +c[2] < 0);
  const ev = [];
  for (const c of rows) {
    const s = { site: c[1], lat: +c[2], lon: +c[3], alt: +c[4] }, obs = Date.parse(`${c[6]}T${c[7]}Z`);
    const loc = new Date(obs + (s.lon / 15) * 3600e3), date = { y: loc.getUTCFullYear(), m: loc.getUTCMonth() + 1, d: loc.getUTCDate() };
    const climate = JSON.parse(readFileSync(new URL(`climate_${s.site.replace(/\W/g, '')}_${s.alt}.json`, C)));
    ev.push({ obs, s, air: climateAir(climate, date, s.alt), tbl: refractionTable(atmosphereOf(PROF[`sl|${c[6]}|${c[7]}`], s.lat), s.alt), group: s.site });
  }
  // The limb sets on the sea horizon: geometric upper limb = e0 - R(e0), e0 = -dip.
  const sunAlt = (ms, s) => { const t = AE.MakeTime(new Date(ms)), ob = new AE.Observer(s.lat, s.lon, s.alt); const e = AE.Equator(AE.Body.Sun, t, ob, true, true); return AE.Horizon(t, ob, e.ra, e.dec).altitude + 959.63 / 3600 / e.dist; };
  const timeOf = (e, sc) => {
    const e0 = -horizonDip(e.s.alt), R = sc === null ? refractionAt(e0, horizonRefraction(e.air)) : sc * e.tbl.refraction(e0);
    let lo = e.obs - 3600e3, hi = e.obs + 3600e3; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (sunAlt(mid, e.s) - (e0 - R) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const S = {};
  for (const g of new Set(ev.map((e) => e.group))) S[g] = keepMean(ev.filter((e) => e.group === g), timeOf);
  console.log('\nChile scale per site:', Object.entries(S).map(([g, s]) => `${g} ${s.toFixed(3)}`).join(', '));
  const res = ev.map((e) => ({ site: e.s.site, normals: (e.obs - timeOf(e, null)) / 1000, era5: (e.obs - timeOf(e, 1)) / 1000, era5kept: (e.obs - timeOf(e, S[e.group])) / 1000 }));
  report('Chile (Schaefer & Liller 1990), sea horizon', [['Vina del Mar', (r) => r.site === 'Vina del Mar'], ['La Serena', (r) => r.site === 'La Serena'], ['Cerro Tololo', (r) => r.site === 'Cerro Tololo'], ['All', () => true]], res);
}
