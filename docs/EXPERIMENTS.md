# What was tested, what was kept, and why

Every change to how this engine handles refraction is measured against the same benchmark: **2,209 sunrises that
observers watched and timed** (Rabbi Chaim Keller's published collection: Rav Druk at Armon HaNatziv 1985–96, R' Yisroel
Golan at Neve Yaakov 2009–13, Rav Yosef Zuriel in Bnei Brak 1961–92), each computed over that spot's real skyline
(`test/compare-observations.js`). An idea was kept only if it made the times closer to what people saw.

The tests below were run on the first 656 of them (Rav Druk 1993–96 only). On 2026-11-10 an error in reading Rav Druk's
1993–96 file was found and fixed (63 times had been filed under the wrong year and 153 left out) and his 1985–92 sunrises
were added. On all 2,209 the kept method gives mean 3.7 s, rms 16.3 s (Rav Druk 4.4 / 17.0, R' Golan 0.4 / 10.9, Rav
Zuriel −4.1 / 11.2); standard fixed refraction gives 23.3 / 29.7. The comparisons between methods below were not redone.

"Mean" is the average of observed − computed (positive: the Sun was seen later than computed); "rms" is the typical
size of the error, including the day-to-day scatter.

## Kept

| Choice | Mean | rms | Why |
|---|---|---|---|
| Standard refraction scaled to the place's **daily-mean** temperature and pressure (ERA5 1991–2020 monthly normals) | 2.0 s | 15.2 s | The baseline. Fixed standard refraction, as most zmanim sites use, is far off on cold mornings. |
| Monthly normals **blended day by day** (each month's value at mid-month, straight line between) | 2.0 s | 15.2 s | Same accuracy, and no jump in the times from the last day of one month to the first of the next. |
| The **day's forecast** averaged over the day, when a forecast covers the date (apps) | 2.2 s | 15.1 s | No better on the Israeli observations, where daily swings are small, but it follows cold snaps and heat waves, which move sunrise by up to about 10 s in a variable climate. |
| Dawn and nightfall in degrees measured **below the true horizon** | — | — | Twilight light comes from rays that skim the Earth far away and high above the local air, so the morning's local refraction should not move dawn. Measuring below the day's own rise point would. |
| Over the sea, the horizon's dip from the **standard bending of light, with no temperature term** (1.80′ × √height in metres) | — | — | What today's nautical tables use (the Nautical Almanac and Bowditch: 1.76′ × √h, less than a second of sunrise apart at ordinary heights). A correction for the water's temperature was tested and not adopted (below). |
| The new moon from Meeus' full lunar theory (astronomia) | — | — | Within 6 s of JPL Horizons; Astronomy Engine's new-moon search was 31–42 s late. Astronomy Engine is still used for moonrise and moonset, where its Moon agrees with JPL to 0.002°. |

## Tested and not adopted

### The air at the moment of sunrise instead of the day's mean

| Weather given to the formula | Mean | rms |
|---|---|---|
| Daily-mean normals (kept) | 2.0 s | 15.2 s |
| That day's own daily mean (ERA5) | 2.2 s | 15.1 s |
| That morning's air at the hour of sunrise (ERA5) | 5.0 s | 16.1 s |
| Normals for the hour of sunrise | 4.5 s | 16.0 s |

**Why it is worse:** the standard refraction value was measured from real sunrises, so it already contains typical
cold morning air. Feeding it the colder sunrise-hour air counts that cold twice and makes every sunrise too early.

### Recalibrating the formula so that each morning's weather could be used

The formula was allowed any base value and any weighting of that morning's sunrise temperature, day mean, pressure,
and the night's cooling (day mean − sunrise temperature), each version scored only on mornings it was not fitted to.

| Extra information | rms (cross-validated) |
|---|---|
| None | 15.1 s |
| Sunrise temperature | 15.1 s |
| Day-mean temperature | 15.1 s |
| Pressure | 15.0 s |
| Night cooling (day mean − sunrise) | 13.8 s |

**Why it was not adopted:** almost all of the night-cooling gain comes from its typical value for the month, not from
the day's own weather (5.2 s per °C for the monthly part, 0.9 s per °C for the day's departure). It appears only for the
two Jerusalem observers, who look east over the Judean desert and the Jordan rift; for Bnei Brak, on the coastal plain,
it does nothing. It is a property of that view, not a general rule about the air, and would not carry over to other
places. One thermometer reading cannot show what bends the light: how temperature changes with height along tens of
kilometres of air.

