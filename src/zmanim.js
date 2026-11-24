// The soferbooks.com zmanim engine: one civil day's zmanim for a place, in every opinion it offers, from public
// astronomy (sun.js → astronomia's full VSOP87) and the halachic definitions below.
//
// Three main sets (SETS): degrees (twilight as the Sun's depression for the given minutes in Jerusalem at the equinox),
// seasonal minutes (twilight degrees turned into seasonal minutes, as Zemaneh Yosef / royzmanim.com compute them), and
// fixed minutes. Every zman can still be chosen on its own from the
// catalogue (dayZmanim().opinions).
import { assertDate, assertPlace } from './check.js';
import { transit, lowerTransit, crossing, sunDistance, sunPosition, marchEquinox, SUN_RADIUS_1AU_DEG } from './sun.js';
import { horizonRefraction, horizonDip, STANDARD_REFRACTION_DEG, stationPressure } from './refraction.js';

const MIN = 60000;
const HOUR = 3600000;

// ---------------------------------------------------------------------------------------------------------------
// Rav Yaakov Hillel's degrees (Ahavat Shalom's method, described in the book's appendices): a zman of N minutes is
// the Sun's depression, below the point where it rises (or sets), N minutes before sunrise (after sunset) in
// Jerusalem on the day of the equinox. We derive the angles ourselves from that definition.
export const JERUSALEM = { lat: 31.778029, lon: 35.235314, elevation: 0 }; // the Kotel; elevation 0 = level horizon
export const RYH_MINUTES = {
  alot90: [90, +1], alot72: [72, +1], misheyakir: [52, +1],
  tzeit14: [14, -1], tzeit18_5: [18.5, -1], tzeit25: [25, -1], tzeit27: [27, -1], tzeit36: [36.5, -1], tzeit40: [40, -1],
  rabbeinuTam: [72.5, -1], tzeit90: [90, -1],
};

const civil = (ms) => { const d = new Date(ms); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };

// Level sunrise / sunset with a given refraction and the true solar radius.
function levelRiseSet(date, place, direction, refractionDeg, noon) {
  const alt = (ms) => -(sunDistance(ms).radiusDeg + refractionDeg);
  return crossing(date, place, alt, direction, noon);
}

const angleCache = new Map();
/**
 * The depression angle for `minutes` before sunrise (direction +1) or after sunset (-1) in Jerusalem at the March
 * equinox of `year`, measured below the rise/set altitude (the convention of Rav Hillel's tables: an event at angle a
 * is when the Sun's centre is at -(radius + refraction + a)). Also returns the plain geometric depression of the
 * Sun's centre. Standard refraction.
 */
export function equinoxAngle(minutes, direction, year = 2026, refractionDeg = STANDARD_REFRACTION_DEG) {
  const key = `${minutes},${direction},${year},${refractionDeg}`;
  if (angleCache.has(key)) return angleCache.get(key);
  const date = civil(marchEquinox(year) + (JERUSALEM.lon / 15) * HOUR);
  const rise = levelRiseSet(date, JERUSALEM, direction, refractionDeg);
  const at = rise - direction * minutes * MIN;
  const alt = sunPosition(at, JERUSALEM).altitude;
  const riseAlt = -(sunDistance(rise).radiusDeg + refractionDeg);
  const res = { angle: riseAlt - alt, geometric: -alt };
  angleCache.set(key, res);
  return res;
}
export function ryhAngles(year = 2026) {
  const out = {};
  for (const [k, [m, dir]] of Object.entries(RYH_MINUTES)) out[k] = equinoxAngle(m, dir, year).angle;
  return out;
}

// The minutes each zman is offered at. Every value comes in three forms (a design decision: "all options" = degrees,
// fixed and seasonal): degrees (Rav Hillel's method, with the time it stands for named), fixed clock minutes, and
// seasonal minutes (1/60 of a halachic hour, sunrise to sunset).
export const MINUTES = {
  alot: [72, 90, 96, 120],
  misheyakir: [50, 52, 60], // 52: Luach Ahavat Shalom's "זמן ציצית"
  // Ben HaShmashot, Nightfall, Rabbeinu Tam. 36.5: Luach Ahavat Shalom's Motzaei Shabbat, "צאת השבת - 36 דקות" (taken as
  // 36.5 minutes); 72.5: its "צה"כ רבינו תם - 72.5".
  tzeit: [13.5, 14, 18, 18.5, 20, 25, 27, 36, 36.5, 40, 42, 50, 72, 72.5, 90, 96, 120],
  candles: [18, 20, 22, 24, 30, 40], // before sunset (fixed minutes only)
};
// Opinions not listed by default (a design decision): still computed, shown when chosen or under "more opinions".
export const HIDDEN_BY_DEFAULT = [
  /^alot\.(deg|fixed|seasonal)(90|96|120)$/,
  /^candles\.fixed(20|22|24|30|40)$/, // (candle lighting is listed only in fixed minutes)
  /^\w+\.ma_(deg|fixed|seasonal)(72|90|96|120)$/, // Magen Avraham's day, alot N to tzeit N
  /^tzeit\.(deg|fixed|seasonal)(18|18_5|20|25|40|90|96|120)$/,
  /^tzeit\.(deg|seasonal)(42|50)$/, // 42 and 50 listed only as fixed minutes
  /^tzeit\.fixed(27|36|36_5)$/, // 27 and 36 listed only in degrees and seasonal
  /^tzeit\.roySeasonal(27|72_5)$/, // Chacham Ovadia's set picks these; listed when chosen
  /^(shema|tefila|chametzEat|chametzBurn)\.maDegStrict$/, // Luach Ahavat Shalom's stringent MA day, alot 90° to tzet 25°
];
export const isHidden = (id) => HIDDEN_BY_DEFAULT.some((re) => re.test(id));

