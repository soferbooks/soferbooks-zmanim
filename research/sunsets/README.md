# Published sunrise and sunset timings, scored with the engine

The results are in [docs/EXPERIMENTS.md](../../docs/EXPERIMENTS.md), under "Testing the engine on these timings".

| Script | What it does |
|---|---|
| `schaefer-liller.mjs` | 110 sunsets over the Pacific from Hawaii and Chile (Schaefer and Liller 1990, Table 1, transcribed in `schaefer-liller-1990.tsv`). Builds each site's skyline from Copernicus GLO-30 out to 150 km and scores the engine's visible sunset over the real horizon, the same ray traced, and two secular definitions. |
| `sampson-edmonton.mjs` | 244 sunrises and 125 sunsets in Edmonton (Sampson 1994, Appendix D). The thesis may not be reproduced, so its table is not here: transcribe it into `cache/sampson-1994.tsv` to run this. Pass `gedtm` (bare earth, the default) or `copernicus` for the terrain. |
| `mount-wilson.mjs` | 250 sunsets over the Pacific from Mount Wilson (Hilton, USNO/AA TN 2014-05). The times are not published, only observed minus a standard ray trace. The script finds the engine's offset from that standard over the same season and carries Hilton's figures across. Also builds the real skyline (Copernicus GLO-30 to 250 km) and lists the season days when the Sun sets behind land. |
| `fetch_clim.py`, `extract_clim.py`, `era5-layering.mjs` | ERA5 monthly means by hour of day (2011-2020) around Edmonton and the Chilean coast, ray traced along each event's line of sight, against the engine's normals. |

Run the `.mjs` scripts with `node` from the repository root. They download terrain blocks and Open-Meteo normals on the
first run into `cache/` (not committed). The ERA5 scripts need a Copernicus key in `~/.cdsapirc`.
