// Downloads Rabbi Chaim Keller's published sunrise observations (github.com/chaimkeller/software, observations-all-places)
// and writes them as one JSON file for compare-observations.js: Rav Druk at Armon HaNatziv 1985-96 (DRUK.001, DRUK9396.DAT), R' Yisroel
// Golan at the Magen Avraham shul in Neve Yaakov 2009-13 (Golan_20xx.csv), Rav Yosef Zuriel in Bnei Brak 1961-92. Times are
// Israel Standard Time (UT+2); observer points and heights as in that repository's Drukfrm.frm.
// Usage: node test/fetch-observations.mjs   (compare-observations.js calls it on its first run)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'https://raw.githubusercontent.com/chaimkeller/software/master/observations-all-places/';
const MON = Object.fromEntries('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ').map((m, i) => [m, i + 1]));
const pad = (n) => String(n).padStart(2, '0');
const SITES = {
  druk: { name: 'Rav Druk, Armon HaNatziv', lat: 31.748552568177, lon: 35.237435642287, eye: 756.7 },
  golan: { name: "R' Golan, Neve Yaakov", lat: 31.8424065056182, lon: 35.2472030237111, eye: 684.3 },
  zuriel: { name: 'Rav Zuriel, Bnei Brak', lat: 32.084319333, lon: 34.83215883, eye: 52 },
};
const get = async (f) => {
  const r = await fetch(BASE + encodeURIComponent(f));
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return new TextDecoder('latin1').decode(await r.arrayBuffer());
};

export async function fetchObservations(outUrl) {
  const rows = [];
  // Rav Druk 1985-92 (DRUK.001): eight quoted cells per day, one per year: "06:37:40B" (the letter: who observed) or "#N/A".
  for (const line of (await get('DRUK.001')).split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)\s+"(\d\d)-(\w{3})"\s+(.*)/);
    if (!m) continue;
    [...m[4].matchAll(/"([^"]*)"/g)].forEach(([, c], yi) => {
      const t = c.match(/^(\d\d):(\d\d):(\d\d)/);
      if (t) rows.push({ site: 'druk', date: `${1985 + yi}-${pad(MON[m[3]])}-${m[2]}`, time: t[0] });
    });
  }
  // Rav Druk 1993-96 (DRUK9396.DAT): four cells per day separated by tabs; an empty year is a lone ",", a filled one is the
  // time and the observer's letter. (Read by commas, as before 2026-11-10, times went into the wrong year and some were lost.)
  for (const line of (await get('DRUK9396.DAT')).split(/\r?\n/)) {
    const m = line.match(/^\s*\d+\s+(\d\d)-(\w{3})\s+(.*)/);
    if (!m) continue;
    let yi = 0;
    for (const tok of m[3].trim().split(/\s+/)) {
      if (yi > 3) break;
      if (tok === ',') { yi++; continue; }
      const t = tok.match(/^(\d\d):(\d\d):(\d\d)$/);
      if (t) { rows.push({ site: 'druk', date: `${1993 + yi}-${pad(MON[m[2]])}-${m[1]}`, time: t[0] }); yi++; }
    }
  }
  for (const y of [2009, 2010, 2011, 2012, 2013]) {
    for (const line of (await get(`Golan_${y}.csv`)).split(/\r?\n/)) {
      const p = line.trim().split(',');
      if (p.length < 3 || !/^\d+:\d\d:\d\d$/.test(p[2])) continue;
      const [, mo, d, yy] = p[1].match(/(\w{3})-(\d\d)-(\d{4})/);
      const [h, mi, s] = p[2].split(':');
      rows.push({ site: 'golan', date: `${yy}-${pad(MON[mo])}-${d}`, time: `${pad(+h)}:${mi}:${s}` });
    }
  }
  for (const line of (await get('Zuriel_Bnei_Brqk_61-92.csv')).split(/\r?\n/)) {
    const m = line.trim().match(/^(\d\d:\d\d:\d\d),(\d\d)\/(\d\d)\/(\d\d)/);
    if (m) rows.push({ site: 'zuriel', date: `${1900 + +m[4]}-${m[2]}-${m[3]}`, time: m[1] });
  }
  writeFileSync(outUrl, JSON.stringify({ source: `${BASE} (downloaded ${new Date().toISOString().slice(0, 10)})`, sites: SITES, rows }));
  return rows.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const n = await fetchObservations(new URL('./fixtures/observations.json', import.meta.url));
  console.log(`${n} observations saved`);
}
