import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Orientation } from '@/domain/orientation';
import { useDatasetStore } from './datasetStore';
import { createDebouncedPersistStorage } from './persistence/debouncedPersistStorage';
import {
  LEGACY_STORAGE_KEY,
  LocalStorageMyListRepository,
  type MyListEntry,
  type MyListRepository,
  type MyListSnapshot,
} from './persistence/myListRepository';

interface MyListState extends MyListSnapshot {
  toggle: (id: string) => void;
  remove: (id: string) => void;
  /** Swap the entry at `index` with its neighbour (`delta` = -1 up, +1 down). */
  move: (index: number, delta: -1 | 1) => void;
  setNote: (id: string, note: string) => void;
  setOrientation: (id: string, deg: Orientation | null) => void;
  /** Drop entries whose apartment is not in `validIds` (after loading another workbook). */
  prune: (validIds: ReadonlySet<string> | ReadonlyMap<string, unknown>) => void;
}

export function createMyListStore(repo: MyListRepository = new LocalStorageMyListRepository()) {
  const storage = createDebouncedPersistStorage(repo);
  const store = create<MyListState>()(
    persist(
      (set) => ({
        entries: [],
        orientation: {},
        toggle: (id) =>
          set((s) => ({
            entries: s.entries.some((e) => e.id === id)
              ? s.entries.filter((e) => e.id !== id)
              : [...s.entries, { id, note: '' }],
          })),
        remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
        move: (index, delta) =>
          set((s) => {
            const j = index + delta;
            const a = s.entries[index];
            const b = s.entries[j];
            if (!a || !b) return s;
            const entries = s.entries.slice();
            entries[index] = b;
            entries[j] = a;
            return { entries };
          }),
        setNote: (id, note) =>
          set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, note } : e)) })),
        setOrientation: (id, deg) =>
          set((s) => {
            const orientation = Object.fromEntries(
              Object.entries(s.orientation).filter(([k]) => k !== id),
            ) as Record<string, Orientation>;
            if (deg != null) orientation[id] = deg;
            return { orientation };
          }),
        prune: (valid) =>
          set((s) => {
            const entries = s.entries.filter((e) => valid.has(e.id));
            return entries.length === s.entries.length ? s : { entries };
          }),
      }),
      {
        name: LEGACY_STORAGE_KEY,
        storage,
        partialize: (s): MyListSnapshot => ({ entries: s.entries, orientation: s.orientation }),
        // Like the legacy site: forget entries whose apartment is not in the current dataset.
        merge: (persisted, current) => {
          const p = persisted as MyListSnapshot | undefined;
          if (!p) return current;
          const { byId } = useDatasetStore.getState().dataset;
          const entries: MyListEntry[] = p.entries.filter((e) => byId.has(e.id));
          return { ...current, entries, orientation: p.orientation };
        },
      },
    ),
  );
  return Object.assign(store, { flush: () => storage.flush() });
}

export const useMyListStore = createMyListStore();
