// Horizon refraction and the dip of the horizon, for the soferbooks.com zmanim engine.
//
// Stage 1 (this file): refraction at the horizon from a standard value scaled by the air's pressure and temperature,
// the textbook correction (Meeus, Astronomical Algorithms, ch. 16; Bennett 1982; the same scaling the Explanatory
// Supplement gives). Give it DAILY-MEAN air: the place's monthly normals of the daily mean (e.g. Open-Meteo ERA5), or
// the day's forecast averaged over the day. Not the air at the moment of sunrise: the standard value was measured from
// real sunrises, so it already holds typical morning air, and the colder sunrise-hour air would count it twice.
// Checked on 656 observed sunrises (test/compare-observations.js, before the set grew to 2,209) with each morning's real ERA5 weather:
//   monthly daily-mean normals 2.0 s mean / 15.2 s rms; the day's own mean 2.2 / 15.1; the air at sunrise 5.0 / 16.1.
// Even the real weather of the day leaves the same ~15 s of scatter: what varies from day to day is the layering of the
// air along the light's path (inversions), which ground temperature and pressure cannot show.
// raytrace.js traces full air profiles for that purpose; the interface stays the same.

// Mean horizon refraction for the standard atmosphere (Reingold & Dershowitz's errata value, the one KosherJava's
// NOAA calculator and Zemaneh Yosef use): 34.478885263888294′.
export const STANDARD_REFRACTION_DEG = 34.478885263888294 / 60;
// The conditions that standard value belongs to (Meeus ch. 16: 1010 hPa, 10 °C).
const P0 = 1010, T0 = 283;

// A monthly normal for one day: each month's value belongs to the middle of that month, and the days between two
// middles are blended in a straight line (wrapping December into January), so there is no jump from the last day of
// one month to the first of the next. monthBlend gives the two months and the fraction { a, b, f } (value = a's +
// f × (b's − a's)); normalForDay applies it to 12 values (January first), null if either month's value is missing.
export function monthBlend({ y, m, d }) {
  const len = (mm) => new Date(Date.UTC(y, mm, 0)).getUTCDate(); // days in month mm (1-12) of year y
  const mid = (mm) => (len(mm) + 1) / 2; // the month's middle, as a day of that month
  if (d >= mid(m)) { const b = (m % 12) + 1; return { a: m, b, f: (d - mid(m)) / (len(m) - mid(m) + mid(b)) }; }
  const a = ((m + 10) % 12) + 1;
  return { a, b: m, f: (len(a) - mid(a) + d) / (len(a) - mid(a) + mid(m)) };
}
export function normalForDay(values, date) {
  const { a, b, f } = monthBlend(date);
  const va = values?.[a - 1], vb = values?.[b - 1];
  if (!Number.isFinite(va) || !Number.isFinite(vb)) return null;
  return va + f * (vb - va);
}

// Refraction at the horizon (degrees) for air at the observer: tempC (°C) and pressure (hPa, station pressure,
// i.e. reduced to the observer's height). Without values, the standard refraction.
export function horizonRefraction({ tempC = null, pressure = null } = {}) {
  if (tempC == null || pressure == null) return STANDARD_REFRACTION_DEG;
  return STANDARD_REFRACTION_DEG * (pressure / P0) * (T0 / (273.15 + tempC));
}

// Sea-level pressure → pressure at height h (m), standard lapse (barometric formula, ICAO).
export function stationPressure(seaLevelHPa, h) {
  return seaLevelHPa * (1 - 2.25577e-5 * h) ** 5.25588;
}

const EARTH_RADIUS_M = 6371008.8; // IUGG mean radius
// Standard coefficient of terrestrial refraction (light near the ground bends with ~1/7.7 of the Earth's curvature;
// geodesy's usual 0.13, the value Zemaneh Yosef's terrain tracer uses as its standard air).
export const K_STANDARD = 0.13;

/**
 * Dip of the sea-level horizon for an observer h metres up (degrees, positive = below the astronomical horizon).
 * k = coefficient of terrestrial refraction (0 = geometric dip, as KosherJava's getElevationAdjustment does with
 * radius = 6356.9 km).
 */
export function horizonDip(h, { k = K_STANDARD, radius = EARTH_RADIUS_M } = {}) {
  if (!(h > 0)) return 0;
  if (k === 0) return (Math.acos(radius / (radius + h)) * 180) / Math.PI;
  // Effective-radius method: the ray curves with radius R/k, equivalent to a straight ray over an Earth of R/(1-k).
  const re = radius / (1 - k);
  return (Math.acos(re / (re + h)) * 180) / Math.PI;
}

/**
 * Altitude (geometric, of the Sun's centre) at which the upper limb touches the horizon:
 *   -(radius + refraction + dip)
 * radiusDeg from sun.js (959.63″/R) or a fixed 16′; refraction from horizonRefraction(); dip from horizonDip().
 */
export const riseSetAltitude = ({ radiusDeg, refractionDeg, dipDeg = 0 }) => -(radiusDeg + refractionDeg + dipDeg);
