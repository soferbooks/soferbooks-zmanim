// Upper-air experiment, rerun on all 2,209 observed sunrises (2026-11-11): the current benchmark's normals against
// ERA5's air at the moment of sunrise, with three checks: Rav Zuriel split at 1979 (ERA5 has no satellite data before),
// the coastal near point moved inland, and a blend of the normals with the path's refraction, weighted leave-one-observer-out.
import { readFileSync } from 'node:fs';
const Z = new URL('../../', import.meta.url).href;
const { visibleRiseSet } = await import(Z + 'src/terrain/visible.js');
const { stationPressure, normalForDay } = await import(Z + 'src/refraction.js');
const { makeAtmosphere, refractionTable, traceRefraction } = await import(Z + 'src/raytrace.js');
const R = new URL('../../test/fixtures/', import.meta.url);
const fx = JSON.parse(readFileSync(new URL('observations.json', R)));
const skies = JSON.parse(readFileSync(new URL('fixture-skylines-observations-1200-auto-bare.json', R)));
const NORM = JSON.parse(readFileSync(new URL('fixture-climate-israel.json', R))).sites;
const P = JSON.parse(readFileSync(new URL('./profiles.json', import.meta.url))).rows;

const STEP = 25, TOP = 5500;
function column(pr) {
  const lv = [{ h: pr.surface.h, t: pr.surface.t }, ...pr.levels].sort((a, b) => a.h - b.h);
  const tAt = (h) => { if (h < lv[0].h) return null; for (let i = 1; i < lv.length; i++) if (h <= lv[i].h) { const f = (h - lv[i - 1].h) / (lv[i].h - lv[i - 1].h); return lv[i - 1].t + f * (lv[i].t - lv[i - 1].t); } return null; };
  return { tAt, ground: lv[0].h, sfcP: pr.surface.p };
}
function atmosphereOf(prs, lat) {
  const cols = prs.map(column), levels = [];
  const lowest = Math.min(...cols.map((c) => c.ground));
  for (let h = Math.ceil(lowest / STEP) * STEP; h <= TOP; h += STEP) {
    const ts = cols.map((c) => c.tAt(h)).filter((v) => v !== null);
    if (ts.length) levels.push({ h, t: ts.reduce((a, b) => a + b, 0) / ts.length });
  }
  const c0 = cols[0];
  return makeAtmosphere(levels, { h: c0.ground, p: c0.sfcP }, { lat });
}
const climateAt = (id, date, eye) => {
  const c = NORM[id === 'zuriel' ? 'telaviv' : 'jerusalem'];
  const t = normalForDay(c.tempC, date), p = normalForDay(c.pressure, date);
  return { tempC: t - 0.0065 * (eye - c.elevation), pressure: (p * stationPressure(1, eye)) / stationPressure(1, c.elevation) };
};
// The normals ray traced through a standard atmosphere (6.5 K/km): the same tracer, so path / this is the morning's layering.
const stdAtm = (c, eye, lat) => makeAtmosphere([{ h: eye - 300, t: c.tempC + 1.95 }, { h: eye + 6000, t: c.tempC - 39 }], { h: eye, p: c.pressure }, { lat });

const res = [];
for (const o of P) {
  const site = fx.sites[o.site], sky = skies[o.site], eye = sky.vantage.eye;
  const [y, m, d] = o.date.split('-').map(Number), [hh, mi, ss] = o.time.split(':').map(Number);
  const obs = Date.UTC(y, m - 1, d, hh - 2, mi, ss);
  const base = climateAt(o.site, { y, m, d }, eye);
  let A;
  try {
    A = { near: atmosphereOf([o.profiles[0]], site.lat), path: atmosphereOf(o.profiles, site.lat),
      land: atmosphereOf([o.land], site.lat), landPath: atmosphereOf([o.land, ...o.profiles.slice(1)], site.lat), std: stdAtm(base, eye, site.lat) };
  } catch { continue; }
  const tr = Object.fromEntries(Object.entries(A).map(([k, a]) => { try { return [k, traceRefraction(a, eye, 0)]; } catch { return [k, NaN]; } }));
  if (!Object.values(tr).every((v) => Number.isFinite(v) && v > 0 && v < 3)) continue;
  const run = (refraction) => { const v = visibleRiseSet({ y, m, d }, sky, { refraction }).sunrise; return v ? (obs - v.raw) / 1000 : null; };
  const r = {
    id: o.site, y, kP: tr.path / tr.std, kLP: tr.landPath / tr.std,
    normals: run({ sunrise: base }),
    tracedNear: run({ sunrise: refractionTable(A.near, eye) }),
    tracedPath: run({ sunrise: refractionTable(A.path, eye) }),
    tracedLand: run({ sunrise: refractionTable(A.land, eye) }),
    tracedLandPath: run({ sunrise: refractionTable(A.landPath, eye) }),
  };
  if (Object.values(r).some((v) => v === null) || Math.abs(r.normals) > 300) continue;
  res.push(r);
}
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const rms = (v) => Math.sqrt(mean(v.map((b) => b * b)));
const f = (v) => `n ${String(v.length).padStart(4)}  mean ${mean(v).toFixed(1).padStart(5)} s  rms ${rms(v).toFixed(1).padStart(4)} s`;
const groups = {
  druk: (r) => r.id === 'druk', golan: (r) => r.id === 'golan', zuriel: (r) => r.id === 'zuriel',
  'zuriel<1979': (r) => r.id === 'zuriel' && r.y < 1979, 'zuriel>=1979': (r) => r.id === 'zuriel' && r.y >= 1979, all: () => true,
};
const M = ['normals', 'tracedNear', 'tracedPath', 'tracedLand', 'tracedLandPath'];
for (const [g, test] of Object.entries(groups)) {
  const sub = res.filter(test);
  for (const k of M) console.log(g.padEnd(13), k.padEnd(15), f(sub.map((r) => r[k])));
}
// Blend the two computed sunrises: (1 - w) x normals + w x that morning's path (residuals blend the same way).
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((b) => (b - m) ** 2))); };
const WS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
for (const kk of ['tracedPath', 'tracedLandPath']) {
  const at = (r, w) => (1 - w) * r.normals + w * r[kk];
  console.log(`\nblend of normals with ${kk}: rms (sd without the bias) by weight`);
  for (const [g, test] of Object.entries(groups)) {
    const sub = res.filter(test);
    console.log(g.padEnd(13), WS.map((w) => `${w}:${rms(sub.map((r) => at(r, w))).toFixed(1)}(${sd(sub.map((r) => at(r, w))).toFixed(1)})`).join(' '));
  }
  for (const id of ['druk', 'golan', 'zuriel']) {
    const train = res.filter((r) => r.id !== id), test = res.filter((r) => r.id === id);
    const w = WS.reduce((b, w) => (rms(train.map((r) => at(r, w))) < rms(train.map((r) => at(r, b))) ? w : b), 0);
    console.log(`  leave out ${id}: weight ${w} -> ${id} rms ${rms(test.map((r) => at(r, w))).toFixed(1)} s (normals ${rms(test.map((r) => r.normals)).toFixed(1)} s)`);
  }
}
