import { type SortKey, sortApartments } from './sort';
import type { Apartment, Dataset } from './types';

export type CategoryFilter = 'all' | 'target' | 'free';
export type FlagFilter = 'garden' | 'pent' | 'top';
export type RoomsFilter = 3 | 4 | 5 | 6;

export const ROOM_FILTERS: readonly RoomsFilter[] = [3, 4, 5, 6];
export const FLAG_FILTERS: readonly FlagFilter[] = ['garden', 'pent', 'top'];
export const CATEGORY_FILTERS: readonly CategoryFilter[] = ['all', 'target', 'free'];
/** Storage levels offered in the filter (values match `StorageUnit.floor`). */
export const STORAGE_FILTERS = ['קרקע', '-1', '-2'] as const;

export interface Filters {
  /** Thousands of ₪; 0 = no limit. */
  budgetMin: number;
  /** Thousands of ₪; 0 = no limit. */
  budgetMax: number;
  rooms: readonly RoomsFilter[];
  floorMin: number | null;
  floorMax: number | null;
  buildings: readonly string[];
  category: CategoryFilter;
  flags: readonly FlagFilter[];
  storageFloors: readonly string[];
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = Object.freeze({
  budgetMin: 0,
  budgetMax: 0,
  rooms: [],
  floorMin: null,
  floorMax: null,
  buildings: [],
  category: 'all',
  flags: [],
  storageFloors: [],
  sort: 'ppsqm',
});

/** True when the apartment passes every active filter (sort is ignored). */
export function matches(a: Apartment, f: Filters): boolean {
  if (f.budgetMin && (a.price == null || a.price < f.budgetMin * 1000)) return false;
  if (f.budgetMax && (a.price == null || a.price > f.budgetMax * 1000)) return false;
  if (f.rooms.length && !(f.rooms as readonly number[]).includes(a.roomsBucket)) return false;
  if (f.floorMin != null && a.floor < f.floorMin) return false;
  if (f.floorMax != null && a.floor > f.floorMax) return false;
  if (f.buildings.length && !f.buildings.includes(a.building)) return false;
  if (f.category !== 'all' && a.category !== f.category) return false;
  if (f.flags.includes('garden') && a.kind !== 'G') return false;
  if (f.flags.includes('pent') && a.kind !== 'P') return false;
  if (f.flags.includes('top') && !a.isTopFloor) return false;
  if (f.storageFloors.length && !f.storageFloors.includes(a.storage.floor)) return false;
  return true;
}

/** Matching apartments in the selected sort order. */
export function applyFilters(dataset: Dataset, f: Filters): Apartment[] {
  return sortApartments(
    dataset.apartments.filter((a) => matches(a, f)),
    f.sort,
    dataset.buildings,
  );
}

/** Budget input (thousands of ₪): empty / invalid / negative → 0 (no limit). */
export function parseBudgetInput(value: string): number {
  const v = value.trim();
  if (v === '') return 0;
  const n = Math.max(0, Number(v));
  return Number.isNaN(n) ? 0 : n;
}

/** Floor input: empty or invalid → null (no limit). Negative floors are allowed. */
export function parseFloorInput(value: string): number | null {
  const v = value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Toggle a value in a readonly list, returning a new list. */
export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Map click: select only this building, or clear when it is already the single selection. */
export function pickSingleBuilding(current: readonly string[], building: string): string[] {
  return current.length === 1 && current[0] === building ? [] : [building];
}

/** Number of matching apartments per building. */
export function countByBuilding(apartments: readonly Apartment[], f: Filters): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of apartments) {
    if (matches(a, f)) counts.set(a.building, (counts.get(a.building) ?? 0) + 1);
  }
  return counts;
}
