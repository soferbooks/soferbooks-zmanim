// Sun positions and altitude crossings for the soferbooks.com zmanim engine.
// The astronomy comes from astronomia (commenthol, MIT licence, npm "astronomia"; a port of Meeus' Astronomical
// Algorithms): the full VSOP87B series for the Earth (2,582 terms, IMCCE), FK5 correction, IAU 1980 nutation,
// aberration, apparent sidereal time and ΔT. Against NASA JPL Horizons (DE441) it is within 0.12″ of the Sun every
// 5 days 2026-2029, closer than Astronomy Engine's Sun (2.1″); see
// test/compare-horizons.js. This file is only the glue: hour angles, topocentric parallax, and the search for
// the moment the Sun's centre reaches a given altitude.
//
// Conventions used everywhere in src/:
//   place = { lat, lon (east positive), elevation (m) }
//   times are epoch milliseconds (UTC); null = the Sun does not reach that altitude on that day.
import { solar, planetposition, sidereal, deltat, solstice } from 'astronomia';
import vsop87Bearth from 'astronomia/data/vsop87Bearth';

const earth = new planetposition.Planet(vsop87Bearth);
const DAY = 86400000;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const AU_KM = 149597870.7;
// The Sun's angular radius at 1 au: 959.63″ (Auwers' value, used by the Astronomical Almanac and by NREL's SPA).
export const SUN_RADIUS_1AU_DEG = 959.63 / 3600;
// The Sun's equatorial horizontal parallax at 1 au: 8.794″ (IAU).
const PARALLAX_1AU_DEG = 8.794 / 3600;
// Topocentric parallax on (the true view from the ground). Tests switch it off to compare with geocentric tables.
let parallaxScale = 1;
export function setTopocentric(on) { parallaxScale = on ? 1 : 0; }
const SUN_HA_RATE = 360.985647 - 0.9856; // degrees of hour angle per day (sidereal rate less the Sun's motion)

const jdOf = (ms) => ms / DAY + 2440587.5;
const decimalYear = (ms) => 1970 + ms / (365.2425 * DAY);
const norm180 = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

// The Sun's apparent geocentric RA / Dec (degrees), distance (au) and the equation of the equinoxes (degrees), computed
// exactly (full VSOP87 + nutation) on the hour and interpolated in between with a cubic through the four nearest hours:
// tested against the exact values: under 0.0003″ (0.00002 s of a sunrise); a day's searches then cost a few
// dozen VSOP87 evaluations instead of thousands.
const HOUR_MS = 3600000;
const exactCache = new Map();
function exactAt(k) { // k = whole hours since 1970
  let e = exactCache.get(k);
  if (!e) {
    if (exactCache.size > 2000) exactCache.clear();
    const ms = k * HOUR_MS, jd = jdOf(ms);
    const jde = jd + deltat.deltaT(decimalYear(ms)) / 86400;
    const eq = solar.apparentEquatorialVSOP87(earth, jde);
    const eqeq = (sidereal.apparent(jd) - sidereal.mean(jd)) / 240; // nutation in RA, degrees
    e = { ra: eq.ra * R2D, dec: eq.dec * R2D, au: eq.range, eqeq };
    exactCache.set(k, e);
  }
  return e;
}
const unwrap = (x, ref) => x + 360 * Math.round((ref - x) / 360);
let lastMs = NaN, last = null;
function geocentric(ms) {
  if (ms === lastMs) return last;
  const k = Math.floor(ms / HOUR_MS), t = ms / HOUR_MS - k; // between hour k and k+1
  const p = [exactAt(k - 1), exactAt(k), exactAt(k + 1), exactAt(k + 2)];
  // Lagrange cubic at x = t on nodes -1, 0, 1, 2.
  const w = [-t * (t - 1) * (t - 2) / 6, (t + 1) * (t - 1) * (t - 2) / 2, -(t + 1) * t * (t - 2) / 2, (t + 1) * t * (t - 1) / 6];
  const lerp = (f) => w[0] * f(p[0]) + w[1] * f(p[1]) + w[2] * f(p[2]) + w[3] * f(p[3]);
  const ra0 = p[1].ra;
  const jd = jdOf(ms);
  last = {
    ra: ((lerp((e) => unwrap(e.ra, ra0)) % 360) + 360) % 360, dec: lerp((e) => e.dec), au: lerp((e) => e.au),
    gast: ((sidereal.mean(jd) / 240 + lerp((e) => e.eqeq)) % 360 + 360) % 360,
  };
  lastMs = ms;
  return last;
}
// The exact (uninterpolated) values, for the tests.
export function geocentricExact(ms) {
  const jd = jdOf(ms), jde = jd + deltat.deltaT(decimalYear(ms)) / 86400;
  const eq = solar.apparentEquatorialVSOP87(earth, jde);
  return { ra: eq.ra * R2D, dec: eq.dec * R2D, au: eq.range, gast: (sidereal.apparent(jd) / 240) % 360 };
}
export { geocentric };

