// How large a cushion each kind of place needs, from every set of timed sunrises and sunsets scored so far.
// The engine prints the visible sunrise CUSHION_S (15 s) later than computed and the visible sunset 15 s earlier, so the
// printed time is on the near side of what is seen. A sunrise is covered when it was seen no later than the printed
// time (observed - computed <= cushion); a sunset when it was seen no earlier (observed - computed >= -cushion).
//
// Inputs (all in cache/, written by the other scripts; observed - computed with the engine's kept method, monthly
// normals, over the horizon the observer saw):
//   keller-residuals.json        node test/compare-observations.js --dump=research/sunsets/cache/keller-residuals.json
//   sampson-results-copernicus.json   sampson-edmonton.mjs   (field `seen`: over the horizon Sampson measured)
//   schaefer-liller-results.json      schaefer-liller.mjs    (field `halachic`: over the real skyline)
//   mount-wilson-omc.json             mount-wilson-obs.mjs   (field `real`: last light over the real skyline)
import { readFileSync } from 'node:fs';
const C = new URL('./cache/', import.meta.url);
const J = (f) => JSON.parse(readFileSync(new URL(f, C)));

const K = J('keller-residuals.json'), E = J('sampson-results-copernicus.json'), SL = J('schaefer-liller-results.json'), MW = J('mount-wilson-omc.json');
const fin = (v) => v.filter((x) => x != null && Number.isFinite(x));
const sl = (f) => fin(SL.filter(f).map((r) => r.halachic));
const groups = [
  ['Sunrise', 'Israel, hills (Druk, Golan)', [...K.druk, ...K.golan]],
  ['Sunrise', 'Israel, coastal plain (Zuriel)', K.zuriel],
  ['Sunrise', 'Edmonton, prairie (Sampson)', fin(E.filter((r) => r.rise).map((r) => r.seen))],
  ['Sunset', 'Edmonton, prairie (Sampson)', fin(E.filter((r) => !r.rise).map((r) => r.seen))],
  ['Sunset', 'Sea, from up to 300 m (Hawaii coast, Vina, La Serena)', sl((r) => r.alt <= 300)],
  ['Sunset', 'Sea, from 800-4,205 m (Hawaii, Tololo)', sl((r) => r.alt > 300)],
  ['Sunset', 'Sea, from 1,739 m, binoculars (Mount Wilson)', fin(MW.map((r) => r.real))],
  ['Sunset', '  the same, no mirage noted', fin(MW.filter((r) => r.nz === '0').map((r) => r.real))],
];
if (!K.druk || !K.golan || !K.zuriel) throw new Error('keller-residuals.json: expected druk, golan, zuriel');

// Cushion needed so that a share p of the events is covered.
const need = (v, rise, p) => { const s = [...v].sort((a, b) => a - b);
  return rise ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : -s[Math.max(0, Math.floor((1 - p) * s.length))]; };
const covered = (v, rise, c) => v.filter((x) => (rise ? x <= c : x >= -c)).length / v.length;
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };
const pct = (x) => `${(100 * x).toFixed(0)}%`.padStart(5);
console.log('observed - computed (s); covered = on the near side of the printed time\n');
console.log('event    place                                              n    mean    sd | covered with cushion 0 / 15 / 30 / 60 s | cushion for 90% / 95% / 99%');
for (const [ev, name, v] of groups) {
  const rise = ev === 'Sunrise';
  console.log(`${ev.padEnd(8)} ${name.padEnd(50)} ${String(v.length).padStart(4)} ${mean(v).toFixed(0).padStart(6)} ${sd(v).toFixed(0).padStart(5)} |`
    + `  ${[0, 15, 30, 60].map((c) => pct(covered(v, rise, c))).join(' ')}                 | `
    + [0.9, 0.95, 0.99].map((p) => `${Math.max(0, need(v, rise, p)).toFixed(0)}`.padStart(5)).join(' '));
}
