// Saves the US Naval Observatory's published sun rise / transit / set / civil twilight (aa.usno.navy.mil API, minute
// precision) for a few places and dates to fixture-usno.json, for compare-usno.js. Run once: node test/own/fetch-usno.mjs
import { writeFileSync } from 'node:fs';
const PLACES = [
  ['Great Neck', 40.8079, -73.7463, -5], ['Jerusalem', 31.778, 35.2353, 2], ['London', 51.5072, -0.1276, 0],
  ['Melbourne', -37.8638, 145.0032, 10], ['Reykjavik', 64.1335, -21.8525, 0],
];
const out = [];
for (const [name, lat, lon, tz] of PLACES) {
  for (let m = 1; m <= 12; m++) {
    const date = `2027-${String(m).padStart(2, '0')}-${m % 2 ? '05' : '20'}`;
    const r = await fetch(`https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&coords=${lat},${lon}&tz=${tz}`);
    const j = await r.json();
    const sun = Object.fromEntries(j.properties.data.sundata.map((x) => [x.phen, x.time]));
    out.push({ name, lat, lon, tz, date, sun });
    await new Promise((res) => setTimeout(res, 300));
  }
  console.log(name);
}
writeFileSync(new URL('./fixtures/fixture-usno.json', import.meta.url), JSON.stringify({ source: 'aa.usno.navy.mil/api/rstt/oneday, fetched 2026-11-05', rows: out }, null, 1));
