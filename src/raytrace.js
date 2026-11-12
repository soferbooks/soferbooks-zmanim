// Astronomical refraction near the horizon by tracing the ray through the day's air, for the soferbooks.com zmanim engine.
// Written for this project (2026-11-05): no openly licensed tracer takes an arbitrary temperature profile (PAL's palRefro,
// the Hohenkerk & Sinclair integration, is LGPL-3.0 and has a single lapse rate; it agrees with this tracer within 0.1′ from
// −1° to 5° (checked 2026-11-10); Zemaneh Yosef's and Rabbi Keller's
// tracers carry no licence). The physics is the textbook one:
//   - the ray in a spherically layered atmosphere: n·r·cos(e) is constant (Bouguer's law), integrated along the path:
//       dr/ds = sin e,  dφ/ds = cos e / r,  de/ds = cos e · (1/r + (dn/dr)/n)
//     (r from the Earth's centre, φ the angle travelled around it, e the elevation above the local horizontal);
//   - refraction = e_observed − e_vacuum, and with no air e_end = e_observed + φ, so R = e_observed + φ_total − e_end
//     at the top of the air (80 km, as Hohenkerk & Sinclair);
//   - refractivity of dry air at visible light (λ = 0.574 μm): the International Association of Geodesy's formula
//     (Resolution 3, Birmingham 1999), (n − 1)·10⁶ = (287.6155 + 1.62887/λ² + 0.01360/λ⁴)·(273.15/1013.25)·P/T
//     (P hPa, T K); water vapour changes horizon refraction by well under 1 % and is left out;
//   - pressure from the hydrostatic equation through the profile.
// Above the profile's top: 6.5 K/km to the tropopause (11 km), then constant temperature to 80 km.

const M_AIR = 0.0289644, R_GAS = 8.31446;
// Gravity at sea level by latitude (International Gravity Formula 1967).
const gravity = (lat) => { const s = Math.sin(lat * Math.PI / 180); return 9.780318 * (1 + 0.0053024 * s * s - 0.0000058 * (2 * s * Math.sqrt(1 - s * s)) ** 2); };
const R_EARTH = 6371000;
const LAMBDA = 0.574;
const C_REFR = (287.6155 + 1.62887 / LAMBDA ** 2 + 0.01360 / LAMBDA ** 4) * 1e-6 * 273.15 / 1013.25; // per hPa/K
const TOP = 80000, TROPOPAUSE = 11000, LAPSE = 0.0065;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/**
 * An atmosphere from a temperature profile: levels [{ h (m above sea level), t (°C) }] (any number, any heights, e.g.
 * 2 m air, 80 / 120 / 180 m air and pressure levels), the pressure (hPa) at one height { h, p }, and the latitude.
 * Returns { n(h), dndh(h), t(h), p(h) } tabulated every metre near the ground and coarser above.
 */
export function makeAtmosphere(levels, pressureAt, { lat = 45 } = {}) {
  const G = gravity(lat);
  const lv = [...levels].filter((l) => Number.isFinite(l.t) && Number.isFinite(l.h)).sort((a, b) => a.h - b.h);
  if (!lv.length) throw new Error('no temperature levels');
  const top = lv[lv.length - 1];
  const tAt = (h) => { // K
    if (h <= lv[0].h) return lv[0].t + LAPSE * (lv[0].h - h) + 273.15; // below the lowest level (valleys): standard lapse
    for (let i = 1; i < lv.length; i++) if (h <= lv[i].h) {
      const a = lv[i - 1], b = lv[i], f = (h - a.h) / (b.h - a.h);
      return a.t + (b.t - a.t) * f + 273.15;
    }
    const tTop = top.t + 273.15;
    const hTrop = Math.max(TROPOPAUSE, top.h);
    return h <= hTrop ? tTop - LAPSE * (h - top.h) : tTop - LAPSE * (hTrop - top.h);
  };
  // Grid from 500 m below sea level (the Dead Sea rift; rays from a height dip below the observer): 1 m up to 2 km above
  // the lowest level, then 10 m to 15 km, then 100 m to the top.
  const h0 = -500;
  const hs = [];
  const fine = Math.max(lv[0].h, pressureAt.h) + 2000;
  for (let h = h0; h < fine; h += 1) hs.push(h);
  for (let h = fine; h < 15000; h += 10) hs.push(h);
  for (let h = Math.max(15000, fine); h <= TOP + 100; h += 100) hs.push(h);
  // Pressure: integrate the hydrostatic equation up and down from the given pressure.
  const T = hs.map(tAt);
  const P = new Float64Array(hs.length);
  let k0 = hs.findIndex((h) => h >= pressureAt.h);
  if (k0 < 0) k0 = hs.length - 1;
  P[k0] = pressureAt.p * Math.exp((-G * M_AIR * (hs[k0] - pressureAt.h)) / (R_GAS * T[k0]));
  for (let k = k0 + 1; k < hs.length; k++) {
    const tm = (T[k] + T[k - 1]) / 2;
    P[k] = P[k - 1] * Math.exp((-G * M_AIR * (hs[k] - hs[k - 1])) / (R_GAS * tm));
  }
  for (let k = k0 - 1; k >= 0; k--) {
    const tm = (T[k] + T[k + 1]) / 2;
    P[k] = P[k + 1] * Math.exp((G * M_AIR * (hs[k + 1] - hs[k])) / (R_GAS * tm));
  }
  const N = hs.map((_, k) => C_REFR * P[k] / T[k]); // n − 1
  const find = (h) => { // index of the grid cell holding h
    if (h <= hs[0]) return 0;
    if (h >= hs[hs.length - 2]) return hs.length - 2;
    let lo = 0, hi = hs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (hs[mid] <= h) lo = mid; else hi = mid; }
    return lo;
  };
  return {
    hMin: hs[0],
    n: (h) => { if (h >= TOP) return 1; const i = find(h), f = (h - hs[i]) / (hs[i + 1] - hs[i]); return 1 + N[i] + (N[i + 1] - N[i]) * f; },
    dndh: (h) => { if (h >= TOP) return 0; const i = find(h); return (N[i + 1] - N[i]) / (hs[i + 1] - hs[i]); },
    t: (h) => tAt(h) - 273.15,
    p: (h) => { const i = find(h), f = (h - hs[i]) / (hs[i + 1] - hs[i]); return P[i] + (P[i + 1] - P[i]) * f; },
  };
}

