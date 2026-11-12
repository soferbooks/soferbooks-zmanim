// Elevation data for the visible sunrise: cloud-optimized GeoTIFFs read by HTTP range requests with geotiff.js
// (geotiffjs, MIT). Only the internal 512×512 blocks a skyline needs are fetched.
//   - USA: USGS 3DEP 1 arc-second, bare earth (public domain). One file per 1° cell, named by its north-west corner:
//     prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/n41w074/USGS_1_n41w074.tif
//   - Elsewhere: Copernicus GLO-30 (free with attribution: "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and
//     © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA"). Named by the
//     south-west corner. No file = sea.
//   - Or, everywhere: GEDTM30 (OpenGeoHub 2025, CC BY 4.0), a global bare-earth model at 1″ fused from Copernicus, ALOS and
//     lidar (ICESat-2, GEDI): one global COG with open CORS. Bare earth matters in built-up places: Copernicus counts
//     buildings as ground.
// The bucket for Copernicus sends no CORS header: the APK fetches it natively (MainActivity.shouldInterceptRequest);
// node (tests) is unaffected.
import { fromUrl } from 'geotiff';

const pad = (n, w) => String(Math.abs(n)).padStart(w, '0');
export function usgsUrl(lat, lon) {
  const n = Math.ceil(lat + 1e-12), w = Math.ceil(-lon + 1e-12);
  if (w < 0 || n < 0) return null; // 3DEP covers only the western / northern hemispheres
  const name = `n${pad(n, 2)}w${pad(w, 3)}`;
  return `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/${name}/USGS_1_${name}.tif`;
}
export function copernicusUrl(lat, lon) {
  const s = Math.floor(lat), w = Math.floor(lon);
  const name = `Copernicus_DSM_COG_10_${s >= 0 ? 'N' : 'S'}${pad(s, 2)}_00_${w >= 0 ? 'E' : 'W'}${pad(w, 3)}_00_DEM`;
  return `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
}

export const GEDTM_URL = 'https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif';

// Roughly where 3DEP 1″ exists (the 48 states; Alaska / Hawaii / territories use Copernicus here).
const inConus = (lat, lon) => lat > 24 && lat < 50 && lon > -125 && lon < -66;

/**
 * Elevation source over many 1° cells. level 0 = full resolution (1″), 1 = 2″, 2 = 4″, 3 = 8″ (the files' overviews).
 * Blocks are loaded with load(blocks) and then sampled synchronously with elevation(lat, lon, level).
 */
export class Dem {
  constructor({ source = 'auto-bare', open = fromUrl } = {}) {
    this.source = source;
    this.open = open;
    this.cells = new Map(); // "lat,lon" (SW corner) → Promise<{ name, images[] } | null>
    this.blocks = new Map(); // "cell|level|bx|by" → Float32Array (512×512) or null (missing)
    this.meta = new Map(); // "cell|level" → { x0, y0, dx, dy, w, h, tw, th, nodata }
  }

  // source: 'auto-bare' (default: USGS lidar bare earth in the 48 states, else GEDTM30 bare earth), 'auto' (USGS, else
  // Copernicus), 'usgs', 'copernicus', 'gedtm' (one global file). Measured 2026-11-05 against Chai Tables at Great Neck
  // (which uses USGS NED): USGS mean +2 s / sd 10 s; GEDTM30 −7 s / 17 s; Copernicus −24 s / 26 s (it counts roofs and
  // trees as ground, so the vantage stood 11 m too high: an early, lenient sunrise). Against the 656 observed sunrises in
  // Israel, GEDTM30 and Copernicus did equally well (rms 15.2 / 15.1 s).
  usesGlobal(lat, lon) {
    return this.source === 'gedtm' || (this.source === 'auto-bare' && !inConus(Math.floor(lat) + 0.5, Math.floor(lon) + 0.5));
  }
  cellKey(lat, lon) { return this.usesGlobal(lat, lon) ? 'G' : `${Math.floor(lat)},${Math.floor(lon)}`; }

  async openCell(lat, lon) {
    const key = this.cellKey(lat, lon);
    if (!this.cells.has(key)) {
      const la = Math.floor(lat) + 0.5, lo = Math.floor(lon) + 0.5;
      const tries = [];
      if (key === 'G') tries.push(['gedtm', GEDTM_URL]);
      else {
        if (this.source !== 'copernicus' && inConus(la, lo)) tries.push(['usgs', usgsUrl(la, lo)]);
        if (this.source !== 'usgs' && this.source !== 'auto-bare') tries.push(['copernicus', copernicusUrl(la, lo)]);
      }
      this.cells.set(key, (async () => {
        for (const [name, url] of tries) {
          try {
            const tif = await this.open(url);
            const n = await tif.getImageCount();
            const images = [];
            for (let i = 0; i < n; i++) images.push(await tif.getImage(i));
            // Overviews carry no georeferencing of their own: same extent as the full image, coarser cells.
            const base = images[0];
            const [x0, , , y1] = base.getBoundingBox();
            const [dx0, dy0] = base.getResolution();
            const nodata = base.getGDALNoData();
            images.forEach((im, level) => {
              const sx = base.getWidth() / im.getWidth(), sy = base.getHeight() / im.getHeight();
              this.meta.set(`${key}|${level}`, { x0, y0: y1, dx: dx0 * sx, dy: dy0 * sy, w: im.getWidth(), h: im.getHeight(), tw: im.getTileWidth(), th: im.getTileHeight(), nodata });
            });
            return { name, url, images };
          } catch { /* next source */ }
        }
        return null; // no file: open sea
      })());
    }
    return this.cells.get(key);
  }

  // Which block of which cell holds (lat, lon) at `level`, and the pixel inside it. Cell must be open.
  locate(lat, lon, level) {
    const key = this.cellKey(lat, lon);
    const m = this.meta.get(`${key}|${level}`);
    if (!m) return null;
    const x = (lon - m.x0) / m.dx - 0.5, y = (lat - m.y0) / m.dy - 0.5; // pixel centres
    return { key, m, x, y };
  }

  /**
   * Make sure the blocks covering the given points are loaded. points: [[lat, lon, level], ...] (many points share a
   * block). onBlock(done, total) is called as blocks arrive (for the user's progress message).
   */
  async load(points, onBlock = () => {}) {
    for (const [lat, lon] of points) await this.openCell(lat, lon);
    const want = new Map();
    for (const [lat, lon, level] of points) {
      const p = this.locate(lat, lon, level);
      if (!p) continue;
      const { m } = p;
      for (const xx of [Math.floor(p.x), Math.floor(p.x) + 1]) for (const yy of [Math.floor(p.y), Math.floor(p.y) + 1]) {
        const bx = Math.floor(Math.min(Math.max(xx, 0), m.w - 1) / m.tw), by = Math.floor(Math.min(Math.max(yy, 0), m.h - 1) / m.th);
        const k = `${p.key}|${level}|${bx}|${by}`;
        if (!this.blocks.has(k)) want.set(k, { key: p.key, level, bx, by, m });
      }
    }
    const list = [...want.values()];
    let done = 0;
    onBlock(0, list.length);
    const worker = async () => {
      while (list.length) {
        const b = list.shift();
        const k = `${b.key}|${b.level}|${b.bx}|${b.by}`;
        const cell = await this.cells.get(b.key);
        const im = cell.images[b.level];
        const win = [b.bx * b.m.tw, b.by * b.m.th, Math.min((b.bx + 1) * b.m.tw, b.m.w), Math.min((b.by + 1) * b.m.th, b.m.h)];
        const r = await im.readRasters({ window: win, samples: [0] });
        this.blocks.set(k, { data: r[0], x0: win[0], y0: win[1], w: win[2] - win[0], h: win[3] - win[1] });
        onBlock(++done, want.size);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]); // four requests at a time
  }

  pixel(key, level, m, x, y) {
    x = Math.min(Math.max(x, 0), m.w - 1); y = Math.min(Math.max(y, 0), m.h - 1);
    const b = this.blocks.get(`${key}|${level}|${Math.floor(x / m.tw)}|${Math.floor(y / m.th)}`);
    if (!b) return NaN;
    const v = b.data[(y - b.y0) * b.w + (x - b.x0)];
    return v === m.nodata || v < -1000 || v > 1e30 ? 0 : v; // no data: the sea
  }

  // Bilinear elevation (m) at (lat, lon) from loaded blocks; 0 where there is no file (sea); NaN if not loaded.
  elevation(lat, lon, level = 0) {
    const p = this.locate(lat, lon, level);
    if (!p) return this.cells.has(this.cellKey(lat, lon)) ? 0 : NaN;
    const { key, m, x, y } = p;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const a = this.pixel(key, level, m, x0, y0), b = this.pixel(key, level, m, x0 + 1, y0);
    const c = this.pixel(key, level, m, x0, y0 + 1), d = this.pixel(key, level, m, x0 + 1, y0 + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }

  // Cell size (m) of a level near a latitude.
  cellSizeM(lat, level) {
    for (const [k, m] of this.meta) if (k.endsWith(`|${level}`)) return Math.abs(m.dy) * 111320;
    return 30 * 2 ** level;
  }
}
