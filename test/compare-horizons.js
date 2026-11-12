// The engine's Sun (src/sun.js: astronomia with the full VSOP87B series) against NASA JPL Horizons (DE441, the reference
// ephemeris; saved in fixtures/horizons-sun.txt: the Sun's geocentric apparent RA / Dec every 5 days 2026-2029, TT). Also
// converts the error into seconds of a sunrise (the Sun climbs at most 15″ a second, at the equator at the equinox).
// Measured 2026-11-05: rms 0.102″ / largest 0.120″ (Astronomy Engine's Sun, tried first: 0.835″ / 2.063″).
import { readFileSync } from 'node:fs';
import { solar, planetposition } from 'astronomia';
import vsop87Bearth from 'astronomia/data/vsop87Bearth';
const earth = new planetposition.Planet(vsop87Bearth);

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const txt = readFileSync(new URL('./fixtures/horizons-sun.txt', import.meta.url), 'utf8');
const rows = txt.slice(txt.indexOf('$$SOE') + 5, txt.indexOf('$$EOE')).trim().split('\n').map((l) => {
  const m = l.trim().match(/^(\d{4})-(\w{3})-(\d\d) (\d\d):(\d\d)\s+([\d.]+)\s+(-?[\d.]+)/);
  return { y: +m[1], mo: MONTHS[m[2]], d: +m[3], h: +m[4], mi: +m[5], ra: +m[6], dec: +m[7] };
});
// Angular separation in arcseconds.
const sep = (ra1, de1, ra2, de2) => {
  const r = Math.PI / 180;
  const c = Math.sin(de1 * r) * Math.sin(de2 * r) + Math.cos(de1 * r) * Math.cos(de2 * r) * Math.cos((ra1 - ra2) * r);
  return (Math.acos(Math.min(1, c)) / r) * 3600;
};
const stats = { own: [] };
for (const p of rows) {
  const jdTT = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) / 86400000 + 2440587.5;
  const a = solar.apparentEquatorialVSOP87(earth, jdTT);
  stats.own.push(sep((a.ra * 180) / Math.PI, (a.dec * 180) / Math.PI, p.ra, p.dec));
}
for (const [name, a] of Object.entries(stats)) {
  const rms = Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length), max = Math.max(...a);
  console.log(`${name.padEnd(16)} rms ${rms.toFixed(3)}″, largest ${max.toFixed(3)}″ (≤ ${(max / 15).toFixed(3)} s of a sunrise), ${a.length} dates`);
}
const worst = (a) => Math.max(...a);
const bad = worst(stats.own) > 0.2;
console.log(bad ? 'the Sun is more than 0.2″ from JPL' : 'the Sun is within 0.2″ of JPL Horizons (under 0.02 s of a sunrise)');
process.exit(bad ? 1 : 0);