/**
 * Refraction (degrees) of a ray seen at apparent elevation eDeg (may be negative: below the astronomical horizon, from a
 * height) by an observer hObs m above sea level. Returns NaN if the ray comes down to the lowest air level (it would
 * hit the ground or the sea: no Sun is seen there).
 */
export function traceRefraction(atm, hObs, eDeg) {
  let r = R_EARTH + hObs, phi = 0, e = eDeg * D2R;
  const rTop = R_EARTH + TOP, rMin = R_EARTH + atm.hMin + 1;
  const deriv = (r_, e_) => {
    const h = r_ - R_EARTH, n = atm.n(h);
    return [Math.sin(e_), Math.cos(e_) / r_, Math.cos(e_) * (1 / r_ + atm.dndh(h) / n)];
  };
  for (let i = 0; i < 200000 && r < rTop; i++) {
    const h = r - R_EARTH;
    // Step: at most ~0.5 m of height near the ground, growing with height; longer where the ray runs level.
    const dhMax = Math.max(0.5, 0.02 * (h - atm.hMin));
    const ds = Math.min(5000, Math.max(5, dhMax / Math.max(Math.abs(Math.sin(e)), 2e-4)));
    const k1 = deriv(r, e);
    const k2 = deriv(r + ds / 2 * k1[0], e + ds / 2 * k1[2]);
    const k3 = deriv(r + ds / 2 * k2[0], e + ds / 2 * k2[2]);
    const k4 = deriv(r + ds * k3[0], e + ds * k3[2]);
    r += ds / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    phi += ds / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    e += ds / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (r < rMin) return NaN;
  }
  return (eDeg * D2R + phi - e) * R2D;
}

/**
 * A refraction table for one atmosphere and observer height: apparent elevation from −3° to +6° (finer near the
 * horizon); refraction(e) interpolates it. Rays that come down to the ground are left out (NaN).
 */
export function refractionTable(atm, hObs, { from = -3, to = 6 } = {}) {
  const es = [];
  for (let x = from; x < -1; x += 0.1) es.push(x);
  for (let x = -1; x < 1.5; x += 0.02) es.push(+x.toFixed(4));
  for (let x = 1.5; x <= to + 1e-9; x += 0.25) es.push(x);
  const rs = es.map((x) => traceRefraction(atm, hObs, x));
  return {
    es, rs, atm,
    // Coefficient of terrestrial refraction for a ray between heights h1 and h2 (m above sea level): k = −R·(dn/dh)/n
    // averaged over the band, so the light from the terrain bends in the same air as the Sun's.
    kBetween(h1, h2) {
      const lo = Math.min(h1, h2) - 20, hi = Math.max(h1, h2) + 5;
      let sum = 0, n = 0;
      for (let h = lo; h <= hi; h += Math.max(1, (hi - lo) / 50)) { sum += -R_EARTH * atm.dndh(h) / atm.n(h); n++; }
      return sum / n;
    },
    refraction(e) {
      if (e >= to) return rs[rs.length - 1] * Math.tan((90 - to) * D2R) / Math.tan((90 - Math.min(e, 89.9)) * D2R); // ~cot e above
      let i = es.findIndex((x) => x > e) - 1;
      if (i < 0) i = 0;
      const a = rs[i], b = rs[i + 1], f = (e - es[i]) / (es[i + 1] - es[i]);
      return a + (b - a) * f;
    },
  };
}

// A standard atmosphere for a surface temperature (°C) and pressure (hPa) at height h: 6.5 K/km above it.
export function standardAtmosphere(tempC, pressure, h = 0, lat = 45) {
  return makeAtmosphere([{ h, t: tempC }, { h: h + 1000, t: tempC - 6.5 }], { h, p: pressure }, { lat });
}
