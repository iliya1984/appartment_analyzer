import { beforeEach, describe, expect, it } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { DEFAULT_FILTERS } from '@/domain/filters';
import { loadWorkbookRows, resetToBuiltIn } from '@/store/actions';
import { useDatasetStore } from '@/store/datasetStore';
import { PAGE_SIZE, useFiltersStore } from '@/store/filtersStore';
import { useMyListStore } from '@/store/myListStore';
import { isSheetTab, TOAST_MS, useUiStore } from '@/store/uiStore';
import { row } from '@/test/factories';

const filters = () => useFiltersStore.getState();

beforeEach(() => {
  resetToBuiltIn();
  useMyListStore.setState({ entries: [], orientation: {} });
});

describe('filtersStore', () => {
  it('starts from defaults', () => {
    expect(filters().filters).toEqual(DEFAULT_FILTERS);
    expect(filters().visibleCount).toBe(PAGE_SIZE);
  });

  it('parses number inputs and keeps the raw text', () => {
    filters().setInput('budgetMin', '1500');
    filters().setInput('floorMax', '-1');
    filters().setInput('budgetMax', 'abc');
    expect(filters().filters).toMatchObject({ budgetMin: 1500, floorMax: -1, budgetMax: 0 });
    expect(filters().inputs).toMatchObject({ budgetMin: '1500', floorMax: '-1', budgetMax: 'abc' });
  });

  it('toggles chips and picks buildings from the map', () => {
    filters().toggleRoom(4);
    filters().toggleRoom(5);
    filters().toggleRoom(4);
    filters().toggleFlag('garden');
    filters().toggleStorageFloor('-1');
    filters().setCategory('free');
    filters().setSort('area');
    filters().toggleBuilding('A1');
    filters().toggleBuilding('B2');
    expect(filters().filters).toMatchObject({
      rooms: [5],
      flags: ['garden'],
      storageFloors: ['-1'],
      category: 'free',
      sort: 'area',
      buildings: ['A1', 'B2'],
    });
    filters().pickBuilding('A1');
    expect(filters().filters.buildings).toEqual(['A1']);
    filters().pickBuilding('A1');
    expect(filters().filters.buildings).toEqual([]);
  });

  it('pages in steps of 40 and resets paging on any filter change', () => {
    filters().showMore();
    filters().showMore();
    expect(filters().visibleCount).toBe(3 * PAGE_SIZE);
    filters().toggleRoom(3);
    expect(filters().visibleCount).toBe(PAGE_SIZE);
    filters().showMore();
    filters().setInput('floorMin', '2');
    expect(filters().visibleCount).toBe(PAGE_SIZE);
  });

  it('resets everything', () => {
    filters().setInput('budgetMin', '900');
    filters().toggleRoom(6);
    filters().reset();
    expect(filters().filters).toEqual(DEFAULT_FILTERS);
    expect(filters().inputs.budgetMin).toBe('');
  });
});

describe('dataset actions', () => {
  it('loads uploaded rows: new dataset, filters reset, missing list entries dropped', () => {
    useMyListStore.getState().toggle('A1-1');
    useMyListStore.getState().toggle('A1-2');
    filters().toggleRoom(3);
    const d = loadWorkbookRows(
      [row({ building: 'A1', unit: 2 }), row({ building: 'B2', unit: 1 })],
      'new.xlsx',
    );
    expect(useDatasetStore.getState().dataset).toBe(d);
    expect(useDatasetStore.getState().source).toEqual({ kind: 'file', fileName: 'new.xlsx' });
    expect(d.meta).toBe(builtInDataset.meta);
    expect(filters().filters).toEqual(DEFAULT_FILTERS);
    expect(useMyListStore.getState().entries.map((e) => e.id)).toEqual(['A1-2']);
  });

  it('resets to the built-in dataset', () => {
    loadWorkbookRows([row()], 'x.xlsx');
    resetToBuiltIn();
    expect(useDatasetStore.getState().dataset).toBe(builtInDataset);
    expect(useDatasetStore.getState().source).toEqual({ kind: 'built-in' });
  });
});

describe('uiStore', () => {
  it('validates sheet tabs', () => {
    expect(isSheetTab('building')).toBe(true);
    expect(isSheetTab('3d')).toBe(false);
  });

  it('keeps one toast at a time and only clears the current one', () => {
    const ui = () => useUiStore.getState();
    ui().showToast('a');
    const first = ui().toast!.id;
    ui().showToast('b');
    ui().clearToast(first);
    expect(ui().toast?.message).toBe('b');
    ui().clearToast(ui().toast!.id);
    expect(ui().toast).toBeNull();
    expect(TOAST_MS).toBe(3200);
  });

  it('remembers the last sheet tab and the dismissed notice', () => {
    useUiStore.getState().setLastSheetTab('schematic');
    useUiStore.getState().dismissNotice();
    expect(useUiStore.getState()).toMatchObject({
      lastSheetTab: 'schematic',
      noticeDismissed: true,
    });
  });
});