### Weather-balloon profiles (NOAA IGRA v2: Bet Dagan 1963–2010, Ashdod 2008–)

The sounding nearest each sunrise (within 4 hours, 174 mornings) traced through the ray tracer:

| Method | Mean | rms |
|---|---|---|
| Monthly normals (on the same 174 mornings) | 5.1 s | 16.8 s |
| That morning's sounding, traced | 3.6 s | 16.7 s |
| Normals scaled by that morning's traced refraction | 5.2 s | 17.8 s |

**Why it was not adopted:** no gain. The balloons go up on the coast; the light reaching the Jerusalem hills crosses
different air.

### ERA5 upper air along the line of sight (Copernicus Climate Data Store)

ERA5 temperature on 16 pressure levels (1000–500 hPa) with surface temperature and pressure, linear in time to the
moment of sunrise, sampled 0–80 km toward the sunrise and traced from the observer's own eye height. First run on 656
sunrises; rerun on all 2,209 (2026-11-11), with the Golan and Druk months the first run had only in part:

| Method: rms (scatter without the bias) | Druk (1,919) | Golan (200) | Zuriel (88) | All |
|---|---|---|---|---|
| Monthly normals (kept) | 16.9 s (16.4) | 10.9 s (10.9) | 11.2 s (10.4) | 16.3 s (15.9) |
| That morning's air at the observer only | 16.3 s | 10.4 s | 12.8 s | 15.7 s |
| That morning's air, averaged along the path | 15.1 s (14.2) | 10.0 s (9.8) | 12.5 s (10.7) | 14.6 s (14.0) |
| The same, the coastal near point moved 0.15° inland | 15.0 s (14.2) | 9.8 s (9.6) | 12.3 s (10.7) | 14.5 s (14.0) |
| The site-month's typical path (other years' mornings) | 15.9 s (15.2) | 10.8 s (10.7) | 12.5 s (10.4) | 15.3 s (14.9) |

Three checks on why Rav Zuriel (Bnei Brak, the coast) gets worse when the hill observers get better:
- **Not the era.** ERA5 has no satellite data before 1979, but his mornings before and after are both worse
  (11.9 → 13.3 s, 9.3 → 10.4 s).
- **Not the sea in the grid cell.** Moving the near point inland changes almost nothing (12.5 → 12.3 s).
- **Mostly a constant shift, not the day-to-day.** The traced air puts his sunrises 2.4 s later on average (±0.2 s);
  R' Golan's shift by the same 2.5 s. With the normals Rav Zuriel was already 4.1 s early, and R' Golan was on time,
  so the same shift hurts one and helps the other. His scatter rises only 10.4 → 10.7 s on that morning's air (a 92%
  chance it is real) and does not rise at all on the typical-month profile. So ERA5 adds nothing day to day on the
  coast, where the dawn layer is finer than its 30 km grid. On the hills it removes 2 s of scatter (certain: none of 2,000
  resamples was worse).

A blend of the normals and that morning's path does not rescue the coast: weighted on the other two observers
(leave one out), it is better for Druk (15.2 s) and Golan (10.0 s) and worse for Zuriel (12.2 s).

**Why it was not adopted:** that morning's air is the best result of any test, but it is known only after the
fact; a printed luach, or the app for any future date, would need it from a forecast at several points along every
sunrise direction. The form that could be used, the site-month's typical ERA5 layering, does help on the hills
(Druk 16.9 → 15.9 s), but it carries the same constant shift on the coast. A harmless version would keep each place's
average refraction equal to the normals' and take from ERA5 only the season's layering. Worked out from the shifts
above, that would give Druk about 15.8 s, Golan 10.7 s, Zuriel 11.2 s: better, better, unchanged.

**Tested (2026-11-12) with the product a worldwide table would use:** ERA5 monthly means by hour of day, 1991–2020,
at each observer's sunrise hour and line of sight. Each month's mean dawn air is ray traced into a refraction table.
The table is multiplied by one constant per place, found model against model over every day of a year with no
observations, so that the year's mean computed sunrise equals the normals'. The constants were 1.009 Druk, 1.021 Golan
and 1.026 Zuriel.

