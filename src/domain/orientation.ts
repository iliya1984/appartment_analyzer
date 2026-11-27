import { he } from '@/i18n/he';
import { mod } from './format';

/** Facade orientation in degrees clockwise from north, in 45° steps. */
export const ORIENTATIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const DIRS: readonly string[] = he.directions;

export const isOrientation = (v: unknown): v is Orientation =>
  typeof v === 'number' && (ORIENTATIONS as readonly number[]).includes(v);

/** Nearest compass point name for an azimuth in degrees. */
export const dirName = (deg: number): string => DIRS[Math.round(mod(deg, 360) / 45) % 8] ?? '';
