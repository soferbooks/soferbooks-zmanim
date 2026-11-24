// Visible sunrise against people who watched it: Rabbi Chaim Keller's published observations (github.com/chaimkeller/software,
// observations-all-places: Rav Druk at Armon HaNatziv 1993-96, R' Golan at Neve Yaakov 2009-13, Rav Zuriel in Bnei Brak
// 1961-92; Israel Standard Time). They are not redistributed here: fetch-observations.mjs downloads them on the first run into
// fixtures/observations.json (not committed). The skyline of each observation point is computed from the elevation data once
// and saved in fixtures/ (--refresh downloads it again).
// Reports observed minus computed (without the cushion): the mean says whether we are early or late, the spread is the
// day-to-day weather the standard refraction cannot know.
// Usage: node test/compare-observations.js [--source=auto-bare|auto|gedtm|copernicus] [--refresh] [--techum=1200] [--refraction=normals|standard|profiles|traced-normals] [--maxkm=100] [--farlevel=2]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { computeSkyline, MAX_KM, LEVELS } from '../src/terrain/skyline.js';
import { visibleRiseSet } from '../src/terrain/visible.js';
import { fetchObservations } from './fetch-observations.mjs';
import { stationPressure, normalForDay } from '../src/refraction.js';
import { tableFor } from '../src/airprofiles.js';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const techumM = Number(arg('techum', 1200));
const refrMode = arg('refraction', 'normals');
const obsUrl = new URL('./fixtures/observations.json', import.meta.url);
if (!existsSync(obsUrl)) {
  try { await fetchObservations(obsUrl); } catch (e) {
    console.log(`skipped: Rabbi Keller's observations could not be downloaded (${e.message}); run once with internet`);
    process.exit(0);
  }
}
const fx = JSON.parse(readFileSync(obsUrl));
const source = arg('source', 'auto-bare');
// --maxkm: how far the skyline is searched (default the engine's MAX_KM, 100). --farlevel: the resolution beyond 60 km
// (default the engine's, 2 = the maps' 4″ overview; 0 = full). The old 60 km skylines are in the file without a suffix.
const maxKm = Number(arg('maxkm', MAX_KM));
const farLevel = Number(arg('farlevel', LEVELS.at(-1)[2]));
const levels = [[0, 60000, 0], [60000, Infinity, farLevel]];
const defaults = maxKm === MAX_KM && farLevel === LEVELS.at(-1)[2];
const cacheUrl = new URL(`./fixtures/fixture-skylines-observations-${techumM}-${source}${maxKm === 60 ? '' : `-${maxKm}km${farLevel ? `-far${farLevel}` : ''}`}.json`, import.meta.url);
let cache = existsSync(cacheUrl) && !process.argv.includes('--refresh') ? JSON.parse(readFileSync(cacheUrl)) : {};

// Monthly normals for refraction: ERA5 daily means 1991-2020 from Open-Meteo (CC BY 4.0; fixtures/fixture-climate-israel.json:
// Jerusalem for Armon HaNatziv and Neve Yaakov, Tel Aviv for Bnei Brak), brought from the grid cell's height to the observer's
// eye (6.5 K/km, barometric formula).
const CLIMATE = JSON.parse(readFileSync(new URL('./fixtures/fixture-climate-israel.json', import.meta.url))).sites;
// date = { y, m, d }: the monthly normals blended day by day (normalForDay), as an app should use them.
const climateAt = (site, date, eye) => {
  const c = CLIMATE[site === 'zuriel' ? 'telaviv' : 'jerusalem'];
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) };
};

