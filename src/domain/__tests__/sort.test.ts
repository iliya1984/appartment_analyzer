import { describe, expect, it } from 'vitest';
import { comparatorFor, isSortKey, SORT_KEYS, sortApartments } from '@/domain/sort';
import { dataset, row } from '@/test/factories';

const d = dataset([
  row({ building: 'B2', unit: 3, price: null, area: 90, floor: 2 }),
  row({ building: 'A1', unit: 9, price: 1_200_000, area: 100, floor: 4 }),
  row({ building: 'A1', unit: 2, price: 1_800_000, area: 120, floor: 1 }),
]);
const ids = (key: (typeof SORT_KEYS)[number]) =>
  sortApartments(d.apartments, key, d.buildings).map((a) => a.id);

describe('sortApartments', () => {
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
    sortApartments(d.apartments, 'area', d.buildings);
    expect(d.apartments.map((a) => a.id)).toEqual(before);
  });

  it('handles buildings missing from the order map', () => {
    const cmp = comparatorFor('id', new Map());
    const [a, b] = d.apartments;
    expect(cmp(a!, b!)).toBe(a!.number - b!.number);
  });
});

describe('isSortKey', () => {
  it('accepts known keys only', () => {
    expect(SORT_KEYS.every(isSortKey)).toBe(true);
    expect(isSortKey('price')).toBe(false);
    expect(isSortKey(3)).toBe(false);
  });
});
