import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { MyListRepository, MyListSnapshot } from './myListRepository';

export const SAVE_DELAY_MS = 500;

const isThenable = <T>(v: unknown): v is PromiseLike<T> =>
  typeof (v as { then?: unknown } | null)?.then === 'function';

export interface DebouncedPersistStorage extends PersistStorage<MyListSnapshot> {
  /** Writes any pending change immediately. */
  flush(): void;
}

/**
 * Adapts a MyListRepository to Zustand's `persist` storage. Writes are debounced; pending
 * writes are flushed when the page is hidden so nothing is lost on close.
 */
export function createDebouncedPersistStorage(
  repo: MyListRepository,
  delayMs = SAVE_DELAY_MS,
): DebouncedPersistStorage {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: MyListSnapshot | undefined;

  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    const snapshot = pending;
    pending = undefined;
    void Promise.resolve(repo.save(snapshot)).catch(() => undefined);
  };

  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);

  const wrap = (s: MyListSnapshot | null): StorageValue<MyListSnapshot> | null =>
    s ? { state: s, version: 0 } : null;

  return {
    getItem: () => {
      const loaded = repo.load();
      return isThenable<MyListSnapshot | null>(loaded)
        ? Promise.resolve(loaded).then(wrap)
        : wrap(loaded);
    },
    setItem: (_name, value) => {
      pending = value.state;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: () => {
      pending = undefined;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    flush,
  };
}
