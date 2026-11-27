import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMyListStore } from '@/store/myListStore';
import {
  LEGACY_STORAGE_KEY,
  LocalStorageMyListRepository,
  type MyListRepository,
  parseSnapshot,
  toLegacyPayload,
} from '@/store/persistence/myListRepository';

describe('parseSnapshot (legacy payload)', () => {
  it('reads the legacy {prio, az} shape', () => {
    expect(
      parseSnapshot({ prio: [{ id: 'A1-1', note: 'x' }, { id: 'B2-3' }], az: { 'A1-1': 90 } }),
    ).toEqual({
      entries: [
        { id: 'A1-1', note: 'x' },
        { id: 'B2-3', note: '' },
      ],
      orientation: { 'A1-1': 90 },
    });
  });

  it('drops invalid parts instead of throwing', () => {
    expect(
      parseSnapshot({
        prio: [null, 5, { id: '' }, { id: 'A1-1', note: 7 }, { id: 'A1-1', note: 'dup' }],
        az: { a: 30, b: '45', c: 'x', d: null, e: 315 },
      }),
    ).toEqual({ entries: [{ id: 'A1-1', note: '' }], orientation: { b: 45, e: 315 } });
    expect(parseSnapshot({ prio: 'nope', az: [] })).toEqual({ entries: [], orientation: {} });
    expect(parseSnapshot('garbage')).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it('writes back the legacy shape', () => {
    expect(
      toLegacyPayload({ entries: [{ id: 'A1-1', note: 'n' }], orientation: { 'A1-1': 180 } }),
    ).toEqual({
      prio: [{ id: 'A1-1', note: 'n' }],
      az: { 'A1-1': 180 },
    });
  });
});

describe('LocalStorageMyListRepository', () => {
  it('returns null for missing or corrupt data', () => {
    const repo = new LocalStorageMyListRepository();
    expect(repo.load()).toBeNull();
    localStorage.setItem(LEGACY_STORAGE_KEY, '{not json');
    expect(repo.load()).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(new LocalStorageMyListRepository().load()).toBeNull();
    spy.mockRestore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() =>
      new LocalStorageMyListRepository().save({ entries: [], orientation: {} }),
    ).not.toThrow();
  });
});

describe('myListStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('loads a list saved by the legacy site, dropping unknown apartments', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        prio: [
          { id: 'A1-1', note: 'ראשונה' },
          { id: 'ZZ-9', note: '' },
          { id: 'C14-13', note: '' },
        ],
        az: { 'A1-1': 135 },
      }),
    );
    const store = createMyListStore();
    expect(store.getState().entries).toEqual([
      { id: 'A1-1', note: 'ראשונה' },
      { id: 'C14-13', note: '' },
    ]);
    expect(store.getState().orientation).toEqual({ 'A1-1': 135 });
  });

  it('toggles, reorders, annotates and removes entries', () => {
    const store = createMyListStore();
    const s = () => store.getState();
    s().toggle('A1-1');
    s().toggle('A1-2');
    s().toggle('A1-3');
    s().move(2, -1);
    expect(s().entries.map((e) => e.id)).toEqual(['A1-1', 'A1-3', 'A1-2']);
    s().move(0, -1); // out of range: no change
    s().move(2, 1);
    expect(s().entries.map((e) => e.id)).toEqual(['A1-1', 'A1-3', 'A1-2']);
    s().setNote('A1-3', 'קרוב למעלית');
    expect(s().entries[1]).toEqual({ id: 'A1-3', note: 'קרוב למעלית' });
    s().toggle('A1-1');
    s().remove('A1-2');
    expect(s().entries).toEqual([{ id: 'A1-3', note: 'קרוב למעלית' }]);
  });

  it('sets and clears orientation', () => {
    const store = createMyListStore();
    store.getState().setOrientation('A1-1', 90);
    expect(store.getState().orientation).toEqual({ 'A1-1': 90 });
    store.getState().setOrientation('A1-1', null);
    expect(store.getState().orientation).toEqual({});
  });

  it('prunes entries that are not in the dataset', () => {
    const store = createMyListStore();
    store.getState().toggle('A1-1');
    store.getState().toggle('B2-1');
    const before = store.getState();
    store.getState().prune(new Set(['A1-1', 'B2-1']));
    expect(store.getState()).toBe(before); // unchanged → same state object
    store.getState().prune(new Set(['B2-1']));
    expect(store.getState().entries.map((e) => e.id)).toEqual(['B2-1']);
  });

  it('saves in the legacy format, debounced by 500 ms', () => {
    const store = createMyListStore();
    store.getState().toggle('A1-1');
    store.getState().setNote('A1-1', 'a');
    store.getState().setOrientation('A1-1', 45);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(499);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)!)).toEqual({
      prio: [{ id: 'A1-1', note: 'a' }],
      az: { 'A1-1': 45 },
    });
  });

  it('flushes pending writes when the page is hidden', () => {
    const store = createMyListStore();
    store.getState().toggle('A1-5');
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)!).prio).toEqual([
      { id: 'A1-5', note: '' },
    ]);
    store.flush(); // nothing pending: no-op
  });

  it('supports an asynchronous repository (future server storage)', async () => {
    vi.useRealTimers();
    const saved: unknown[] = [];
    const repo: MyListRepository = {
      load: () => Promise.resolve({ entries: [{ id: 'A1-1', note: 'srv' }], orientation: {} }),
      save: (s) => {
        saved.push(s);
        return Promise.resolve();
      },
    };
    const store = createMyListStore(repo);
    await store.persist.rehydrate();
    expect(store.getState().entries).toEqual([{ id: 'A1-1', note: 'srv' }]);
    store.getState().toggle('A1-2');
    store.flush();
    expect(saved).toHaveLength(1);
  });
});
