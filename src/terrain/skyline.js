// The skyline around a place, as Chai Tables computes it for a visible sunrise / sunset:
//   1. vantage point: the highest ground within a techum (TECHUM_M) of the location, eye EYE_M above it;
//   2. rays every 0.1° of azimuth over the eastern and western wedges (±34° around due east / west, wider where the
//      Sun's yearly swing is wider), out to MAX_KM;
//   3. along each ray, the apparent angle of every ground point above the vantage's horizontal, with the Earth's
//      curvature and standard terrestrial refraction (k = 0.13); ground within a techum of the vantage is shaved;
//   4. per azimuth, the highest angle and the distance of the ground that makes it.
// The result is small (≈ 1,400 angles and distances) and is cached per location.
import { Dem } from './dem.js';
import { K_STANDARD } from '../refraction.js';
import { visibleRiseSet } from './visible.js';

// A pause for the page between pieces of the work (the skylines take seconds on a phone).
// Without setTimeout (JavaScriptCore, QuickJS, Hermes with no host timers) it only yields to other promises.
const breathe = () => (typeof globalThis.setTimeout === 'function' ? new Promise((r) => globalThis.setTimeout(r, 0)) : Promise.resolve());
export const TECHUM_M = 1200;
export const EYE_M = 1.6;
// 100 km: Rav Druk's skyline over the Moab plateau has peaks 60–76 km away; searched to 60 km, his 1,921 observed
// sunrises scored 17.0 s rms, to 150 km 14.2 s (EXPERIMENTS.md, "How far the skyline reaches"). Past 100 km the Earth's
// curve hides anything under about 700 m.
export const MAX_KM = 100;
export const AZ_STEP = 0.1;
// Resolution by distance: [from m, to m, level] (0 = full 1″, 1 = 2″, 2 = 4″, 3 = 8″ overviews). Full resolution to
// 60 km: the overviews average the ground, which lowers peaks and gives an earlier (lenient) sunrise. Measured 2026-11-05
// against full resolution: 1″ to 15 km / 2″ to 35 km / 4″ beyond saved ~40 % of the download but moved the skyline up to
// 0.017° (≈ 5 s); coarser schedules up to 0.08° (≈ 23 s). Full: Great Neck 29 MB, Kotel 28 MB, Beit Shemesh 25 MB.
// Beyond 60 km the 4″ overview: the far skylines (Rabbi Diskin's horizon) already load those blocks, so it adds nothing to
// the download. Measured 2026-11-20 against 1″ to 150 km at Keller's three observation points, every day of a year:
// 0.3 s on average, 3 s at most (Rav Druk); on the 2,209 observed sunrises 14.0 s rms against 13.8 s.
export const LEVELS = [[0, 60000, 0], [60000, Infinity, 2]];
export const LEVELS_LIGHT = [[0, 15000, 0], [15000, 35000, 1], [35000, Infinity, 2]];

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
// WGS84 radii of curvature at a latitude.
const A = 6378137, E2 = 0.00669437999014;
function radii(lat) {
  const s = Math.sin(lat * D2R), w = Math.sqrt(1 - E2 * s * s);
  return { M: (A * (1 - E2)) / (w * w * w), N: A / w };
}
// Point at distance d (m) and azimuth az (degrees from north) from (lat, lon), on the local sphere (Gaussian radius).
export function destination(lat, lon, az, d) {
  const { M, N } = radii(lat), R = Math.sqrt(M * N);
  const p1 = lat * D2R, l1 = lon * D2R, a = az * D2R, dr = d / R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(a));
  const l2 = l1 + Math.atan2(Math.sin(a) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
  return [p2 * R2D, l2 * R2D];
}
export const earthRadius = (lat) => { const { M, N } = radii(lat); return Math.sqrt(M * N); };

// Wedge half-width: ±34°, or the Sun's yearly swing of rising / setting azimuth at this latitude plus 4°.
export function wedgeHalfWidth(lat) {
  const amp = Math.asin(Math.min(1, Math.sin(23.44 * D2R) / Math.cos(lat * D2R))) * R2D;
  return Math.max(34, amp + 4);
}

const levelAt = (d) => LEVELS.find(([a, b]) => d >= a && d < b)[2];

/**
 * Compute the skyline for a place. onProgress({ phase, done, total, message }) reports each step (for a progress display).
 * opts: { dem, techumM, eyeM, maxKm, levels, k }
 */
