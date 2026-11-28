import { describe, expect, it } from 'vitest';
import {
  adjacentSheet,
  apartmentsOnSheet,
  buildingsWithPlans,
  coverageReport,
  type FloorPlanManifest,
  floorOnSheet,
  type PlanSheet,
  resolveSheet,
  sheetForFloor,
  sheetPlanType,
  sheetsForBuilding,
} from '@/domain/floorPlans';
import { dataset, row } from '@/test/factories';

const sheet = (p: Partial<PlanSheet> & Pick<PlanSheet, 'id' | 'kind'>): PlanSheet => ({
  building: 'A1',
  page: 1,
  floors: [],
  label: '',
  level: p.floors?.length ? Math.max(...p.floors) : 0,
  scale: 100,
  width: 1600,
  height: 1300,
  anchors: {},
  regions: {},
  ...p,
});

const m: FloorPlanManifest = {
  sheets: [
    sheet({
      id: 'A1-p1',
      kind: 'floor',
      page: 1,
      floors: [1],
      anchors: { 'T-T4A': [0.3, 0.4], 'T-T5B': [0.6, 0.4] },
    }),
    sheet({
      id: 'A1-p2',
      kind: 'floor',
      page: 2,
      floors: [2, 3, 4],
      anchors: { 'T-T4A': [0.3, 0.4], 'T-T5B': [0.6, 0.4] },
    }),
    sheet({ id: 'A1-p3', kind: 'roof', page: 3, label: 'גג', level: 9 }),
    sheet({ id: 'A1-p4', kind: 'ground', page: 4, label: 'קרקע', level: -1 }),
    sheet({
      id: 'A1-p5',
      kind: 'penthouse',
      page: 5,
      floors: [5],
      anchors: { 'T-P6.5F': [0.5, 0.5] },
      regions: {
        'T-P6.5F': [
          [0.4, 0.4],
          [0.6, 0.4],
          [0.6, 0.6],
        ],
      },
    }),
    sheet({
      id: 'D15-p1',
      building: 'D15',
      kind: 'unit',
      floors: [2, 3],
      planType: 'T-T5C',
      scale: 50,
      anchors: { 'T-T5C': [0.5, 0.5] },
    }),
  ],
  aliases: { 'A1:T-P6F': 'T-P6.5F' },
};

const d = dataset([
  row({ unit: 1, floor: 1, plan: 'T-T4A' }),
  row({ unit: 2, floor: 1, plan: 'T-T5B', rooms: 5 }),
  row({ unit: 3, floor: 3, plan: 'T-T4A' }),
  row({ unit: 4, floor: 3, plan: 'T-T5B', rooms: 5 }),
  row({ unit: 5, floor: 5, plan: 'T-P6F', rooms: 6 }),
  row({ unit: 6, floor: 3, plan: 'T-T3X', rooms: 3 }),
  row({ building: 'D15', unit: 1, floor: 2, plan: 'T-T5C', rooms: 5 }),
  row({ building: 'D15', unit: 2, floor: 2, plan: 'T-T3B', rooms: 3 }),
  row({ building: 'Z9', unit: 1, floor: 1 }),
]);
const apt = (id: string) => d.byId.get(id)!;

describe('floor plan manifest helpers', () => {
  it('resolves the labelled floor sheet with the unit anchor', () => {
    const r = resolveSheet(m, apt('A1-3'))!;
    expect(r.sheet.id).toBe('A1-p2');
    expect(r.anchor).toEqual([0.3, 0.4]);
    expect(r.region).toBeNull();
  });

  it('applies plan-type aliases and returns hand-drawn regions', () => {
    expect(sheetPlanType(m, apt('A1-5'))).toBe('T-P6.5F');
    const r = resolveSheet(m, apt('A1-5'))!;
    expect(r.sheet.id).toBe('A1-p5');
    expect(r.planType).toBe('T-P6.5F');
    expect(r.region).toHaveLength(3);
  });

  it('falls back to a unit sheet, then to the floor sheet without anchor, else null', () => {
    expect(resolveSheet(m, apt('D15-1'))?.sheet.id).toBe('D15-p1');
    expect(resolveSheet(m, apt('D15-2'))).toBeNull(); // only T-T5C has a plan in D15
    const unlabelled = resolveSheet(m, apt('A1-6'))!;
    expect(unlabelled.sheet.id).toBe('A1-p2');
    expect(unlabelled.anchor).toBeNull();
    expect(resolveSheet(m, apt('Z9-1'))).toBeNull();
  });

  it('orders sheets roof → floors → ground and finds neighbours', () => {
    expect(sheetsForBuilding(m, 'A1').map((s) => s.id)).toEqual([
      'A1-p3',
      'A1-p5',
      'A1-p2',
      'A1-p1',
      'A1-p4',
    ]);
    const p2 = m.sheets[1]!;
    expect(adjacentSheet(m, p2, 1)?.id).toBe('A1-p5');
    expect(adjacentSheet(m, p2, -1)?.id).toBe('A1-p1');
    expect(adjacentSheet(m, m.sheets[2]!, 1)).toBeUndefined();
    expect(adjacentSheet(m, sheet({ id: 'X', kind: 'roof' }), 1)).toBeUndefined();
    expect(sheetForFloor(m, 'A1', 4)?.id).toBe('A1-p2');
    expect(sheetForFloor(m, 'A1', 9)).toBeUndefined();
  });

  it('maps the units of a floor to the sheet labels (unit numbers change per floor)', () => {
    const p2 = m.sheets[1]!;
    const on3 = apartmentsOnSheet(m, d.apartments, p2, 3);
    expect([...on3.entries()].map(([t, a]) => `${t}:${a.number}`)).toEqual(['T-T4A:3', 'T-T5B:4']);
    expect(apartmentsOnSheet(m, d.apartments, p2, 1).size).toBe(0); // floor 1 is not on this sheet
    expect(apartmentsOnSheet(m, d.apartments, m.sheets[5]!, 2).get('T-T5C')?.id).toBe('D15-1');
  });

  it('picks the floor shown on a sheet', () => {
    const p2 = m.sheets[1]!;
    expect(floorOnSheet(p2, 3)).toBe(3);
    expect(floorOnSheet(p2, 9)).toBe(2);
    expect(floorOnSheet(p2, null)).toBe(2);
    expect(floorOnSheet(m.sheets[2]!, 3)).toBeNull();
  });

  it('reports apartments without a plan or without a label', () => {
    expect(coverageReport(m, d.apartments)).toEqual({
      missing: ['D15-2', 'Z9-1'],
      unlabelled: ['A1-6'],
    });
    expect([...buildingsWithPlans(m)].sort()).toEqual(['A1', 'D15']);
  });
});
