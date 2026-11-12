// Visible sunrise and sunset over a skyline (skyline.js): the moment the Sun's upper limb, as refracted, first clears
// (last touches) the terrain at the Sun's azimuth, seen from the vantage point. Then the safety cushion, and a flag when
// the ground that decides it is near (buildings and trees there are not in the elevation data).
import { transit, crossing, sunPosition, sunDistance } from '../sun.js';
import { horizonRefraction, horizonDip } from '../refraction.js';
import { horizonAt, farSky } from './skyline.js';

const D2R = Math.PI / 180;
// Chai Tables' practice: a cushion after the computed visible sunrise / before the visible sunset (15–20 s).
export const CUSHION_S = 15;
export const NEAR_M = 6000;
const STEP_MS = 20000;
const LEVELS_MEMO = new Map(); // scan step (the Sun moves ~0.1° of azimuth in 20 s; the skyline is every 0.1°)

// Bennett (1982) refraction at apparent altitude h (degrees), scaled so that h = 0 gives `atHorizon` (the day's
// horizon refraction, from the air's pressure and temperature). Stage 3 replaces this with a ray trace, which also
// matters below the astronomical horizon (skylines seen from a height).
const bennett = (h) => 1 / Math.tan((h + 7.31 / (h + 4.4)) * D2R) / 60;
export const refractionAt = (h, atHorizon) => (bennett(Math.max(h, -3)) * atHorizon) / bennett(0);
// The day's refraction model for one event: a ray-traced table (airprofiles.js tableFor: { refraction(e) }) when given,
// else Bennett scaled to the horizon refraction from { tempC, pressure } or a number of degrees.
export function refractionModel(r) {
  if (r && typeof r.refraction === 'function') { const f = (h) => r.refraction(h); f.table = r; return f; }
  const atH = typeof r === 'number' ? r : horizonRefraction(r ?? {});
  return (h) => refractionAt(h, atH);
}
const R_EARTH = 6371000;
// With a ray-traced table, the skyline's terrain is lifted (or lowered) by the same air: the skyline was computed with
// k = sky.params.k; the day's air gives k' over the band the terrain ray crosses, which raises the apparent angle by
// (k' − k)·d / 2R (d = the obstruction's distance).
function skylineInAir(hz, sky, refrH, eye) {
  const t = refrH.table;
  if (!t?.kBetween || !hz.dist) return hz.angle;
  const k0 = sky.params?.k ?? 0.13;
  const d = hz.dist, hTop = eye + d * Math.tan(hz.angle * Math.PI / 180) + (d * d * (1 - k0)) / (2 * R_EARTH);
  const k1 = t.kBetween(eye, hTop);
  return hz.angle + ((k1 - k0) * d) / (2 * R_EARTH) * (180 / Math.PI);
}

// Apparent altitude of the upper limb minus the skyline at the Sun's azimuth, at moment t; NaN outside the wedges.
// floor (degrees, or undefined): the skyline is never lower than this (Rabbi Diskin's horizon: the sea-level horizon
// from the vantage, the nearer hills being disregarded).
function clearance(t, place, sky, refrH, floor) {
  const p = sunPosition(t, place);
  let hz = horizonAt(sky, p.azimuth);
  if (!hz) return { f: NaN };
  if (floor !== undefined && !(hz.angle > floor)) hz = { angle: floor, dist: null, floor: true };
  const upper = p.altitude + sunDistance(t).radiusDeg; // geometric upper limb
  let app = upper;
  for (let i = 0; i < 3; i++) app = upper + refrH(app); // apparent = geometric + R(apparent)
  return { f: app - (hz.floor ? hz.angle : skylineInAir(hz, sky, refrH, place.elevation)), hz, az: p.azimuth };
}