// Ray-traced refraction through each site's typical profile at sunrise for the month (Open-Meteo archived forecasts
// 2022–2025, fixture-profile-normals-israel.json from airprofiles.js), for --refraction=profiles.
const profiles = refrMode === 'profiles' ? JSON.parse(readFileSync(new URL('./fixtures/fixture-profile-normals-israel.json', import.meta.url))) : null;
// The same monthly normals, ray traced through a standard atmosphere (6.5 K/km, no inversion) instead of Bennett's formula.
const tracedNormal = (id, date, eye, lat) => {
  const c = climateAt(id, date, eye);
  return tableFor({ levels: [{ h: eye, t: c.tempC }, { h: eye + 1000, t: c.tempC - 6.5 }], pressure: { h: eye, p: c.pressure } }, eye, lat);
};
let fresh = false;
const stats = {};
for (const [id, site] of Object.entries(fx.sites)) {
  if (!cache[id]) {
    cache[id] = await computeSkyline(site, { vantage: { lat: site.lat, lon: site.lon, eye: site.eye }, techumM, source, maxKm, levels });
    fresh = true;
  }
  const sky = cache[id];
  const s = (stats[id] = { n: 0, sum: 0, sq: 0, list: [], near: 0 });
  for (const r of fx.rows.filter((x) => x.site === id)) {
    const [y, m, d] = r.date.split('-').map(Number);
    const [hh, mi, ss] = r.time.split(':').map(Number);
    const obs = Date.UTC(y, m - 1, d, hh - 2, mi, ss);
    const cfg = refrMode === 'normals' ? { refraction: { sunrise: climateAt(id, { y, m, d }, sky.vantage.eye) } }
      : refrMode === 'profiles' ? { refraction: { sunrise: tableFor(profiles[id].months[m].sunrise, sky.vantage.eye, site.lat) } }
      : refrMode === 'traced-normals' ? { refraction: { sunrise: tracedNormal(id, { y, m, d }, sky.vantage.eye, site.lat) } } : {};
    const v = visibleRiseSet({ y, m, d }, sky, cfg).sunrise;
    if (!v) continue;
    const diff = (obs - v.raw) / 1000;
    if (Math.abs(diff) > 300) continue; // a mis-recorded entry
    s.n++; s.sum += diff; s.sq += diff * diff; s.list.push(diff); (s.dated ??= []).push([r.date, diff]);
    if (v.near) s.near++;
  }
}
if (fresh) writeFileSync(cacheUrl, JSON.stringify(cache));
// --dump=path: each observer's observed − computed (s), for research/sunsets/cushion.mjs.
const dump = arg('dump', '');
if (dump) writeFileSync(dump, JSON.stringify(Object.fromEntries(Object.entries(stats).flatMap(([id, s]) => [[id, s.list], [`${id}Dated`, s.dated]]))));
let allN = 0, allSum = 0, allSq = 0;
for (const [id, s] of Object.entries(stats)) {
  const mean = s.sum / s.n, rms = Math.sqrt(s.sq / s.n), sd = Math.sqrt(s.sq / s.n - mean * mean);
  const sorted = [...s.list].sort((a, b) => a - b), q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  console.log(`${fx.sites[id].name.padEnd(28)} ${String(s.n).padStart(4)} sunrises: observed − computed mean ${mean.toFixed(1).padStart(6)} s, sd ${sd.toFixed(1)} s, rms ${rms.toFixed(1)} s; 5%–95% ${q(0.05).toFixed(0)}…${q(0.95).toFixed(0)} s${s.near ? `; ${s.near} with near ground` : ''}`);
  allN += s.n; allSum += s.sum; allSq += s.sq;
}
// Pass: every observer's mean within 5 s and spread (rms) within 20 s, with the default settings (techum shave, normals).
const bad = Object.values(stats).filter((s) => Math.abs(s.sum / s.n) > 5 || Math.sqrt(s.sq / s.n) > 20).length;
console.log(`all ${allN} observed sunrises (techum shave ${techumM} m, ${refrMode} refraction, ${source} elevation, skyline to ${maxKm} km${farLevel ? `, level ${farLevel} beyond 60 km` : ''}): mean ${(allSum / allN).toFixed(1)} s, rms ${Math.sqrt(allSq / allN).toFixed(1)} s; ${bad} observers outside 5 s mean / 20 s rms`);
if (techumM === 1200 && refrMode === 'normals' && source === 'auto-bare' && defaults) process.exit(bad ? 1 : 0);
