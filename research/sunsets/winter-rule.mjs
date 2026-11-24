// Keller's winter rule for visible sunrise, tested on every timed sunrise we have. Chai Tables' netzski6.c (version 18,
// github.com/chaimkeller/software; no licence file, so only the rule as its comments state it is used here): in a winter
// month, "defined by ave min monthly temp < 1/2 * max min temperature", the 15 s cushion is removed from sunrise, i.e.
// the sunrise is put 15 s earlier. Keller & Hall (Computers & Geosciences, 2022): winter inversion effects on sunrise
// "can be treated by subtracting a fixed amount of seconds".
//
// Monthly mean daily minimum temperatures: Open-Meteo's ERA5 archive, 2011-2020 (cached in cache/tmin_*.json).
// Residuals (observed - computed, s): Keller's from `node test/compare-observations.js --dump=research/sunsets/cache/
// keller-normals-100far2.json` (the engine's default skyline), Edmonton's from sampson-edmonton.mjs (`seen`).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const C = new URL('./cache/', import.meta.url);
const J = (f) => JSON.parse(readFileSync(new URL(f, C)));

async function tmin(name, lat, lon) {
  const f = new URL(`tmin_${name}.json`, C);
  if (!existsSync(f)) {
    const a = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=2011-01-01&end_date=2020-12-31&daily=temperature_2m_min&timezone=GMT`)).json();
    const T = Array.from({ length: 12 }, () => []);
    a.daily.time.forEach((d, i) => { const v = a.daily.temperature_2m_min[i]; if (v != null) T[+d.slice(5, 7) - 1].push(v); });
    writeFileSync(f, JSON.stringify(T.map((v) => v.reduce((x, y) => x + y, 0) / v.length)));
  }
  return J(`tmin_${name}.json`);
}
// Keller's winter months: mean minimum below half the warmest month's mean minimum.
const winterOf = (t) => { const half = Math.max(...t) / 2; return t.map((x) => x < half); };

const W = {
  jerusalem: winterOf(await tmin('jerusalem', 31.7399, 35.2221)),
  telaviv: winterOf(await tmin('telaviv', 32.0853, 34.7818)),
  edmonton: winterOf(await tmin('edmonton', 53.5461, -113.4938)),
};
const months = (w) => w.map((x, i) => (x ? i + 1 : null)).filter(Boolean).join(',');
console.log(`winter months: Jerusalem ${months(W.jerusalem)}; Tel Aviv ${months(W.telaviv)}; Edmonton ${months(W.edmonton)}\n`);

const st = (v) => { const n = v.length, m = v.reduce((a, b) => a + b, 0) / n, r = Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n);
  return `${String(n).padStart(4)} ${(m >= 0 ? '+' : '') + m.toFixed(1)} / ${r.toFixed(1)}`; };
// The rule puts the computed sunrise 15 s earlier, so observed - computed grows by 15 s in a winter month.
const apply = (rows, w) => rows.map(([m, v]) => (w[m - 1] ? v + 15 : v));
const K = J('keller-normals-100far2.json');
const sets = [
  ['Rav Druk, Armon HaNatziv', K.drukDated.map(([d, v]) => [+d.slice(5, 7), v]), W.jerusalem],
  ["R' Golan, Neve Yaakov", K.golanDated.map(([d, v]) => [+d.slice(5, 7), v]), W.jerusalem],
  ['Rav Zuriel, Bnei Brak', K.zurielDated.map(([d, v]) => [+d.slice(5, 7), v]), W.telaviv],
  ['Edmonton sunrises (Sampson)', J('sampson-results-copernicus.json').filter((r) => r.rise && Number.isFinite(r.seen)).map((r) => [r.m, r.seen]), W.edmonton],
];
console.log('observed - computed, sunrises: n / mean / rms (s)      without the rule      with it');
for (const [name, rows, w] of sets) console.log(`${name.padEnd(30)} ${st(rows.map(([, v]) => v)).padStart(20)}   ${st(apply(rows, w)).padStart(20)}`);
const isr = sets.slice(0, 3).flatMap(([, rows, w]) => apply(rows, w)), isr0 = sets.slice(0, 3).flatMap(([, rows]) => rows.map(([, v]) => v));
console.log(`${'All 2,209 in Israel'.padEnd(30)} ${st(isr0).padStart(20)}   ${st(isr).padStart(20)}`);
