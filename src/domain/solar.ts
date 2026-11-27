import { he } from '@/i18n/he';
import { mod } from './format';

/** Haifa latitude (degrees). */
export const HAIFA_LAT = 32.8;

export interface SunPosition {
  /** Elevation above the horizon, degrees. */
  el: number;
  /** Azimuth clockwise from north, degrees. */
  az: number;
}

/**
 * Simple solar position model (declination + hour angle), using solar time.
 * @param hour solar hour 0–24
 * @param dayOfYear 1–365
 */
export function solarPosition(hour: number, dayOfYear: number, lat = HAIFA_LAT): SunPosition {
  const r = Math.PI / 180;
  const dec = 23.44 * Math.sin(((r * 360) / 365) * (dayOfYear - 81));
  const H = 15 * (hour - 12);
  const sinE =
    Math.sin(lat * r) * Math.sin(dec * r) + Math.cos(lat * r) * Math.cos(dec * r) * Math.cos(H * r);
  const e = Math.asin(Math.max(-1, Math.min(1, sinE)));
  let cA = (Math.sin(dec * r) - sinE * Math.sin(lat * r)) / (Math.cos(e) * Math.cos(lat * r));
  cA = Math.max(-1, Math.min(1, cA));
  let az = Math.acos(cA) / r;
  if (H > 0) az = 360 - az;
  return { el: e / r, az };
}

export type SeasonKey = 'winter' | 'equinox' | 'summer';

export const SEASONS: Readonly<Record<SeasonKey, { name: string; dayOfYear: number }>> = {
  winter: { name: he.seasons.winter, dayOfYear: 355 },
  equinox: { name: he.seasons.equinox, dayOfYear: 80 },
  summer: { name: he.seasons.summer, dayOfYear: 172 },
};

export const SEASON_KEYS: readonly SeasonKey[] = ['winter', 'equinox', 'summer'];

/**
 * Estimated hours of direct sun on the living-room facades (front facade at `facadeAz` and the
 * side facade 90° counter-clockwise), ignoring shading by neighbouring buildings.
 */
export function sunHours(facadeAz: number, dayOfYear: number): number {
  const normals = [facadeAz, mod(facadeAz + 270, 360)];
  let h = 0;
  for (let t = 5; t < 20; t += 0.25) {
    const s = solarPosition(t, dayOfYear);
    if (s.el < 6) continue;
    if (normals.some((n) => Math.cos(((s.az - n) * Math.PI) / 180) > 0.15)) h += 0.25;
  }
  return h;
}

/** "09:15" for 9.25. */
export function formatSolarHour(hour: number): string {
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