| rms (scatter) | Druk (1,921) | Golan (200) | Zuriel (88) | All |
|---|---|---|---|---|
| Monthly normals (kept) | 17.0 s (16.4) | 10.9 s (10.9) | 11.2 s (10.4) | 16.3 s (15.9) |
| ERA5 monthly dawn layering, yearly mean kept | 16.2 s (15.6) | 10.6 s (10.6) | 11.3 s (10.5) | 15.6 s (15.2) |
| Chance it is worse (2,000 paired resamples) | 0 % | 2 % | 96 % | 0 % |
| How far the times move: mean / max | 2.6 / 11.5 s | 0.8 / 5.0 s | 0.6 / 1.8 s | 2.4 / 11.5 s |
| Displayed minute changes | 3 % of days | 2 % | 1 % | 3 % |

A first attempt that took one factor per month from a level ray and multiplied the normals by it was much worse
(16.3 → 19.7 s). Over the hills the Sun is seen above or below level, where the traced and the scaled-formula
refraction differ in shape, so the factor has to be applied to the traced table itself.

**Result:** better on the hills (Druk −0.8 s, Golan −0.3 s), and on the coast a hair worse (+0.1 s). That is
consistent but tiny: the times there move 0.6 s on average. So it is not strictly ours-more-accurate everywhere.
Worldwide, it would need these monthly means for every grid point (the source data is large, the finished table a few
MB) and would be checked only where observations exist. It has not been built.

### Local weather stations

Not tested separately: even each day's real weather at the place (ERA5 above, which assimilates the stations) leaves the
same scatter, so a nearer thermometer cannot help.

### Views over water: the sea's temperature

Where sunrise or sunset is over the sea, the Sun is seen when its edge reaches the sea horizon, and how far below eye
level that horizon lies depends on whether the water is warmer or colder than the air. There are no timed sunrises over
water to test against, so the test uses 76 measurements of the sea horizon itself: Sinzi and Owaki (Japan Hydrographic
Department, 1959) measured its dip with a theodolite about 3 m above the sea at Shirahama in February 1959, with the air
temperature at the eye and the sea's surface temperature each time (`test/compare-sea-dip.js`, not part of `npm test`).

