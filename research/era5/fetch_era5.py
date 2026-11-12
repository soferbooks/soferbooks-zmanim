# Download ERA5 upper air (temperature and geopotential on pressure levels) plus surface temperature and pressure,
# around sunrise, for every date with an observed sunrise (Rabbi Keller's collection), over central Israel and the
# Jordan valley: the air the light crosses on its way to the observers. One request per month; already-downloaded
# files are skipped, so it can be re-run after an interruption.
# Needs your own Copernicus key in ~/.cdsapirc (https://cds.climate.copernicus.eu/how-to-api) and the ERA5 licences
# accepted on the CDS website.
import json, os, sys, cdsapi
from collections import defaultdict

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(OUT, exist_ok=True)
fx = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixtures', 'observations.json')))
days = defaultdict(set)
for r in fx['rows']:
    y, m, d = r['date'].split('-')
    days[(y, m)].add(d)

AREA = [32.25, 34.5, 31.25, 36.25]  # N, W, S, E: Bnei Brak to beyond the Dead Sea
TIMES = ['02:00', '03:00', '04:00', '05:00']  # UTC; Israel sunrise is about 03:30-04:45 UTC
LEVELS = ['500', '550', '600', '650', '700', '750', '775', '800', '825', '850', '875', '900', '925', '950', '975', '1000']

c = cdsapi.Client()
todo = sorted(days.items())
only = sys.argv[1] if len(sys.argv) > 1 else None  # e.g. 1994-01 to test one month first
for (y, m), ds in todo:
    if only and f'{y}-{m}' != only:
        continue
    base = {'product_type': ['reanalysis'], 'year': [y], 'month': [m], 'day': sorted(ds), 'time': TIMES,
            'area': AREA, 'data_format': 'netcdf', 'download_format': 'unarchived'}
    jobs = [
        ('reanalysis-era5-pressure-levels', f'pl_{y}-{m}.nc', {**base, 'variable': ['temperature', 'geopotential'], 'pressure_level': LEVELS}),
        ('reanalysis-era5-single-levels', f'sl_{y}-{m}.nc', {**base, 'variable': ['2m_temperature', 'surface_pressure', 'geopotential']}),
    ]
    for dataset, name, req in jobs:
        path = os.path.join(OUT, name)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue
        print('requesting', name, flush=True)
        c.retrieve(dataset, req, path + '.part')
        os.replace(path + '.part', path)
print('done')
