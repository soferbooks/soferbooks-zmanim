// Moonrise, moonset and the new moon for the soferbooks.com zmanim engine.
//
// Moonrise / moonset: Astronomy Engine (Donald Cross, MIT licence, npm "astronomy-engine"). Its topocentric Moon
// near the horizon agrees with NASA JPL Horizons to about 0.002° (checked at Great Neck, 25 Oct 2026), a second or
// two of time. Each event is solved exactly.
//
// New moon (the true, astronomical molad): astronomia's moonphase (Meeus, Astronomical Algorithms ch. 49; MIT
// licence), with ΔT from astronomia. Against JPL Horizons 2026-27 it is within 6 s (Astronomy Engine's own search
// is 31-42 s late). The traditional molad (arithmetic) is in molad.js and re-exported at the end of this file.
//
// Conventions as in sun.js: place = { lat, lon (east positive), elevation (m) }, times are epoch ms (UTC).
import * as AE from 'astronomy-engine';
import { moonphase, deltat, base, parallactic } from 'astronomia';
import { assertDate, assertPlace } from './check.js';

const DAY = 86400000, MIN = 60000;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const MOON_RADIUS_KM = 1737.4;
// Standard horizon refraction for rise and set (the almanac rule, also Astronomy Engine's): 34′.
export const MOON_HORIZON_REFRACTION_DEG = 34 / 60;

const observer = (place) => new AE.Observer(place.lat, place.lon, place.elevation ?? 0);
// The clock's midnight of the date: place.utcOffset (hours) when given, as sun.js's approxNoon; otherwise local mean
// midnight at the place's longitude.
const localMidnight = ({ y, m, d }, place) =>
  Date.UTC(y, m - 1, d) - (Number.isFinite(place.utcOffset) ? place.utcOffset : place.lon / 15) * 3600000;

// The Moon's topocentric geometric altitude of its centre, its angular radius, and the height of the highest lit
// point of the Moon above its centre. Rabbi Daniel Aharon Glauberman, Luach Ahavat Shalom, Appendix A §2 "Calculating
// moonrise" (pp. 645-647): for Birkat HaLevanah one needs the lit top corner of the crescent, not the dark top edge.
// His formula, radius × sin(90° − q) with q = arccos(sin latitude / cos declination), takes the horns along the
// north-south line through the pole (and needs the absolute value south of the Equator - his note, 2026). Here it is
// exact (Mordy, 2026-11-11), from Meeus, Astronomical Algorithms (as astronomia has them): the bright limb's position
// angle χ (48.5) less the parallactic angle q (14.1) is the bright limb's angle A from the zenith, with the sign
// either side of the Equator. The lit part is the bright half of the rim and the terminator, a half ellipse of
// semi-axis e = −cos(phase angle) on the dark side when gibbous. Its highest point: the top of the disc when A is
// within 90° (cos A ≥ 0); otherwise the higher horn, |sin A|, or on a gibbous Moon the terminator's top,
// √(sin²A + e² cos²A).
export function litTop(chi, q, phaseAngle) {
  const A = chi - q, c = Math.cos(A), s = Math.sin(A), e = -Math.cos(phaseAngle);
  return c >= 0 ? 1 : Math.sqrt(s * s + (e < 0 ? e * e * c * c : 0));
}
function moonState(ms, place, obs) {
  const t = AE.MakeTime(new Date(ms));
  const eq = AE.Equator(AE.Body.Moon, t, obs, true, true);
  const hor = AE.Horizon(t, obs, eq.ra, eq.dec);
  const sd = Math.asin(MOON_RADIUS_KM / (eq.dist * AE.KM_PER_AU)) * R2D;
  const sun = AE.Equator(AE.Body.Sun, t, obs, true, true);
  const moon = { ra: eq.ra * 15 * D2R, dec: eq.dec * D2R };
  const chi = base.limb(moon, { ra: sun.ra * 15 * D2R, dec: sun.dec * D2R });
  const H = (AE.SiderealTime(t) * 15 + place.lon) * D2R - moon.ra;
  const q = parallactic.parallacticAngle(place.lat * D2R, moon.dec, H);
  const phase = AE.Illumination(AE.Body.Moon, t).phase_angle * D2R;
  return { alt: hor.altitude, sd, corner: sd * litTop(chi, q, phase) };
}

/**
 * Moonrise (direction +1) or moonset (-1) on the civil date at the place, over a level horizon. The day runs from the
 * clock's midnight (place.utcOffset, hours) to the next; without utcOffset, from local mean midnight.
 * edge: 'top' (default): the top of the disc on the horizon with 34′ refraction (the almanac rule);
 *       'lit': the highest lit point - the crescent's lit top corner (Luach Ahavat Shalom, Appendix A §2, for Birkat
 *       HaLevanah), by Meeus's bright limb and parallactic angle; solved exactly.
 * Returns epoch ms, or null when the Moon does not rise / set that day.
 */
export function moonRiseSet(date, place, direction, { edge = 'top' } = {}) {
  assertDate(date); assertPlace(place);
  if (direction !== 1 && direction !== -1) throw new TypeError('moonRiseSet: direction must be +1 (rise) or -1 (set)');
  const obs = observer(place);
  const start = localMidnight(date, place);
  const ev = AE.SearchRiseSet(AE.Body.Moon, obs, direction, new Date(start), 1);
  if (!ev) return null;
  const top = ev.date.getTime();
  if (top >= start + DAY) return null;
  if (edge === 'top') return top;
  // The corner is lower than the top: it reaches the horizon before the top at moonset (after it at moonrise).
  // Solve f(t) = centre altitude + corner + refraction = 0 by bisection within 30 minutes of the top.
  const f = (ms) => { const s = moonState(ms, place, obs); return s.alt + s.corner + MOON_HORIZON_REFRACTION_DEG; };
  let lo = top - 30 * MIN, hi = top + 30 * MIN; // the Moon climbs (or sinks) steadily through this hour
  if (Math.sign(f(lo)) === Math.sign(f(hi))) return top;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

// The new moon of lunation k (Meeus's k: 0 = 6 Jan 2000), as epoch ms (UT). astronomia's newMoon(year) snaps
// k = (year - 2000) × 12.3685 to the nearest whole number, so the year 2000 + k / 12.3685 gives exactly lunation k.
function newMoonK(k) {
  const tt = (moonphase.newMoon(2000 + k / 12.3685) - 2440587.5) * DAY;
  return Math.round(tt - deltat.deltaT(1970 + tt / (365.2425 * DAY)) * 1000);
}
/** The astronomical new moon (true molad) nearest to the moment ms, as epoch ms (UT). */
export function newMoon(ms) {
  if (!Number.isFinite(ms)) throw new TypeError('newMoon: ms must be a finite number (epoch milliseconds)');
  const k = Math.round((ms / DAY + 2440587.5 - 2451550.09766) / 29.530588861); // mean lunation (Meeus 49.1)
  let best = null;
  for (const kk of [k - 1, k, k + 1]) { const t = newMoonK(kk); if (best === null || Math.abs(t - ms) < Math.abs(best - ms)) best = t; }
  return best;
}

/** The Moon's topocentric altitude (degrees, geometric, centre) at ms: for checks against other ephemerides. */
export function moonAltitude(ms, place) {
  return moonState(ms, place, observer(place)).alt;
}


// The traditional molad and the Kiddush Levana window (arithmetic, no dependencies): molad.js.
export { traditionalMolad, kiddushLevana } from './molad.js';
