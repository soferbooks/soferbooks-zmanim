// Input checks for the public functions: a wrong input throws a TypeError naming it, instead of giving NaN, a rolled-over
// date or another day's times without a word.

const isInt = (v) => Number.isInteger(v);
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** date = { y, m, d }: whole numbers (numeric strings accepted), a real calendar date. Returns { y, m, d } as numbers. */
export function assertDate(date, fn = 'date') {
  if (!date || typeof date !== 'object' || date instanceof Date) {
    throw new TypeError(`${fn}: the date must be { y, m, d } (a JavaScript Date is not accepted: its day depends on the time zone)`);
  }
  const y = Number(date.y), m = Number(date.m), d = Number(date.d);
  if (!isInt(y) || !isInt(m) || !isInt(d)) throw new TypeError(`${fn}: the date needs whole y, m, d (got ${JSON.stringify(date)})`);
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) throw new TypeError(`${fn}: ${y}-${m}-${d} is not a calendar date`);
  return { y, m, d };
}

/**
 * place = { lat, lon (east +), elevation (m), utcOffset (hours) }: lat in [-90, 90], lon in [-180, 180] (not 0-360),
 * finite numbers; elevation and utcOffset optional.
 */
export function assertPlace(place, fn = 'place') {
  if (!place || typeof place !== 'object') throw new TypeError(`${fn}: the place must be { lat, lon, elevation }`);
  const { lat, lon, elevation, utcOffset } = place;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new TypeError(`${fn}: lat must be a number from -90 to 90 (got ${JSON.stringify(lat)})`);
  if (lon === undefined && place.lng !== undefined) throw new TypeError(`${fn}: the longitude is "lon", not "lng"`);
  if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new TypeError(`${fn}: lon must be a number from -180 to 180, east positive (got ${JSON.stringify(lon)})`);
  if (elevation != null && (typeof elevation !== 'number' || !Number.isFinite(elevation))) throw new TypeError(`${fn}: elevation must be a number of metres (got ${JSON.stringify(elevation)})`);
  if (utcOffset != null && (typeof utcOffset !== 'number' || !Number.isFinite(utcOffset) || Math.abs(utcOffset) > 14)) throw new TypeError(`${fn}: utcOffset must be hours from -14 to 14 (got ${JSON.stringify(utcOffset)})`);
}
