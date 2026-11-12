// Runs every check of the engine. Usage: npm test
// compare-observations.js downloads Rabbi Keller's observations on its first run (internet needed once).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const runs = [['zmanim.test.js'], ['moon.test.js'], ['raytrace.test.js'], ['compare-horizons.js'], ['compare-usno.js'], ['compare-roy.js'], ['compare-observations.js']];
let failed = 0;
for (const [script, ...args] of runs) {
  const r = spawnSync(process.execPath, [join(here, script), ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const last = (r.stdout || '').trim().split('\n').pop() || (r.stderr || '').trim().split('\n').pop();
  if (r.status !== 0) failed++;
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${[script, ...args].join(' ')}: ${last}`);
}
console.log(failed ? `${failed} run(s) failed` : 'every check passes');
process.exit(failed ? 1 : 0);
