# How these zmanim compare

Great Neck, NY (40.8079 N, 73.7463 W, 33 m), Thursday 5 November 2026 (25 Heshvan 5787), Eastern Standard Time.
Every other column is the times as published: Luach Ahavat Shalom's printed times, MyZmanim's public page, Hebcal's
public API (zip 11021), Chabad.org's zmanim feed, Chai Tables' tables, and royzmanim.com.

## The day's times

| Zman | This engine | Luach Ahavat Shalom | MyZmanim | Hebcal | Chabad.org | Chai Tables | royzmanim.com |
|---|---|---|---|---|---|---|---|
| Dawn, 72 minutes in degrees (≈16.1°) | 5:07:08 | 5:06:59 | 5:06:53 | 5:06:51 | 5:02 (16.9°) | — | 5:21 (72 seasonal minutes) |
| Sunrise, sea level | 6:30:12 | 6:30:00 | 6:30:09 | 6:30:05 | 6:30 | — | — |
| Sunrise from the height (33 m, over a flat horizon) | 6:29:13 | — | — | — | — | — | — |
| Sunrise, visible over the real terrain | 6:33:35 | — | — | — | — | 6:28:01 (its circle) | 6:32:57 |
| Latest Shema (Gra) | 9:04:16 | 9:04:10 | 9:04:11 | 9:04:08 | 9:02 (Alter Rebbe) | — | 9:04 |
| Latest Tefila (Gra) | 9:55:37 | 9:55:33 | 9:55:32 | 9:55:29 | 9:54 (Alter Rebbe) | — | 9:55 |
| Midday, the Sun highest | 11:38:35 | 11:38:35 | — | — | 11:38 | — | — |
| Midday, halfway between sunrise and sunset | 11:38:19 | — | 11:38:14 | 11:38:12 | — | — | — |
| Earliest Mincha | 12:08:35 | 12:08:35 | 12:08:14 | 12:03:52 (½ seasonal hour) | 12:05 (Alter Rebbe) | — | 12:09 |
| Plag HaMincha (Gra) | 3:42:15 | 3:42:25 | 3:42:08 | 3:42:07 | 3:46 (Alter Rebbe) | — | 3:42 (Halacha Berura) |
| Sunset, sea level | 4:46:27 | 4:46:39 | 4:46:20 | 4:46:19 | 4:46 | — | 4:46 |
| Sunset from the height (33 m, over a flat horizon) | 4:47:26 | — | — | — | — | — | — |
| Sunset, visible over the real terrain | 4:46:52 | — | — | — | — | 4:47:44 (its circle) | — |
| 72 fixed minutes after sunset | 5:58:27 | 5:58:39 | 5:58:20 | 5:58:19 | — | — | — |
| Midnight, the Sun lowest | 11:38:35 PM | — | — | — | — | — | — |
| Midnight, 12 hours after midday | 11:38:35 PM | — | — | — | — | — | — |

The zmanim of the day are counted from sea-level sunrise and sunset, as most of the other calendars count them; this is
the engine's default. Visible sunrise and sunset are for this exact point (the hills hide the Sun
a little longer this morning). Chai Tables publishes only visible times, for its own Great Neck circle about 5 km east
(40.7883 N, 73.6933 W); from that circle this engine gives 6:28:05 / 4:47:51 (next section). royzmanim.com rounds to the
whole minute in the strict direction.

### Why each one differs

- **Luach Ahavat Shalom.** The same place and an equally precise Sun (midday agrees to the second). The difference is how much
  the air bends the light at the horizon. Its book (Appendix A §5) describes choosing, for each place and month, the
  closest of several model atmospheres and scaling its refraction to the month's temperature and pressure. This engine
  scales the standard refraction (34.48′, measured over real horizons) to the date's weather (the month's averages
  blended day by day), brought down to sea level. Today the Luach's sunrise is 12 s earlier and its sunset 12 s later;
  everything counted from sunrise or sunset moves with them.
- **MyZmanim.** The same standard refraction every day of the year. Its midday is halfway between its sunrise and sunset,
  about 20 s before the Sun is actually highest. It does not publish its coordinates or method.
- **Hebcal.** The NOAA solar formula (as in KosherJava) with a fixed 34′ of refraction, at the centre of zip 11021,
  2.6 km from the point used here: that alone moves sunrise about 7 s. Midday is the midpoint; the earliest Mincha is half
  a seasonal hour after midday, a more lenient opinion.
- **Chabad.org.** The Alter Rebbe's opinions (dawn at 16.9°, the day for Shema counted from the Sun 1.583° below the
  horizon, nightfall at 6°), rounded to the minute. Halachic choices, not calculation differences.
- **Chai Tables.** Visible sunrise and sunset only: the earliest sunrise and latest sunset seen from its chosen high
  points within a circle around the town, over detailed elevation data. Its circle is not the point used here, so its
  times differ by minutes; from the same circle this engine agrees with it to a few seconds (next section).
- **royzmanim.com (Zemaneh Yosef).** Chacham Ovadia Yosef's opinions: zmanim in seasonal minutes (dawn 72 seasonal
  minutes before sunrise), the day counted from visible sunrise where it has terrain data, the NOAA solar formula,
  computed from sea level outside Israel, and every time rounded to the minute in the strict direction. This engine's
  seasonal-minutes set follows the same opinions (last section).

### Which is more accurate, and why

