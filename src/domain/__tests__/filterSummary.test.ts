import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, type Filters } from '@/domain/filters';
import { describeFilters, describeSort } from '@/domain/filterSummary';
import { SORT_PRESETS } from '@/domain/sort';

const f = (p: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...p });

describe('describeSort', () => {
  it('names each level with its direction', () => {
    expect(
      describeSort([
        { field: 'rooms', dir: 'asc' },
        { field: 'floor', dir: 'desc' },
      ]),
    ).toBe('חדרים (מהמעט להרבה), ואז קומה (מהגבוהה לנמוכה)');
    expect(describeSort(SORT_PRESETS.ppsqm)).toBe('מחיר למ״ר (מהזול ליקר)');
  });
});

describe('describeFilters', () => {
  it('says when no filter is active, and always includes the sort', () => {
    expect(describeFilters(DEFAULT_FILTERS)).toEqual([
      ['ללא סינון (כל הדירות)', ''],
      ['מיון', 'מחיר למ״ר (מהזול ליקר)'],
    ]);
  });

  it('lists only the active filters, in panel order', () => {
    const rows = describeFilters(
      f({
        typeQuery: ['T5A', 'AM'],
        budgetMax: 2000,
        rooms: [3, 5],
        floorMin: 0,
        buildings: ['A1'],
        category: 'target',
        flags: ['pent'],
        storageFloors: ['קרקע', '-1'],
        sort: SORT_PRESETS.priceD,
      }),
    );
    expect(rows).toEqual([
      ['חיפוש טיפוס', 'T5A, AM'],
      ['תקציב מקסימלי (אלפי ₪)', '2000'],
      ['חדרים', '3, 5 – 5.5'],
      ['מקומה', '0'],
      ['בניין', 'A1'],
      ['סוג', 'מחיר מטרה'],
      ['מאפיינים', 'פנטהאוז'],
      ['קומת המחסן', 'קרקע, מינוס 1'],
      ['מיון', 'מחיר (מהיקר לזול)'],
    ]);
  });
});
