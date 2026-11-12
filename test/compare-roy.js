// Chacham Ovadia's set from the own engine against Zemaneh Yosef's formulas on kosher-zmanim (roy-reference.js), every
// day of a Gregorian year at several places. The two use different solar theories (Astronomy Engine's VSOP87 vs the
// NOAA approximation), so a few seconds apart is agreement.
// Usage: node test/own/compare-roy.js [year]
import { dayZmanim } from '../src/zmanim.js';
import { royReference } from './roy-reference.js';

const year = Number(process.argv[2] || 2027);
const PLACES = [
  ['Jerusalem', { lat: 31.778029, lon: 35.235314, elevation: 790, israel: true }, 'Asia/Jerusalem'],
  ['Bnei Brak', { lat: 32.0807, lon: 34.8338, elevation: 40, israel: true }, 'Asia/Jerusalem'],
  ['Great Neck', { lat: 40.807934, lon: -73.746343, elevation: 33 }, 'America/New_York'],
  ['Los Angeles', { lat: 34.0522, lon: -118.2437, elevation: 90 }, 'America/Los_Angeles'],
  ['Paris', { lat: 48.8566, lon: 2.3522, elevation: 35 }, 'Europe/Paris'],
  ['London', { lat: 51.5072, lon: -0.1276, elevation: 20 }, 'Europe/London'],
  ['Buenos Aires', { lat: -34.6037, lon: -58.3816, elevation: 25 }, 'America/Argentina/Buenos_Aires'],
];
const LIMIT_S = 10;
// KosherJava's NOAA solar noon is an approximation (equation of time from a short series), up to ~15 s off; our hatzot
// is within 0.2″ of JPL Horizons (compare-horizons.js), so these get a wider tolerance here.
const NOON_IDS = new Set(['hatzot', 'minchaGedola.roy', 'midnight.astronomical']);
const limitOf = (id) => (NOON_IDS.has(id) ? 20 : LIMIT_S);
let failures = 0, worst = 0;
for (const [name, place, tz] of PLACES) {
  const stats = {};
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86400000) {
    const g = new Date(t), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
    const own = dayZmanim(date, place).opinions;
    const ref = royReference(date, place, tz);
    for (const [id, want] of Object.entries(ref)) {
      const got = own[id];
      const s = (stats[id] ??= { n: 0, sum: 0, sq: 0, max: 0, at: '', missing: 0 });
      if (want == null || got == null) { if ((want == null) !== (got == null)) s.missing++; continue; }
      const d = (got - want) / 1000;
      s.n++; s.sum += d; s.sq += d * d;
      if (Math.abs(d) > Math.abs(s.max)) { s.max = d; s.at = `${date.m}/${date.d}`; }
    }
  }
  console.log(`\n${name} ${year}`);
  for (const [id, s] of Object.entries(stats)) {
    const bad = Math.abs(s.max) > limitOf(id) || s.missing;
    if (bad) failures++;
    if (!NOON_IDS.has(id)) worst = Math.max(worst, Math.abs(s.max));
    console.log(`  ${bad ? 'FAIL' : 'ok  '} ${id.padEnd(24)} mean ${(s.sum / s.n).toFixed(1).padStart(5)} s, rms ${Math.sqrt(s.sq / s.n).toFixed(1).padStart(4)} s, largest ${s.max.toFixed(1).padStart(5)} s (${s.at})${s.missing ? `, ${s.missing} days only one side has a time` : ''}`);
  }
}
console.log(`\nlargest difference ${worst.toFixed(1)} s; ${failures} differing (limit ${LIMIT_S} s)`);
process.exit(failures ? 1 : 0);
