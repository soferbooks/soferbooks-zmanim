# ERA5 monthly means by hour of day, 2011-2020 (the period of the weather normals used for these sites), temperature and geopotential on pressure levels plus surface fields,
# around Edmonton and the Chilean coast (Vina del Mar, La Serena, Cerro Tololo): the typical layering at each hour.
# Needs a Copernicus key in ~/.cdsapirc. Files go to research/sunsets/cache/era5/.
import os, cdsapi
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache', 'era5'); os.makedirs(OUT, exist_ok=True)
AREAS = {'edmonton': [54.25, -114.5, 52.75, -112.5], 'chile': [-29.5, -72.5, -33.5, -70.5]}
LEVELS = ['500', '550', '600', '650', '700', '750', '775', '800', '825', '850', '875', '900', '925', '950', '975', '1000']
HOURS = {'edmonton': [[10, 11, 12, 13], [14, 15, 16, 17], [21, 22, 23, 0], [1, 2, 3, 4], [5, 6]], 'chile': [[21, 22, 23, 0, 1]]}
c = cdsapi.Client()
for name, area in AREAS.items():
    for y0 in range(2011, 2021, 5):
      for hg in HOURS[name]:
        base = {'product_type': ['monthly_averaged_reanalysis_by_hour_of_day'], 'year': [str(y) for y in range(y0, y0 + 5)],
                'month': [f'{m:02d}' for m in range(1, 13)], 'time': [f'{h:02d}:00' for h in hg], 'area': area, 'data_format': 'netcdf', 'download_format': 'unarchived'}
        for ds, kind, extra in [('reanalysis-era5-pressure-levels-monthly-means', 'pl', {'variable': ['temperature', 'geopotential'], 'pressure_level': LEVELS}),
                                ('reanalysis-era5-single-levels-monthly-means', 'sl', {'variable': ['2m_temperature', 'surface_pressure', 'geopotential']})]:
            path = os.path.join(OUT, f'{name}_{kind}_{y0}_h{hg[0]:02d}.nc')
            if os.path.exists(path) and os.path.getsize(path) > 0: continue
            print('requesting', path, flush=True)
            c.retrieve(ds, {**base, **extra}, path + '.part'); os.replace(path + '.part', path)
print('done')
