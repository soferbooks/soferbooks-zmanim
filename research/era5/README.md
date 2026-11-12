# Upper air (ERA5) and observed sunrise: the scripts

These scripts produced the "ERA5 upper air along the line of sight" results in [docs/EXPERIMENTS.md](../../docs/EXPERIMENTS.md).
They ask whether knowing the air's layering, beyond the temperature and pressure at the observer, predicts the moment
of visible sunrise better. The test set is 2,209 timed sunrises in Israel: Rav Druk (Armon HaNatziv, Jerusalem),
R' Golan (Neve Yaakov, Jerusalem) and Rav Zuriel (Bnei Brak, on the coastal plain).

**Short answer:** the layering helps over the hills and does nothing, or slightly harms, on the coast. On the hills
that morning's air removes about 2 s of scatter. The typical monthly layering, kept to the same yearly average,
removes about 0.8 s. At Bnei Brak, that morning's air adds a constant shift of about 2.4 s and no gain in scatter,
and the monthly layering is 0.1 s worse. The tables and the reasoning are in the experiments document.

## Running them

You need Python with `cdsapi`, `netCDF4` and `numpy`, and a Copernicus Climate Data Store key in `~/.cdsapirc` with
the ERA5 licences accepted. Before running anything, run `node test/compare-observations.js` once: it downloads the observations (Rabbi Chaim
Keller's collection, not redistributed here) to `test/fixtures/observations.json`.

| Step | Script | What it does |
|---|---|---|
| 1 | `fetch_era5.py` | ERA5 hourly temperature and geopotential on 16 pressure levels plus surface temperature and pressure, 02-05 UTC, for every observation date, over 31.25-32.25 N, 34.5-36.25 E. About 170 requests; skips files already present, so re-run it after an interruption. |
| 2 | `extract_era5.py` | For each sunrise, the air at the moment of sunrise at 0, 20, 40, 60 and 80 km along the line of sight, plus a point 0.15 deg inland. Writes `profiles.json`. |
| 3 | `era5trace2.mjs` | Ray traces those profiles from the observer's eye and scores the computed sunrises: the normals, the air at the observer only, along the path, and with the inland point. Groups: each observer, and Rav Zuriel before and after 1979. Also a weighted blend of the normals and the path, chosen on the other observers each time (leave one out). |
| 4 | `era5clim.mjs` | The site-month's typical path profile from the other years' mornings. |
| 5 | `fetch_clim.py`, `extract_clim.py` | ERA5 monthly means by hour of day, 1991-2020, and each observer's mean dawn air per calendar month. Writes `clim_profiles.json`. |
| 6 | `era5season.mjs` | The usable form: the month's mean dawn layering, ray traced, times one constant per place so the year's mean sunrise equals the normals'. Shows the scores, the chance it is worse (paired bootstrap), how far times move, and how often a displayed minute changes. |

Run the `.mjs` scripts with `node` from this folder. They import the engine from `../../src`.

ERA5: Hersbach et al. (2020), Copernicus Climate Change Service, CC BY 4.0.