export async function computeSkyline(place, opts = {}, onProgress = () => {}) {
  const dem = opts.dem ?? new Dem({ source: opts.source ?? 'auto-bare' });
  const techum = opts.techumM ?? TECHUM_M, eye = opts.eyeM ?? EYE_M, maxD = (opts.maxKm ?? MAX_KM) * 1000;
  const levels = opts.levels ?? LEVELS;
  const lvl = (d) => levels.find(([a, b]) => d >= a && d < b)[2];
  const k = opts.k ?? K_STANDARD;
  const half = wedgeHalfWidth(place.lat);

  // 1. Vantage: the highest ground within a techum, on the full-resolution grid; or a given observer point
  //    (opts.vantage = { lat, lon, eye }: eye = the eye's height above sea level), as for recorded observations.
  onProgress({ phase: 'vantage', done: 0, total: 1, message: 'Finding the highest point nearby' });
  let v;
  if (opts.vantage) {
    await dem.load([[opts.vantage.lat, opts.vantage.lon, 0]]);
    v = { ...opts.vantage, ground: dem.elevation(opts.vantage.lat, opts.vantage.lon, 0) };
  } else {
    const near = [];
    for (let d = 0; d <= techum; d += 25) for (let az = 0; az < 360; az += d ? Math.max(1, (25 / d) * R2D) : 360) near.push([...destination(place.lat, place.lon, az, d), 0, d, az]);
    await dem.load(near.map(([a, b]) => [a, b, 0]));
    let best = { ground: -Infinity };
    for (const [la, lo] of near) {
      const h = dem.elevation(la, lo, 0);
      if (h > best.ground) best = { lat: la, lon: lo, ground: h };
    }
    v = { ...best, eye: best.ground + eye };
  }

  // 2. Load the blocks the two wedges cross (sampled coarsely: a block spans kilometres).
  const wedges = { east: 90, west: 270 };
  const coarse = [];
  for (const c of Object.values(wedges)) {
    for (let az = c - half; az <= c + half + 1e-9; az += 0.5) {
      for (let d = techum; d <= maxD; d += 500) coarse.push([...destination(v.lat, v.lon, az, d), lvl(d)]);
    }
  }
  await dem.load(coarse, (done, total) => onProgress({ phase: 'download', done, total, message: `Downloading terrain ${done} / ${total}` }));

  // 3–4. March each ray.
  const R = earthRadius(v.lat);
  const out = { version: 1, place: { lat: place.lat, lon: place.lon }, vantage: v, params: { techum, eye, maxKm: maxD / 1000, k, levels, azStep: AZ_STEP } };
  const n = Math.round((2 * half) / AZ_STEP) + 1;
  let raysDone = 0;
  for (const [side, c] of Object.entries(wedges)) {
    const angle = new Float32Array(n), dist = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i % 20 === 0) await breathe(); // let the page draw and answer taps while the skyline is computed
      const az = c - half + i * AZ_STEP;
      let maxA = -Infinity, at = 0;
      // Points along the ray: the exact great-circle point every kilometre, linear in between (well under a metre off).
      const knots = [];
      for (let kd = 0; kd <= maxD + 1000; kd += 1000) knots.push(destination(v.lat, v.lon, az, kd));
      for (let d = techum; d <= maxD;) {
        const L = lvl(d);
        const kq = Math.floor(d / 1000), f = d / 1000 - kq, A = knots[kq], B = knots[kq + 1];
        const la = A[0] + (B[0] - A[0]) * f, lo = A[1] + (B[1] - A[1]) * f;
        const h = dem.elevation(la, lo, L);
        if (Number.isFinite(h)) {
          const a = Math.atan((h - v.eye) / d - (d * (1 - k)) / (2 * R)) * R2D;
          if (a > maxA) { maxA = a; at = d; }
        }
        d += Math.max(10, 0.7 * 30 * 2 ** L); // under a cell per step at each resolution
      }
      angle[i] = Number.isFinite(maxA) ? maxA : -5; dist[i] = at; // no ground found: far below any sunrise
      if (++raysDone % 100 === 0) onProgress({ phase: 'skyline', done: raysDone, total: 2 * n, message: 'Computing the skyline' });
    }
    out[side] = { az0: c - half, step: AZ_STEP, angle: Array.from(angle, (x) => +x.toFixed(4)), dist: Array.from(dist, (x) => Math.round(x)) };
  }
  onProgress({ phase: 'done', done: 1, total: 1, message: 'Visible sunrise ready' });
  return out;
}

