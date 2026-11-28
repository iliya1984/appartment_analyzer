import type { Apartment } from './types';

/** Fields the apartments list can be sorted by. */
export const SORT_FIELDS = [
  'pricePerSqm',
  'delta',
  'price',
  'rooms',
  'floor',
  'area',
  'outdoor',
  'storageArea',
  'building',
  'number',
  'planType',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDir = 'asc' | 'desc';

export interface SortLevel {
  field: SortField;
  dir: SortDir;
}

/** Ordered sort levels: the first decides, later ones break ties. Never empty. */
export type SortSpec = readonly SortLevel[];

export const MAX_SORT_LEVELS = 4;

/** Quick-sort presets (the legacy single-key sort orders). */
export const SORT_KEYS = ['ppsqm', 'delta', 'priceA', 'priceD', 'area', 'floor', 'id'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_PRESETS: Readonly<Record<SortKey, SortSpec>> = Object.freeze({
  ppsqm: [{ field: 'pricePerSqm', dir: 'asc' }],
  delta: [{ field: 'delta', dir: 'asc' }],
  priceA: [{ field: 'price', dir: 'asc' }],
  priceD: [{ field: 'price', dir: 'desc' }],
  area: [{ field: 'area', dir: 'desc' }],
  floor: [{ field: 'floor', dir: 'desc' }],
  id: [
    { field: 'building', dir: 'asc' },
    { field: 'number', dir: 'asc' },
  ],
});

export const DEFAULT_SORT: SortSpec = SORT_PRESETS.ppsqm;

export const isSortKey = (v: unknown): v is SortKey =>
  typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);

export const isSortField = (v: unknown): v is SortField =>
  typeof v === 'string' && (SORT_FIELDS as readonly string[]).includes(v);

export const sameSpec = (a: SortSpec, b: SortSpec): boolean =>
  a.length === b.length && a.every((l, i) => l.field === b[i]?.field && l.dir === b[i].dir);

/** The preset whose levels equal `spec`, or null for a custom order. */
export function presetOf(spec: SortSpec): SortKey | null {
  return SORT_KEYS.find((k) => sameSpec(SORT_PRESETS[k], spec)) ?? null;
}

type Comparator = (a: Apartment, b: Apartment) => number;

/** Ascending compare in which `null` always sorts last, whatever the direction. */
function compareNullable<T extends number | string>(
  x: T | null | undefined,
  y: T | null | undefined,
  dir: SortDir,
): number {
  const xNull = x == null;
  const yNull = y == null;
  if (xNull || yNull) return xNull === yNull ? 0 : xNull ? 1 : -1;
  const c = x < y ? -1 : x > y ? 1 : 0;
  return dir === 'asc' ? c : -c;
}

const KIND_ORDER: Readonly<Record<string, number>> = { T: 0, G: 1, P: 2 };
const PLAN_RE = /^T-(?<kind>[TGP])(?<rooms>\d+(?:\.\d+)?)(?<rest>.*)$/;

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

interface PlanParts {
  kind: number;
  rooms: number;
  rest: string;
}

function planParts(code: string): PlanParts | null {
  const g = PLAN_RE.exec(code)?.groups;
  if (!g) return null;
  return {
    kind: KIND_ORDER[g.kind ?? ''] ?? 9,
    rooms: Number(g.rooms),
    rest: g.rest ?? '',
  };
}

/**
 * Natural order of plan types: kind (regular, garden, penthouse), then rooms as a number,
 * then the letter. Codes that do not follow the `T-<kind><rooms><letter>` pattern go last,
 * in plain string order.
 */
export function comparePlanType(a: string, b: string): number {
  const pa = planParts(a);
  const pb = planParts(b);
  if (!pa || !pb) {
    if (pa) return -1;
    if (pb) return 1;
    return compareStrings(a, b);
  }
  return pa.kind - pb.kind || pa.rooms - pb.rooms || compareStrings(pa.rest, pb.rest);
}

function levelComparator(level: SortLevel, buildingOrder: ReadonlyMap<string, number>): Comparator {
  const { dir } = level;
  const by =
    (get: (a: Apartment) => number | null | undefined): Comparator =>
    (a, b) =>
      compareNullable(get(a), get(b), dir);
  switch (level.field) {
    case 'pricePerSqm':
      return by((a) => a.pricePerSqm);
    case 'delta':
      return by((a) => a.comparison?.delta);
    case 'price':
      return by((a) => a.price);
    case 'rooms':
      return by((a) => a.rooms);
    case 'floor':
      return by((a) => a.floor);
    case 'area':
      return by((a) => a.area);
    case 'outdoor':
      return by((a) => a.outdoor);
    case 'storageArea':
      return by((a) => a.storage.area);
    case 'building':
      // Display order; buildings missing from the map sort first (as the legacy `id` sort did).
      return by((a) => buildingOrder.get(a.building) ?? -1);
    case 'number':
      return by((a) => a.number);
    case 'planType':
      return (a, b) => {
        const c = comparePlanType(a.planType, b.planType);
        return dir === 'asc' ? c : -c;
      };
  }
}

/**
 * Chains the comparators of every level. `buildingOrder` maps building id → display index.
 * The sort is stable, so apartments equal on every level keep the input (workbook) order.
 */
export function comparatorFor(
  spec: SortSpec,
  buildingOrder: ReadonlyMap<string, number>,
): Comparator {
  const cmps = spec.map((l) => levelComparator(l, buildingOrder));
  return (a, b) => {
    for (const cmp of cmps) {
      const c = cmp(a, b);
      if (c !== 0) return c;
    }
    return 0;
  };
}

/** Returns a new, sorted array. */
export function sortApartments(
  list: readonly Apartment[],
  spec: SortSpec,
  buildings: readonly string[],
): Apartment[] {
  const order = new Map(buildings.map((b, i) => [b, i]));
  return list.slice().sort(comparatorFor(spec, order));
}

// ---- Pure edits used by the sort builder (each returns a new spec) ----

/** Adds the first field not yet used (ascending), up to MAX_SORT_LEVELS. */
export function addSortLevel(spec: SortSpec): SortSpec {
  if (spec.length >= MAX_SORT_LEVELS) return spec;
  const used = new Set(spec.map((l) => l.field));
  const field = SORT_FIELDS.find((f) => !used.has(f));
  return field ? [...spec, { field, dir: 'asc' }] : spec;
}

/** Removes level `i`; the last remaining level is kept. */
export function removeSortLevel(spec: SortSpec, i: number): SortSpec {
  if (spec.length <= 1 || i < 0 || i >= spec.length) return spec;
  return spec.filter((_, j) => j !== i);
}

/** Sets the field of level `i`. A field used by another level is swapped with it. */
export function setSortLevelField(spec: SortSpec, i: number, field: SortField): SortSpec {
  const current = spec[i];
  if (!current || current.field === field) return spec;
  const other = spec.findIndex((l) => l.field === field);
  return spec.map((l, j) => {
    if (j === i) return { ...l, field };
    if (j === other) return { ...l, field: current.field };
    return l;
  });
}

export function toggleSortLevelDir(spec: SortSpec, i: number): SortSpec {
  if (!spec[i]) return spec;
  return spec.map((l, j) => (j === i ? { ...l, dir: l.dir === 'asc' ? 'desc' : 'asc' } : l));
}

/** Moves level `i` one place up (-1) or down (+1). */
export function moveSortLevel(spec: SortSpec, i: number, delta: -1 | 1): SortSpec {
  const j = i + delta;
  const a = spec[i];
  const b = spec[j];
  if (!a || !b) return spec;
  return spec.map((l, k) => (k === i ? b : k === j ? a : l));
}
