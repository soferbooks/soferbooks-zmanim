// Unit checks for the engine (src/): polar days, order of the zmanim, Rav Hillel's angles from their definition,
// Chacham Ovadia's equinox fractions, refraction and dip, and speed.
import { dayZmanim, ryhAngles, royEquinoxFraction, pick, SETS, MINUTES, MA_DAYS, listedOpinions, isHidden } from '../src/zmanim.js';
import { horizonRefraction, horizonDip, STANDARD_REFRACTION_DEG, normalForDay } from '../src/refraction.js';

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log(`FAIL ${msg}`); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

const GN = { lat: 40.807934, lon: -73.746343, elevation: 33 };
const TROMSO = { lat: 69.6492, lon: 18.9553, elevation: 10 };
const LONDON = { lat: 51.5072, lon: -0.1276, elevation: 20 };

// Polar day and night, and no alot / tzeit 90 at London's midsummer.
{
  const w = dayZmanim({ y: 2027, m: 12, d: 21 }, TROMSO), s = dayZmanim({ y: 2027, m: 6, d: 21 }, TROMSO);
  ok(w.sunrise.level === null && w.sunset.level === null, 'Tromsø midwinter: no sunrise or sunset');
  ok(s.sunrise.level === null && s.sunset.level === null, 'Tromsø midsummer: no sunrise or sunset');
  ok(w.opinions.hatzot !== null, 'Tromsø midwinter still has hatzot');
  const l = dayZmanim({ y: 2027, m: 6, d: 21 }, LONDON);
  ok(l.opinions['alot.deg90'] === null && l.opinions['tzeit.deg90'] === null, 'London midsummer: no alot / tzeit at 19°');
}

// Every set's zmanim in order through the day, at Great Neck through a year.
for (let m = 1; m <= 12; m++) {
  const day = dayZmanim({ y: 2027, m, d: 15 }, GN);
  for (const set of Object.keys(SETS)) {
    const t = pick(day, set);
    const order = ['alot', 'misheyakir', 'sunrise', 'shema', 'tefila', 'hatzot', 'minchaGedola', 'minchaKetana', 'plag', 'sunset', 'benHashmashot', 'nightfall', 'rabbeinuTam'];
    for (let i = 1; i < order.length; i++) ok(t[order[i - 1]] < t[order[i]], `${set} 2027-${m}-15: ${order[i - 1]} before ${order[i]}`);
    ok(t.candles < t.sunset, `${set}: candles before sunset`);
  }
  const o = day.opinions;
  ok(day.sunrise.elevated < day.sunrise.level && day.sunset.elevated > day.sunset.level, `elevated sunrise earlier / sunset later (2027-${m})`);
  near((o['sunset.seaLevel'] - o['sunrise.seaLevel']) / 12, day.hours.gra, 1, 'GRA hour = day / 12 (sea level)');
  ok(!('sunrise.level' in o) && !('sunset.level' in o), 'no level sunrise / sunset to choose');
  ok(!('sunrise.elevated' in o) && !('sunrise.roy' in o) && !('sunset.elevated' in o) && !('sunset.roy' in o), 'no lower-horizon sunrise / sunset to choose');
}

// Rav Hillel's angles derived from their definition (minutes in Jerusalem at the equinox): the 72 minutes come to the
// familiar 16.1° (to within a hundredth or so of a degree), and more minutes always mean a deeper Sun.
{
  const a = ryhAngles(2026);
  near(a.alot72 + 0.8423, 16.08, 0.03, 'derived alot 72 minutes ≈ 16.1° below the true horizon');
  ok(a.alot72 < a.alot90 && a.tzeit14 < a.tzeit18_5 && a.tzeit18_5 < a.tzeit27 && a.tzeit27 < a.tzeit36 && a.tzeit36 < a.tzeit40 && a.tzeit40 < a.rabbeinuTam, 'derived angles grow with the minutes');
}

