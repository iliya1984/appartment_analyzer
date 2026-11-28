import { describe, expect, it } from 'vitest';
import {
  addSortLevel,
  comparatorFor,
  comparePlanType,
  DEFAULT_SORT,
  isSortField,
  isSortKey,
  MAX_SORT_LEVELS,
  moveSortLevel,
  presetOf,
  removeSortLevel,
  sameSpec,
  setSortLevelField,
  SORT_FIELDS,
  SORT_KEYS,
  SORT_PRESETS,
  type SortKey,
  type SortSpec,
  sortApartments,
  toggleSortLevelDir,
} from '@/domain/sort';
import { dataset, row } from '@/test/factories';

const d = dataset([
  row({ building: 'B2', unit: 3, price: null, area: 90, floor: 2 }),
  row({ building: 'A1', unit: 9, price: 1_200_000, area: 100, floor: 4 }),
  row({ building: 'A1', unit: 2, price: 1_800_000, area: 120, floor: 1 }),
]);
const sorted = (spec: SortSpec) => sortApartments(d.apartments, spec, d.buildings).map((a) => a.id);
const ids = (key: SortKey) => sorted(SORT_PRESETS[key]);

describe('sortApartments with presets (legacy orders)', () => {
  it('puts unpriced apartments last for ascending price sorts', () => {
    expect(ids('priceA')).toEqual(['A1-9', 'A1-2', 'B2-3']);
    expect(ids('ppsqm')).toEqual(['A1-9', 'A1-2', 'B2-3']);
    expect(ids('delta').at(-1)).toBe('B2-3');
  });

  it('puts unpriced apartments last for descending price', () => {
    expect(ids('priceD')).toEqual(['A1-2', 'A1-9', 'B2-3']);
  });

  it('sorts by area and floor descending', () => {
    expect(ids('area')).toEqual(['A1-2', 'A1-9', 'B2-3']);
    expect(ids('floor')).toEqual(['A1-9', 'B2-3', 'A1-2']);
  });

  it('sorts by building display order, then unit number', () => {
    expect(ids('id')).toEqual(['A1-2', 'A1-9', 'B2-3']);
  });

  it('does not mutate the input', () => {
    const before = d.apartments.map((a) => a.id);
    sortApartments(d.apartments, SORT_PRESETS.area, d.buildings);
    expect(d.apartments.map((a) => a.id)).toEqual(before);
  });

  it('handles buildings missing from the order map', () => {
    const cmp = comparatorFor(SORT_PRESETS.id, new Map());
    const [a, b] = d.apartments;
    expect(Math.sign(cmp(a!, b!))).toBe(Math.sign(a!.number - b!.number));
  });

  it('uses price per m² ascending by default', () => {
    expect(DEFAULT_SORT).toEqual([{ field: 'pricePerSqm', dir: 'asc' }]);
  });
});

describe('multi-level sort', () => {
  const m = dataset([
    row({ building: 'A1', unit: 1, rooms: 5, floor: 2, plan: 'T-T5A', price: 1_700_000 }),
    row({ building: 'A1', unit: 2, rooms: 3, floor: 2, plan: 'T-T3B', price: null }),
    row({ building: 'A1', unit: 3, rooms: 5, floor: 7, plan: 'T-P5E', price: 2_100_000 }),
    row({ building: 'B2', unit: 4, rooms: 3, floor: 9, plan: 'T-G3H', price: 1_100_000 }),
    row({ building: 'B2', unit: 5, rooms: 4.5, floor: 4, plan: 'T-T4.5C', price: 1_500_000 }),
  ]);
  const by = (spec: SortSpec) => sortApartments(m.apartments, spec, m.buildings).map((a) => a.id);

  it('sorts by rooms, then floor from high to low', () => {
    expect(
      by([
        { field: 'rooms', dir: 'asc' },
        { field: 'floor', dir: 'desc' },
      ]),
    ).toEqual(['B2-4', 'A1-2', 'B2-5', 'A1-3', 'A1-1']);
  });

  it('applies the direction per level', () => {
    expect(
      by([
        { field: 'rooms', dir: 'desc' },
        { field: 'floor', dir: 'asc' },
      ]),
    ).toEqual(['A1-1', 'A1-3', 'B2-5', 'A1-2', 'B2-4']);
  });

  it('keeps unpriced apartments last in both directions', () => {
    expect(by([{ field: 'price', dir: 'asc' }]).at(-1)).toBe('A1-2');
    expect(by([{ field: 'price', dir: 'desc' }]).at(-1)).toBe('A1-2');
    expect(by([{ field: 'pricePerSqm', dir: 'desc' }]).at(-1)).toBe('A1-2');
  });

  it('keeps the input order for full ties (stable)', () => {
    expect(by([{ field: 'building', dir: 'asc' }])).toEqual([
      'A1-1',
      'A1-2',
      'A1-3',
      'B2-4',
      'B2-5',
    ]);
    expect(by([{ field: 'building', dir: 'desc' }])).toEqual([
      'B2-4',
      'B2-5',
      'A1-1',
      'A1-2',
      'A1-3',
    ]);
  });

  it('sorts plan types in natural order (kind, rooms, letter)', () => {
    expect(by([{ field: 'planType', dir: 'asc' }])).toEqual([
      'A1-2',
      'B2-5',
      'A1-1',
      'B2-4',
      'A1-3',
    ]);
    expect(by([{ field: 'planType', dir: 'desc' }])).toEqual([
      'A1-3',
      'B2-4',
      'A1-1',
      'B2-5',
      'A1-2',
    ]);
  });

  it('supports every field', () => {
    for (const field of SORT_FIELDS) {
      expect(by([{ field, dir: 'asc' }]), field).toHaveLength(5);
    }
  });
});

