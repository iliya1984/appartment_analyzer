import { describe, expect, it } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { hasPlanModel, loadPlanModel, modelledPlanTypes } from '@/data/plan-models';
import { countedRooms, netArea, outdoorArea, salonFacade, validateModel } from '@/domain/planModel';

const apartments = builtInDataset.apartments;

describe('plan models (extracted from the sales plans)', () => {
  it('lists the modelled types; every one is a real plan type of the project', () => {
    const types = modelledPlanTypes();
    expect(types).toContain('T-T5C');
    for (const t of types)
      expect(
        apartments.some((a) => a.planType === t),
        t,
      ).toBe(true);
    expect(hasPlanModel('T-T5C')).toBe(true);
    expect(hasPlanModel('T-NOPE')).toBe(false);
  });

  it('returns null for types without a model', async () => {
    expect(await loadPlanModel('T-NOPE')).toBeNull();
  });

  it.each(modelledPlanTypes())('%s passes the schema and matches the dataset', async (t) => {
    const m = (await loadPlanModel(t))!;
    expect(m.planType).toBe(t);
    const same = apartments.filter((a) => a.planType === t);
    expect(same.length).toBeGreaterThan(0);
    expect(validateModel(m, same).filter((i) => i.level === 'error')).toEqual([]);
    expect(countedRooms(m)).toBe(Math.floor(same[0]!.rooms));
  });

  it('T-T5C: measured from the 1:50 sheet', async () => {
    const m = (await loadPlanModel('T-T5C'))!;
    // contract area 128.2 m² includes walls; the rooms inside are ~85 % of it
    expect(netArea(m)).toBeGreaterThan(104);
    expect(netArea(m)).toBeLessThan(115);
    // covered balcony 43.0 m² in the price file
    expect(outdoorArea(m)).toBeGreaterThan(39);
    expect(outdoorArea(m)).toBeLessThan(47);
    // windows of 120 cm (drawn 115–120) on the north facade
    const north = m.openings.filter((o) => o.kind === 'window' && o.rect[1] < 60);
    expect(north.length).toBeGreaterThanOrEqual(2);
    for (const o of north) expect(o.rect[2]).toBeGreaterThan(105);
    expect(m.openings.some((o) => o.kind === 'entrance')).toBe(true);
    expect(m.openings.filter((o) => o.kind === 'slider').length).toBeGreaterThanOrEqual(2);
    // the salon opens east onto the balcony
    expect(salonFacade(m)).toBe(90);
    expect(m.rooms.map((r) => r.type)).toEqual(
      expect.arrayContaining(['salon', 'master', 'bed', 'mamad', 'bath', 'wc', 'hall']),
    );
  });
});
