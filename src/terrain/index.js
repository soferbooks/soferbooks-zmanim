// Visible sunrise / sunset over the real terrain around a place: the entry points.
//   const sky = await prepareVisibleHorizon(place, { onProgress });   // once per location, in the background
//   const v = visibleTimes(date, sky, refraction);                     // each day: { sunrise, sunset } (ms) + flags
//   dayZmanim(date, place, { visible: v, ... })
// While it is being prepared an app can show level times and tells the user what is happening (a design decision): every
// progress report carries a `message` for the status line and a `percent` for a bar.
import { computeHorizonSet } from './skyline.js';
import { visibleRiseSet } from './visible.js';
import { destination } from './skyline.js';

export const MESSAGES = {
  start: 'Preparing the visible sunrise for this place. Until it is ready, sunrise and sunset are for a level horizon.',
  vantage: 'Visible sunrise: finding the highest point nearby…',
  download: (done, total) => `Visible sunrise: downloading the terrain map, ${done} of ${total} parts (once for this place)…`,
  skyline: (done, total) => `Visible sunrise: working out the skyline from high point ${Math.min(done + 1, total)} of ${total}…`,
  done: 'Visible sunrise ready.',
  failed: 'Could not prepare the visible sunrise (no connection?). Showing sunrise over a level horizon; it will try again.',
};
// Share of the work each phase takes, for the progress bar.
const WEIGHT = { vantage: [0, 5], download: [5, 60], candidates: [60, 100] };

/**
 * Compute (or recompute) the skylines for a place, as Chai Tables does (a design decision): from the 8 highest local high
 * points within a techum; each day the earliest sunrise and the latest sunset of any of them. onProgress({ phase,
 * percent, message }) as it goes. Resolves to the set (JSON-safe, ~20 KB per kept high point: cache it with the place).
 * Rejects on failure after reporting MESSAGES.failed.
 */
export async function prepareVisibleHorizon(place, { onProgress = () => {}, ...opts } = {}) {
  onProgress({ phase: 'start', percent: 0, message: MESSAGES.start });
  try {
    let started = false; // later high points may fetch a block or two more: report downloads only before the first skyline
    return await computeHorizonSet(place, opts, ({ phase, done, total }) => {
      if (phase === 'done') return onProgress({ phase, percent: 100, message: MESSAGES.done });
      if (phase === 'candidates') started = true;
      if (phase === 'download' && started) return;
      const [a, b] = WEIGHT[phase] ?? [0, 100];
      const percent = Math.round(a + ((b - a) * (total ? done / total : 0)));
      const message = phase === 'download' ? MESSAGES.download(done, total) : phase === 'candidates' ? MESSAGES.skyline(done, total) : MESSAGES[phase];
      onProgress({ phase, percent, message });
    });
  } catch (e) {
    onProgress({ phase: 'failed', percent: 0, message: MESSAGES.failed, error: e });
    throw e;
  }
}

// Whether a cached skyline still belongs to this place (it moved less than 100 m).
export function skylineFits(sky, place, metres = 100) {
  if (!sky?.place) return false;
  const [la, lo] = destination(sky.place.lat, sky.place.lon, 0, 0);
  const dLat = (place.lat - la) * 111320, dLon = (place.lon - lo) * 111320 * Math.cos((place.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLon) < metres;
}

/**
 * The day's visible sunrise and sunset for dayZmanim's cfg.visible, plus what the list can say about them:
 * { sunrise, sunset (epoch ms, cushion included, or null), sunriseNear, sunsetNear (ground within 6 km decides it),
 *   sunriseFar, sunsetFar (only mountains a day's walk away; null when the set has no far skylines) }.
 */
export function visibleTimes(date, sky, refraction) {
  const v = visibleRiseSet(date, sky, { refraction });
  // Rabbi Diskin's horizon (only mountains a day's walk away), when the set has it: from the highest points within a
  // techum, the nearer hills disregarded; where no far mountain rises into view, the sea-level horizon from there.
  const hasFar = !!sky.candidates?.length && sky.candidates.every((c) => c.far);
  const f = hasFar ? visibleRiseSet(date, sky, { refraction, far: true }) : null;
  return {
    sunrise: v.sunrise?.time ?? null, sunset: v.sunset?.time ?? null,
    sunriseFar: hasFar ? f.sunrise?.time ?? null : null, sunsetFar: hasFar ? f.sunset?.time ?? null : null,
    sunriseNear: !!v.sunrise?.near, sunsetNear: !!v.sunset?.near,
    detail: v,
  };
}
