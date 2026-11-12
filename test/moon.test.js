// Checks of src/moon.js against NASA JPL Horizons (DE441), fetched 2026-11-05 from ssd.jpl.nasa.gov/api/horizons.api:
//  - new moons: the minute where the Moon's and the Sun's geocentric ecliptic longitudes of date cross (QUANTITIES=31,
//    1-minute steps, linear interpolation);
//  - the Moon's topocentric refracted elevation at Great Neck (40.807934 N, 73.746343 W, 0 m; QUANTITIES=4,
//    APPARENT=REFRACTED) on 25 Oct 2026 around moonrise, against Astronomy Engine's refracted altitude.
// Also: the lit-corner moonset (Luach Ahavat Shalom, Appendix A) never comes after the top-edge one, and the lit-corner
// moonrise never before it; and the highest lit point (Meeus's bright limb less the parallactic angle) against a model
// of the Moon as a sphere lit by the Sun in the observer's sky, north and south of the Equator (R' Glauberman's note,
// 2026: his formula needs the absolute value in the Southern Hemisphere).
// Usage: node test/own/moon.test.js
import * as AE from 'astronomy-engine';
import { base, parallactic } from 'astronomia';
import { newMoon, moonRiseSet, traditionalMolad, kiddushLevana, litTop } from '../src/moon.js';

let n = 0, bad = 0;
const ok = (cond, what) => { n++; if (!cond) { bad++; console.log(`FAIL ${what}`); } };

const JPL_NEW_MOONS = ['2026-10-10T15:50:05Z', '2026-11-09T07:02:07Z', '2027-01-07T20:24:23Z', '2027-03-08T09:29:29Z', '2027-05-06T10:58:38Z'];
for (const iso of JPL_NEW_MOONS) {
  const t = Date.parse(iso), d = (newMoon(t) - t) / 1000;
  ok(Math.abs(d) <= 10, `new moon ${iso}: ours ${d.toFixed(1)} s from JPL`);
}

const GN = { lat: 40.807934, lon: -73.746343, elevation: 0 };
const JPL_ELEVATION = [['2026-10-25T21:23:00Z', -0.520608332], ['2026-10-25T21:24:00Z', -0.347788051], ['2026-10-25T21:25:00Z', -0.203308332], ['2026-10-25T21:26:00Z', -0.058889675]];
const obs = new AE.Observer(GN.lat, GN.lon, 0);
for (const [iso, el] of JPL_ELEVATION) {
  const t = AE.MakeTime(new Date(iso));
  const eq = AE.Equator(AE.Body.Moon, t, obs, true, true);
  const alt = AE.Horizon(t, obs, eq.ra, eq.dec, 'normal').altitude;
  ok(Math.abs(alt - el) < 0.005, `Moon elevation ${iso}: Astronomy Engine ${alt.toFixed(5)}°, JPL ${el}°`);
}

