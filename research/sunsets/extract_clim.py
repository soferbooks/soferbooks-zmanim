# For every observed sunrise / sunset (Sampson's Edmonton table, Schaefer & Liller's Chile sunsets): ERA5's 1991-2020
# mean air for that calendar month at that time of day (linear between the hours), at 0, 20, 40 and 60 km along the
# line of sight toward the Sun. Writes cache/clim_events.json: { key: [profiles] } with key "set|date|time".
import json, math, os, glob, datetime as dt
import netCDF4 as N
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); C = os.path.join(HERE, 'cache')
G, E = 9.80665, dt.datetime(1970, 1, 1)
DISTS = [0, 20, 40, 60]

def load(area):
    out = {}
    for kind, names in (('pl', ['t', 'z']), ('sl', ['t2m', 'sp', 'z'])):
        acc = {}
        for f in sorted(glob.glob(os.path.join(C, 'era5', f'{area}_{kind}_*.nc'))):
            ds = N.Dataset(f)
            when = [E + dt.timedelta(seconds=int(x)) for x in np.asarray(ds['valid_time'][:])]
            arrs = {n: np.asarray(ds[n][:]) for n in names}
            lat, lon = np.asarray(ds['latitude'][:]), np.asarray(ds['longitude'][:])
            for i, w in enumerate(when):
                a = acc.setdefault((w.month, w.hour), {n: [] for n in names})
                for n in names: a[n].append(arrs[n][i])
            ds.close()
        out[kind] = {k: {n: np.mean(v[n], axis=0) for n in names} for k, v in acc.items()}
        out['lat'], out['lon'] = lat, lon
    return out

def bilin(arr, lat, lon, la, lo):
    i = np.interp(la, lat[::-1], np.arange(len(lat))[::-1]); j = np.interp(lo, lon, np.arange(len(lon)))
    i0, j0 = min(int(i), len(lat) - 2), min(int(j), len(lon) - 2); fi, fj = i - i0, j - j0
    return (arr[..., i0, j0] * (1 - fi) * (1 - fj) + arr[..., i0 + 1, j0] * fi * (1 - fj)
            + arr[..., i0, j0 + 1] * (1 - fi) * fj + arr[..., i0 + 1, j0 + 1] * fi * fj)

def at(D, m, hr, field):
    h0 = int(math.floor(hr)) % 24; h1 = (h0 + 1) % 24; f = hr - math.floor(hr)
    if (m, h1) not in D: h1, f = h0, 0.0
    if (m, h0) not in D: h0, f = h1, 0.0
    return D[(m, h0)][field] * (1 - f) + D[(m, h1)][field] * f

def sun_az(lat, lon, t):  # solar azimuth (deg from north), approximate (~0.5 deg)
    n = (t - dt.datetime(2000, 1, 1, 12)).total_seconds() / 86400
    L = math.radians((280.46 + 0.9856474 * n) % 360); g = math.radians((357.528 + 0.9856003 * n) % 360)
    lam = L + math.radians(1.915) * math.sin(g) + math.radians(0.02) * math.sin(2 * g); eps = math.radians(23.439)
    ra = math.atan2(math.cos(eps) * math.sin(lam), math.cos(lam)); dec = math.asin(math.sin(eps) * math.sin(lam))
    gmst = math.radians((280.46061837 + 360.98564736629 * n) % 360); H = gmst + math.radians(lon) - ra
    φ = math.radians(lat)
    return math.degrees(math.atan2(math.sin(H), math.cos(H) * math.sin(φ) - math.tan(dec) * math.cos(φ))) % 360 + 180

def profiles(D, lat0, lon0, m, hr, az):
    T, Z = at(D['pl'], m, hr, 't'), at(D['pl'], m, hr, 'z')
    T2, SP, ZS = at(D['sl'], m, hr, 't2m'), at(D['sl'], m, hr, 'sp'), at(D['sl'], m, hr, 'z')
    out = []
    for km in DISTS:
        la = lat0 + km / 111.2 * math.cos(math.radians(az)); lo = lon0 + km / (111.2 * math.cos(math.radians(lat0))) * math.sin(math.radians(az))
        t = bilin(T, D['lat'], D['lon'], la, lo) - 273.15; h = bilin(Z, D['lat'], D['lon'], la, lo) / G
        ground = float(bilin(ZS, D['lat'], D['lon'], la, lo)) / G
        out.append({'km': km, 'levels': [{'h': float(a), 't': float(b)} for a, b in sorted(zip(h, t)) if a > ground + 2],
                    'surface': {'h': ground + 2, 't': float(bilin(T2, D['lat'], D['lon'], la, lo)) - 273.15, 'p': float(bilin(SP, D['lat'], D['lon'], la, lo)) / 100}})
    return out

res = {}
ED = load('edmonton')
for l in open(os.path.join(C, 'sampson-1994.tsv'), encoding='utf8').read().strip().split('\n')[1:]:
    c = l.split('\t'); mm, dd, yy = map(int, c[2].split('/')); hh, mi, ss = map(int, c[3].split(':'))
    t = dt.datetime(1900 + yy, mm, dd, hh, mi, ss); loc = t - dt.timedelta(hours=113.49 / 15)
    res[f'edm|{c[2]}|{c[3]}'] = profiles(ED, 53.526, -113.49, loc.month, hh + mi / 60 + ss / 3600, sun_az(53.526, -113.49, t))
CH = load('chile')
for l in open(os.path.join(HERE, 'schaefer-liller-1990.tsv'), encoding='utf8').read().strip().split('\n')[1:]:
    c = l.split('\t'); lat, lon = float(c[2]), float(c[3])
    if lat > 0: continue  # Hawaii: not downloaded
    y, m, d = map(int, c[6].split('-')); hh, mi, ss = map(int, c[7].split(':'))
    t = dt.datetime(y, m, d, hh, mi, ss); loc = t + dt.timedelta(hours=lon / 15)
    res[f'sl|{c[6]}|{c[7]}'] = profiles(CH, lat, lon, loc.month, hh + mi / 60 + ss / 3600, sun_az(lat, lon, t))
json.dump(res, open(os.path.join(C, 'clim_events.json'), 'w'))
print(len(res), 'events')
