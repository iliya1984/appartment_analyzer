import { describe, expect, it } from 'vitest';
import {
  clampView,
  fitScale,
  fitView,
  focusView,
  MAX_ZOOM,
  panBy,
  relativeZoom,
  zoomAt,
} from '@/features/floor-plans/panZoom';
import { parsePlanState, planStateParams } from '@/features/floor-plans/modes';
import { buildingPlansPath } from '@/features/floor-plans/paths';

const vp = { w: 800, h: 600 };
const content = { w: 1600, h: 1300 };

describe('pan / zoom math', () => {
  it('fits the sheet and centres it', () => {
    expect(fitScale(vp, content)).toBeCloseTo(600 / 1300);
    const v = fitView(vp, content);
    expect(v.y).toBeCloseTo(0);
    expect(v.x).toBeCloseTo((800 - 1600 * v.s) / 2);
    expect(fitScale({ w: 0, h: 0 }, content)).toBe(1);
  });

  it('zooms around the pointer and clamps between fit and MAX_ZOOM', () => {
    const fit = fitView(vp, content);
    const z = zoomAt(fit, 2, 400, 300, vp, content);
    expect(z.s).toBeCloseTo(fit.s * 2);
    // the content point under the pointer stays under it
    const before = (400 - fit.x) / fit.s;
    const after = (400 - z.x) / z.s;
    expect(after).toBeCloseTo(before);
    expect(zoomAt(fit, 0.1, 0, 0, vp, content).s).toBeCloseTo(fit.s);
    expect(zoomAt(fit, 1000, 0, 0, vp, content).s).toBeCloseTo(fit.s * MAX_ZOOM);
    expect(relativeZoom(z, vp, content)).toBeCloseTo(2);
  });

  it('focuses a point and keeps the content on screen when panning', () => {
    const f = focusView(vp, content, [0.5, 0.5], 3);
    expect(f.x + 0.5 * 1600 * f.s).toBeCloseTo(400);
    expect(f.y + 0.5 * 1300 * f.s).toBeCloseTo(300);
    const corner = focusView(vp, content, [0, 0], 3);
    expect(corner.x).toBe(0); // clamped: no empty space beyond the edge
    expect(corner.y).toBe(0);
    const far = panBy(f, 1e5, -1e5, vp, content);
    expect(far.x).toBe(0);
    expect(far.y).toBeCloseTo(600 - 1300 * f.s);
    expect(clampView({ s: 0.01, x: 50, y: 50 }, vp, content).s).toBeCloseTo(fitScale(vp, content));
  });
});

describe('plan URL state', () => {
  it('parses and serialises', () => {
    expect(parsePlanState('floor', 'A1-p8', '9')).toEqual({
      mode: 'floor',
      sheetId: 'A1-p8',
      floor: 9,
    });
    expect(parsePlanState('bogus', null, 'x')).toEqual({ mode: null, sheetId: null, floor: null });
    expect(parsePlanState(undefined, undefined, '')).toEqual({
      mode: null,
      sheetId: null,
      floor: null,
    });
    expect(planStateParams({ mode: 'unit', sheetId: null, floor: 0 })).toEqual({
      mode: 'unit',
      floor: '0',
    });
    expect(planStateParams({ mode: null, sheetId: 'B2-p1', floor: null })).toEqual({
      sheet: 'B2-p1',
    });
  });

  it('builds the building plans route', () => {
    expect(buildingPlansPath('A1')).toBe('/buildings/A1/plans');
    expect(buildingPlansPath('B12', -1)).toBe('/buildings/B12/plans?floor=-1');
  });
});
