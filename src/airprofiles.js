// The air at sunrise and sunset, for the ray-traced refraction (raytrace.js), from Open-Meteo (free, no key):
//   - normals: a place's typical temperature profile at sunrise and at sunset for each month, averaged over recent years
//     of Open-Meteo's archived forecasts (2 m, 80 / 120 / 180 m air and pressure levels up to 700 hPa, so dawn
//     inversions are in it), built once per place and cached (a few KB);
//   - live: the day's forecast profile at the moment of sunrise or sunset, when online.
// Each becomes an atmosphere (makeAtmosphere) and then a refraction table for the observer's height.
import { makeAtmosphere, refractionTable } from './raytrace.js';
import { transit, crossing } from './sun.js';

const LEVELS_HPA = [1000, 975, 950, 925, 900, 850, 800, 700];
const NEAR_M = [2, 80, 120, 180];
const VARS = [...NEAR_M.map((m) => `temperature_${m}m`), 'surface_pressure',
  ...LEVELS_HPA.map((p) => `temperature_${p}hPa`), ...LEVELS_HPA.map((p) => `geopotential_height_${p}hPa`)];
export const NORMAL_YEARS = [2022, 2025];

const url = (base, lat, lon, extra) => `${base}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${VARS.join(',')}&timezone=GMT&timeformat=unixtime${extra}`;
async function getJSON(u, fetchFn = fetch) {
  const r = await fetchFn(u);
  if (!r.ok) throw new Error(`Open-Meteo answered ${r.status}`);
  return r.json();
}

// The profile at one moment of an hourly series: { ground, levels [{h, t}], pressure {h, p} } (linear in time).
function profileAt(j, t) {
  const h = j.hourly, times = h.time;
  const i = Math.max(0, Math.min(times.length - 2, Math.floor((t / 1000 - times[0]) / 3600)));
  const f = Math.max(0, Math.min(1, (t / 1000 - times[i]) / (times[i + 1] - times[i])));
  const v = (k) => { const a = h[k]?.[i], b = h[k]?.[i + 1]; return a == null || b == null ? null : a + (b - a) * f; };
  const ground = j.elevation;
  const ps = v('surface_pressure');
  if (ps == null) return null;
  const levels = [];
  for (const m of NEAR_M) { const t2 = v(`temperature_${m}m`); if (t2 != null) levels.push({ h: ground + m, t: t2, key: `${m}m` }); }
  for (const p of LEVELS_HPA) {
    const t2 = v(`temperature_${p}hPa`), gh = v(`geopotential_height_${p}hPa`);
    if (t2 != null && gh != null && p < ps - 5 && gh > ground + 200) levels.push({ h: gh, t: t2, key: `${p}hPa` }); // only air above the ground
  }
  return { ground, levels: levels.sort((a, b) => a.h - b.h), pressure: { h: ground, p: ps } };
}

const eventTime = (date, place, ev) => crossing(date, place, -0.833, ev === 'sunrise' ? +1 : -1, transit(date, place));

/**
 * Typical profiles at sunrise and sunset by month: { [month 1..12]: { sunrise, sunset } } each { ground, levels,
 * pressure } averaged over NORMAL_YEARS. place = { lat, lon }. One request (~5 MB).
 */
export async function fetchProfileNormals(place, { years = NORMAL_YEARS, fetchFn, onYear = () => {} } = {}) {
  let j = null; // a year per request (longer ones time out), joined
  for (let y = years[0]; y <= years[1]; y++) {
    const part = await getJSON(url('https://historical-forecast-api.open-meteo.com/v1/forecast', place.lat, place.lon,
      `&start_date=${y}-01-01&end_date=${y}-12-31`), fetchFn);
    if (!j) j = part;
    else for (const k of Object.keys(j.hourly)) j.hourly[k] = j.hourly[k].concat(part.hourly[k] ?? []);
    onYear(y - years[0] + 1, years[1] - years[0] + 1);
  }
  return buildNormals(j, place);
}

export function buildNormals(j, place) {
  const acc = {};
  const y0 = new Date(j.hourly.time[0] * 1000), y1 = new Date(j.hourly.time.at(-1) * 1000);
  for (let t = Date.UTC(y0.getUTCFullYear(), y0.getUTCMonth(), y0.getUTCDate()); t < y1.getTime() - 86400000; t += 86400000) {
    const g = new Date(t), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
    for (const ev of ['sunrise', 'sunset']) {
      const te = eventTime(date, place, ev);
      if (te === null) continue;
      const pr = profileAt(j, te);
      if (!pr) continue;
      const a = ((acc[date.m] ??= {})[ev] ??= { n: 0, p: 0, lv: new Map() });
      a.n++; a.p += pr.pressure.p;
      for (const l of pr.levels) {
        const s = a.lv.get(l.key) ?? { h: 0, t: 0, n: 0 };
        s.h += l.h; s.t += l.t; s.n++; a.lv.set(l.key, s);
      }
    }
  }
  const out = { source: `Open-Meteo archived forecasts ${new Date(j.hourly.time[0] * 1000).getUTCFullYear()}–${y1.getUTCFullYear()}`, ground: j.elevation, months: {} };
  for (const [m, evs] of Object.entries(acc)) {
    out.months[m] = {};
    for (const [ev, a] of Object.entries(evs)) {
      // Each level (2 m … 180 m, each pressure level) averaged; a pressure level only where it was above the ground on most days.
      const levels = [...a.lv.values()].filter((s) => s.n >= a.n * 0.5).map((s) => ({ h: +(s.h / s.n).toFixed(1), t: +(s.t / s.n).toFixed(2) }));
      out.months[m][ev] = { ground: j.elevation, levels: levels.sort((x, y) => x.h - y.h), pressure: { h: j.elevation, p: +(a.p / a.n).toFixed(1) } };
    }
  }
  return out;
}

// The live forecast (past 2 days to 16 ahead): the raw hourly series, to be read with liveProfile().
export async function fetchProfileForecast(place, { fetchFn } = {}) {
  const j = await getJSON(url('https://api.open-meteo.com/v1/forecast', place.lat, place.lon, '&past_days=2&forecast_days=16'), fetchFn);
  return { fetched: Date.now(), ...j };
}
export function liveProfile(forecast, date, place, ev) {
  const te = eventTime(date, place, ev);
  if (te === null || te / 1000 < forecast.hourly.time[0] || te / 1000 > forecast.hourly.time.at(-1)) return null;
  return profileAt(forecast, te);
}

// A refraction table (raytrace.js) for a profile and an observer height (m above sea level), cached by content.
const tableCache = new Map();
export function tableFor(profile, hObs, lat) {
  const key = JSON.stringify([profile.levels, profile.pressure, Math.round(hObs), Math.round(lat)]);
  let t = tableCache.get(key);
  if (!t) {
    if (tableCache.size > 200) tableCache.clear();
    t = refractionTable(makeAtmosphere(profile.levels, profile.pressure, { lat }), hObs);
    tableCache.set(key, t);
  }
  return t;
}
