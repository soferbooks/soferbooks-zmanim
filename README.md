# The soferbooks.com zmanim engine

Halachic times (zmanim) from full-precision astronomy, in JavaScript (Node 18+ and browsers).

- **Every zman in three forms:** degrees, seasonal minutes and fixed minutes, with a ready set for each (`degrees`,
  `seasonal`, `fixed`). Any single opinion can be chosen on its own.
- **The Sun from the full VSOP87 theory**, within 0.12″ of NASA JPL Horizons.
- **Refraction from the weather** (for every sunrise and sunset: sea level and visible): the standard horizon refraction scaled to the place's daily-mean temperature and
  pressure (monthly averages blended day by day, or the day's forecast), checked against 2,209 sunrises that people watched and timed. A ray tracer for full air profiles
  is included.
- **Degrees measured below the true horizon**, so the morning's local air moves sunrise but not dawn.
- **Visible sunrise and sunset** over the real terrain (USGS 3DEP in the US, GEDTM30 elsewhere), in the manner of Chai
  Tables: the earliest sunrise and the latest sunset from the high points within a techum.
- **Also:** both ways of counting midday and midnight; Erev Pesach's last times to eat and to burn chametz; the 10th
  hour before Shabbat and Yom Tov; the traditional molad and the Birkat HaL'vanah window (3 or 7 days, half the month or 15
  days).
- **The Moon:** moonrise and moonset solved exactly (Astronomy Engine), including the crescent's lit top corner for
  Birkat HaL'vanah; the astronomical new moon within 6 s of JPL.

Why these times differ from other calendars, in plain words: [docs/WHY-DIFFERENT.md](docs/WHY-DIFFERENT.md).
How the results compare with Luach Ahavat Shalom, MyZmanim, Hebcal, Chabad.org, Chai Tables and royzmanim.com, and which
is more accurate where they differ: [docs/COMPARISON.md](docs/COMPARISON.md). What was tried to make it more precise,
what was kept and what was rejected, with the numbers: [docs/EXPERIMENTS.md](docs/EXPERIMENTS.md). The scripts for the upper-air (ERA5) tests are in
[research/era5](research/era5).

## The website

[`website/Soferbooks Zmanim.html`](website/) is the whole Soferbooks Zmanim website in one file, built on this engine:
download it and open it in any browser. It shows a day's zmanim with every opinion and a printable month, for Great
Neck (with visible sunrise built in) or any place added by address. See [website/README.md](website/README.md).

## Use

```js
import { dayZmanim, pick, moonRiseSet, newMoon } from 'soferbooks-zmanim';

const place = { lat: 40.807934, lon: -73.746343, elevation: 33 }; // east-positive longitude, metres
const day = dayZmanim({ y: 2026, m: 11, d: 5 }, place, {
  refraction: { sunrise: { tempC: 5, pressure: 1016 }, sunset: { tempC: 5, pressure: 1016 } }, // optional
});

day.opinions['sunrise.seaLevel']; // epoch ms (UTC)
day.opinions['alot.deg72'];      // dawn, 72 minutes in degrees
day.info['alot.deg72'].detail;   // "Sun's centre 16.079° below the true horizon: 72 minutes before sunrise in Jerusalem at the equinox"

pick(day, 'degrees');            // { alot, sunrise, shema, tefila, hatzot, ..., nightfall, rabbeinuTam }
pick(day, 'seasonal');           // the seasonal-minutes set
pick(day, 'fixed');              // the fixed-minutes set

moonRiseSet({ y: 2026, m: 10, d: 25 }, place, +1);                    // moonrise (top edge)
moonRiseSet({ y: 2026, m: 10, d: 14 }, place, -1, { edge: 'lit' });   // moonset of the lit corner
newMoon(Date.UTC(2026, 9, 10));                                        // the new moon nearest that moment
```

Visible sunrise downloads elevation data (about 30–35 MB per place, once) and is a separate entry point:

```js
import { prepareVisibleHorizon, visibleTimes } from 'soferbooks-zmanim/terrain';
const sky = await prepareVisibleHorizon(place, { onProgress: (p) => console.log(p.message) });
const day = dayZmanim(date, place, { visible: visibleTimes(date, sky) });
```

Times are epoch milliseconds (UTC); `null` means the event does not happen that day (far north or south).

## Tests

```bash
npm install
npm test
```

| Check | Against | Result |
|---|---|---|
| `compare-horizons.js` | NASA JPL Horizons, the Sun every 5 days 2026–29 | within 0.12″ |
| `compare-usno.js` | US Naval Observatory sunrise / sunset tables | within USNO's rounding |
| `compare-roy.js` | Zemaneh Yosef's formulas (via KosherJava), 7 places, a whole year | within 4.2 s |
| `compare-observations.js` | 2,209 observed sunrises (Rabbi Chaim Keller's collection) | mean 1.2 s, rms 14.0 s |
| `moon.test.js` | JPL Horizons new moons and lunar positions; the nearest new moon from any moment; moonrise / moonset on the clock date | within 6 s / 0.002° |
| `check.test.js` | bad input throws; a failed terrain download is an error, not the sea | 21 checks |
| `raytrace.test.js` | Starlink PAL's refraction integration | within 1.9″ |
| `zmanim.test.js` | polar days, order of the zmanim, all forms, every opinion described | 776 checks |

`compare-observations.js` downloads Rabbi Keller's observations from his repository on its first run; they are not
redistributed here. Without internet on that first run it reports "skipped".

## Sources and thanks

- **Rav Yaakov Hillel** and **Luach Ahavat Shalom** (Yeshivat Ahavat Shalom, Jerusalem); the calculation chapters and
  appendices by **Rabbi Daniel Aharon Glauberman**, including the lit top corner of the crescent for Birkat HaLevanah.
- **Chacham Ovadia Yosef**'s zmanim as computed by **Zemaneh Yosef** (royzmanim.com).
- **astronomia** (MIT; Jean Meeus, *Astronomical Algorithms*; VSOP87 by IMCCE), **Astronomy Engine** (MIT, Donald Cross),
  **geotiff.js** (MIT); **KosherJava / kosher-zmanim** (LGPL-3.0) in the tests only.
- **NASA JPL Horizons**, the **US Naval Observatory**, **USGS 3DEP**, **GEDTM30** (OpenGeoHub, CC BY 4.0), **Copernicus
  GLO-30**, **Open-Meteo** (ERA5 / forecasts, CC BY 4.0).
- **Rabbi Chaim Keller** (Chai Tables) for the published sunrise observations of Rav Druk, R' Yisroel Golan and Rav Yosef
  Zuriel.

## Licence: מה אני בחינם אף אתם נמי בחינם

As this was given freely, so it is to be passed on freely. The legal terms are the GNU General Public License v3.0 or
later (see [LICENSE](LICENSE), which is the GPL's own text and may not be changed): you may use, study, share and change
this code; if you distribute a changed version, its source must be released, free, under the same licence.
