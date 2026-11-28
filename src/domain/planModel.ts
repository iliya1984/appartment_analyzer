/**
 * Plan models: an apartment type's real geometry, extracted from the sales plans by
 * scripts/plans/extract-model.mjs. Coordinates are centimetres in plan space: +x = right on
 * the sheet, +y = down on the sheet. With northDeg = 0 the top of the sheet is north.
 * Shapes are unions of axis-aligned rectangles [x, y, w, h] (the extractor works on a raster).
 */
import type { Orientation } from './orientation';
import type { Apartment } from './types';

export type Rect = readonly [x: number, y: number, w: number, h: number];

export type PlanRoomType =
  | 'salon'
  | 'kitchen'
  | 'dining'
  | 'master'
  | 'bed'
  | 'mamad'
  | 'bath'
  | 'wc'
  | 'service'
  | 'storage'
  | 'hall'
  | 'balcony'
  | 'garden'
  | 'roof-terrace'
  | 'other';

export type OpeningKind = 'door' | 'entrance' | 'window' | 'slider';

export interface PlanRoom {
  id: string;
  type: PlanRoomType;
  /** Hebrew name(s); open-plan spaces list several ("סלון, מטבח"). */
  label: string;
  rects: readonly Rect[];
  areaM2: number;
  /** Label point inside the room. */
  center: readonly [number, number];
  /**
   * Clear dimensions (cm, width × depth): written on the 1:50 sheet, or measured from the traced
   * 1:100 drawing for rectangular rooms.
   */
  dims?: readonly [number, number];
}

export interface PlanOutdoor extends PlanRoom {
  covered: boolean;
}

export interface PlanOpening {
  kind: OpeningKind;
  rect: Rect;
  /** cm above the floor */
  sill: number;
  head: number;
}

export const FURNITURE_KINDS = [
  'bed-double',
  'bed-single',
  'wardrobe',
  'desk',
  'sofa',
  'table',
  'coffee-table',
  'tv',
  'counter',
  'fridge',
  'toilet',
  'sink',
  'bathtub',
  'shower',
  'washer',
] as const;
export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

/** Compass side of the plan (n = top of the sheet). */
export type PlanSide = 'n' | 'e' | 's' | 'w';

/** A piece of furniture, for illustration only. */
export interface PlanFurniture {
  kind: FurnitureKind;
  rect: Rect;
  /** Side of the backrest / headboard / the wall it stands against. */
  side?: PlanSide;
}

/**
 * How the model was made: 'measured' = walls and rooms read off the sheet and checked against
 * its dimension labels (scripts/plans/measured); 'vector' = traced from the line work of the
 * 1:100 sheets (scripts/plans/extract-vector.mjs); 'layers' / 'colors' = raster extraction.
 */
export type ModelMethod = 'measured' | 'vector' | 'layers' | 'colors';

export interface PlanModel {
  planType: string;
  source: { file: string; page: number; scale: 50 | 100; method: ModelMethod };
  unitsCm: true;
  northDeg: number;
  bounds: readonly [number, number];
  entrance: readonly [number, number] | null;
  walls: readonly Rect[];
  openings: readonly PlanOpening[];
  rooms: readonly PlanRoom[];
  outdoor: readonly PlanOutdoor[];
  /** Balcony railings / parapets (1.05 m). */
  rails?: readonly Rect[];
  furniture?: readonly PlanFurniture[];
}

/** Rooms that count in the apartment's room number ("5 rooms" = salon + 3 bedrooms + mamad). */
const COUNTED: ReadonlySet<PlanRoomType> = new Set(['salon', 'master', 'bed', 'mamad']);

export const rectArea = (r: Rect): number => r[2] * r[3];
export const rectsArea = (rs: readonly Rect[]): number => rs.reduce((s, r) => s + rectArea(r), 0);

/** Net indoor floor area (m²), walls excluded. */
export const netArea = (m: PlanModel): number => m.rooms.reduce((s, r) => s + r.areaM2, 0);
export const outdoorArea = (m: PlanModel): number => m.outdoor.reduce((s, r) => s + r.areaM2, 0);
export const countedRooms = (m: PlanModel): number =>
  m.rooms.filter((r) => COUNTED.has(r.type)).length;

/** Overall size of the drawn unit (m). */
export const modelSize = (m: PlanModel): { w: number; d: number } => ({
  w: m.bounds[0] / 100,
  d: m.bounds[1] / 100,
});

export interface ModelIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Sanity checks against the dataset. The contract area includes the walls, so the net room
 * area is expected at 75–95 % of it (small units have relatively more wall); outdoor areas within ±10 %.
 */
