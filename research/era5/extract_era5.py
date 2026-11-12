# For each observed sunrise: the ERA5 air profile at the moment of sunrise (linear in time between the hours), at
# points along the line of sight toward the sunrise direction (0-80 km), each bilinear in latitude/longitude.
# Writes profiles.json: { rows: [{ site, date, time, az, near: {levels,[ps,zs]}, path: {...} }] } with heights in metres
# (geopotential / g), temperatures in degrees C, levels below the ground removed.
import json, math, os, datetime as dt
import netCDF4 as N
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
fx = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'test', 'fixtures', 'observations.json')))
G = 9.80665
DISTS = [0, 20, 40, 60, 80]  # km along the line of sight
cache = {}

def files(ym):
    if ym not in cache:
        pl = N.Dataset(os.path.join(HERE, 'data', f'pl_{ym}.nc')); sl = N.Dataset(os.path.join(HERE, 'data', f'sl_{ym}.nc'))
        cache[ym] = dict(t=np.asarray(pl['valid_time'][:]), lat=np.asarray(pl['latitude'][:]), lon=np.asarray(pl['longitude'][:]),
                         lev=np.asarray(pl['pressure_level'][:]), T=np.asarray(pl['t'][:]), Z=np.asarray(pl['z'][:]),
                         st=np.asarray(sl['valid_time'][:]), t2=np.asarray(sl['t2m'][:]), sp=np.asarray(sl['sp'][:]), zs=np.asarray(sl['z'][:]))
    return cache[ym]

def bilin(arr, lat, lon, la, lo):  # arr[..., lat, lon]; lat descending
    i = np.interp(la, lat[::-1], np.arange(len(lat))[::-1]); j = np.interp(lo, lon, np.arange(len(lon)))
    i0, j0 = min(int(i), len(lat) - 2), min(int(j), len(lon) - 2); fi, fj = i - i0, j - j0
    return (arr[..., i0, j0] * (1 - fi) * (1 - fj) + arr[..., i0 + 1, j0] * fi * (1 - fj)
            + arr[..., i0, j0 + 1] * (1 - fi) * fj + arr[..., i0 + 1, j0 + 1] * fi * fj)

def at_time(times, arr, ts):
    k = np.searchsorted(times, ts) - 1; k = max(0, min(k, len(times) - 2))
    f = (ts - times[k]) / (times[k + 1] - times[k])
    if times[k + 1] - times[k] > 3600 * 1.5 or f < -0.5 or f > 1.5: return None  # different days: no bracketing hours
    return arr[k] * (1 - f) + arr[k + 1] * f

def sun_az(lat, date):  # rising azimuth (deg from north), from the declination (good to ~1 deg)
    n = date.timetuple().tm_yday
    dec = -23.44 * math.cos(math.radians(360 / 365 * (n + 10)))
    return math.degrees(math.acos(math.sin(math.radians(dec)) / math.cos(math.radians(lat))))

out = []
for r in fx['rows']:
    site = fx['sites'][r['site']]
    y, m, d = map(int, r['date'].split('-')); hh, mi, ss = map(int, r['time'].split(':'))
    ts = dt.datetime(y, m, d, hh, mi, ss, tzinfo=dt.timezone.utc).timestamp() - 2 * 3600  # Israel Standard Time
    ym = f'{y:04d}-{m:02d}'
    if not all(os.path.exists(os.path.join(HERE, 'data', f'{k}_{ym}.nc')) for k in ('pl', 'sl')): continue
    F = files(ym)
    T = at_time(F['t'], F['T'], ts); Z = at_time(F['t'], F['Z'], ts)
    T2 = at_time(F['st'], F['t2'], ts); SP = at_time(F['st'], F['sp'], ts); ZS = at_time(F['st'], F['zs'], ts)
    if T is None or T2 is None: continue
    az = sun_az(site['lat'], dt.date(y, m, d))
    profs = []
    for km in DISTS:
        la = site['lat'] + km / 111.2 * math.cos(math.radians(az))
        lo = site['lon'] + km / (111.2 * math.cos(math.radians(site['lat']))) * math.sin(math.radians(az))
        t = bilin(T, F['lat'], F['lon'], la, lo) - 273.15; h = bilin(Z, F['lat'], F['lon'], la, lo) / G
        ground = float(bilin(ZS, F['lat'], F['lon'], la, lo)) / G
        lv = [{'h': float(hh_), 't': float(tt)} for hh_, tt in sorted(zip(h, t)) if hh_ > ground + 2]
        sfc = {'h': ground + 2, 't': float(bilin(T2, F['lat'], F['lon'], la, lo)) - 273.15, 'p': float(bilin(SP, F['lat'], F['lon'], la, lo)) / 100}
        profs.append({'km': km, 'levels': lv, 'surface': sfc})
    # (the near point moved inland, 0.15 deg east, for the land-only check at the coast)
    la, lo = site['lat'], site['lon'] + 0.15
    t = bilin(T, F['lat'], F['lon'], la, lo) - 273.15; h = bilin(Z, F['lat'], F['lon'], la, lo) / G
    ground = float(bilin(ZS, F['lat'], F['lon'], la, lo)) / G
    land = {'km': 0, 'levels': [{'h': float(hh_), 't': float(tt)} for hh_, tt in sorted(zip(h, t)) if hh_ > ground + 2],
            'surface': {'h': ground + 2, 't': float(bilin(T2, F['lat'], F['lon'], la, lo)) - 273.15, 'p': float(bilin(SP, F['lat'], F['lon'], la, lo)) / 100}}
    out.append({'site': r['site'], 'date': r['date'], 'time': r['time'], 'az': az, 'profiles': profs, 'land': land})
json.dump({'rows': out}, open(os.path.join(HERE, 'profiles.json'), 'w'))
print(len(out), 'observations with ERA5 profiles')