// Mean-solar noon of the civil date at the place's longitude (a starting point for the searches).
export function approxNoon(date, place) {
  // The civil date is the place's clock date. Where the clock is across the date line from the longitude (Samoa, Tonga,
  // Kiritimati, the Chatham Islands: UTC+13/+14 at longitude −150° to −180°, or the reverse), the longitude is taken
  // ±360° so the date's noon falls on that clock day (place.utcOffset: the zone's offset in hours; as KosherJava's
  // antimeridian adjustment).
  let lon = place.lon;
  if (Number.isFinite(place.utcOffset)) {
    const d = place.utcOffset - lon / 15;
    if (d > 12) lon += 360; else if (d < -12) lon -= 360;
  }
  return Date.UTC(date.y, date.m - 1, date.d, 12) - (lon / 15) * 3600000;
}

const hourAngle = (g, place) => norm180(g.gast + place.lon - g.ra);

// The moment the Sun's hour angle is `ha` degrees (0 = transit, ±180 = lower transit), near `start`.
function solveHourAngle(place, ha, start) {
  let t = start;
  for (let i = 0; i < 20; i++) {
    const dt = (norm180(ha - hourAngle(geocentric(t), place)) / SUN_HA_RATE) * DAY;
    t += dt;
    if (Math.abs(dt) < 1) break;
  }
  return Math.round(t);
}

// Solar transit (hatzot): the Sun on the upper meridian on the civil date.
export function transit(date, place) {
  return solveHourAngle(place, 0, approxNoon(date, place));
}

// Lower transit (hatzot halaila) after the date's transit.
export function lowerTransit(date, place) {
  return solveHourAngle(place, 180, transit(date, place) + DAY / 2);
}

// The Sun's distance (au) and angular radius (degrees) at a moment.
export function sunDistance(ms) {
  const g = geocentric(ms);
  return { au: g.au, radiusDeg: SUN_RADIUS_1AU_DEG / g.au };
}

// Topocentric altitude (no refraction) and azimuth (degrees from north, eastward) of the Sun's centre.
export function sunPosition(ms, place) {
  const g = geocentric(ms);
  const H = hourAngle(g, place) * D2R, phi = place.lat * D2R, dec = g.dec * D2R;
  const sinAlt = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const altGeo = Math.asin(sinAlt) * R2D;
  const az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) * R2D + 180) % 360;
  const altitude = altGeo - parallaxScale * (PARALLAX_1AU_DEG / g.au) * Math.cos(altGeo * D2R); // parallax lowers the Sun by ≤ 8.8″
  return { ra: g.ra, dec: g.dec, dist: g.au, distKm: g.au * AU_KM, azimuth: az, altitude };
}

/**
 * The moment the Sun's centre reaches `altitudeDeg` (topocentric, geometric: no refraction) on the morning (+1) or
 * evening (-1) of the civil date. altitudeDeg may be a function of the moment (a horizon that depends on the Sun's
 * distance, its azimuth, or the weather then). Newton's method on the hour angle, to 1 ms; null when the Sun does
 * not reach that altitude that day.
 */
export function crossing(date, place, altitudeDeg, direction, noon = transit(date, place)) {
  const target = typeof altitudeDeg === 'function' ? altitudeDeg : () => altitudeDeg;
  const phi = place.lat * D2R;
  let t = noon - direction * DAY / 4;
  for (let i = 0; i < 30; i++) {
    const g = geocentric(t);
    // Topocentric target → geocentric altitude (add back the parallax).
    const h = target(t) + parallaxScale * (PARALLAX_1AU_DEG / g.au) * Math.cos(target(t) * D2R);
    const dec = g.dec * D2R;
    const cosH0 = (Math.sin(h * D2R) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosH0 < -1 || cosH0 > 1) {
      // Not reached at this moment's declination. Near the threshold the declination of the event itself decides, so
      // look once more from near midnight, then settle it by bisection between the lower transit and the transit (the
      // Sun only just reaching the altitude: polar days, deep twilight; as KosherJava 3.1 does).
      if (i > 0) return bracketCrossing(place, target, direction, noon);
      t = noon - direction * DAY * 0.45;
      continue;
    }
    const want = -direction * Math.acos(cosH0) * R2D; // morning: negative hour angle
    const dt = (norm180(want - hourAngle(g, place)) / SUN_HA_RATE) * DAY;
    t += dt;
    if (Math.abs(dt) < 1) return Math.round(t);
  }
  return Math.round(t);
}

// The crossing by bisection on the Sun's topocentric altitude, in the half day before (morning) or after (evening) the
// transit; null when the altitude is not crossed there.
function bracketCrossing(place, target, direction, noon) {
  const f = (t) => sunPosition(t, place).altitude - target(t);
  let lo = direction > 0 ? noon - DAY / 2 : noon, hi = direction > 0 ? noon : noon + DAY / 2;
  const flo = f(lo), fhi = f(hi);
  if (direction > 0 ? !(flo < 0 && fhi >= 0) : !(flo >= 0 && fhi < 0)) return null;
  for (let i = 0; i < 60 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2, up = f(mid) >= 0;
    if (direction > 0 ? up : !up) hi = mid; else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

// The March equinox of a year (epoch ms, UT), from VSOP87 (Meeus ch. 27).
export function marchEquinox(year) {
  const jde = solstice.march2(year, earth);
  const ms = (jde - 2440587.5) * DAY;
  return ms - deltat.deltaT(decimalYear(ms)) * 1000;
}