| Dip computed with | Mean (observed − computed) | rms |
|---|---|---|
| The standard dip (no temperatures; the engine's) | 0.90′ | 1.24′ |
| The ray traced, the air at the water taken at the water's temperature | −5.76′ | 6.51′ (8 measurements left out: no horizon predicted) |
| The standard dip + 0.22′ per °C of water − air (fitted to these same data) | 0.05′ | 0.54′ |

| Water − air | Measurements | Observed | Standard | Traced |
|---|---|---|---|---|
| below 0 °C (water colder) | 11 | 2.67′ | 2.99′ | 1.88′ |
| 0 to 2 °C | 19 | 3.70′ | 3.17′ | 6.49′ |
| 2 to 4 °C | 9 | 3.90′ | 3.12′ | 8.68′ |
| 4 to 8 °C | 24 | 4.50′ | 3.22′ | 11.38′ |
| 8 to 13 °C | 13 | 4.95′ | 3.07′ | 15.09′ |

The effect is real: warm water lowers the horizon, cold water raises it, by up to about 2′ here, which in New York is
roughly 10 seconds of sunrise or sunset over water. The ray tracer gets the direction right but the size about six times
too large, and where the water was colder it predicts light bending all the way round with the sea, while a horizon was
still seen. The temperature changes in a very thin layer just above the water, with mirages, which a layered tracer fed
only the eye-height air and the water temperature cannot represent.

The other published series give only fitted formulas, no individual measurements to test against:

| Source | Change in dip per °C of water − air |
|---|---|
| Sinzi and Owaki, Shirahama 1959 (above, 3 m) | 0.22′ |
| Koss and Thun-Hohenstein, Adriatic 1898–99 (6–42 m, all seasons), analysed by Kohlschütter 1903; in the German nautical tables of 1917–19 | 0.33′ |
| US Coast and Geodetic Survey, Georges Bank, 1930 season (star sights) | 0.30′ |
| US Coast and Geodetic Survey, Georges Bank 1931 (its author: "somewhat incomplete and unsatisfactory") | 0.41′ |

**Why it was not adopted:** all four agree that warm water lowers the horizon and cold water raises it, but they differ
by a factor of two in how much, and none of them times a sunrise: they measure the horizon, so there is no way to show
that the correction brings sunrise or sunset over water closer to what is seen. Today's nautical tables carry no
temperature term either; the old German one was dropped, the real water and air temperatures out at the horizon being
rarely known (Freiesleben, 1934 and 1949, adds that the air just above the water, which nobody measures, matters
more than the water itself). The effect would be about 5–10 seconds for a typical 3–5 °C difference. The ray tracer
as it stands is also wrong over water (above), so it is not used there. Revisit only with timed sunrises or sunsets
over water.

## The limit

With every source of weather data available today, about 14–15 s rms remains: the layering of the air along the light's
path on that particular morning, which nobody measures. In plain terms, with the kept method, on all 2,209 sunrises:

| Observer | Typical error (median) | Within 10 s | Within 20 s | Within 40 s | Within 60 s |
|---|---|---|---|---|---|
| All 2,209 | 10.1 s | 50 % | 82 % | 98 % | 100 % |
| R' Golan, Neve Yaakov | 5.5 s | 79 % | 95 % | 99 % | 100 % |
| Rav Zuriel, Bnei Brak | 5.9 s | 68 % | 89 % | 100 % | 100 % |
| Rav Druk, Armon HaNatziv | 10.9 s | 46 % | 80 % | 97 % | 100 % |
| *For comparison: level sunrise, all 2,209* | *29 s* | *14 %* | *33 %* | *61 %* | *72 %* |

Level sunrise (over a flat horizon, what most calendars print) is a different definition, not an error, but it shows
how much the real terrain matters for the moment the Sun is seen.

## Published work on observed sunrise and sunset (searched 2026-11-12)

Other timed observations exist, some from exactly the case these tests could not check: high ground near the sea.
- **Mount Wilson, California (1,740 m, above the Los Angeles basin and the Pacific).** About 250 sunsets timed by
  L. Rarogiewicz, 1987–1991, analysed by J. Hilton (US Naval Observatory technical note, 2015, DTIC AD1094328).
  The Sun set on average about 41 s later than computed, with ±58 s scatter and some extreme events. He put the cause
  in the lowest air's temperature profile, possibly cooled by the cold Pacific beneath, not in the refraction formula.
- **Chile (Schaefer and Liller, 1990).** Sunsets timed from Cerro Tololo (2,215 m) and Viña del Mar (120 m), both near
  the Pacific coast. They found large day-to-day changes in refraction, which Schaefer put down to temperature
  inversions.
- **Edmonton, Alberta (Sampson, Lozowski, Peterson, Hube, 2003–2005).** 244 sunrises and 135 sunsets, inland. Refraction
  is greatest in the coldest months, and sunrise refraction is larger and more variable than sunset. Their ray traces
  through same-day weather-balloon profiles fitted most photographed sunsets. They also warn that this may do no better
  than a standard atmosphere adjusted to the ground's temperature and pressure, as found here. Their Barbados
  comparison tied the day's variability to the temperature gradient at the surface.
- **Teresa Wilson (Michigan Technological University dissertation, 2018).** She tested refraction models of increasing
  complexity against observations from Mount Wilson, Edmonton, Chile and a ship in the Atlantic. More complex models did
  not do significantly better. She called for a larger worldwide set of timed rises and sets with matching weather,
  collected through a phone app.
- **"Using a ray tracing program to calculate sunrise times over a digital terrain model based visible horizon using a
  simplified atmospheric model, part II" (Computers & Geosciences, 2022).** Jerusalem sunrises recomputed by ray tracing
  over a terrain model with Siebren van der Werf's simplified atmosphere, with inversion layers. It reports staying within
  about ±15 s, the accuracy needed for published sunrise tables.

No published work was found that uses a reanalysis such as ERA5 to predict horizon refraction against timed
observations, which is what the ERA5 tests above do. The Mount Wilson and Chile timings would test "hills by the coast"
directly, for sunsets over the sea. They are not available as data online that we found: they would need the original
reports or the authors.

## Data used

ERA5 (Copernicus Climate Change Service, CC BY 4.0) through the Copernicus Climate Data Store and Open-Meteo; NOAA IGRA v2
radiosonde data (public domain); generated using Copernicus Climate Change Service information [2026]; Rabbi Chaim Keller's observations (downloaded by the test, not redistributed); the sea-horizon dips from Sinzi and Owaki,
"Studies on abnormal refraction over sea surface, I. Observation of dip of sea horizon" (Japan Hydrographic Department, 1959),
Table 4, typed into the test; for the other series, the reports reprinted in the International Hydrographic Review
(Hubbard, "Refraction on Georges Bank 1931"; Freiesleben, "Researches on the dip of the sea horizon", 1934, and
"Refraction occurring immediately above the water surface"; Moll, "Measurement of the dip of the horizon", 1906); the
nautical tables' dip from Bowditch, *The American Practical Navigator* (2019), and the Nautical Almanac.