// Chacham Ovadia's twilight fractions: 16.04° ≈ 72 seasonal minutes in Jerusalem (Zemaneh Yosef's own statement), and
// 3.7° ≈ 13.5 minutes.
{
  const J = { lat: 31.778029, lon: 35.235314, elevation: 0 };
  near(royEquinoxFraction(16.04, +1, J, 2027) * 60, 72, 1.5, 'Jerusalem dawn 16.04° in seasonal minutes');
  near(royEquinoxFraction(3.7, -1, J, 2027) * 60, 13.5, 0.5, 'Jerusalem nightfall 3.7° in seasonal minutes');
  near(royEquinoxFraction(5.075, -1, J, 2027) * 60, 20, 0.7, 'Jerusalem stringent nightfall 5.075° in seasonal minutes');
}

// Every minute value in all three forms (degrees, fixed, seasonal), every opinion described, and each degree opinion
// naming the time it stands for.
{
  const day = dayZmanim({ y: 2027, m: 3, d: 1 }, GN);
  for (const [zman, list] of Object.entries(MINUTES)) {
    if (zman === 'candles') continue; // (fixed minutes only: checked below)
    for (const m of list) {
      for (const form of ['deg', 'fixed', 'seasonal']) {
        const id = `${zman}.${form}${String(m).replace('.', '_')}`;
        ok(typeof day.opinions[id] === 'number', `${id} has a time`);
      }
      const d = day.info[`${zman}.deg${String(m).replace('.', '_')}`];
      ok(/° (above|below) the true horizon: [\d.]+ minutes (before sunrise|after sunset|before sunset) in Jerusalem at the equinox/.test(d.detail), `${zman} ${m} degrees names its basis: ${d.detail}`);
    }
  }
  // Magen Avraham's day in three forms for every zman counted in its hours.
  for (const m of MA_DAYS) for (const form of ['deg', 'fixed', 'seasonal']) for (const z of ['shema', 'tefila', 'minchaGedola', 'minchaKetana', 'plag']) {
    const id = `${z}.ma_${form}${m}`;
    ok(typeof day.opinions[id] === 'number', `${id} has a time`);
    if (form === 'deg') ok(/minutes each in Jerusalem at the equinox/.test(day.info[id].detail), `${id} names its basis`);
  }
  ok(day.opinions['candles.fixed18'] === day.opinions['sunset.seaLevel'] - 18 * 60000, 'candles 18 fixed minutes (from sea-level sunset)');
  { const D = { y: 2027, m: 3, d: 20 }, z = dayZmanim(D, GN), lv = z.opinions;
    const far = dayZmanim(D, GN, { visible: { sunriseFar: z.sunrise.level - 60000, sunsetFar: z.sunset.level + 60000 } }).opinions;
    ok(far['sunrise.visibleFar'] === z.sunrise.level - 60000 && far['sunset.visibleFar'] === z.sunset.level + 60000, "day's walk: the open horizon from the high point can be earlier / later than level");
    ok(lv['sunrise.visibleFar'] === null, "day's walk: null without far skylines");
    ok(Math.abs(lv['sunrise.seaLevel'] - z.sunrise.level) < 90000 && Math.abs(lv['sunset.seaLevel'] - z.sunset.level) < 90000, 'sea-level sunrise / sunset near the level ones');
    const vis = dayZmanim(D, GN, { visible: { sunrise: z.sunrise.level + 120000, sunset: z.sunset.level } }).opinions;
    ok(vis['sunrise.seaLevel'] === lv['sunrise.seaLevel'] && vis['sunrise.visible'] === z.sunrise.level + 120000 && vis['shema.gra'] === lv['shema.gra'], 'with hill data: sea level and visible listed; the hours still count from sea level');
    const lvl = dayZmanim(D, GN, { horizon: 'level' });
    ok(lvl.opinions['candles.fixed18'] === lvl.sunset.level - 18 * 60000, 'horizon: level counts from the level horizon'); }
  { const lw = dayZmanim({ y: 2027, m: 3, d: 20 }, GN, { horizon: 'lower' }); ok(lw.opinions['candles.fixed18'] === lw.sunset.elevated - 18 * 60000 && Math.abs((lw.sunset.elevated - lw.sunrise.elevated) / 12 - lw.hours.gra) < 1, 'horizon: lower counts from the lower horizon'); }
  ok(day.opinions['candles.fixed40'] < day.opinions['candles.fixed18'], 'candles 40 minutes before 18');
  ok(day.opinions['candles.deg18'] === undefined && day.opinions['candles.seasonal18'] === undefined, 'candles in fixed minutes only');
  ok(Object.keys(day.opinions).every((k) => day.info[k]?.label), 'every opinion has a label');
  ok(!Object.values(day.info).some((i) => /to be settled/.test(i.detail)), 'no angle is pending');
  // Hidden by default, and the chosen form hides the other two.
  for (const id of ['alot.deg90', 'alot.seasonal120', 'candles.fixed40', 'shema.ma_fixed72', 'plag.ma_deg120', 'tzeit.deg18_5', 'tzeit.fixed40', 'tzeit.seasonal96', 'shema.maDegStrict'])
    ok(isHidden(id) && day.info[id].hidden, `${id} hidden by default`);
  for (const id of ['tzeit.deg42', 'tzeit.seasonal50', 'tzeit.fixed27', 'tzeit.fixed36', 'tzeit.fixed36_5']) ok(isHidden(id), `${id} hidden by default`);
  for (const id of ['tzeit.fixed42', 'tzeit.fixed50', 'tzeit.deg27', 'tzeit.seasonal36', 'tzeit.deg36_5', 'tzeit.seasonal36_5']) ok(!isHidden(id), `${id} listed by default`);
  for (const id of ['alot.deg72', 'candles.fixed18', 'tzeit.fixed13_5', 'tzeit.deg36', 'tzeit.deg72_5', 'misheyakir.deg52', 'shema.maDeg', 'tzeit.roy'])
    ok(!isHidden(id), `${id} listed by default`);
  const tz = Object.keys(day.opinions).filter((k) => k.startsWith('tzeit.') || k.startsWith('rt.'));
  const fixedOnly = listedOpinions(tz, 'tzeit.fixed13_5');
  ok(fixedOnly.includes('tzeit.fixed50') && !fixedOnly.includes('tzeit.deg14') && !fixedOnly.includes('tzeit.seasonal14'), 'chose fixed: degree and seasonal minute options hidden');
  ok(fixedOnly.includes('tzeit.roy') && fixedOnly.includes('rt.roy'), "chose fixed: Chacham Ovadia's still listed");
  ok(listedOpinions(tz, 'tzeit.deg96').includes('tzeit.deg96'), 'a hidden opinion is listed once chosen');
  ok(listedOpinions(tz, null, { showAll: true }).length === tz.length, 'more opinions lists everything');
  ok(day.opinions['tzeit.fixed13_5'] - day.opinions['sunset.seaLevel'] === 13.5 * 60000, 'Ben HaShmashot 13.5 fixed minutes');
  near((day.opinions['tzeit.roySeasonal72_5'] - day.opinions['tzeit.roySeasonal27']) / day.hours.royGra, 45.5 / 60, 1e-9, "Chacham Ovadia's Rabbeinu Tam: 72.5 of his seasonal minutes");
  const ov = pick(day, 'seasonal'), hi = pick(day, 'degrees');
  ok(ov.benHashmashot === day.opinions['tzeit.roySeasonal13_5'] && ov.nightfall === day.opinions['tzeit.roySeasonal27'] && ov.rabbeinuTam === day.opinions['tzeit.roySeasonal72_5'], "Chacham Ovadia's nightfall defaults");
  ok(hi.benHashmashot === day.opinions['tzeit.deg13_5'] && hi.nightfall === day.opinions['tzeit.deg36_5'] && hi.rabbeinuTam === day.opinions['tzeit.deg72_5'], "Rav Hillel's nightfall defaults");
  ok(day.opinions['tzeit.roySeasonal27'] - (27 / 60) * day.hours.royGra > day.sunset.level, "Chacham Ovadia's sunset uses the elevation outside Israel too");
}

