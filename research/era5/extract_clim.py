# The 1991-2020 mean dawn air for each observer and calendar month, from ERA5 monthly means by hour of day: at mid-month,
# linear in time to the moment of sunrise, at the points along the line of sight (the near point 0.15 deg inland, as
# in the land-path check). Writes clim_profiles.json: { site: { month: [profiles...] } }.
import json, math, os, glob, datetime as dt
import netCDF4 as N
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
fx = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixtures', 'observations.json')))
G = 9.80665
DISTS = [0, 20, 40, 60, 80]
E = dt.datetime(1970, 1, 1)

def load(kind, names):
    acc = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'clim', f'{kind}_*.nc'))):
        ds = N.Dataset(f)
        when = [E + dt.timedelta(seconds=int(x)) for x in np.asarray(ds['valid_time'][:])]
        arrs = {n: np.asarray(ds[n][:]) for n in names}
        lat, lon = np.asarray(ds['latitude'][:]), np.asarray(ds['longitude'][:])
        for i, w in enumerate(when):
            k = (w.month, w.hour)
            a = acc.setdefault(k, {n: [] for n in names})
            for n in names: a[n].append(arrs[n][i])
        ds.close()
    return {k: {n: np.mean(v[n], axis=0) for n in names} for k, v in acc.items()}, lat, lon

PL, lat, lon = load('pl', ['t', 'z'])
SL, _, _ = load('sl', ['t2m', 'sp', 'z'])
lev_ds = N.Dataset(sorted(glob.glob(os.path.join(HERE, 'clim', 'pl_*.nc')))[0]); LEV = np.asarray(lev_ds['pressure_level'][:]); lev_ds.close()
HOURS = sorted({h for (_, h) in PL})

def bilin(arr, la, lo):
    i = np.interp(la, lat[::-1], np.arange(len(lat))[::-1]); j = np.interp(lo, lon, np.arange(len(lon)))
    i0, j0 = min(int(i), len(lat) - 2), min(int(j), len(lon) - 2); fi, fj = i - i0, j - j0
    return (arr[..., i0, j0] * (1 - fi) * (1 - fj) + arr[..., i0 + 1, j0] * fi * (1 - fj)
            + arr[..., i0, j0 + 1] * (1 - fi) * fj + arr[..., i0 + 1, j0 + 1] * fi * fj)

def decl(doy): return -23.44 * math.cos(math.radians(360 / 365 * (doy + 10)))
def sunrise_utc(lat_, lon_, doy):  # hours UTC, good to ~15 min (no equation of time): enough for hourly means
    d = math.radians(decl(doy)); h0 = math.degrees(math.acos(-math.tan(math.radians(lat_)) * math.tan(d) - 0.0145 / math.cos(math.radians(lat_)) / math.cos(d)))
    return 12 - lon_ / 15 - h0 / 15

def at_hour(D, m, hr, field):
    hs = [h for h in HOURS]; k = max(0, min(int(np.searchsorted(hs, hr)) - 1, len(hs) - 2)); f = (hr - hs[k]) / (hs[k + 1] - hs[k])
    return D[(m, hs[k])][field] * (1 - f) + D[(m, hs[k + 1])][field] * f

out = {}
for site_id, site in fx['sites'].items():
    out[site_id] = {}
    for m in range(1, 13):
        doy = dt.date(2001, m, 15).timetuple().tm_yday
        hr = sunrise_utc(site['lat'], site['lon'], doy)
        az = math.degrees(math.acos(math.sin(math.radians(decl(doy))) / math.cos(math.radians(site['lat']))))
        T, Z = at_hour(PL, m, hr, 't'), at_hour(PL, m, hr, 'z')
        T2, SP, ZS = at_hour(SL, m, hr, 't2m'), at_hour(SL, m, hr, 'sp'), at_hour(SL, m, hr, 'z')
        profs = []
        for km in DISTS:
            la = site['lat'] + km / 111.2 * math.cos(math.radians(az))
            lo = site['lon'] + km / (111.2 * math.cos(math.radians(site['lat']))) * math.sin(math.radians(az))
            if km == 0: lo += 0.15
            t = bilin(T, la, lo) - 273.15; h = bilin(Z, la, lo) / G; ground = float(bilin(ZS, la, lo)) / G
            profs.append({'km': km, 'levels': [{'h': float(a), 't': float(b)} for a, b in sorted(zip(h, t)) if a > ground + 2],
                          'surface': {'h': ground + 2, 't': float(bilin(T2, la, lo)) - 273.15, 'p': float(bilin(SP, la, lo)) / 100}})
        out[site_id][m] = profs
json.dump(out, open(os.path.join(HERE, 'clim_profiles.json'), 'w'))
print('sites', list(out), 'hours', HOURS, 'levels', len(LEV))
