import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  countByBuilding,
  DEFAULT_FILTERS,
  type Filters,
  matches,
  parseBudgetInput,
  parseFloorInput,
  pickSingleBuilding,
  toggleIn,
} from '@/domain/filters';
import { SORT_PRESETS } from '@/domain/sort';
import { dataset, row } from '@/test/factories';

const d = dataset([
  row({
    building: 'A1',
    unit: 1,
    floor: 0,
    rooms: 3,
    price: 1_000_000,
    plan: 'T-G3A',
    storageFloor: 'קרקע',
  }),
  row({ building: 'A1', unit: 2, floor: 5, rooms: 4.5, price: 1_600_000, storageFloor: '-1' }),
  row({
    building: 'B2',
    unit: 1,
    floor: 6,
    rooms: 6,
    price: null,
    target: 0,
    plan: 'T-P6A',
    storageFloor: '-2',
  }),
]);
const [ground, mid, pent] = d.apartments as [never, never, never];
const f = (p: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...p });

describe('matches', () => {
  it('matches everything with default filters', () => {
    expect(d.apartments.every((a) => matches(a, DEFAULT_FILTERS))).toBe(true);
  });

  it('applies budget in thousands and excludes unpriced apartments', () => {
    expect(matches(ground, f({ budgetMin: 1000 }))).toBe(true);
    expect(matches(ground, f({ budgetMin: 1001 }))).toBe(false);
    expect(matches(mid, f({ budgetMax: 1500 }))).toBe(false);
    expect(matches(pent, f({ budgetMax: 99_999 }))).toBe(false);
    expect(matches(pent, f({ budgetMin: 1 }))).toBe(false);
  });

  it('filters by rooms bucket, floor range and building', () => {
    expect(matches(mid, f({ rooms: [4] }))).toBe(true);
    expect(matches(mid, f({ rooms: [3, 5] }))).toBe(false);
    expect(matches(ground, f({ floorMin: 0, floorMax: 0 }))).toBe(true);
    expect(matches(mid, f({ floorMax: 4 }))).toBe(false);
    expect(matches(mid, f({ floorMin: 6 }))).toBe(false);
    expect(matches(pent, f({ buildings: ['A1'] }))).toBe(false);
  });

  it('filters by category, flags and storage floor', () => {
    expect(matches(pent, f({ category: 'free' }))).toBe(true);
    expect(matches(pent, f({ category: 'target' }))).toBe(false);
    expect(matches(ground, f({ flags: ['garden'] }))).toBe(true);
    expect(matches(mid, f({ flags: ['garden'] }))).toBe(false);
    expect(matches(pent, f({ flags: ['pent', 'top'] }))).toBe(true);
    expect(matches(ground, f({ flags: ['pent'] }))).toBe(false);
    expect(matches(ground, f({ flags: ['top'] }))).toBe(false);
    expect(matches(ground, f({ storageFloors: ['קרקע'] }))).toBe(true);
    expect(matches(mid, f({ storageFloors: ['קרקע', '-2'] }))).toBe(false);
  });
});

describe('type search', () => {
  it('ANDs the type tokens with the other filters', () => {
    expect(matches(ground, f({ typeQuery: ['G3'] }))).toBe(true);
    expect(matches(pent, f({ typeQuery: ['G3'] }))).toBe(false);
    expect(matches(pent, f({ typeQuery: ['G3', 'P6'] }))).toBe(true);
    expect(matches(pent, f({ typeQuery: ['P6'], rooms: [3] }))).toBe(false);
    expect(matches(mid, f({ typeQuery: [] }))).toBe(true);
  });

  it('narrows the per-building counts', () => {
    expect(Object.fromEntries(countByBuilding(d.apartments, f({ typeQuery: ['P'] })))).toEqual({
      B2: 1,
    });
  });
});

describe('applyFilters / countByBuilding', () => {
  it('filters then sorts', () => {
    expect(applyFilters(d, f({ sort: SORT_PRESETS.floor })).map((a) => a.id)).toEqual([
      'B2-1',
      'A1-2',
      'A1-1',
    ]);
    expect(
      applyFilters(d, f({ buildings: ['A1'], sort: SORT_PRESETS.priceD })).map((a) => a.id),
    ).toEqual(['A1-2', 'A1-1']);
  });

  it('counts matches per building, omitting buildings with none', () => {
    expect(Object.fromEntries(countByBuilding(d.apartments, f({ budgetMin: 1 })))).toEqual({
      A1: 2,
    });
  });
});

describe('input parsing', () => {
  it.each([
    ['', 0],
    ['  ', 0],
    ['1500', 1500],
    ['-20', 0],
    ['abc', 0],
  ])('budget %j → %d', (input, out) => expect(parseBudgetInput(input)).toBe(out));

  it.each([
    ['', null],
    ['3', 3],
    ['-1', -1],
    ['x', null],
  ])('floor %j → %j', (input, out) => expect(parseFloorInput(input)).toBe(out));
});

describe('list helpers', () => {
  it('toggles values without mutating', () => {
    const list = [1, 2];
    expect(toggleIn(list, 2)).toEqual([1]);
    expect(toggleIn(list, 3)).toEqual([1, 2, 3]);
    expect(list).toEqual([1, 2]);
  });

  it('picks a single building or clears it', () => {
    expect(pickSingleBuilding([], 'A1')).toEqual(['A1']);
    expect(pickSingleBuilding(['A1', 'B2'], 'A1')).toEqual(['A1']);
    expect(pickSingleBuilding(['A1'], 'A1')).toEqual([]);
    expect(pickSingleBuilding(['B2'], 'A1')).toEqual(['A1']);
  });
});
