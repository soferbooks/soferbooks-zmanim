// Bad input throws instead of giving NaN or another day's times, and a failed terrain download is an error, not the sea
// (review ZM-04 and ZM-06, 2026-11-23).
// Usage: node test/check.test.js
import { dayZmanim, pick } from '../src/zmanim.js';
import { moonRiseSet } from '../src/moon.js';
import { Dem } from '../src/terrain/dem.js';

let n = 0, bad = 0;
const ok = (cond, what) => { n++; if (!cond) { bad++; console.log(`FAIL ${what}`); } };
const throwsType = (f, what) => { let e = null; try { f(); } catch (x) { e = x; } ok(e instanceof TypeError, `${what} throws a TypeError${e ? ` (${e.message})` : ' (did not throw)'}`); };

const GN = { lat: 40.8007, lon: -73.7285, elevation: 33 };
const D = { y: 2027, m: 6, d: 21 };
throwsType(() => dayZmanim(D, { lat: 40.8007, lng: -73.7285 }), 'lng instead of lon');
throwsType(() => dayZmanim(D, { lat: '40.8', lon: '-73.7' }), 'lat / lon as strings');
throwsType(() => dayZmanim(D, { lat: 95, lon: 0 }), 'lat 95');
throwsType(() => dayZmanim(D, { lat: 40.8, lon: 286.25 }), 'lon 286.25 (0-360)');
throwsType(() => dayZmanim({ y: 2026, m: 13, d: 1 }, GN), 'month 13');
throwsType(() => dayZmanim({ y: 2027, m: 2, d: 30 }, GN), '30 February');
throwsType(() => dayZmanim(new Date(Date.UTC(2027, 5, 21)), GN), 'a JavaScript Date');
throwsType(() => dayZmanim({ year: 2027, month: 6, day: 21 }, GN), '{ year, month, day }');
throwsType(() => dayZmanim(D, { ...GN, utcOffset: 20 }), 'utcOffset 20');
throwsType(() => pick(dayZmanim(D, GN), 'degree'), "pick's unknown set 'degree'");
throwsType(() => moonRiseSet(D, GN, 2), 'moonRiseSet direction 2');
throwsType(() => moonRiseSet(D, { lat: 40.8 }, 1), 'moonRiseSet without lon');
// Good input still works: date fields as numeric strings, no elevation, and a time for every set.
ok(Number.isFinite(dayZmanim({ y: '2027', m: '6', d: '21' }, { lat: 40.8007, lon: -73.7285 }).opinions['sunset.seaLevel']), 'string date fields and no elevation give a sunset');
for (const set of ['degrees', 'fixed', 'seasonal']) ok(Number.isFinite(pick(dayZmanim(D, GN), set).sunset), `pick ${set}`);

// Terrain: a file the server does not have is the sea; a failed download rejects with its cause, and is tried again.
{
  const missing = new Dem({ source: 'copernicus', open: async () => { throw new Error('Error fetching data.'); } });
  await missing.load([[40.5, -73.5, 0]]);
  ok(missing.elevation(40.5, -73.5, 0) === 0, 'no file: the sea (elevation 0)');
  let calls = 0;
  const offline = new Dem({ source: 'copernicus', open: async () => { calls++; throw new TypeError('fetch failed'); } });
  let err = null;
  try { await offline.load([[31.5, 35.5, 0]]); } catch (e) { err = e; }
  ok(err && err.cause instanceof TypeError, `a failed download rejects with its cause (${err?.message})`);
  try { await offline.load([[31.5, 35.5, 0]]); } catch { /* expected */ }
  ok(calls === 2, 'a failed cell is tried again on the next load');
  let gErr = null;
  const global = new Dem({ source: 'gedtm', open: async () => { throw new Error('Error fetching data.'); } });
  try { await global.load([[31.5, 35.5, 0]]); } catch (e) { gErr = e; }
  ok(gErr !== null, 'the global GEDTM file failing is an error, never the sea');
}

// The skyline's pause works without setTimeout (JavaScriptCore, QuickJS, Hermes).
{
  const saved = globalThis.setTimeout;
  delete globalThis.setTimeout;
  let e = null;
  try {
    const { computeSkyline } = await import('../src/terrain/skyline.js');
    // A DEM that is all sea: no network; the work reaches the pauses.
    const sea = new Dem({ source: 'copernicus', open: async () => { throw new Error('Error fetching data.'); } });
    await computeSkyline({ lat: 40.8, lon: -73.7 }, { dem: sea, maxKm: 3, vantage: { lat: 40.8, lon: -73.7, eye: 10 } });
  } catch (x) { e = x; }
  globalThis.setTimeout = saved;
  ok(e === null, `a skyline is computed without setTimeout${e ? ` (${e.message})` : ''}`);
}

console.log(bad ? `${bad} of ${n} input checks failed` : `checks: all ${n} pass (bad input throws; a failed terrain download is an error)`);
process.exit(bad ? 1 : 0);
