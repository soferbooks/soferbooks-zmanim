// The traditional molad and the time for Kiddush Levana.
// The molad of the Hebrew calendar is arithmetic: BaHaRaD (Sunday 23:11:20, Jerusalem mean time, before 1 Tishrei of year
// 1) plus whole months of 29 days 12 hours 793 parts (a part = 1/1080 hour). Reingold & Dershowitz, Calendrical
// Calculations, "molad". Jerusalem mean time is the Sun's time at Jerusalem's longitude (35.2333° E): UT + 2:20:56.
const DAY = 86400000;
const MONTH_DAYS = 29.5 + 793 / 25920;
const MOLAD_TOHU_JD = -1373427 + 1721424.5 - 876 / 25920; // JD of molad BaHaRaD, Jerusalem mean time
const JERUSALEM_MEAN = (35.2333 / 15) * 3600000; // ms ahead of UT
const msOfJD = (jd) => (jd - 2440587.5) * DAY;
/** The traditional molad (epoch ms, UT) at or before the moment ms. */
export function traditionalMolad(ms) {
  const jdLocal = (ms + JERUSALEM_MEAN) / DAY + 2440587.5;
  const n = Math.floor((jdLocal - MOLAD_TOHU_JD) / MONTH_DAYS);
  return msOfJD(MOLAD_TOHU_JD + n * MONTH_DAYS) - JERUSALEM_MEAN;
}
/**
 * The Kiddush Levana window of the lunar month whose molad is at or before ms (epoch ms, UT):
 * from3 / from7 (3 or 7 full days after the molad), untilHalf (half a month after it: 14 days 18 hours 22 minutes 1⅔ s,
 * the Rema) and until15 (15 full days, the Shulchan Aruch).
 */
export function kiddushLevana(ms) {
  const m = traditionalMolad(ms);
  return { molad: m, from3: m + 3 * DAY, from7: m + 7 * DAY, untilHalf: m + (MONTH_DAYS / 2) * DAY, until15: m + 15 * DAY };
}