// Every day of a year: a top-edge moonrise / moonset when one exists, and the lit edge sets no later than the top.
let sets = 0, rises = 0;
for (let i = 0; i < 365; i++) {
  const g = new Date(Date.UTC(2027, 0, 1 + i)), date = { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
  const top = moonRiseSet(date, GN, -1), lit = moonRiseSet(date, GN, -1, { edge: 'lit' });
  if (top) { sets++; ok(lit !== null && lit <= top + 1000, `${date.y}-${date.m}-${date.d}: lit corner sets by the top edge`); }
  const rTop = moonRiseSet(date, GN, +1), rLit = moonRiseSet(date, GN, +1, { edge: 'lit' });
  if (rTop) { rises++; ok(rLit === null || rLit >= rTop - 1000, `${date.y}-${date.m}-${date.d}: lit corner rises after the top edge`); }
}
ok(sets > 330 && rises > 330, `a year of moonsets (${sets}) and moonrises (${rises})`);

// The traditional molad (Calendrical Calculations' arithmetic): Molad Elul 5784 was Tuesday 3 September 2024, 2:37 PM and
// 12 chalakim, Jerusalem time (= 14:37:40 Jerusalem mean time); consecutive molads are 29 d 12 h 793 parts apart.
{
  const JMT = (35.2333 / 15) * 3600000;
  const m = traditionalMolad(Date.UTC(2024, 8, 10));
  ok(Math.abs(m + JMT - Date.UTC(2024, 8, 3, 14, 37, 40)) < 2, `molad Elul 5784 ${new Date(m + JMT).toISOString()} (Jerusalem mean time)`);
  const next = traditionalMolad(m + 30 * 86400000);
  ok(Math.abs(next - m - (29.5 + 793 / 25920) * 86400000) < 2, 'molads 29 d 12 h 793 parts apart');
  const kl = kiddushLevana(m + 5 * 86400000);
  ok(kl.molad === m && kl.from3 === m + 3 * 86400000 && kl.until15 === m + 15 * 86400000 && Math.abs(kl.untilHalf - m - (14 * 86400 + 18 * 3600 + 22 * 60 + 1 + 2 / 3) * 1000) < 2, 'Kiddush Levana window: 3 / 7 days, half a month, 15 days');
}

// The highest lit point, at moonset, against the Moon as a sphere lit by the Sun (its visible lit points sampled; the
// highest one's altitude above the centre, in radii): within 0.02 of the radius, either side of the Equator.
{
  const D = Math.PI / 180;
  const vec = (alt, az, r) => [r * Math.cos(alt * D) * Math.cos(az * D), r * Math.cos(alt * D) * Math.sin(az * D), r * Math.sin(alt * D)];
  for (const [name, place] of [['Great Neck', GN], ['Sydney', { lat: -33.87, lon: 151.21 }], ['Quito', { lat: -0.18, lon: -78.47 }]]) {
    for (const d of [14, 19, 23]) {
      const ms = moonRiseSet({ y: 2026, m: 11, d }, place, -1);
      const t = AE.MakeTime(new Date(ms)), obs = new AE.Observer(place.lat, place.lon, 0);
      const me = AE.Equator(AE.Body.Moon, t, obs, true, true), se = AE.Equator(AE.Body.Sun, t, obs, true, true);
      const mh = AE.Horizon(t, obs, me.ra, me.dec), sh = AE.Horizon(t, obs, se.ra, se.dec);
      const M = vec(mh.altitude, mh.azimuth, me.dist), S = vec(sh.altitude, sh.azimuth, se.dist), R = 1737.4 / AE.KM_PER_AU;
      const alt0 = Math.asin(M[2] / me.dist), sd = Math.asin(R / me.dist);
      let best = -9;
      for (let i = 0, N = 60000; i < N; i++) {
        const z = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - z * z), ph = i * Math.PI * (3 - Math.sqrt(5));
        const u = [r * Math.cos(ph), r * Math.sin(ph), z], P = M.map((m, k) => m + R * u[k]);
        if (u[0] * M[0] + u[1] * M[1] + u[2] * M[2] > 0) continue; // the far side
        if (u[0] * (S[0] - P[0]) + u[1] * (S[1] - P[1]) + u[2] * (S[2] - P[2]) <= 0) continue; // unlit
        best = Math.max(best, (Math.asin(P[2] / Math.hypot(...P)) - alt0) / sd);
      }
      const moon = { ra: me.ra * 15 * D, dec: me.dec * D };
      const chi = base.limb(moon, { ra: se.ra * 15 * D, dec: se.dec * D });
      const q = parallactic.parallacticAngle(place.lat * D, moon.dec, (AE.SiderealTime(t) * 15 + place.lon) * D - moon.ra);
      const h = litTop(chi, q, AE.Illumination(AE.Body.Moon, t).phase_angle * D);
      ok(Math.abs(h - best) < 0.02, `${name} 2026-11-${d}: highest lit point ${h.toFixed(3)} radius, sphere model ${best.toFixed(3)}`);
    }
  }
}

console.log(bad ? `${bad} of ${n} moon checks failed` : `moon: all ${n} checks pass (new moons within 10 s of JPL, Moon within 0.005° of JPL)`);
process.exit(bad ? 1 : 0);