// Refraction scaling and dip.
near(horizonRefraction({ tempC: 9.85, pressure: 1010 }), STANDARD_REFRACTION_DEG, 1e-9, 'refraction at 1010 hPa, 283 K = standard');
ok(horizonRefraction({ tempC: -20, pressure: 1030 }) > horizonRefraction({ tempC: 35, pressure: 990 }), 'cold dense air refracts more');

// Erev Pesach and Erev Shabbat zmanim: eating chametz ends with the 4th hour (as tefila), burning with the 5th; the 10th
// hour begins after 9 hours, before Minha Ketana.
{
  const z = dayZmanim({ y: 2027, m: 4, d: 21 }, { lat: 40.807934, lon: -73.746343, elevation: 33 });
  for (const k of ['gra', 'maDeg', 'ma_fixed72', 'ma_seasonal72']) {
    ok(z.opinions[`chametzEat.${k}`] === z.opinions[`tefila.${k}`] && z.opinions[`chametzBurn.${k}`] > z.opinions[`chametzEat.${k}`], `chametz ${k}: eat = tefila < burn`);
  }
  ok(z.opinions['chametzEat.royMga'] < z.opinions['chametzEat.roy'], 'chametz: Chacham Ovadia MA before his Gra');
  ok(z.opinions['meal10.gra'] < z.opinions['minchaKetana.gra'] && z.opinions['meal10.gra'] > z.opinions['minchaGedola.gra'], 'the 10th hour between Minha Gedola and Ketana');
  ok(Math.abs(z.opinions['chametzBurn.gra'] - z.opinions['chametzEat.gra'] - z.hours.gra) < 1, 'burning one halachic hour after eating');
}
// Monthly normals blended by day: the month's own value at mid-month, no jump between months, December wraps to January.
{
  const T = [1, 2, 6, 11, 17, 22, 25, 24, 20, 14, 8, 3]; // Great Neck-like monthly means
  near(normalForDay(T, { y: 2026, m: 1, d: 16 }), 1, 1e-9, "normal for day: mid-January is January's value");
  near(normalForDay(T, { y: 2026, m: 7, d: 16 }), 25, 1e-9, "normal for day: mid-July is July's value");
  const a = normalForDay(T, { y: 2026, m: 4, d: 30 }), b = normalForDay(T, { y: 2026, m: 5, d: 1 });
  ok(a > 11 && b < 17 && Math.abs(b - a) < 0.25, `normal for day: 30 April ${a.toFixed(2)} → 1 May ${b.toFixed(2)}, no jump`);
  const c = normalForDay(T, { y: 2026, m: 12, d: 31 }), e = normalForDay(T, { y: 2027, m: 1, d: 1 });
  ok(Math.abs(e - c) < 0.1 && c < 3 && c > 1, `normal for day: 31 Dec ${c.toFixed(2)} → 1 Jan ${e.toFixed(2)}, wraps`);
  let worst = 0, prev = normalForDay(T, { y: 2026, m: 1, d: 1 });
  for (let t = Date.UTC(2026, 0, 2); t < Date.UTC(2027, 0, 1); t += 86400000) {
    const dt = new Date(t), v = normalForDay(T, { y: 2026, m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
    worst = Math.max(worst, Math.abs(v - prev)); prev = v;
  }
  ok(worst < 0.25, `normal for day: largest day-to-day step over 2026 ${worst.toFixed(3)}° (monthly steps up to 6°)`);
  ok(normalForDay([1, 2], { y: 2026, m: 6, d: 1 }) === null, 'normal for day: missing months give null');
}
near(horizonDip(100, { k: 0 }), 0.3210, 0.001, 'geometric dip at 100 m');
near(horizonDip(100), 0.2995, 0.001, 'dip at 100 m with k = 0.13');

// Live weather: different refraction at sunrise and sunset moves them apart.
{
  const d = { y: 2027, m: 1, d: 10 };
  const base = dayZmanim(d, GN);
  const cold = dayZmanim(d, GN, { refraction: { sunrise: { tempC: -15, pressure: 1035 }, sunset: { tempC: 0, pressure: 1015 } } });
  ok(cold.sunrise.level < base.sunrise.level, 'cold morning: earlier sunrise');
  ok(cold.refraction.sunrise > cold.refraction.sunset, 'colder sunrise refracts more than sunset');
  // Degrees are measured from the true horizon: the local air moves sunrise but not alot / tzeit in degrees.
  ok(cold.opinions['alot.deg72'] === base.opinions['alot.deg72'] && cold.opinions['tzeit.deg36_5'] === base.opinions['tzeit.deg36_5'], 'local refraction does not move the degree zmanim');
  // Measuring below the day's own rise point (degreesFrom: 'risePoint') is kept for comparison, and there the cold morning does move alot.
  const r1 = dayZmanim(d, GN, { degreesFrom: 'risePoint' }), r2 = dayZmanim(d, GN, { degreesFrom: 'risePoint', refraction: { sunrise: { tempC: -15, pressure: 1035 }, sunset: { tempC: 0, pressure: 1015 } } });
  ok(r2.opinions['alot.deg72'] < r1.opinions['alot.deg72'], "below the rise point: a cold morning moves alot");
  // With the standard refraction the two ways agree to within the Sun's radius change over the year (a few seconds).
  ok(Math.abs(base.opinions['alot.deg72'] - r1.opinions['alot.deg72']) < 5000, `standard air: the two ways within 5 s (${(base.opinions['alot.deg72'] - r1.opinions['alot.deg72']) / 1000} s)`);
}

// Speed: a whole year for one place.
{
  const t0 = performance.now();
  for (let i = 0; i < 365; i++) {
    const g = new Date(Date.UTC(2028, 0, 1 + i));
    dayZmanim({ y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() }, GN);
  }
  const secs = (performance.now() - t0) / 1000;
  console.log(`one year of days at Great Neck: ${secs.toFixed(2)} s`);
  ok(secs < 20, 'a year computes in under 20 s');
}

// Fixes from the checks against KosherJava 3.x (2026-11-10).
{
  // Across the date line from the longitude (Apia: UTC+13 at 171.8° W): the civil date is the clock's date.
  const apia = { lat: -13.833, lon: -171.767, elevation: 2, utcOffset: 13 };
  const rise = dayZmanim({ y: 2026, m: 11, d: 10 }, apia).opinions['sunrise.seaLevel'];
  ok(new Date(rise + 13 * 3600000).toISOString().slice(0, 10) === '2026-11-10', 'date line: Apia sunrise on its own clock date');
  // The Sun only just reaching the horizon (Tromsø, 15 January 2024: its first sunrise of the year, a few minutes long).
  const tr = dayZmanim({ y: 2024, m: 1, d: 15 }, { ...TROMSO, elevation: 0 }).opinions;
  ok(tr['sunrise.seaLevel'] !== null && tr['sunset.seaLevel'] !== null && tr['sunrise.seaLevel'] < tr['sunset.seaLevel'], 'barely reached: Tromsø 2024-01-15 has a sunrise and sunset');
  // Chacham Ovadia's dawn where the Sun never reaches 16.04° on 17 March (75.5° N): no time, not sunrise.
  const far = dayZmanim({ y: 2026, m: 6, d: 1 }, { lat: 75.5, lon: 0, elevation: 0 }).opinions;
  ok(far['alot.roy'] === null && far['misheyakir.roy'] === null, "Chacham Ovadia's dawn: none where 16.04° is never reached");
  // Short days at 70° N: mincha gedola never after sunset, candle lighting never before plag.
  let bad = 0;
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 864e5) {
    const g = new Date(t), o = dayZmanim({ y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() }, { lat: 70, lon: 20, elevation: 0 }).opinions;
    if ((o['minchaGedola.gra30'] !== null && o['sunset.seaLevel'] !== null && o['minchaGedola.gra30'] > o['sunset.seaLevel'])
      || (o['candles.fixed18'] !== null && o['plag.gra'] != null && o['candles.fixed18'] < o['plag.gra'])) bad++;
  }
  ok(bad === 0, `short days: no mincha gedola after sunset or candle lighting before plag (${bad} days)`);
}

console.log(`${checks} checks, ${fails} cases differ`);
process.exit(fails ? 1 : 0);
