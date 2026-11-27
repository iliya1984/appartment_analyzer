import { useMemo } from 'react';
import { applyFilters, countByBuilding } from '@/domain/filters';
import type { Apartment, Dataset } from '@/domain/types';
import { useDatasetStore } from './datasetStore';
import { useFiltersStore } from './filtersStore';
import { useMyListStore } from './myListStore';

export const useDataset = (): Dataset => useDatasetStore((s) => s.dataset);

export const useApartment = (id: string | null | undefined): Apartment | undefined => {
  const dataset = useDataset();
  return id ? dataset.byId.get(id) : undefined;
};

/** Matching apartments in the selected order. */
export function useFilteredApartments(): Apartment[] {
  const dataset = useDataset();
  const filters = useFiltersStore((s) => s.filters);
  return useMemo(() => applyFilters(dataset, filters), [dataset, filters]);
}

export function useMatchCountsByBuilding(): Map<string, number> {
  const dataset = useDataset();
  const filters = useFiltersStore((s) => s.filters);
  return useMemo(() => countByBuilding(dataset.apartments, filters), [dataset, filters]);
}

export const useIsInMyList = (id: string): boolean =>
  useMyListStore((s) => s.entries.some((e) => e.id === id));

/** Ids in the list, as a Set (stable while the list does not change). */
export function useMyListIds(): ReadonlySet<string> {
  const entries = useMyListStore((s) => s.entries);
  return useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
}

export const useMyListCount = (): number => useMyListStore((s) => s.entries.length);