describe('comparePlanType', () => {
  it('orders by kind, then rooms numerically, then letter', () => {
    expect(['T-P6D', 'T-T10A', 'T-G4K', 'T-T5.5F', 'T-T5A', 'T-T3H'].sort(comparePlanType)).toEqual(
      ['T-T3H', 'T-T5A', 'T-T5.5F', 'T-T10A', 'T-G4K', 'T-P6D'],
    );
  });

  it('puts codes outside the pattern last', () => {
    expect(['X', 'T-T5A', 'B'].sort(comparePlanType)).toEqual(['T-T5A', 'B', 'X']);
  });
});

describe('presets and guards', () => {
  it('recognises presets and custom specs', () => {
    for (const k of SORT_KEYS) expect(presetOf(SORT_PRESETS[k])).toBe(k);
    expect(presetOf([{ field: 'rooms', dir: 'asc' }])).toBeNull();
    expect(sameSpec(SORT_PRESETS.id, [...SORT_PRESETS.id])).toBe(true);
    expect(sameSpec(SORT_PRESETS.priceA, SORT_PRESETS.priceD)).toBe(false);
  });

  it('accepts known keys and fields only', () => {
    expect(SORT_KEYS.every(isSortKey)).toBe(true);
    expect(isSortKey('price')).toBe(false);
    expect(isSortKey(3)).toBe(false);
    expect(SORT_FIELDS.every(isSortField)).toBe(true);
    expect(isSortField('ppsqm')).toBe(false);
  });
});

describe('sort builder edits', () => {
  const two: SortSpec = [
    { field: 'rooms', dir: 'asc' },
    { field: 'floor', dir: 'desc' },
  ];

  it('adds the first unused field, up to the maximum', () => {
    expect(addSortLevel(two).at(-1)).toEqual({ field: 'pricePerSqm', dir: 'asc' });
    let s: SortSpec = DEFAULT_SORT;
    for (let i = 0; i < 10; i++) s = addSortLevel(s);
    expect(s).toHaveLength(MAX_SORT_LEVELS);
    expect(new Set(s.map((l) => l.field)).size).toBe(MAX_SORT_LEVELS);
  });

  it('removes a level but never the last one', () => {
    expect(removeSortLevel(two, 0)).toEqual([{ field: 'floor', dir: 'desc' }]);
    expect(removeSortLevel(DEFAULT_SORT, 0)).toBe(DEFAULT_SORT);
    expect(removeSortLevel(two, 5)).toBe(two);
  });

  it('sets a field, swapping with the level that already uses it', () => {
    expect(setSortLevelField(two, 0, 'price')).toEqual([
      { field: 'price', dir: 'asc' },
      { field: 'floor', dir: 'desc' },
    ]);
    expect(setSortLevelField(two, 0, 'floor')).toEqual([
      { field: 'floor', dir: 'asc' },
      { field: 'rooms', dir: 'desc' },
    ]);
    expect(setSortLevelField(two, 0, 'rooms')).toBe(two);
  });

  it('toggles the direction of one level', () => {
    expect(toggleSortLevelDir(two, 1)).toEqual([
      { field: 'rooms', dir: 'asc' },
      { field: 'floor', dir: 'asc' },
    ]);
    expect(toggleSortLevelDir(two, 9)).toBe(two);
  });

  it('moves levels within bounds', () => {
    expect(moveSortLevel(two, 1, -1)).toEqual([two[1], two[0]]);
    expect(moveSortLevel(two, 0, -1)).toBe(two);
    expect(moveSortLevel(two, 1, 1)).toBe(two);
  });
});
