import { describe, expect, it } from 'vitest';
import { buildDataset, compareBuildingIds, countTarget, parseStorage } from '@/domain/dataset';
import { dataset, row, testMeta } from '@/test/factories';

describe('parseStorage', () => {
  it.each([
    ['קרקע עליון', 'קרקע', 'עליון'],
    ['קרקע תחתון', 'קרקע', 'תחתון'],
    ['קרקע', 'קרקע', ''],
    ['-1', '-1', ''],
    ['-2.00', '-2', ''],
  ])('%s → floor %s, sub %s', (raw, floor, sub) => {
    expect(parseStorage('7', 5.5, raw)).toEqual({ no: '7', area: 5.5, floor, sub });
  });
});

describe('compareBuildingIds', () => {
  it('sorts by letter, then numerically', () => {
    expect(['B10', 'A7', 'B2', 'A1', 'C3'].sort(compareBuildingIds)).toEqual([
      'A1',
      'A7',
      'B2',
      'B10',
      'C3',
    ]);
  });
});

describe('buildDataset', () => {
  it('derives ids, kinds, categories and price per m²', () => {
    const d = dataset([
      row({ building: 'B2', unit: 5, plan: 'T-G4A', price: 2_000_000, area: 100 }),
      row({ building: 'B2', unit: 6, plan: 'T-P6A', target: 0, price: null }),
      row({ building: 'B2', unit: 7, plan: 'T-X4A' }),
    ]);
    const [garden, pent, odd] = d.apartments;
    expect(garden).toMatchObject({
      id: 'B2-5',
      kind: 'G',
      category: 'target',
      pricePerSqm: 20_000,
    });
    expect(pent).toMatchObject({ id: 'B2-6', kind: 'P', category: 'free', pricePerSqm: null });
    expect(odd?.kind).toBe('T'); // unknown kind letters fall back to "regular"
  });

  it('buckets rooms (capped at 6)', () => {
    const d = dataset([row({ rooms: 4.5 }), row({ unit: 2, rooms: 6.5 })]);
    expect(d.apartments.map((a) => a.roomsBucket)).toEqual([4, 6]);
  });

  it('marks top and bottom floors per building', () => {
    const d = dataset([
      row({ unit: 1, floor: 0 }),
      row({ unit: 2, floor: 3 }),
      row({ unit: 3, floor: 1 }),
    ]);
    expect(d.apartments.map((a) => [a.isBottomFloor, a.isTopFloor])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
  });

  it('computes building stats, with null price range when nothing is priced', () => {
    const d = dataset([
      row({ building: 'A1', unit: 1, price: 1_000_000, area: 80, storageArea: 4 }),
      row({ building: 'A1', unit: 2, price: 2_000_000, area: 120, storageArea: 8, target: 0 }),
      row({ building: 'C3', unit: 1, price: null }),
    ]);
    expect(d.buildingStats.get('A1')).toMatchObject({
      units: 2,
      targetUnits: 1,
      avgArea: 100,
      priceMin: 1_000_000,
      priceMax: 2_000_000,
      avgStorageArea: 6,
    });
    expect(d.buildingStats.get('C3')).toMatchObject({ priceMin: null, priceMax: null });
    expect(countTarget(d)).toBe(2);
  });

  it('groups peers by plan when the plan has ≥ 4 priced units, otherwise by rooms + kind', () => {
    const plan = [1, 2, 3, 4].map((n) =>
      row({ unit: n, plan: 'T-T4A', price: 1_000_000 + n * 10_000 }),
    );
    const small = [
      row({ unit: 10, plan: 'T-T4B', price: 1_100_000 }),
      row({ unit: 11, plan: 'T-T4C', price: 1_300_000 }),
    ];
    const d = dataset([...plan, ...small]);
    expect(d.byId.get('A1-1')?.comparison).toMatchObject({
      key: 'p:T-T4A',
      label: 'מתוכנית T-T4A',
      rank: 1,
      size: 4,
    });
    expect(d.byId.get('A1-11')?.comparison).toMatchObject({
      key: 'k:4T',
      label: 'בנות 4 חדרים (רגילה)',
      rank: 2,
      size: 2,
    });
  });

  it('is pure: does not mutate the input rows and returns equal output for equal input', () => {
    const rows = [row({ unit: 1 }), row({ unit: 2, price: null })];
    const copy = JSON.parse(JSON.stringify(rows));
    const a = buildDataset(rows, testMeta);
    const b = buildDataset(rows, testMeta);
    expect(rows).toEqual(copy);
    expect(a.apartments).toEqual(b.apartments);
    expect(a.meta).toBe(testMeta);
  });
});
