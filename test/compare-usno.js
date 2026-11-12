// The own engine's Sun against the US Naval Observatory's published times (fixture-usno.json, saved by fetch-usno.mjs):
// rise and set (USNO's convention: the Sun's centre 50′ below the horizon, i.e. 34′ refraction + 16′ radius), upper
// transit, and civil twilight (centre 6° below). USNO rounds to the minute, so each of ours must round to the same
// minute, allowing 5 s either side of the half-minute for differing solar theories (where the Sun rises at a shallow
// angle, as in London or Reykjavik in summer, 0.01° is 3 s).
import { readFileSync } from 'node:fs';
import { crossing, transit } from '../src/sun.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/fixture-usno.json', import.meta.url)));
const EVENTS = [['Begin Civil Twilight', -6, +1], ['Rise', -50 / 60, +1], ['Upper Transit', null, 0], ['Set', -50 / 60, -1], ['End Civil Twilight', -6, -1]];
const SLACK_S = 5;
let checks = 0, fails = 0, worst = 0;
for (const r of fx.rows) {
  const [y, m, d] = r.date.split('-').map(Number);
  const date = { y, m, d }, place = { lat: r.lat, lon: r.lon, elevation: 0 };
  const noon = transit(date, place);
  for (const [phen, alt, dir] of EVENTS) {
    const want = r.sun[phen];
    if (!want) continue;
    const [hh, mm] = want.split(':').map(Number);
    // USNO lists an event under the local date it falls on: a sunset after local midnight (Reykjavik in June) is the
    // previous date's evening, so compare it with our sunset of that date.
    const prev = dir < 0 && hh < 12;
    const ms = dir === 0 ? noon : prev ? crossing({ y, m, d: d - 1 }, place, alt, dir) : crossing(date, place, alt, dir, noon);
    const usnoMin = Date.UTC(y, m - 1, d, hh, mm) - r.tz * 3600000; // USNO's minute, local → UTC
    // Seconds outside USNO's rounding window [minute − 30 s, minute + 30 s).
    const off = (ms - usnoMin) / 1000;
    const outside = off < -30 ? -30 - off : off >= 30 ? off - 30 : 0;
    checks++;
    worst = Math.max(worst, Math.abs(off));
    if (outside > SLACK_S) { fails++; console.log(`DIFF ${r.name} ${r.date} ${phen}: USNO ${want}, ours ${off.toFixed(1)} s from it`); }
  }
}
console.log(`${checks} USNO times, ${fails} cases differ (largest offset from USNO's minute ${worst.toFixed(1)} s, rounding window ±30 s)`);
process.exit(fails ? 1 : 0);
