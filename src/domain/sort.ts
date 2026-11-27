import type { Apartment } from './types';

export const SORT_KEYS = ['ppsqm', 'delta', 'priceA', 'priceD', 'area', 'floor', 'id'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const isSortKey = (v: unknown): v is SortKey =>
  typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);

type Comparator = (a: Apartment, b: Apartment) => number;

/** `null` sorts as `fallback` (so unpriced apartments go last in ascending orders). */
const nz = (v: number | null | undefined, fallback: number): number => v ?? fallback;

/**
 * Comparators. `buildingOrder` maps building id → display index and is only used by `id`.
 * All sorts are stable, so equal keys keep the input (workbook) order.
 */
export function comparatorFor(
  key: SortKey,
  buildingOrder: ReadonlyMap<string, number>,
): Comparator {
  switch (key) {
    case 'ppsqm':
      return (a, b) => nz(a.pricePerSqm, 1e9) - nz(b.pricePerSqm, 1e9);
    case 'delta':
      return (a, b) => nz(a.comparison?.delta, 9) - nz(b.comparison?.delta, 9);
    case 'priceA':
      return (a, b) => nz(a.price, 1e12) - nz(b.price, 1e12);
    case 'priceD':
      return (a, b) => nz(b.price, -1) - nz(a.price, -1);
    case 'area':
      return (a, b) => b.area - a.area;
    case 'floor':
      return (a, b) => b.floor - a.floor;
    case 'id':
      return (a, b) =>
        nz(buildingOrder.get(a.building), -1) - nz(buildingOrder.get(b.building), -1) ||
        a.number - b.number;
  }
}

/** Returns a new, sorted array. */
export function sortApartments(
  list: readonly Apartment[],
  key: SortKey,
  buildings: readonly string[],
): Apartment[] {
  const order = new Map(buildings.map((b, i) => [b, i]));
  return list.slice().sort(comparatorFor(key, order));
}
