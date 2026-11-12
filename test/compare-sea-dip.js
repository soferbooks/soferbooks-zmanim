// The sea-horizon dip against measurements (docs/EXPERIMENTS.md, "Views over water"). Not part of npm test: an experiment.
// Data: Sinzi & Owaki (1959), "Studies on abnormal refraction over sea surface, I. Observation of dip of sea horizon",
// Japan Hydrographic Dept., Table 4 (Shirahama, February 1959, theodolite about 3 m above the sea): the measured dip, the
// eye height, the air temperature at the eye and the sea's surface temperature. "Feb. 11" second block = 12 February.
// Run: node test/compare-sea-dip.js
import { horizonDip } from '../src/refraction.js';

// [dip (arcminutes), eye height (cm), air at the eye (°C), water (°C)]
const rows = `4.02 300 9.0 13.8|3.93 303 10.0 13.8|4.13 306 11.4 14.2|4.12 307 11.9 14.1|4.08 306 12.3 14.2|3.98 305 12.4 14.3|3.98 302 12.6 14.3|3.82 298 12.8 14.2|4.03 294 12.7 14.2|4.05 290 12.7 14.2|3.90 286 12.6 14.2|3.87 280 12.6 14.2
|3.87 282 9.4 14.2|3.99 288 9.6 14.2|3.78 298 9.9 14.2|3.89 315 12.1 14.3|3.98 321 12.3 14.2|3.88 325 12.4 14.3|3.64 327 12.5 14.3|3.78 326 12.7 14.2|3.52 322 12.9 14.4|3.53 317 14.0 14.6|3.33 314 14.5 14.6|3.38 306 13.8 14.6|3.28 298 15.8 14.5|3.18 291 15.9 14.5|3.11 285 15.7 14.4|2.78 276 15.2 14.2|2.64 271 15.3 14.4|2.52 267 15.3 14.6|2.23 266 15.0 14.6|2.26 267 15.0 14.6|2.63 271 14.8 14.6|2.40 276 14.7 14.5|2.30 282 14.6 14.4
|3.06 349 13.2 14.7|3.23 338 13.2 14.7|3.26 332 12.9 14.7|3.59 321 12.5 14.7|3.87 308 11.9 14.7|3.82 296 11.8 14.7|3.79 285 11.2 14.6|3.92 280 10.8 14.6|3.99 274 10.3 14.6|3.88 269 9.6 14.5
|6.11 273 4.8 13.4|5.73 271 4.8 13.4|5.08 270 4.7 13.4|5.16 271 4.6 13.4|4.76 288 4.4 13.4|5.07 293 4.3 13.4|4.79 308 4.0 13.4|4.27 319 3.9 13.4|4.17 329 3.8 13.4
|5.09 289 3.2 15.0|5.96 285 4.5 15.0|5.22 283 6.2 15.0|5.29 283 8.0 15.0|5.17 286 8.8 15.0|3.75 296 9.8 15.0|3.97 303 9.9 15.0|3.96 310 10.0 15.0|4.22 319 10.1 15.0|3.88 334 10.1 15.0|4.48 346 10.2 15.0|4.68 358 10.2 15.0|4.80 377 10.3 15.0|5.53 376 10.4 15.0|5.37 372 10.4 15.0|5.41 367 10.3 15.0|5.07 359 10.3 15.0|5.00 347 10.2 15.0|4.73 335 9.1 15.0|4.47 325 7.5 15.0|4.58 322 7.3 15.0|2.92 317 7.0 15.0`
  .split('|').map((r) => r.trim().split(/\s+/).map(Number));

// The same refractivity as src/raytrace.js (IAG 1999, λ = 0.574 μm). In a layered atmosphere n·r·cos(e) is constant, so the
// ray that grazes the sea reaches the eye at a dip fixed by n at the surface and n at the eye: cos(dip) = n0·R / (nh·(R+h)).
// No temperature was measured in the air just above the water, so the air there is taken at the water's temperature.
const R = 6371000, C = (287.6155 + 1.62887 / 0.574 ** 2 + 0.01360 / 0.574 ** 4) * 1e-6 * 273.15 / 1013.25, P = 1015, g = 9.797;
const AM = 180 * 60 / Math.PI;
const traced = (h, Th, T0) => {
  const Ph = P - (P * 0.0289644 / (8.31446 * (273.15 + (Th + T0) / 2))) * g * h;
  const n0 = 1 + C * P / (273.15 + T0), nh = 1 + C * Ph / (273.15 + Th);
  const c = (n0 * R) / (nh * (R + h));
  return c > 1 ? null : Math.acos(c) * AM; // null: the light bends with the sea, no horizon below eye level
};
const standard = (h) => horizonDip(h) * 60;

const stats = (pairs) => {
  const n = pairs.length, mean = pairs.reduce((a, [o, c]) => a + o - c, 0) / n;
  return `mean ${mean.toFixed(2)}′, rms ${Math.sqrt(pairs.reduce((a, [o, c]) => a + (o - c) ** 2, 0) / n).toFixed(2)}′`;
};
const obs = rows.map(([d, hc, Th, Tw]) => ({ d, h: hc / 100, Th, Tw, t: traced(hc / 100, Th, Tw) }));
console.log(`${obs.length} measured dips (observed − computed):`);
console.log(`  standard dip (k = 0.13, no temperatures):      ${stats(obs.map((o) => [o.d, standard(o.h)]))}`);
const ok = obs.filter((o) => o.t !== null);
console.log(`  traced, air at the water's temperature:         ${stats(ok.map((o) => [o.d, o.t]))} (${obs.length - ok.length} with no horizon predicted, left out)`);
// The classical form: dip = standard + b·(water − air); b fitted (least squares, all data).
const b = obs.reduce((a, o) => a + (o.Tw - o.Th) * (o.d - standard(o.h)), 0) / obs.reduce((a, o) => a + (o.Tw - o.Th) ** 2, 0);
console.log(`  standard + ${b.toFixed(3)}′ per °C of water − air:        ${stats(obs.map((o) => [o.d, standard(o.h) + b * (o.Tw - o.Th)]))} (fitted to these same data)`);
console.log('\nBy water − air:');
for (const [lo, hi] of [[-9, 0], [0, 2], [2, 4], [4, 8], [8, 13]]) {
  const s = obs.filter((o) => o.Tw - o.Th >= lo && o.Tw - o.Th < hi), avg = (f) => (s.reduce((a, o) => a + f(o), 0) / s.length).toFixed(2);
  const tr = s.filter((o) => o.t !== null);
  console.log(`  ${String(lo).padStart(3)} to ${String(hi).padStart(2)} °C: ${String(s.length).padStart(2)} dips, observed ${avg((o) => o.d)}′, standard ${avg((o) => standard(o.h))}′, traced ${tr.length ? (tr.reduce((a, o) => a + o.t, 0) / tr.length).toFixed(2) + '′' : 'no horizon'}`);
}