// The form of a minute-based opinion: 'deg', 'fixed' or 'seasonal' (null for the others: GRA, Chacham Ovadia's, ...).
export function formOf(id) {
  const m = id.match(/\.(?:ma_|roy)?(deg|fixed|seasonal)\d/i); // roySeasonal13_5: Chacham Ovadia's, in seasonal minutes
  return m ? m[1].toLowerCase() : null;
}
/**
 * Which of one zman's opinions to list. Hidden-by-default ones are left out; and once the chosen opinion is in degrees,
 * fixed or seasonal minutes, the minute options in the other two forms are left out too (a design decision: "if a user
 * sets an opinion (degrees, fixed or seasonal) then hide the others"). The chosen one is always listed; showAll lists
 * everything (the "more opinions" view).
 */
export function listedOpinions(ids, chosen = null, { showAll = false } = {}) {
  if (showAll) return [...ids];
  const form = chosen ? formOf(chosen) : null;
  return ids.filter((id) => id === chosen || (!isHidden(id) && (!form || !formOf(id) || formOf(id) === form)));
}

// Magen Avraham's day, from alot N minutes before sunrise to tzeit N minutes after sunset, in each of the three forms:
// sof zman shema / tefila, mincha gedola / ketana and plag are counted in its hours.
export const MA_DAYS = [72, 90, 96, 120];

/**
 * The angle (below the rise / set point) for a zman of `minutes` before sunrise (+1) or after sunset (-1).
 * mode: undefined = the definition; or an object { 'dir:minutes': angle } of overrides.
 */
// Rav Hillel's degrees (Luach Ahavat Shalom's book: the Sun's depression for the given minutes in Jerusalem at the equinox,
// with refraction and the Sun's radius added) are measured below the rise / set point with the standard refraction,
// i.e. the Sun's centre is then at -(radius + standard refraction + angle). The engine places each such zman where the
// Sun's centre is that same depth below the true horizon every day (a design decision: twilight light comes from rays
// that skim the Earth far away and high above the local air, so the morning's local refraction must not move it).
// cfg.degreesFrom = 'risePoint' measures below each day's own rise / set point instead (the day's radius and refraction).
export function risePointOffset(direction, year = 2026) {
  const e = equinoxAngle(0, direction, year);
  return e.geometric - e.angle;
}

export function ryhAngle(minutes, direction, mode, year = 2026) {
  const key = `${direction}:${minutes}`;
  if (mode && typeof mode === 'object' && key in mode) return { angle: mode[key], source: 'set' };
  return { angle: equinoxAngle(minutes, direction, year).angle, source: 'definition' };
}

// ---------------------------------------------------------------------------------------------------------------
// Chacham Ovadia's twilights (Zemaneh Yosef, ROYZmanim.js; KosherJava's getPercentOfShaahZmanisFromDegrees): the
// Sun's geometric depression in degrees, turned into a fraction of a seasonal hour at the place on 17 March, and then
// applied as that many seasonal minutes every day of the year.
export const ROY_DEGREES = { dawn: 16.04, nightfall: 3.7, nightfallHumra: 5.075, rabbeinuTam: 16.04, mil: 4.8, guard: 8.5 };

// KosherJava's sea-level sunrise / sunset: 34′ refraction... Zemaneh Yosef sets 34.478885′, a fixed 16′ radius.
const ROY_RISE_ALT = -(16 / 60 + STANDARD_REFRACTION_DEG);
// KosherJava's elevation adjustment: geometric dip with an Earth radius of 6356.9 km.
const royDip = (h) => horizonDip(h, { k: 0, radius: 6356900 });

