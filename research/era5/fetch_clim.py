# ERA5 monthly means by hour of day, 1991-2020 (the normals' period), over the same area: the product a worldwide
# monthly dawn-layering table would be built from. One request per decade per dataset; skips files already here.
import os, cdsapi
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'clim')
os.makedirs(OUT, exist_ok=True)
AREA = [32.25, 34.5, 31.25, 36.25]
TIMES = ['02:00', '03:00', '04:00', '05:00']
LEVELS = ['500', '550', '600', '650', '700', '750', '775', '800', '825', '850', '875', '900', '925', '950', '975', '1000']
MONTHS = [f'{m:02d}' for m in range(1, 13)]
c = cdsapi.Client()
for y0 in (1991, 2001, 2011):
    base = {'product_type': ['monthly_averaged_reanalysis_by_hour_of_day'], 'year': [str(y) for y in range(y0, y0 + 10)],
            'month': MONTHS, 'time': TIMES, 'area': AREA, 'data_format': 'netcdf', 'download_format': 'unarchived'}
    for ds, name, extra in [
        ('reanalysis-era5-pressure-levels-monthly-means', f'pl_{y0}.nc', {'variable': ['temperature', 'geopotential'], 'pressure_level': LEVELS}),
        ('reanalysis-era5-single-levels-monthly-means', f'sl_{y0}.nc', {'variable': ['2m_temperature', 'surface_pressure', 'geopotential']}),
    ]:
        path = os.path.join(OUT, name)
        if os.path.exists(path) and os.path.getsize(path) > 0: continue
        print('requesting', name, flush=True)
        c.retrieve(ds, {**base, **extra}, path + '.part')
        os.replace(path + '.part', path)
print('done')
