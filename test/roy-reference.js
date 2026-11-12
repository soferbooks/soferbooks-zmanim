// A reference for Chacham Ovadia's zmanim: Zemaneh Yosef's formulas (sources/roy/ROYZmanim.js, ZemanimMathBase.setDate
// and ZemanFunctions) run on kosher-zmanim (the KosherJava port, LGPL-3.0, devDependency only: used here for testing,
// never shipped in this package). Zemaneh Yosef runs the same formulas on its own SPA calculator; KosherJava's NOAA one
// differs from it by a few seconds, which is the tolerance of the comparison.
import KZ from 'kosher-zmanim';
const { GeoLocation, ComplexZmanimCalendar } = KZ;

const ms = (dt) => (dt ? dt.toMillis() : null);

function calendar(place, tzName, useElevation) {
  const geo = new GeoLocation('place', place.lat, place.lon, place.elevation ?? 0, tzName);
  const zc = new ComplexZmanimCalendar(geo);
  zc.getAstronomicalCalculator().setRefraction(34.478885263888294 / 60); // Zemaneh Yosef's refraction
  zc.setUseElevation(!!useElevation);
  return zc;
}
const at = (zc, date) => { zc.setDate(new Date(date.y, date.m - 1, date.d, 12)); return zc; };

// getPercentOfShaahZmanisFromDegrees on 17 March of the date's year (durationOfEquinoxDegreeSeasonalHour).
function equinoxFraction(zc, date, degree, sunset) {
  at(zc, { y: date.y, m: 3, d: 17 });
  const f = zc.getPercentOfShaahZmanisFromDegrees(degree, sunset);
  at(zc, date);
  return f;
}

export function royReference(date, place, tzName) {
  // Zemaneh Yosef uses the elevation only in Israel; this engine uses it everywhere, so the reference does too.
  const useElevation = (place.elevation ?? 0) > 0;
  const zc = calendar(place, tzName, useElevation);
  const f = {
    dawn: equinoxFraction(zc, date, 16.04, false), nightfall: equinoxFraction(zc, date, 3.7, true),
    humra: equinoxFraction(zc, date, 5.075, true), rt: equinoxFraction(zc, date, 16.04, true),
  };
  at(zc, date);
  const sunrise = ms(useElevation ? zc.getSunrise() : zc.getSeaLevelSunrise());
  const sunset = ms(useElevation ? zc.getSunset() : zc.getSeaLevelSunset());
  const hour = (sunset - sunrise) / 12;
  const offset98 = ms(zc.getSunriseOffsetByDegrees(98.5));
  let dawn = sunrise - f.dawn * hour;
  if (offset98 !== null && offset98 < dawn) dawn = offset98;
  const nightfall = sunset + f.nightfall * hour;
  const tzetRT = sunset + f.rt * hour;
  const mga = (tzetRT - dawn) / 12;
  const transit = ms(zc.getSunTransit());
  return {
    'alot.roy': dawn,
    'misheyakir.roy': sunrise - (5 / 6) * (sunrise - dawn),
    'misheyakir.royEarly': sunrise - (5.5 / 6) * (sunrise - dawn),
    'shema.royMga': dawn + 3 * mga, 'shema.royGra': sunrise + 3 * hour, 'tefila.roy': sunrise + 4 * hour,
    hatzot: transit,
    'minchaGedola.roy': Math.max(transit + 30 * 60000, transit + hour / 2),
    'minchaGedola.royIkar': sunrise + 6.5 * hour,
    'minchaKetana.roy': sunrise + 9.5 * hour,
    'plag.royHalachaBerura': sunset - 1.25 * hour,
    'plag.royYalkutYosef': nightfall - 1.25 * hour,
    'plag.royMaamarMordechai': nightfall - 1.25 * ((nightfall - dawn) / 12),
    'tzeit.roy': nightfall, 'tzeit.royHumra': sunset + f.humra * hour, 'rt.roy': tzetRT,
    'midnight.astronomical': ms(zc.getSolarMidnight()),
  };
}
