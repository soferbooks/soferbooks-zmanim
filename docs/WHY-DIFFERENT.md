# Why are our zmanim different from other zmanim?

Open any two zmanim sites for the same town and the times rarely agree to the second, and sometimes not to the minute.
Ours differ too, usually by a few seconds, sometimes by a minute or two. That is not carelessness on anyone's part.
Every calendar makes choices, and here are ours, with the reason for each.

**In short:** we compute the Sun as exactly as modern astronomy can, we take the weather of your place into account, we
measure from where the Sun actually is, and we checked the result against hundreds of sunrises that people watched and
timed.

## 1. The Sun's position, as exact as astronomy allows

Many sites and apps use a short formula for the Sun's position (the NOAA formula). It is good to a few seconds.
We use the full planetary theory astronomers use (VSOP87), which agrees with NASA's JPL Horizons to a tiny fraction of a
second.

*Effect: up to a few seconds.*

## 2. Your weather bends the light

At sunrise and sunset you see the Sun while it is still a little below the horizon, because the air bends its light.
How much it bends depends on the temperature and pressure of the air: cold, dense air bends it more and makes sunrise
earlier and sunset later.

- Most sites use one fixed amount of bending for every place and every day of the year.
- We use your place's own average weather for the date, changing smoothly from day to day, for every sunrise and sunset
  (sea level and both visible ones), and so for every zman counted from them.
- On the phone, when you are online, we use the next days' weather forecast, so a cold snap or a heat wave is taken
  into account.

*Effect: usually under 10 seconds, up to about 20 seconds on a very cold or very hot day.*

## 3. Two ways to count midday

Some sites set midday (chatzot) halfway between their sunrise and sunset; others give the moment the Sun is actually
highest in the sky. The two are not the same, because the Sun's daily motion changes slightly over the day. We give
both, and both for midnight too: the moment the Sun is lowest, and 12 hours after midday.

*Effect: up to about 20–30 seconds, depending on the season.*

## 4. Dawn and nightfall in degrees, from the true horizon

When dawn or nightfall is defined by how far the Sun is below the horizon (for example 16.1° for 72 minutes), we
measure that depth below the true horizon. Twilight comes from sunlight scattered high in the sky, far from you, so the
bending of light in the air around you that morning should not move dawn. Sunrise and sunset do move with your local air;
dawn and nightfall do not.

Every zman is offered three ways: in degrees, in seasonal minutes, and in fixed minutes, so you can follow the
opinion you hold.

## 5. Sunrise and sunset: three opinions

Three opinions of sunrise and sunset are given, side by side; which one to follow is a question for your rav:

- **Sea level:** the Sun's upper edge on a sea-level horizon, as most zmanim calendars give it, but with the bending of
  light from the place's weather (the day's temperature and pressure brought down to sea level) instead of one fixed
  amount.
- **Visible over the hills (techum):** the Sun's edge clearing the real hills and mountains around you, computed from
  detailed elevation maps (USGS lidar in the US), in the manner of Chai Tables: the earliest sunrise and the latest
  sunset from the high points within a techum.
- **Visible over only the mountains a day's walk away:** from the same high points within a techum, the nearer hills
  are disregarded and only mountains farther than a day's walk count; where none rise into view, the Sun is seen on the
  sea-level horizon from that height, a little below level, so sunrise can come before the level one and sunset after.

### Which mountains count

Poskim differ on which hills hide the "real" sunrise. A close mountain, like the Mount of Olives for Jerusalem, is
considered a wall: once the Sun has risen behind it, it is sunrise even for those who cannot see it yet. A distant
range, like the mountains of Moab, more than 50 km from Jerusalem, is the horizon itself. Between the two there is no
settled measure, and Luach Ahavat Shalom's introduction leaves it as a doubt. Two measures are given:

- **Divrei Yosef** (Rabbi Yosef Schwartz): mountains beyond the city's techum are the horizon. The first visible
  option follows this: it counts every hill beyond the ground immediately around each high point of the town.
- **Rabbi Yehoshua Leib Diskin:** the Mount of Olives is disregarded because it is very close; the mountains of Moab
  are not, because they are more than a day's walk away. The second visible option follows this.

Both measures look from the highest point within the techum; they differ only in how far away a mountain must be to
count. Disregarding a near hill means treating it as if it were not there, so beyond it the observer on the high point
sees the open horizon, lower than level, wherever no far mountain rises above it.

A day's walk is 40 mil (Pesachim 93b). At 2,000 amot to the mil and Rav Chaim Na'eh's amah of 48 cm that is 38.4 km.
The smaller amah is used because it counts more mountains, which is the stricter side for both sunrise and sunset.
Beyond a day's walk the engine looks for mountains out to 100 km: the mountains of Moab are some 40 to 90 km from
Jerusalem, and past 100 km the Earth's curve hides anything lower than about 700 m.