export function validateModel(
  m: PlanModel,
  apartments: readonly Pick<Apartment, 'area' | 'outdoor' | 'rooms' | 'planType'>[],
): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const same = apartments.filter((a) => a.planType === m.planType);
  const net = netArea(m);
  for (const r of [...m.rooms, ...m.outdoor]) {
    const area = rectsArea(r.rects) / 10000;
    if (Math.abs(area - r.areaM2) > 0.15)
      issues.push({
        level: 'error',
        message: `${r.id}: area ${r.areaM2} ≠ rects ${area.toFixed(2)}`,
      });
  }
  for (const a of same) {
    const ratio = net / a.area;
    if (ratio < 0.75 || ratio > 0.95)
      issues.push({
        level: 'error',
        message: `net ${net.toFixed(1)} m² vs contract ${a.area} m² (${(ratio * 100).toFixed(0)}%)`,
      });
    if (a.outdoor > 0 && m.outdoor.length) {
      const o = outdoorArea(m) / a.outdoor;
      if (o < 0.9 || o > 1.1)
        issues.push({
          level: 'warn',
          message: `outdoor ${outdoorArea(m).toFixed(1)} m² vs ${a.outdoor} m²`,
        });
    }
    // a "half room" (x.5 rooms) is drawn as a small bedroom, so x or x + 1 counted rooms
    const counted = countedRooms(m);
    if (counted < Math.floor(a.rooms) || counted > Math.ceil(a.rooms))
      issues.push({ level: 'error', message: `${counted} rooms vs ${a.rooms}` });
  }
  const inBounds = (r: Rect) =>
    r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= m.bounds[0] + 1 && r[1] + r[3] <= m.bounds[1] + 1;
  if (!m.walls.every(inBounds) || !m.openings.every((o) => inBounds(o.rect)))
    issues.push({ level: 'error', message: 'geometry outside bounds' });
  for (const o of m.openings)
    if (o.sill < 0 || o.head <= o.sill || o.head > 300)
      issues.push({ level: 'error', message: `bad opening heights ${o.sill}–${o.head}` });
  return issues;
}

/** Mirror image of a model (left ↔ right), for plan types drawn as mirrored pairs. */
export function mirrorModel(m: PlanModel, planType: string): PlanModel {
  const W = m.bounds[0];
  const fx = (r: Rect): Rect => [W - r[0] - r[2], r[1], r[2], r[3]];
  const fp = (p: readonly [number, number]): [number, number] => [W - p[0], p[1]];
  const room = <R extends PlanRoom>(r: R): R => ({
    ...r,
    rects: r.rects.map(fx),
    center: fp(r.center),
  });
  return {
    ...m,
    planType,
    entrance: m.entrance ? fp(m.entrance) : null,
    walls: m.walls.map(fx),
    openings: m.openings.map((o) => ({ ...o, rect: fx(o.rect) })),
    rooms: m.rooms.map(room),
    outdoor: m.outdoor.map(room),
    ...(m.rails ? { rails: m.rails.map(fx) } : {}),
    ...(m.furniture
      ? {
          furniture: m.furniture.map((f) => ({
            ...f,
            rect: fx(f.rect),
            ...(f.side ? { side: MIRROR_SIDE[f.side] } : {}),
          })),
        }
      : {}),
  };
}

const MIRROR_SIDE: Readonly<Record<PlanSide, PlanSide>> = { n: 'n', s: 's', e: 'w', w: 'e' };

/**
 * Largest gap (cm) between a room's drawn dimensions and its measured rectangles: the room's
 * biggest rectangle is compared with the label in either orientation. null when the sheet
 * gives no dimensions for the room.
 */
export function dimsDeviation(r: PlanRoom): number | null {
  if (!r.dims) return null;
  const big = r.rects.reduce((m, q) => (q[2] * q[3] > m[2] * m[3] ? q : m));
  const [a, b] = r.dims;
  const straight = Math.max(Math.abs(big[2] - a), Math.abs(big[3] - b));
  const turned = Math.max(Math.abs(big[2] - b), Math.abs(big[3] - a));
  return Math.min(straight, turned);
}

const rectCenter = (r: Rect): [number, number] => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const near = (r: Rect, p: readonly [number, number], pad: number) =>
  p[0] >= r[0] - pad &&
  p[0] <= r[0] + r[2] + pad &&
  p[1] >= r[1] - pad &&
  p[1] <= r[1] + r[3] + pad;

/**
 * Compass direction (0 = N, 90 = E …, snapped to 45°) the salon's glazing faces, from the
 * salon's windows / sliders. null when the salon has none.
 */
export function salonFacade(m: PlanModel): Orientation | null {
  const salon = m.rooms.find((r) => r.type === 'salon');
  if (!salon) return null;
  let best: { len: number; dir: number } | null = null;
  for (const o of m.openings) {
    if (o.kind !== 'window' && o.kind !== 'slider') continue;
    const c = rectCenter(o.rect);
    if (!salon.rects.some((r) => near(r, c, 40))) continue;
    const len = Math.max(o.rect[2], o.rect[3]);
    // outward = from the salon centre towards the opening, along the opening's normal
    const horizontal = o.rect[2] >= o.rect[3];
    const dx = horizontal ? 0 : Math.sign(c[0] - salon.center[0]);
    const dy = horizontal ? Math.sign(c[1] - salon.center[1]) : 0;
    const dir = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (!best || len > best.len) best = { len, dir };
  }
  if (!best) return null;
  const deg = (((best.dir + m.northDeg) % 360) + 360) % 360;
  return ((Math.round(deg / 45) * 45) % 360) as Orientation;
}

/** True when the 2D point (cm) is inside a wall (walk-through collision). */
export function hitsWall(m: PlanModel, x: number, y: number, radius = 20): boolean {
  return m.walls.some(
    (r) =>
      x + radius > r[0] &&
      x - radius < r[0] + r[2] &&
      y + radius > r[1] &&
      y - radius < r[1] + r[3],
  );
}

/** A start point just inside the entrance (cm), or the salon centre. */
export function startPoint(m: PlanModel): [number, number] {
  const salon = m.rooms.find((r) => r.type === 'salon') ?? m.rooms[0];
  const target = salon?.center ?? [m.bounds[0] / 2, m.bounds[1] / 2];
  if (!m.entrance) return [target[0], target[1]];
  const [ex, ey] = m.entrance;
  const len = Math.hypot(target[0] - ex, target[1] - ey) || 1;
  // 1.2 m inside, towards the salon
  return [ex + ((target[0] - ex) / len) * 120, ey + ((target[1] - ey) / len) * 120];
}