| Part | Best | Why |
|---|---|---|
| The Sun's position | This engine, Luach Ahavat Shalom | Full planetary theory: within 0.12″ of NASA JPL Horizons (`test/compare-horizons.js`). The NOAA formula behind Hebcal is a short approximation, a few seconds off. |
| Refraction at sunrise and sunset | This engine | Tested against 2,209 sunrises that observers watched and timed in Israel (`test/compare-observations.js`): 3.7 s average error with public ERA5 climate normals. Fixed standard refraction, as most sites use, is about 23 s off on average, because cold mornings bend light more. |
| Location | Whatever matches where you stand | A few kilometres move sunrise by seconds. Pass your own coordinates. |
| Midday | A matter of definition | The Sun's highest point (this engine, Luach Ahavat Shalom) is the exact astronomical midday; the midpoint of sunrise and sunset (MyZmanim, Hebcal) is another accepted way to count. |
| Dawn and nightfall in degrees | This engine, MyZmanim, Hebcal | Twilight light comes from rays that skim the Earth far away and high above the local air, so the depth below the **true** horizon is what matters, unaffected by the morning's local refraction. This engine uses the depth the given minutes come to in Jerusalem at the equinox (72 minutes = 16.079°); the sites round the same idea to 16.1°. |

## Visible sunrise and sunset (over the real hills)

| From where | This engine | Chai Tables | royzmanim.com |
|---|---|---|---|
| Chai Tables' Great Neck circle (40.7883 N, 73.6933 W, best point within 1.2 km) | 6:28:05 / 4:47:51 | 6:28:01 / 4:47:44 | — |
| 40.8079 N, 73.7463 W | 6:33:35 / 4:46:52 | — | 6:32:57 / 4:46 |

Over the whole year 5787 this engine averages 0.5 s from Chai Tables at sunrise and 4.5 s at sunset (about 10 s of
day-to-day scatter, from different elevation data and refraction).

## The seasonal-minutes set against royzmanim.com

| Zman | This engine | royzmanim.com | Zemaneh Yosef's formulas at the same height |
|---|---|---|---|
| Dawn | 5:19:52 | 5:21 | 5:19:49 |
| Earliest tallit | 5:31:25 | 5:33 | 5:31:22 |
| Latest Shema, MGA / GRA | 8:29:08 / 9:03:45 | 8:30 / 9:04 | 8:29:05 / 9:03:42 |
| Latest Tefila | 9:55:17 | 9:55 | 9:55:14 |
| Mincha gedola / ketana | 12:08:34 / 2:38:39 | 12:09 / 2:38 | 12:08:31 / 2:38:37 |
| Plag (Halacha Berura / Yalkut Yosef) | 3:43:03 / 3:56:01 | 3:42 / 3:55 | 3:43:01 / 3:55:59 |
| Sunset (from the height) | 4:47:27 | 4:46 | 4:47:25 |
| Nightfall / strict | 5:00:25 / 5:06:40 | 4:59 / 5:06 | 5:00:23 / 5:06:38 |
| Rabbenu Tam | 5:56:57 | 5:55 | 5:56:55 |

Run with the same height, Zemaneh Yosef's own open-source formulas give these times within 2–4 s (`test/compare-roy.js`;
the gap is the NOAA solar formula they run on). The site itself differs by about a minute: outside Israel it computes from
sea level (this engine uses the place's height everywhere), and it rounds to the whole minute in the strict direction.

## The Moon

**New moon (the astronomical "true molad").** Against NASA JPL Horizons:

| Month | JPL Horizons (UT) | This engine | Luach Ahavat Shalom's "true molad" |
|---|---|---|---|
| Heshvan 5787 | 10 Oct 2026 15:50:05 | −2 s | −64 s |
| Kislev | 9 Nov 2026 07:02:07 | −4 s | −66 s |
| Sh'vat | 7 Jan 2027 20:24:23 | +6 s | −56 s |
| Second Adar | 8 Mar 2027 09:29:29 | +4 s | −58 s |
| Iyar | 6 May 2027 10:58:38 | −3 s | −65 s |

The traditional molad (the four opinions and the Rambam's form) is arithmetic; Luach Ahavat Shalom, Chabad's molad
calculator and the Hebrew calendar agree on it exactly.

**Moonrise and moonset.** This engine solves each event exactly with Astronomy Engine, whose Moon agrees with JPL Horizons
to 0.002° at the horizon. For Birkat HaL'vanah it also offers the crescent's lit top corner, as Rabbi Daniel Aharon
Glauberman explains in Luach Ahavat Shalom (Appendix A §2). His formula, size = radius × sin(90° − q) with
q = arccos(sin latitude / cos declination), takes the horns along the north-south line through the pole (and, as he
found, needs the absolute value south of the Equator). This engine takes the lit top exactly instead: the bright limb's
angle from the zenith, Meeus's bright-limb position angle less the parallactic angle (Astronomical Algorithms 48.5 and
14.1), checked against the Moon as a sphere lit by the Sun to 0.01 of its radius, north and south of the Equator. The
two differ by up to about a third of the radius, 20-25 seconds of moonset. Luach Ahavat Shalom's printed moonrise and
moonset times for Great Neck, 5787, lay within 51 s rms of this engine's with his formula (up to 2 minutes; 46 events).

| Event, Great Neck | This engine | Luach Ahavat Shalom |
|---|---|---|
| Moonset (lit corner), night of 4 Heshvan (14 Oct 2026) | 8:12:54 PM | 8:12:41 PM |
| Moonrise, night of 15 Heshvan (25 Oct 2026) | 5:24:54 PM | 5:25:07 PM |
| Moonset (lit corner), night of 3 Kislev (12 Nov 2026) | 6:46:15 PM | 6:45:57 PM |
| Moonrise, night of 14 Kislev (23 Nov 2026) | 3:27:37 PM | 3:28:10 PM |
