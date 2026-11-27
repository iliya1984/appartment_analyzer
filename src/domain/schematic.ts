import { he } from '@/i18n/he';
import type { Apartment } from './types';

/**
 * Schematic room layout generated from area and room count. It is NOT the contractor's real
 * floor plan; it only gives a sense of proportions for the 3D view and the rooms table.
 */
export type RoomKey =
  'salon' | 'master' | 'kit' | 'bath' | 'bath2' | 'wc' | 'mamad' | 'bed' | 'bed2' | 'bed3' | 'svc';

/** Window flags: F = front facade, S = side facade. */
export type WindowFlags = '' | 'F' | 'S' | 'FS';

/** [key, name, x0, z0, x1, z1, windows] — coordinates are fractions of width / depth. */
type LayoutCell = readonly [RoomKey, string, number, number, number, number, WindowFlags];

const R = he.rooms;

export const LAYOUT: Readonly<Record<3 | 4 | 5 | 6, readonly LayoutCell[]>> = {
  3: [
    ['salon', R.salon, 0, 0, 0.5, 0.55, 'FS'],
    ['master', R.master, 0.5, 0, 1, 0.55, 'F'],
    ['kit', R.kit, 0, 0.55, 0.35, 1, 'S'],
    ['bath', R.bath, 0.35, 0.55, 0.55, 1, ''],
    ['mamad', R.mamad3, 0.55, 0.55, 1, 1, ''],
  ],
  4: [
    ['salon', R.salon, 0, 0, 0.45, 0.52, 'FS'],
    ['bed', R.bed, 0.45, 0, 0.7, 0.52, 'F'],
    ['master', R.master, 0.7, 0, 1, 0.52, 'F'],
    ['kit', R.kit, 0, 0.52, 0.3, 1, 'S'],
    ['bath', R.bath, 0.3, 0.52, 0.48, 1, ''],
    ['wc', R.wc, 0.48, 0.52, 0.6, 1, ''],
    ['mamad', R.mamad, 0.6, 0.52, 1, 1, ''],
  ],
  5: [
    ['salon', R.salon, 0, 0, 0.38, 0.5, 'FS'],
    ['bed', R.bed, 0.38, 0, 0.57, 0.5, 'F'],
    ['bed2', R.bed, 0.57, 0, 0.77, 0.5, 'F'],
    ['master', R.master, 0.77, 0, 1, 0.5, 'F'],
    ['kit', R.kit, 0, 0.5, 0.28, 1, 'S'],
    ['bath', R.bath, 0.28, 0.5, 0.42, 1, ''],
    ['wc', R.wc, 0.42, 0.5, 0.52, 1, ''],
    ['mamad', R.mamad, 0.52, 0.5, 0.76, 1, ''],
    ['svc', R.svc, 0.76, 0.5, 1, 1, ''],
  ],
  6: [
    ['salon', R.salon, 0, 0, 0.3, 0.5, 'FS'],
    ['bed', R.bed, 0.3, 0, 0.46, 0.5, 'F'],
    ['bed2', R.bed, 0.46, 0, 0.62, 0.5, 'F'],
    ['bed3', R.bed, 0.62, 0, 0.8, 0.5, 'F'],
    ['master', R.master, 0.8, 0, 1, 0.5, 'F'],
    ['kit', R.kit, 0, 0.5, 0.22, 1, 'S'],
    ['bath', R.bath, 0.22, 0.5, 0.34, 1, ''],
    ['wc', R.wc, 0.34, 0.5, 0.42, 1, ''],
    ['mamad', R.mamad, 0.42, 0.5, 0.62, 1, ''],
    ['svc', R.svc, 0.62, 0.5, 0.8, 1, ''],
    ['bath2', R.bath2, 0.8, 0.5, 1, 1, ''],
  ],
};

export const ROOM_COLOR: Readonly<Record<RoomKey, string>> = {
  salon: '#d2b98f',
  kit: '#dcd7cb',
  bed: '#d6e0e8',
  bed2: '#d6e0e8',
  bed3: '#d6e0e8',
  master: '#cdd9e6',
  bath: '#b9d3d9',
  bath2: '#b9d3d9',
  wc: '#b9d3d9',
  mamad: '#c9c6d6',
  svc: '#d5d5d5',
};

/** Width / depth aspect ratio per layout size. */
const ASPECT: Readonly<Record<3 | 4 | 5 | 6, number>> = { 3: 1.45, 4: 1.55, 5: 1.7, 6: 1.9 };

export interface LayoutRoom {
  k: RoomKey;
  name: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  win: WindowFlags;
  /** width (x extent), metres */
  w: number;
  /** depth (z extent), metres */
  d: number;
}

export interface ApartmentLayout {
  /** Overall width (front facade length), metres. */
  W: number;
  /** Overall depth, metres. */
  D: number;
  rooms: LayoutRoom[];
}

export const layoutKey = (rooms: number): 3 | 4 | 5 | 6 =>
  Math.max(3, Math.min(6, Math.floor(rooms))) as 3 | 4 | 5 | 6;

export function layoutFor(apartment: Pick<Apartment, 'rooms' | 'area'>): ApartmentLayout {
  const key = layoutKey(apartment.rooms);
  const D = Math.sqrt(apartment.area / ASPECT[key]);
  const W = apartment.area / D;
  return {
    W,
    D,
    rooms: LAYOUT[key].map(([k, name, a, b, c, d, win]) => ({
      k,
      name,
      x0: a * W,
      z0: b * D,
      x1: c * W,
      z1: d * D,
      win,
      w: (c - a) * W,
      d: (d - b) * D,
    })),
  };
}