/**
 * Candidate vantage points within a techum, as Chai Tables uses its own vantage points: the local high points of the
 * ground (higher than everything within `windowM`), highest first, at least `sepM` apart, at most `count`; the highest
 * point is always first. Returns [{ lat, lon, ground }].
 */
export async function findVantages(dem, place, { techumM = TECHUM_M, count = 25, windowM = 90, sepM = 150 } = {}) {
  const step = 30;
  const R = earthRadius(place.lat);
  const mLat = (180 / Math.PI) / R, mLon = mLat / Math.cos(place.lat * D2R);
  const n = Math.ceil(techumM / step);
  const pts = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (Math.hypot(i, j) * step <= techumM) pts.push([place.lat + i * step * mLat, place.lon + j * step * mLon, 0]);
  await dem.load(pts);
  const idx = (i, j) => (i + n) * (2 * n + 1) + (j + n);
  const H = new Float64Array((2 * n + 1) ** 2).fill(NaN);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    if (Math.hypot(i, j) * step > techumM) continue;
    H[idx(i, j)] = dem.elevation(place.lat + i * step * mLat, place.lon + j * step * mLon, 0);
  }
  const w = Math.max(1, Math.round(windowM / step));
  const peaks = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const h = H[idx(i, j)];
    if (!Number.isFinite(h)) continue;
    let top = true;
    for (let a = -w; a <= w && top; a++) for (let b = -w; b <= w; b++) {
      if ((a || b) && Math.abs(i + a) <= n && Math.abs(j + b) <= n && H[idx(i + a, j + b)] > h) { top = false; break; }
    }
    if (top) peaks.push({ lat: place.lat + i * step * mLat, lon: place.lon + j * step * mLon, ground: h });
  }
  peaks.sort((a, b) => b.ground - a.ground);
  const out = [];
  for (const p of peaks) {
    if (out.length >= count) break;
    if (out.every((q) => Math.hypot((p.lat - q.lat) / mLat, (p.lon - q.lon) / mLon) >= sepM)) out.push(p);
  }
  return out;
}

/**
 * Chai Tables' way (a design decision): skylines from every candidate vantage within a techum; each day the earliest
 * sunrise and the latest sunset of any of them (visible.js). opts.shaveM: ground ignored around each candidate.
 * onProgress as computeSkyline, plus phase 'candidates' (done / total skylines).
 */
export async function computeHorizonSet(place, opts = {}, onProgress = () => {}) {
  const dem = opts.dem ?? new Dem({ source: opts.source ?? 'auto-bare' });
  const techum = opts.techumM ?? TECHUM_M, eye = opts.eyeM ?? EYE_M;
  onProgress({ phase: 'vantage', done: 0, total: 1 });
  const cands = await findVantages(dem, place, { techumM: techum, count: opts.count ?? CANDIDATES });
  const skies = [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    // The far mountains at full detail when the far skylines are (the app's "Far mountains in full detail").
    const levels = opts.levels ?? (opts.farLevels?.every(([, , l]) => l === 0) ? [[0, Infinity, 0]] : LEVELS);
    const sky = await computeSkyline(place, { ...opts, dem, levels, techumM: opts.shaveM ?? SHAVE_M, vantage: { lat: c.lat, lon: c.lon, eye: c.ground + eye } },
      (p) => { if (p.phase === 'download') onProgress(p); });
    delete sky.place;
    // Rabbi Diskin's horizon: only the mountains more than a day's walk away (FAR_M); the same high point, the same
    // terrain blocks (already loaded), every ray starting at FAR_M.
    if (opts.far !== false) {
      const far = await computeSkyline(place, { ...opts, dem, techumM: FAR_M, maxKm: FAR_MAX_KM, levels: opts.farLevels ?? FAR_LEVELS, vantage: { lat: c.lat, lon: c.lon, eye: c.ground + eye } });
      sky.far = { params: far.params, east: far.east, west: far.west };
    }
    skies.push(sky);
    onProgress({ phase: 'candidates', done: i + 1, total: cands.length });
  }
  const set = { version: 2, place: { lat: place.lat, lon: place.lon }, params: { techum, eye, shave: opts.shaveM ?? SHAVE_M }, candidates: skies };
  if (opts.prune !== false) await pruneCandidates(set);
  onProgress({ phase: 'done', done: 1, total: 1 });
  return set;
}
export const SHAVE_M = 300;
// A day's walk (Pesachim 93b: 40 mil) at 2,000 amot to the mil and Rav Chaim Na'eh's amah of 48 cm: 38.4 km. Mountains
// nearer than this are disregarded in Rabbi Yehoshua Leib Diskin's view (they are like a wall, as the Mount of Olives is
// for Jerusalem); farther ones, like the mountains of Moab, are the horizon. The smaller amah counts more mountains,
// which is the stricter side for both sunrise and sunset.
export const FAR_M = 38400;
// How far the far skylines look: the mountains of Moab are some 40–90 km from Jerusalem; past 100 km the Earth's curve
// hides anything under about 700 m.
export const FAR_MAX_KM = 100;
// The far skylines read the maps' 4″ overviews (about 120 m): at 40–100 km a cell's error is a few metres of height, a
// few seconds of time, and the download stays about the same as before (the full 1″ out to 100 km would be about three
// times as much).
export const FAR_LEVELS = [[0, Infinity, 2]];
// How many of the highest local high points within a techum are candidates. Chosen by the comparison with Chai Tables
// (test/own/compare-chaitables.js, 2026-11-05): with 8, Great Neck sunrise +0.5 s / sunset +4.5 s and Armon HaNatziv
// −6 s / +8 s on average; fewer miss Armon HaNatziv's latest-sunset points (−33 s with 5), more let in low points that
// see through gaps houses and trees close in reality (Great Neck sunrise up to 2 min early with all 17).
export const CANDIDATES = 8;