The introduction also cites the Gemara (B'chorot 54b) that a shepherd can see 16 mil. That is brought about eyesight,
to explain why we no longer see three stars at three-quarters of a mil after sunset (Rabbi Issur Zalman Meltzer on Ben
HaSh'mashot), not as a limit on which mountains block the Sun; the mountains of Moab, which it counts, are far beyond
16 mil. So it does not enter either calculation.

For sunset, the introduction notes that the custom in Jerusalem is to disregard the mountains; both visible options are
still offered for sunset, for those who follow the view that the sunset one sees is the one that counts.

Some calendars also give sunrise "from a height", over a lower horizon. It is not offered here: the visible time already
includes the earth's curve and the bending of light, so where the land around you really is lower (open sea from a
hill), the visible sunrise comes out the same as the one from a height.

### What the other zmanim count from

Every other zman built on sunrise or sunset counts from **sea-level** sunrise and sunset: the halachic hours (Sh'ma,
Tefila, Mincha, Plag), the halfway midday, minutes before sunrise or after sunset, and candle lighting. Dawn and
nightfall in degrees are measured from the true horizon and do not depend on this. The visible sunrise and sunset are
not used for the other zmanim; they are listed only as sunrise and sunset themselves. (The engine can also count from a
level horizon at the observer's height or from the lower horizon, for one who asks: `cfg.horizon`.)

In Great Neck, NY, the hills to the east, 6 to 14 km away, make the visible sunrise (techum) later than the sea-level one
all year: about 3 to 3½ minutes in winter and about 1½ to 2½ minutes the rest of the year. They are nearer than a day's
walk, so by Rabbi Diskin's measure they are disregarded, and from the high point (about 34 m) the Sun is seen on the open
horizon: sunrise about 1¼ to 1½ minutes earlier than sea level, and around the equinoxes, when low land on Long Island more
than a day's walk away is in line with the Sun, 35 to 50 seconds earlier. To the west, ridges in New Jersey about 43 km
away are a little above eye level, so by his measure sunset is up to about 45 seconds earlier than sea level from March to
October; in winter, with nothing that high in line, it is up to about 1⅓ minutes later. Over the hills (techum) summer
sunset is up to about 1¾ minutes earlier than sea level. Trees and buildings are not in the maps, so if they block your view you will see the
Sun later.

## 6. Exactly where you are

A few kilometres east or west moves sunrise by several seconds. Many sites use the centre of a town or zip code. We use
the coordinates you give, or your phone's location.

## 7. Halachic choices and rounding

Some differences are not calculations at all:

- **Different opinions.** For example, Chabad.org follows the Alter Rebbe for dawn (16.9°) and for Shema, and some
  calendars count the earliest Mincha differently.
- **Rounding.** Many calendars round to the whole minute in the strict direction: sunrise up, sunset down. A one-minute
  "difference" is often just that.

We show seconds, but read them as a prediction. The air changes from morning to morning.

## How we checked

We computed 2,209 sunrises that observers in Israel watched and timed (Rabbi Chaim Keller's published collection), each
from that observer's own spot. Here is how close each kind of sunrise came to what they saw:

| | Visible sunrise (over the real terrain) | Sea-level sunrise (what most calendars print) |
|---|---|---|
| Typical error | 10 seconds | 29 seconds |
| Within 10 seconds | 50% of mornings | 14% |
| Within 20 seconds | 82% | 33% |
| Within 40 seconds | 98% | 61% |
| Within 60 seconds | 100% | 72% |

This measures only which time matches the moment the Sun is first seen. Sea-level sunrise is a definition, not a
mistake: it is the time the Sun would rise over a flat horizon, and many poskim use it. Which sunrise counts is a
halachic question, not one these numbers decide.

## An example: Great Neck, NY, Thursday 5 November 2026

| Zman | Ours | Luach Ahavat Shalom | MyZmanim | Hebcal | Chabad.org | Chai Tables | royzmanim.com |
|---|---|---|---|---|---|---|---|
| Dawn, 72 minutes in degrees | 5:07:08 | 5:06:59 | 5:06:53 | 5:06:51 | 5:02 (16.9°) | — | 5:21 (seasonal) |
| Sunrise, sea level | 6:30:12 | 6:30:00 | 6:30:09 | 6:30:05 | 6:30 | — | — |
| Sunrise from the height (33 m) | 6:29:13 | — | — | — | — | — | — |
| Sunrise, visible over the hills | 6:33:35 | — | — | — | — | 6:28:01* | 6:32:57 |
| Latest Shema (Gra) | 9:04:16 | 9:04:10 | 9:04:11 | 9:04:08 | 9:02 (Alter Rebbe) | — | 9:04 |
| Midday, the Sun highest | 11:38:35 | 11:38:35 | — | — | 11:38 | — | — |
| Midday, halfway between sunrise and sunset | 11:38:19 | — | 11:38:14 | 11:38:12 | — | — | — |
| Sunset, sea level | 4:46:27 | 4:46:39 | 4:46:20 | 4:46:19 | 4:46 | — | 4:46 |
| Sunset from the height (33 m) | 4:47:26 | — | — | — | — | — | — |
| Sunset, visible over the hills | 4:46:52 | — | — | — | — | 4:47:44* | — |

\* Chai Tables publishes only visible times, for its own Great Neck circle about 5 km east. From that same circle ours are
6:28:05 and 4:47:51, within a few seconds of it. royzmanim.com rounds to the whole minute in the strict direction and
follows Chacham Ovadia's opinions (dawn in seasonal minutes).

Every site agrees within a few seconds where the definitions agree. The bigger differences come from the choices
above. A full comparison, including Chai Tables and royzmanim.com: [COMPARISON.md](COMPARISON.md).

