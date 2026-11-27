import { create } from 'zustand';
import {
  DEFAULT_FILTERS,
  type CategoryFilter,
  type Filters,
  type FlagFilter,
  type RoomsFilter,
  parseBudgetInput,
  parseFloorInput,
  pickSingleBuilding,
  toggleIn,
} from '@/domain/filters';
import type { SortKey } from '@/domain/sort';

/** Cards shown initially and added by each "show more". */
export const PAGE_SIZE = 40;

/** Raw text of the number inputs (kept so partially typed values are not lost). */
export interface FilterInputs {
  budgetMin: string;
  budgetMax: string;
  floorMin: string;
  floorMax: string;
}

const EMPTY_INPUTS: FilterInputs = { budgetMin: '', budgetMax: '', floorMin: '', floorMax: '' };

interface FiltersState {
  filters: Filters;
  inputs: FilterInputs;
  visibleCount: number;
  setInput: (field: keyof FilterInputs, text: string) => void;
  toggleRoom: (rooms: RoomsFilter) => void;
  toggleBuilding: (building: string) => void;
  /** Map behaviour: select only this building, or clear it if it is the only one selected. */
  pickBuilding: (building: string) => void;
  setCategory: (category: CategoryFilter) => void;
  toggleFlag: (flag: FlagFilter) => void;
  toggleStorageFloor: (floor: string) => void;
  setSort: (sort: SortKey) => void;
  showMore: () => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>()((set) => {
  /** Every filter change starts again from the first page. */
  const update = (fn: (f: Filters) => Partial<Filters>) =>
    set((s) => ({ filters: { ...s.filters, ...fn(s.filters) }, visibleCount: PAGE_SIZE }));

  return {
    filters: DEFAULT_FILTERS,
    inputs: EMPTY_INPUTS,
    visibleCount: PAGE_SIZE,
    setInput: (field, text) =>
      set((s) => {
        const value =
          field === 'budgetMin' || field === 'budgetMax'
            ? parseBudgetInput(text)
            : parseFloorInput(text);
        return {
          inputs: { ...s.inputs, [field]: text },
          filters: { ...s.filters, [field]: value },
          visibleCount: PAGE_SIZE,
        };
      }),
    toggleRoom: (rooms) => update((f) => ({ rooms: toggleIn(f.rooms, rooms) })),
    toggleBuilding: (b) => update((f) => ({ buildings: toggleIn(f.buildings, b) })),
    pickBuilding: (b) => update((f) => ({ buildings: pickSingleBuilding(f.buildings, b) })),
    setCategory: (category) => update(() => ({ category })),
    toggleFlag: (flag) => update((f) => ({ flags: toggleIn(f.flags, flag) })),
    toggleStorageFloor: (floor) =>
      update((f) => ({ storageFloors: toggleIn(f.storageFloors, floor) })),
    setSort: (sort) => update(() => ({ sort })),
    showMore: () => set((s) => ({ visibleCount: s.visibleCount + PAGE_SIZE })),
    reset: () => set({ filters: DEFAULT_FILTERS, inputs: EMPTY_INPUTS, visibleCount: PAGE_SIZE }),
  };
});