const royFracCache = new Map();
// Fraction of a seasonal (GRA, sea-level) hour between sunrise/sunset and the Sun at `deg` below, on 17 March.
export function royEquinoxFraction(deg, direction, place, year) {
  const key = `${deg},${direction},${place.lat},${place.lon},${year}`;
  if (royFracCache.has(key)) return royFracCache.get(key);
  const date = { y: year, m: 3, d: 17 };
  const noon = transit(date, place);
  const rise = crossing(date, place, ROY_RISE_ALT, +1, noon), set = crossing(date, place, ROY_RISE_ALT, -1, noon);
  const tw = crossing(date, place, -deg, direction, noon);
  const f = rise === null || set === null || tw === null ? null : (direction > 0 ? rise - tw : tw - set) / ((set - rise) / 12) ;
  royFracCache.set(key, f);
  return f;
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * One day's zmanim.
 * date  = { y, m, d } civil date at the place
 * place = { lat (−90…90), lon (east +, −180…180), elevation (m), utcOffset (hours; needed where the clock is across the
 *           date line from the longitude: Samoa, Kiritimati, …) }. Bad input throws a TypeError (check.js).
 * cfg   = {
 *   refraction: { sunrise, sunset } each a ray-traced table (airprofiles.js tableFor) or { tempC, pressure },
 *               or a number (degrees); default: the standard refraction,
 *   visible: { sunrise, sunset } epoch ms from the terrain module (stage 2), or null,
 *   candleMinutes (default 18),
 *   degreesFrom: undefined (the true horizon) | 'risePoint' (below the day's own rise / set point),
 *   angles: undefined (each angle from its minutes) | { '-1:36.5': angle, … } overrides,
 *   horizon: 'sea' (default, DEFAULT_HORIZON) | 'level' | 'lower': what the zmanim built on sunrise / sunset count from,
 *   ryhYear (default 2026): the year whose 17 March gives Rav Yaakov Hillel's degree equivalents,
 * }
 * Returns { transit (ms), sunrise:{…}, sunset:{…}, refraction: { sunrise, sunset } (degrees), angles: { id: degrees },
 *   opinions: { id: ms|null }, info: { id: { label, detail } }, candleId (the place's candle-lighting opinion id),
 *   hours: { id: the length of a halachic hour in ms (a duration, not a time of day) } }.
 * Midnight is among the opinions ('midnight.half', 'midnight.astronomical').
 * On very short days (near the polar circles) some zmanim can fall out of their usual order: only "mincha gedola after
 * sunset" and "candle lighting before plag" are set to null; the sets are not meant for days of a few hours.
 */
// The horizon that every zman built on sunrise or sunset counts from (Gra hours, fixed and seasonal minutes, candle
// lighting, the halfway midday, plag ...): 'sea' (sea-level sunrise and sunset with standard refraction, 50′ in all, as
// most calendars; Mordy, 2026-11-09: "zmanim besides sunrise and sunset are to be decided by sea level"), 'level' (a
// level horizon at the observer's height, with the place's weather) or 'lower' (over the lower horizon, from the
// place's height). A day can also be asked for with cfg.horizon.
export const DEFAULT_HORIZON = 'sea';

export function dayZmanim(date, place, cfg = {}) {
  assertDate(date, 'dayZmanim'); assertPlace(place, 'dayZmanim');
  const noon = transit(date, place);
  // Refraction at apparent elevation e for an event: a ray-traced table (airprofiles.js) when given, else the horizon
  // value from the air's temperature and pressure (or a number of degrees), the same at every e near the horizon.
  const refrAt = (ev, e = 0) => {
    const r = cfg.refraction;
    if (typeof r === 'number') return r;
    if (r?.[ev] && typeof r[ev].refraction === 'function') return r[ev].refraction(e);
    return horizonRefraction(r?.[ev] ?? {});
  };
  const rSunrise = refrAt('sunrise'), rSunset = refrAt('sunset');
  const radius = (ms) => sunDistance(ms).radiusDeg;
  const at = (direction, extra, refr) => crossing(date, place, (ms) => -(radius(ms) + refr + extra), direction, noon);

  // Sunrise and sunset. level: a level horizon at the observer's own height (Rav Hillel's main time, also "sea
  // level"); elevated: over the lower surroundings from this height (dip with standard terrestrial refraction).
  const dip = horizonDip(place.elevation ?? 0);
  const sunrise = { level: at(+1, 0, rSunrise), elevated: at(+1, dip, refrAt('sunrise', -dip)), visible: cfg.visible?.sunrise ?? null };
  const sunset = { level: at(-1, 0, rSunset), elevated: at(-1, dip, refrAt('sunset', -dip)), visible: cfg.visible?.sunset ?? null };
  // Sea level: a sea-level horizon with the place's weather (Mordy, 2026-11-09: "make it use weather, i want that to be
  // the most accurate too"): the day's temperature and pressure brought down from the place's height to sea level
  // (standard lapse rate and barometric formula); a ray-traced table or a fixed number is used as it is.
  const seaRefr = (ev) => {
    const r = cfg.refraction?.[ev], h = place.elevation ?? 0;
    if (r && typeof r.refraction !== 'function' && r.tempC != null && r.pressure != null)
      return horizonRefraction({ tempC: r.tempC + 0.0065 * h, pressure: r.pressure / stationPressure(1, h) });
    return refrAt(ev);
  };
  sunrise.seaLevel = at(+1, 0, seaRefr('sunrise'));
  sunset.seaLevel = at(-1, 0, seaRefr('sunset'));
  // The sunrise and sunset the other zmanim count from (DEFAULT_HORIZON).
  const horizon = cfg.horizon ?? DEFAULT_HORIZON, lower = horizon === 'lower';
  const pick = (e) => (horizon === 'sea' ? e.seaLevel : lower ? e.elevated : e.level);
  const rise0 = pick(sunrise), set0 = pick(sunset);

  const o = {};
  const info = {}; // id → { label, detail }: what each opinion is, for display
  const add = (a, b) => (a === null || b === null ? null : a + b);
  const hourOf = (a, b) => (a === null || b === null ? null : (b - a) / 12);
  const seasonal = (base, hours, hour) => (base === null || hour === null ? null : base + hours * hour);
  const gra = hourOf(rise0, set0);
  const before = (t, m) => add(t, -m * MIN), after = (t, m) => add(t, m * MIN);
  const angles = {};
  const fromRise = cfg.degreesFrom === 'risePoint';

  // ---- Every minute value in three forms: degrees (Rav Hillel's method), fixed, seasonal --------------------------
  const tag = (m) => String(m).replace('.', '_');
  // zman N minutes before sunrise (dir +1), after sunset (dir -1), or before sunset (dir -1, early = true: candles).
  const minutesForm = (zman, m, dir, early = false) => {
    const ev = dir > 0 ? 'sunrise' : 'sunset', base = dir > 0 ? rise0 : set0;
    const word = dir > 0 ? 'before sunrise' : early ? 'before sunset' : 'after sunset';
    const signed = early ? -m : m; // minutes past the event, in the direction away from midday
    const a = ryhAngle(signed, dir, cfg.angles, cfg.ryhYear ?? 2026);
    const id = (form) => `${zman}.${form}${tag(m)}`;
    const geo = a.angle + risePointOffset(dir, cfg.ryhYear ?? 2026); // the Sun's centre below the true horizon
    angles[id('deg')] = a.angle;
    o[id('deg')] = fromRise ? at(dir, a.angle, dir > 0 ? rSunrise : rSunset) : crossing(date, place, -geo, dir, noon);
    info[id('deg')] = {
      label: `${m} minutes (degrees)`,
      detail: `Sun's centre ${Math.abs(geo).toFixed(3)}° ${geo < 0 ? 'above' : 'below'} the true horizon: ${m} minutes ${word} in Jerusalem at the equinox`,
    };
    o[id('fixed')] = dir > 0 ? before(base, m) : after(base, signed);
    info[id('fixed')] = { label: `${m} fixed minutes`, detail: `${m} minutes ${word}` };
    o[id('seasonal')] = seasonal(base, (-dir * signed) / 60, gra);
    info[id('seasonal')] = { label: `${m} seasonal minutes`, detail: `${m} minutes of a halachic hour (1/60 of 1/12 of sunrise to sunset) ${word}` };
  };
  for (const m of MINUTES.alot) minutesForm('alot', m, +1);
  for (const m of MINUTES.misheyakir) minutesForm('misheyakir', m, +1);
  for (const m of MINUTES.tzeit) minutesForm('tzeit', m, -1);
  // Candle lighting: the place's own minutes (cfg.candleMinutes, e.g. 40 in Jerusalem) join the list; the sets show them.
  const candleList = MINUTES.candles.includes(cfg.candleMinutes ?? 18) ? MINUTES.candles : [...MINUTES.candles, cfg.candleMinutes];
  for (const m of candleList) minutesForm('candles', m, -1, true);
  // Candle lighting in fixed minutes only: its minutes are a custom before sunset, not a height of the sun or a share
  // of the day (Mordy, 2026-11-08).
  for (const m of candleList) for (const form of ['deg', 'seasonal']) { const id = `candles.${form}${tag(m)}`; delete o[id]; delete info[id]; delete angles[id]; }
  const maDeg = hourOf(o['alot.deg72'], o['tzeit.deg14']); // Rav Yaakov Hillel's Magen Avraham: alot 72 to tzeit 14 (degrees)
  const maDegStrict = hourOf(o['alot.deg90'], o['tzeit.deg25']); // stringent: alot 90 to tzeit 25 (degrees)
  const FORM_WORD = { deg: 'degrees', fixed: 'fixed minutes', seasonal: 'seasonal minutes' };
  const maHours = {};
  for (const m of MA_DAYS) {
    for (const form of ['deg', 'fixed', 'seasonal']) {
      const t = tag(m), start = o[`alot.${form}${t}`], h = hourOf(start, o[`tzeit.${form}${t}`]);
      maHours[`${form}${t}`] = h;
      const basis = form === 'deg'
        ? ` (alot: Sun's centre ${(angles[`alot.deg${t}`] + risePointOffset(+1, cfg.ryhYear ?? 2026)).toFixed(3)}° below the true horizon; tzeit: ${(angles[`tzeit.deg${t}`] + risePointOffset(-1, cfg.ryhYear ?? 2026)).toFixed(3)}°; ${m} minutes each in Jerusalem at the equinox)`
        : '';
      const day = `a day from alot ${m} to tzeit ${m}, in ${FORM_WORD[form]}${basis}`;
      const label = `Magen Avraham, ${m} ${FORM_WORD[form]}`;
      const put = (zman, value, detail) => { o[`${zman}.ma_${form}${t}`] = value; info[`${zman}.ma_${form}${t}`] = { label, detail }; };
      put('shema', seasonal(start, 3, h), `3 hours of ${day}`);
      put('tefila', seasonal(start, 4, h), `4 hours of ${day}`);
      put('chametzEat', seasonal(start, 4, h), `4 hours of ${day}`);
      put('chametzBurn', seasonal(start, 5, h), `5 hours of ${day}`);
      put('meal10', seasonal(start, 9, h), `9 hours of ${day} (the 10th hour begins)`);
      put('minchaGedola', seasonal(noon, 0.5, h), `Half an hour of ${day}, after hatzot`);
      put('minchaKetana', seasonal(start, 9.5, h), `9½ hours of ${day}`);
      put('plag', seasonal(start, 10.75, h), `10¾ hours of ${day}`);
    }
  }

  // ---- Chacham Ovadia (Zemaneh Yosef) -----------------------------------------------------------------------------
  // Day: sunrise to sunset with the elevation's dip.
  // Design decision: with the elevation everywhere (Zemaneh Yosef does so only in Israel; sea level elsewhere).
  const royUseElev = (place.elevation ?? 0) > 0;
  const rd = royUseElev ? royDip(place.elevation) : 0;
  const royRise = crossing(date, place, ROY_RISE_ALT - rd, +1, noon), roySet = crossing(date, place, ROY_RISE_ALT - rd, -1, noon);
  const royHour = hourOf(royRise, roySet);
  const yr = date.y;
  const frac = (d, dir) => royEquinoxFraction(d, dir, place, yr);
  const royAfter = (base, f) => (f === null ? null : seasonal(base, f, royHour));
  const guard = crossing(date, place, -ROY_DEGREES.guard, +1, noon); // never later than the Sun 8.5° down
  // (a null fraction - the Sun never that far down on 17 March, far north or south - stays null, not −0)
  const dawnFrac = frac(ROY_DEGREES.dawn, +1);
  let royDawn = royAfter(royRise, dawnFrac === null ? null : -dawnFrac);
  if (royDawn !== null && guard !== null && guard < royDawn) royDawn = guard;
  const royTzetRT = royAfter(roySet, frac(ROY_DEGREES.rabbeinuTam, -1));
  o['alot.roy'] = royDawn;
  o['misheyakir.roy'] = royDawn === null || royRise === null ? null : royRise - (5 / 6) * (royRise - royDawn);
  o['misheyakir.royEarly'] = royDawn === null || royRise === null ? null : royRise - (5.5 / 6) * (royRise - royDawn);
  o['tzeit.roy'] = royAfter(roySet, frac(ROY_DEGREES.nightfall, -1));
  o['tzeit.royHumra'] = royAfter(roySet, frac(ROY_DEGREES.nightfallHumra, -1));
  // Seasonal minutes counted from his sunset with his halachic hour (both with the elevation).
  for (const m of [13.5, 27, 72.5]) o[`tzeit.roySeasonal${String(m).replace('.', '_')}`] = seasonal(roySet, m / 60, royHour);
  o['rt.roy'] = royTzetRT;
  o['rt.royKula'] = royTzetRT === null ? after(roySet, 72) : Math.min(royTzetRT, roySet + 72 * MIN);
  const royMGA = hourOf(royDawn, royTzetRT);

  // ---- Zmanim made of hours ---------------------------------------------------------------------------------------
  // Sunrise and sunset to choose from: three opinions only (Mordy, 2026-11-09: "i only want 3 opinions, sea level,
  // diskin and divrei [yosef]"): sea level (the default), visible over the hills (Divrei Yosef, techum) and visible over
  // only the mountains a day's walk away (Rabbi Diskin). Level is not listed. The other zmanim count from sea level
  // (DEFAULT_HORIZON).
  o['sunrise.visible'] = sunrise.visible;
  o['sunset.visible'] = sunset.visible;
  // Sea level with standard refraction (34′ + 16′ = 50′), as NOAA and most zmanim calendars print it: for comparison.
  o['sunrise.seaLevel'] = sunrise.seaLevel;
  o['sunset.seaLevel'] = sunset.seaLevel;
  // Visible over only the mountains more than a day's walk away (Rabbi Diskin): from the same highest points within a
  // techum, the nearer hills disregarded; where no far mountain rises into view, the sea-level horizon seen from there
  // (Mordy, 2026-11-08).
  const vf = cfg.visible ?? {};
  o['sunrise.visibleFar'] = vf.sunriseFar ?? null;
  o['sunset.visibleFar'] = vf.sunsetFar ?? null;

  o['shema.gra'] = seasonal(rise0, 3, gra);
  o['shema.maDeg'] = seasonal(o['alot.deg72'], 3, maDeg);
  o['shema.maDegStrict'] = seasonal(o['alot.deg90'], 3, maDegStrict);
  o['shema.royGra'] = seasonal(royRise, 3, royHour);
  o['shema.royMga'] = seasonal(royDawn, 3, royMGA);

  o['tefila.gra'] = seasonal(rise0, 4, gra);
  o['tefila.maDeg'] = seasonal(o['alot.deg72'], 4, maDeg);
  o['tefila.maDegStrict'] = seasonal(o['alot.deg90'], 4, maDegStrict);
  o['tefila.roy'] = seasonal(royRise, 4, royHour);

  // Erev Pesach: the last time to eat chametz (the end of the 4th hour) and to burn it (the end of the 5th).
  for (const [z, n] of [['chametzEat', 4], ['chametzBurn', 5]]) {
    o[`${z}.gra`] = seasonal(rise0, n, gra);
    o[`${z}.maDeg`] = seasonal(o['alot.deg72'], n, maDeg);
    o[`${z}.maDegStrict`] = seasonal(o['alot.deg90'], n, maDegStrict);
    o[`${z}.roy`] = seasonal(royRise, n, royHour);
    o[`${z}.royMga`] = seasonal(royDawn, n, royMGA);
  }
  // Erev Shabbat and Erev Yom Tov: a meal should not be started from the 10th hour (after 9 halachic hours).
  o['meal10.gra'] = seasonal(rise0, 9, gra);
  o['meal10.maDeg'] = seasonal(o['alot.deg72'], 9, maDeg);
  o['meal10.roy'] = seasonal(royRise, 9, royHour);

  o['hatzot'] = noon;
  // The other way to count midday: halfway between sunrise and sunset (rise0 / set0), as many calendars give it. It differs from
  // the Sun's highest point by up to about half a minute, because the Sun's daily motion changes over the day.
  o['hatzot.midpoint'] = rise0 !== null && set0 !== null ? (rise0 + set0) / 2 : null;
  // Mincha gedola: half a seasonal hour after hatzot; "30" = never less than 30 minutes (Chacham Ovadia's main one).
  o['minchaGedola.gra'] = seasonal(noon, 0.5, gra);
  o['minchaGedola.gra30'] = gra === null ? null : noon + Math.max(30 * MIN, gra / 2);
  o['minchaGedola.roy'] = royHour === null ? null : noon + Math.max(30 * MIN, royHour / 2);
  o['minchaGedola.royIkar'] = seasonal(royRise, 6.5, royHour);
  o['minchaKetana.gra'] = seasonal(rise0, 9.5, gra);
  o['minchaKetana.maDeg'] = seasonal(o['alot.deg72'], 9.5, maDeg);
  o['minchaKetana.roy'] = seasonal(royRise, 9.5, royHour);
  o['plag.gra'] = seasonal(set0, -1.25, gra);
  // Rav Yaakov Hillel's plag: 10¾ hours of a day from alot 72 to tzeit 14 (both in degrees).
  o['plag.maDeg'] = seasonal(o['alot.deg72'], 10.75, maDeg);
  o['plag.royHalachaBerura'] = seasonal(roySet, -1.25, royHour);
  o['plag.royYalkutYosef'] = seasonal(o['tzeit.roy'], -1.25, royHour);
  o['plag.royMaamarMordechai'] = seasonal(o['tzeit.roy'], -1.25, hourOf(royDawn, o['tzeit.roy']));

  const candle = cfg.candleMinutes ?? 18;
  // Before the visible sunset, where the hills are known (options; level is the default - Mordy, 2026-11-08).
  o['candles.visible'] = sunset.visible == null ? null : before(sunset.visible, candle);
  o['candles.visibleFar'] = vf.sunsetFar == null ? null : before(vf.sunsetFar, candle);

  o['midnight.astronomical'] = lowerTransit(date, place);
  o['midnight.half'] = noon + 12 * HOUR;

  // What the remaining opinions are. Chacham Ovadia's degree-based ones also say how many seasonal minutes their
  // degrees come to at this place (on 17 March, as Zemaneh Yosef computes them).
  const sm = (d, dir) => { const f = frac(d, dir); return f === null ? '' : ` = ${(f * 60).toFixed(1)} seasonal minutes here`; };
  Object.assign(info, {
    'alot.roy': { label: '16.04 degrees, in seasonal minutes', detail: `Chacham Ovadia Yosef: Sun 16.04° below the horizon at the equinox${sm(16.04, +1)}, before sunrise` },
    'misheyakir.roy': { label: '5/6 of alot to sunrise', detail: 'Chacham Ovadia Yosef: 5/6 of the time from alot to sunrise' },
    'misheyakir.royEarly': { label: '5.5/6 of alot to sunrise', detail: 'Chacham Ovadia Yosef: 5.5/6 of the time from alot to sunrise (when needed)' },
    'sunrise.seaLevel': { label: 'Sea-level sunrise', detail: "The Sun's upper edge on a sea-level horizon, with the bending of light from the place's weather (temperature and pressure)" },
    'sunrise.visible': { label: 'Visible sunrise, over the hills', detail: "Over the hills and mountains around the city, seen from its high points (Divrei Yosef: mountains beyond the city's techum are the horizon)" },
    'sunrise.visibleFar': { label: "Visible sunrise, only mountains a day's walk away", detail: "Nearer hills disregarded, like a wall; only mountains more than a day's walk (40 mil, 38.4 km) away count, as the mountains of Moab for Jerusalem (Rabbi Yehoshua Leib Diskin). Seen from the highest point within a techum; with none in view, the sea-level horizon from there" },
    'sunset.seaLevel': { label: 'Sea-level sunset', detail: "The Sun's upper edge on a sea-level horizon, with the bending of light from the place's weather (temperature and pressure)" },
    'sunset.visible': { label: 'Visible sunset, over the hills', detail: "Behind the hills and mountains around the city, seen from its high points (Divrei Yosef: mountains beyond the city's techum are the horizon)" },
    'sunset.visibleFar': { label: "Visible sunset, only mountains a day's walk away", detail: "Nearer hills disregarded, like a wall; only mountains more than a day's walk (40 mil, 38.4 km) away count (Rabbi Yehoshua Leib Diskin). Seen from the highest point within a techum; with none in view, the sea-level horizon from there" },
    'shema.gra': { label: 'Gra', detail: '3 halachic hours from sunrise' },
    'shema.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '3 hours of a day from alot 72 to tzeit 14 (degrees)' },
    'shema.maDegStrict': { label: 'Stringent Magen Avraham', detail: '3 hours of a day from alot 90 to tzeit 25 (degrees)' },
    'shema.royGra': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 3 halachic hours from sunrise' },
    'shema.royMga': { label: 'Magen Avraham, alot 16.04° to tzeit 16.04°', detail: 'Chacham Ovadia Yosef: 3 hours of a day from his alot to Rabbeinu Tam (16.04° each, in seasonal minutes)' },
    'tefila.gra': { label: 'Gra', detail: '4 halachic hours from sunrise' },
    'tefila.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '4 hours of a day from alot 72 to tzeit 14 (degrees)' },
    'tefila.maDegStrict': { label: 'Stringent Magen Avraham', detail: '4 hours of a day from alot 90 to tzeit 25 (degrees)' },
    'tefila.roy': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 4 halachic hours from sunrise' },
    'chametzEat.gra': { label: 'Gra', detail: '4 halachic hours from sunrise' },
    'chametzEat.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '4 hours of a day from alot 72 to tzeit 14 (degrees)' },
    'chametzEat.maDegStrict': { label: 'Stringent Magen Avraham', detail: '4 hours of a day from alot 90 to tzeit 25 (degrees)' },
    'chametzEat.roy': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 4 halachic hours from sunrise' },
    'chametzEat.royMga': { label: 'Magen Avraham, alot 16.04° to tzeit 16.04°', detail: 'Chacham Ovadia Yosef: 4 hours of a day from his alot to Rabbeinu Tam' },
    'chametzBurn.gra': { label: 'Gra', detail: '5 halachic hours from sunrise' },
    'chametzBurn.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '5 hours of a day from alot 72 to tzeit 14 (degrees)' },
    'chametzBurn.maDegStrict': { label: 'Stringent Magen Avraham', detail: '5 hours of a day from alot 90 to tzeit 25 (degrees)' },
    'chametzBurn.roy': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 5 halachic hours from sunrise' },
    'chametzBurn.royMga': { label: 'Magen Avraham, alot 16.04° to tzeit 16.04°', detail: 'Chacham Ovadia Yosef: 5 hours of a day from his alot to Rabbeinu Tam' },
    'meal10.gra': { label: 'Gra', detail: '9 halachic hours from sunrise (the 10th hour begins)' },
    'meal10.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '9 hours of a day from alot 72 to tzeit 14 (degrees)' },
    'meal10.roy': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 9 halachic hours from sunrise (the 10th hour begins)' },
    hatzot: { label: 'Midday (the Sun highest)', detail: 'The Sun crosses the meridian' },
    'hatzot.midpoint': { label: 'Midday (halfway)', detail: `Halfway between sunrise and sunset (${horizon === 'sea' ? 'sea level' : lower ? 'over the lower horizon' : 'level'})` },
    'minchaGedola.gra': { label: 'Gra', detail: 'Half a halachic hour after hatzot' },
    'minchaGedola.gra30': { label: 'Stringent Gra', detail: 'Half a halachic hour after hatzot, at least 30 minutes' },
    'minchaGedola.roy': { label: 'Gra at this elevation, at least 30 minutes', detail: 'Chacham Ovadia Yosef: Half a halachic hour after hatzot, at least 30 minutes' },
    'minchaGedola.royIkar': { label: '6½ hours from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: (the main time) 6½ halachic hours from sunrise' },
    'minchaKetana.gra': { label: 'Gra', detail: '9½ halachic hours from sunrise' },
    'minchaKetana.maDeg': { label: 'Rav Yaakov Hillel (Magen Avraham)', detail: '9½ hours of a day from alot 72 to tzeit 14 (degrees)' },
    'minchaKetana.roy': { label: 'Gra, from sunrise at this elevation', detail: 'Chacham Ovadia Yosef: 9½ halachic hours from sunrise' },
    'plag.gra': { label: 'Gra', detail: '1¼ halachic hours before sunset' },
    'plag.maDeg': { label: 'Rav Yaakov Hillel', detail: '10¾ hours of a day from alot 72 to tzeit 14 (degrees)' },
    'plag.royHalachaBerura': { label: 'Halacha Berura', detail: '1¼ halachic hours before sunset' },
    'plag.royYalkutYosef': { label: 'Yalkut Yosef', detail: "1¼ halachic hours before Chacham Ovadia's tzet" },
    'plag.royMaamarMordechai': { label: 'Maamar Mordechai', detail: '1¼ hours of a day from alot to tzet, before tzet' },
    'candles.visible': { label: `${candle} minutes, Divrei Yosef`, detail: `${candle} minutes before the visible sunset over the hills around the city (Divrei Yosef)` },
    'candles.visibleFar': { label: `${candle} minutes, Rabbi Diskin`, detail: `${candle} minutes before the visible sunset counting only mountains more than a day's walk away (Rabbi Yehoshua Leib Diskin)` },
    'tzeit.roy': { label: '3.7 degrees, in seasonal minutes', detail: `Chacham Ovadia Yosef: Sun 3.7° below the horizon at the equinox${sm(3.7, -1)}, after sunset` },
    'tzeit.royHumra': { label: '5.075 degrees, in seasonal minutes', detail: `Chacham Ovadia Yosef: (stringent) Sun 5.075° below the horizon at the equinox${sm(5.075, -1)}, after sunset` },
    'tzeit.roySeasonal13_5': { label: '13.5 seasonal minutes at this elevation', detail: `Chacham Ovadia Yosef: 13.5 seasonal minutes after sunset at this elevation (Ohr HaChaim)` },
    'tzeit.roySeasonal27': { label: '27 seasonal minutes at this elevation', detail: `Chacham Ovadia Yosef: 27 seasonal minutes after sunset at this elevation` },
    'tzeit.roySeasonal72_5': { label: 'Rabbeinu Tam, 72.5 seasonal minutes at this elevation', detail: `Chacham Ovadia Yosef: 72.5 seasonal minutes after sunset at this elevation` },
    'rt.roy': { label: 'Rabbeinu Tam, 16.04 degrees in seasonal minutes', detail: `Chacham Ovadia Yosef: Sun 16.04° below the horizon at the equinox${sm(16.04, -1)}, after sunset` },
    'rt.royKula': { label: 'Rabbeinu Tam, the earlier of 16.04° and 72 minutes', detail: 'Chacham Ovadia Yosef: (lenient) the earlier of the 16.04° time and 72 fixed minutes' },
    'midnight.astronomical': { label: 'Hatzot halaila', detail: 'The Sun crosses the lower meridian' },
    'midnight.half': { label: 'Hatzot halaila', detail: '12 hours after hatzot' },
  });

  for (const id of Object.keys(info)) if (isHidden(id)) info[id].hidden = true;

  // Very short days (far north and south): a zman that falls outside the day it belongs to does not exist that day, as in
  // KosherJava 3.1: mincha gedola after sunset, and candle lighting before plag haMincha.
  if (o['minchaGedola.gra30'] !== null && set0 !== null && o['minchaGedola.gra30'] > set0) o['minchaGedola.gra30'] = null;
  if (o['minchaGedola.roy'] !== null && roySet !== null && o['minchaGedola.roy'] > roySet) o['minchaGedola.roy'] = null;
  const plagGra = o['plag.gra'];
  if (plagGra != null) for (const k of Object.keys(o)) if (k.startsWith('candles.') && o[k] !== null && o[k] < plagGra) o[k] = null;

  return {
    transit: noon,
    sunrise, sunset,
    refraction: { sunrise: rSunrise, sunset: rSunset },
    angles,
    opinions: o,
    info,
    candleId: `candles.fixed${tag(candle)}`, // the place's candle lighting, which the sets show
    hours: { gra, maDeg, maDegStrict, ...Object.fromEntries(Object.entries(maHours).map(([k, v]) => [`ma_${k}`, v])), royGra: royHour, royMga: royMGA },
  };
}

// The three main sets: which opinion each zman shows by default. Every zman can still be changed on its own. Sunrise and
// sunset are sea level in every set (the visible ones are options where the hills are known).
// Three nightfall zmanim, each listing every tzet and Rabbeinu Tam opinion (a design decision): Ben HaShmashot, Nightfall
// (e.g. Motzaei Shabbat) and Rabbeinu Tam.
export const NIGHTFALL_ZMANIM = ['benHashmashot', 'nightfall', 'rabbeinuTam'];
export const SETS = {
  degrees: {
    name: 'Degrees',
    alot: 'alot.deg72', misheyakir: 'misheyakir.deg52', sunrise: 'sunrise.seaLevel', shema: 'shema.gra', tefila: 'tefila.gra',
    hatzot: 'hatzot', minchaGedola: 'minchaGedola.gra30', minchaKetana: 'minchaKetana.gra', plag: 'plag.gra',
    candles: 'candles.fixed18', sunset: 'sunset.seaLevel', benHashmashot: 'tzeit.deg13_5', nightfall: 'tzeit.deg36_5', rabbeinuTam: 'tzeit.deg72_5', midnight: 'midnight.half',
    chametzEat: 'chametzEat.gra', chametzBurn: 'chametzBurn.gra', meal10: 'meal10.gra',
  },
  seasonal: {
    name: 'Seasonal minutes',
    alot: 'alot.roy', misheyakir: 'misheyakir.roy', sunrise: 'sunrise.seaLevel', shema: 'shema.royGra', tefila: 'tefila.roy',
    hatzot: 'hatzot', minchaGedola: 'minchaGedola.roy', minchaKetana: 'minchaKetana.roy', plag: 'plag.royHalachaBerura',
    candles: 'candles.fixed18', sunset: 'sunset.seaLevel', benHashmashot: 'tzeit.roySeasonal13_5', nightfall: 'tzeit.roySeasonal27', rabbeinuTam: 'tzeit.roySeasonal72_5', midnight: 'midnight.astronomical',
    chametzEat: 'chametzEat.roy', chametzBurn: 'chametzBurn.roy', meal10: 'meal10.roy',
  },
  fixed: {
    name: 'Fixed minutes',
    alot: 'alot.fixed72', misheyakir: 'misheyakir.fixed60', sunrise: 'sunrise.seaLevel', shema: 'shema.ma_fixed72', tefila: 'tefila.ma_fixed72',
    hatzot: 'hatzot', minchaGedola: 'minchaGedola.gra30', minchaKetana: 'minchaKetana.gra', plag: 'plag.gra',
    candles: 'candles.fixed18', sunset: 'sunset.seaLevel', benHashmashot: 'tzeit.fixed13_5', nightfall: 'tzeit.fixed50', rabbeinuTam: 'tzeit.fixed72', midnight: 'midnight.half',
    chametzEat: 'chametzEat.ma_fixed72', chametzBurn: 'chametzBurn.ma_fixed72', meal10: 'meal10.ma_fixed72',
  },
};

// The set's chosen time for each zman, with any per-zman picks overriding it: { alot: ms, ... }.
export function pick(day, set = 'degrees', overrides = {}) {
  if (!SETS[set]) throw new TypeError(`pick: unknown set "${set}" (one of ${Object.keys(SETS).join(', ')})`);
  const s = { ...SETS[set], ...overrides };
  const out = {};
  for (const [k, id] of Object.entries(s)) if (k !== 'name') out[k] = day.opinions[k === 'candles' && !overrides.candles ? day.candleId ?? id : id] ?? null;
  return out;
}

export { SUN_RADIUS_1AU_DEG };