// Keep only the candidates that give the earliest sunrise (or latest sunset) on some day: every 4th day of a year, and
// any within 2 s of the best that day. Stores sunriseIdx / sunsetIdx; visible.js then computes only those.
export async function pruneCandidates(set, { year = new Date().getUTCFullYear(), stepDays = 4, slackMs = 2000 } = {}) {
  const rise = new Set(), sett = new Set();
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += stepDays * 86400000) {
    await breathe();
    const g = new Date(t), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
    const all = set.candidates.map((c) => visibleRiseSet(date, c));
    const r = all.map((v) => v.sunrise?.time ?? Infinity), s2 = all.map((v) => v.sunset?.time ?? -Infinity);
    const br = Math.min(...r), bs = Math.max(...s2);
    r.forEach((x, i) => { if (Number.isFinite(x) && x - br <= slackMs) rise.add(i); });
    s2.forEach((x, i) => { if (Number.isFinite(x) && bs - x <= slackMs) sett.add(i); });
  }
  set.sunriseIdx = [...rise].sort((a, b) => a - b);
  set.sunsetIdx = [...sett].sort((a, b) => a - b);
  // The same for the far skylines (Rabbi Diskin's horizon).
  if (set.candidates.every((c) => c.far)) {
    const fr = new Set(), fs = new Set();
    for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += stepDays * 86400000) {
      await breathe();
      const g = new Date(t), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
      const all = set.candidates.map((c) => visibleRiseSet(date, farSky(c), { diskin: true }));
      const r = all.map((v) => v.sunrise?.time ?? Infinity), s2 = all.map((v) => v.sunset?.time ?? -Infinity);
      const br = Math.min(...r), bs = Math.max(...s2);
      r.forEach((x, i) => { if (Number.isFinite(x) && x - br <= slackMs) fr.add(i); });
      s2.forEach((x, i) => { if (Number.isFinite(x) && bs - x <= slackMs) fs.add(i); });
    }
    set.farSunriseIdx = [...fr].sort((a, b) => a - b);
    set.farSunsetIdx = [...fs].sort((a, b) => a - b);
  }
  return set;
}

// A candidate's far skyline (Rabbi Diskin's horizon) in the shape of an ordinary one.
export const farSky = (c) => ({ vantage: c.vantage, params: c.far.params, east: c.far.east, west: c.far.west });

// Horizon angle (degrees) and obstruction distance (m) at an azimuth, interpolated; null outside the wedges.
export function horizonAt(sky, az) {
  az = ((az % 360) + 360) % 360;
  const side = az < 180 ? sky.east : sky.west;
  const f = (az - side.az0) / side.step;
  if (f < 0 || f > side.angle.length - 1) return null;
  const i = Math.min(Math.floor(f), side.angle.length - 2), t = f - i;
  return { angle: side.angle[i] * (1 - t) + side.angle[i + 1] * t, dist: t < 0.5 ? side.dist[i] : side.dist[i + 1] };
}
export { levelAt };