function bisect(lo, hi, g) { // g(lo) < 0 <= g(hi) (or reversed sign handled by caller)
  for (let i = 0; i < 40 && hi - lo > 50; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Visible sunrise and sunset on a civil date. sky = computeSkyline() result. cfg.refraction = { sunrise: {tempC,
 * pressure}, sunset: {...} } or degrees; cfg.cushionS (default 15). Returns { sunrise, sunset } each
 * { time (epoch ms, cushion included), raw (without cushion), angle (°), dist (m), near (bool), azimuth } or null.
 */
export function visibleRiseSet(date, sky, cfg = {}) {
  // A set of candidate vantages (computeHorizonSet): the earliest sunrise and the latest sunset of any of them.
  // cfg.far: over the far skylines (only mountains more than a day's walk away, Rabbi Diskin), when the set has them.
  if (sky.candidates) {
    let sunrise = null, sunset = null;
    const far = !!cfg.far;
    if (far && !sky.candidates.every((c) => c.far)) return { sunrise: null, sunset: null };
    const all = sky.candidates.map((_, i) => i);
    const ri = (far ? sky.farSunriseIdx : sky.sunriseIdx) ?? all, si = (far ? sky.farSunsetIdx : sky.sunsetIdx) ?? all;
    for (const i of new Set([...ri, ...si])) {
      const c = sky.candidates[i];
      const v = visibleRiseSet(date, far ? farSky(c) : c, { ...cfg, far: false, diskin: far });
      if (ri.includes(i) && v.sunrise && (!sunrise || v.sunrise.time < sunrise.time)) sunrise = { ...v.sunrise, vantage: c.vantage };
      if (si.includes(i) && v.sunset && (!sunset || v.sunset.time > sunset.time)) sunset = { ...v.sunset, vantage: c.vantage };
    }
    return { sunrise, sunset };
  }
  const v = sky.vantage;
  const place = { lat: v.lat, lon: v.lon, elevation: v.eye };
  // The day's transit and level crossings at this vantage, shared by its near and far skylines.
  const key = `${date.y}-${date.m}-${date.d}:${v.lat},${v.lon},${v.eye}`;
  let base = LEVELS_MEMO.get(key);
  if (!base) {
    const n = transit(date, place);
    base = { noon: n, rise: crossing(date, place, -0.833, +1, n), set: crossing(date, place, -0.833, -1, n) };
    if (LEVELS_MEMO.size > 400) LEVELS_MEMO.clear();
    LEVELS_MEMO.set(key, base);
  }
  const noon = base.noon;
  const refr = (ev) => refractionModel(typeof cfg.refraction === 'number' ? cfg.refraction : cfg.refraction?.[ev]);
  const cushion = (cfg.cushionS ?? CUSHION_S) * 1000;
  // cfg.diskin (the far skylines, Rabbi Diskin): the nearer hills are disregarded, so where no far mountain rises above
  // it the Sun is seen on the sea-level horizon from the vantage (its dip, standard terrestrial refraction).
  const floor = cfg.diskin ? -horizonDip(v.eye) : undefined;
  const result = (t, refrH, sign) => {
    const c = clearance(t, place, sky, refrH, floor);
    // The cushion is for the terrain's uncertainty; on the open horizon there is none.
    return { time: Math.round(t + (c.hz.floor ? 0 : sign * cushion)), raw: Math.round(t), angle: c.hz.angle, dist: c.hz.dist,
      near: !c.hz.floor && c.hz.dist < NEAR_M, open: !!c.hz.floor, azimuth: c.az };
  };
  // Where the scan starts: well before the level time; for Rabbi Diskin's horizon a little before the Sun reaches the
  // sea-level horizon (nothing can be seen earlier).
  const lead = (dir, lvl) => {
    if (floor === undefined) return lvl - dir * 45 * 60000;
    const t = crossing(date, place, floor - 0.833 - 0.3, dir, noon);
    return t ?? lvl - dir * 45 * 60000;
  };

  // Sunrise: scan forward from before the level sunrise; the first moment the limb clears the skyline.
  let sunrise = null;
  const rR = refr('sunrise');
  const level = base.rise;
  if (level !== null) {
    const g = (t) => clearance(t, place, sky, rR, floor).f;
    let prev = lead(+1, level), fp = g(prev);
    for (let k = 0; k < 6 && fp >= 0; k++) { prev -= 5 * 60000; fp = g(prev); }
    for (let t = prev + STEP_MS; t <= Math.min(noon, level + 3 * 3600000); t += STEP_MS) {
      const f = g(t);
      if (fp < 0 && f >= 0) { sunrise = result(bisect(prev, t, g), rR, +1); break; }
      prev = t; fp = f;
    }
  }
  // Sunset: scan backward from after the level sunset; the last moment the limb is above the skyline.
  let sunset = null;
  const rS = refr('sunset');
  const levelS = base.set;
  if (levelS !== null) {
    const g = (t) => clearance(t, place, sky, rS, floor).f;
    let next = lead(-1, levelS), fn = g(next);
    for (let k = 0; k < 6 && fn >= 0; k++) { next += 5 * 60000; fn = g(next); }
    for (let t = next - STEP_MS; t >= Math.max(noon, levelS - 3 * 3600000); t -= STEP_MS) {
      const f = g(t);
      if (fn < 0 && f >= 0) { sunset = result(bisectSet(t, next, g), rS, -1); break; }
      next = t; fn = f;
    }
  }
  return { sunrise, sunset };
}

// Sunset: g(lo) >= 0 (above the skyline), g(hi) < 0; the moment it goes below.
function bisectSet(lo, hi, g) {
  for (let i = 0; i < 40 && hi - lo > 50; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) >= 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
