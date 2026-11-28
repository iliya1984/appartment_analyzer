import { describe, expect, it } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import {
  buildManifest,
  floorPlanManifest,
  generatedSchema,
  sheetMapSchema,
} from '@/data/floor-plans/manifest';
import generated from '@/data/floor-plans/sheets.generated.json';
import sheetMap from '@/data/floor-plans/sheet-map.json';
import { coverageReport, sheetPlanType, sheetsForBuilding } from '@/domain/floorPlans';
import { renderedSheetIds, sheetImage } from '@/features/floor-plans/sheetImages';

const m = floorPlanManifest;
const apartments = builtInDataset.apartments;

describe('floor-plan manifest (real data)', () => {
  it('validates and every mapped sheet was rendered', () => {
    const built = buildManifest(sheetMapSchema.parse(sheetMap), generatedSchema.parse(generated));
    expect(built.notRendered).toEqual([]);
    expect(m.sheets).toHaveLength(93);
  });

  it('has both image resolutions for every sheet and no stray images', () => {
    for (const s of m.sheets) {
      const img = sheetImage(s.id);
      expect(img?.x1, s.id).toMatch(/@1x\.webp$/);
      expect(img?.x2, s.id).toMatch(/@2x\.webp$/);
    }
    expect(renderedSheetIds()).toEqual(m.sheets.map((s) => s.id).sort());
    expect(sheetImage('nope')).toBeNull();
  });

  it('covers every dataset floor exactly once per building (except D15)', () => {
    for (const b of builtInDataset.buildings) {
      if (b === 'D15') continue;
      const floors = new Set(apartments.filter((a) => a.building === b).map((a) => a.floor));
      const sheets = sheetsForBuilding(m, b).filter((s) => s.kind !== 'unit');
      for (const f of floors) {
        const hits = sheets.filter((s) => s.floors.includes(f));
        expect(
          hits.map((s) => s.id),
          `${b} floor ${f}`,
        ).toHaveLength(1);
      }
      for (const s of sheets)
        for (const f of s.floors) expect(floors.has(f), `${s.id} floor ${f}`).toBe(true);
    }
  });

  it('labels on each sheet are exactly the plan types of its floors in the dataset', () => {
    for (const s of m.sheets) {
      if (s.kind === 'unit') continue;
      for (const f of s.floors) {
        const types = apartments
          .filter((a) => a.building === s.building && a.floor === f)
          .map((a) => sheetPlanType(m, a))
          .sort();
        expect(Object.keys(s.anchors).sort(), `${s.id} floor ${f}`).toEqual(types);
      }
    }
  });

  it('service sheets (roof, lobby) carry no unit labels', () => {
    for (const s of m.sheets.filter((x) => x.floors.length === 0))
      expect(Object.keys(s.anchors), s.id).toEqual([]);
  });

  it('has a plan for every apartment except the D15 types without sheets', () => {
    const report = coverageReport(m, apartments);
    expect(report.unlabelled).toEqual([]);
    const missing = report.missing.map((id) => builtInDataset.byId.get(id)!);
    expect(missing.every((a) => a.building === 'D15' && a.planType !== 'T-T5C')).toBe(true);
    // D15 has no building set: only the T-T5C unit sheet (floors 2–5) was delivered.
    expect(
      apartments
        .filter((a) => a.building === 'D15' && a.planType === 'T-T5C')
        .every((a) => !report.missing.includes(a.id)),
    ).toBe(true);
    expect(apartments.length - missing.length).toBeGreaterThan(380);
  });

  it('anchors are inside the drawing, away from the cropped title block', () => {
    for (const s of m.sheets)
      for (const [t, [x, y]] of Object.entries(s.anchors)) {
        expect(x, `${s.id} ${t}`).toBeGreaterThan(0.02);
        expect(x, `${s.id} ${t}`).toBeLessThan(0.98);
        expect(y, `${s.id} ${t}`).toBeGreaterThan(0.02);
        expect(y, `${s.id} ${t}`).toBeLessThan(0.98);
      }
  });
});
