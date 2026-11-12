// The ray tracer (src/raytrace.js) against Starlink PAL's palRefro (Hohenkerk & Sinclair's integration; GPL-3, run
// privately in Python as a reference, values pasted below; not part of this package): a dry standard atmosphere, 10 °C,
// 1010 hPa, 6.5 K/km, λ 0.574 μm, latitude 32°, at sea level and from 800 m (4.8 °C, 919.4 hPa).
import { standardAtmosphere, traceRefraction, refractionTable, makeAtmosphere } from '../src/raytrace.js';

const PAL = {
  0: { atm: [10, 1010, 0], r: { 0: 33.777, 0.5: 28.247, 1: 24.016, 2: 18.105, 5: 9.809, 10: 5.294, 45: 0.965 } },
  800: { atm: [4.8, 1010 * Math.exp(-800 / 8400), 800], r: { 0: 31.421, 0.5: 26.265, 1: 22.322, 2: 16.813, 5: 9.095, 10: 4.905, 45: 0.894 } },
};
let fails = 0, checks = 0, worst = 0;
for (const [h, { atm, r }] of Object.entries(PAL)) {
  const a = standardAtmosphere(...atm, 32);
  for (const [e, want] of Object.entries(r)) {
    const got = traceRefraction(a, Number(h), Number(e)) * 60;
    const diff = Math.abs(got - want) * 60; // arcseconds
    worst = Math.max(worst, diff); checks++;
    if (diff > 3) { fails++; console.log(`DIFF ${h} m, ${e}°: ${got.toFixed(3)}′ vs PAL ${want}′ (${diff.toFixed(1)}″)`); }
  }
}
// Below the astronomical horizon from a height: more refraction the lower the ray; a ray that comes down to sea level is NaN.
const hi = standardAtmosphere(4.8, 919.4, 800, 32);
const below = [-1, -0.5, 0].map((e) => traceRefraction(hi, 800, e));
checks++; if (!(below[0] > below[1] && below[1] > below[2])) { fails++; console.log('refraction should grow below the horizon', below); }
checks++; if (!Number.isNaN(traceRefraction(standardAtmosphere(10, 1010, 2, 32), 2, -1))) { fails++; console.log('a ray from 2 m at −1° should reach the ground'); }
// An inversion (warmer air above) refracts more than the standard air.
const inv = makeAtmosphere([{ h: 0, t: 5 }, { h: 100, t: 9 }, { h: 1100, t: 2.5 }], { h: 0, p: 1015 }, { lat: 32 });
const std = standardAtmosphere(5, 1015, 0, 32);
checks++; if (!(traceRefraction(inv, 2, 0) > traceRefraction(std, 2, 0) + 2 / 60)) { fails++; console.log('an inversion should add refraction'); }
// The table interpolates the traced values.
const tb = refractionTable(std, 0);
checks++; if (Math.abs(tb.refraction(0.31) - traceRefraction(std, 0, 0.31)) * 3600 > 1) { fails++; console.log('table interpolation off by more than 1″'); }
console.log(`${checks} checks, ${fails} cases differ (largest difference from PAL ${worst.toFixed(1)}″)`);
process.exit(fails ? 1 : 0);
