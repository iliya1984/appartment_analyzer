import { he } from '@/i18n/he';
import type { Filters } from './filters';
import type { SortLevel, SortSpec } from './sort';

const T = he.filters;
const R = he.resultsSheet;

/** "קומה (מהגבוהה לנמוכה)". */
export const describeSortLevel = (l: SortLevel): string =>
  `${T.sortFields[l.field]} (${T.sortDirs[l.field][l.dir]})`;

/** "חדרים (מהמעט להרבה), ואז קומה (מהגבוהה לנמוכה)". */
export const describeSort = (spec: SortSpec): string =>
  spec.map(describeSortLevel).join(T.sortThen);

const STORAGE_LABELS: Readonly<Record<string, string>> = {
  קרקע: T.storageOptions.ground,
  '-1': T.storageOptions.minus1,
  '-2': T.storageOptions.minus2,
};

/**
 * The active filters as [label, value] pairs, in panel order, followed by the sort order.
 * Inactive filters are left out; with none active the first pair says so.
 */
export function describeFilters(f: Filters): [string, string][] {
  const out: [string, string][] = [];
  if (f.typeQuery.length) out.push([R.search, f.typeQuery.join(', ')]);
  if (f.budgetMin) out.push([R.budgetMin, String(f.budgetMin)]);
  if (f.budgetMax) out.push([R.budgetMax, String(f.budgetMax)]);
  if (f.rooms.length) out.push([R.rooms, f.rooms.map((r) => T.roomOptions[r]).join(', ')]);
  if (f.floorMin != null) out.push([R.floorMin, String(f.floorMin)]);
  if (f.floorMax != null) out.push([R.floorMax, String(f.floorMax)]);
  if (f.buildings.length) out.push([R.building, f.buildings.join(', ')]);
  if (f.category !== 'all')
    out.push([R.category, f.category === 'target' ? he.common.target : he.common.free]);
  if (f.flags.length) out.push([R.flags, f.flags.map((x) => T.flagOptions[x]).join(', ')]);
  if (f.storageFloors.length)
    out.push([R.storage, f.storageFloors.map((s) => STORAGE_LABELS[s] ?? s).join(', ')]);
  if (!out.length) out.push([R.noFilters, '']);
  out.push([R.sort, describeSort(f.sort)]);
  return out;
}
