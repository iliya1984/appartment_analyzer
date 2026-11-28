import { beforeAll, describe, expect, it } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { hasPlanModel, loadPlanModel, modelledPlanTypes } from '@/data/plan-models';
import {
  countedRooms,
  dimsDeviation,
  netArea,
  outdoorArea,
  type PlanModel,
  type PlanRoomType,
  type Rect,
  salonFacade,
  validateModel,
} from '@/domain/planModel';
import traced5C from './fixtures/T-T5C-D13.json';

const apartments = builtInDataset.apartments;
const COUNTED_TYPES = new Set<PlanRoomType>(['salon', 'master', 'bed', 'mamad']);
const overlaps = (a: Rect, b: Rect) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
/** Every point of a (sampled every 5 cm) lies in one of the rectangles. */
const insideUnion = (a: Rect, rs: readonly Rect[]) => {
  const xs = [a[0] + a[2] - 0.5];
  const ys = [a[1] + a[3] - 0.5];
  for (let x = a[0]; x < a[0] + a[2]; x += 5) xs.push(x + 0.5);
  for (let y = a[1]; y < a[1] + a[3]; y += 5) ys.push(y + 0.5);
  return xs.every((x) =>
    ys.every((y) => rs.some((q) => x >= q[0] && y >= q[1] && x <= q[0] + q[2] && y <= q[1] + q[3])),
  );
};
/** Width and depth of the box around a union of rectangles. */
const bbox = (rs: readonly Rect[]): [number, number] => [
  Math.max(...rs.map((q) => q[0] + q[2])) - Math.min(...rs.map((q) => q[0])),
  Math.max(...rs.map((q) => q[1] + q[3])) - Math.min(...rs.map((q) => q[1])),
];

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
    // x.5 rooms: the half room is drawn as a small bedroom
    expect(countedRooms(m)).toBeGreaterThanOrEqual(Math.floor(same[0]!.rooms));
    expect(countedRooms(m)).toBeLessThanOrEqual(Math.ceil(same[0]!.rooms));
  });

  it('T-T5C: every room matches the dimension labels of the 1:50 sheet (±3 cm)', async () => {
    const m = (await loadPlanModel('T-T5C'))!;
    expect(m.source.method).toBe('measured');
    // the labels written on the sheet, width × depth in cm
    const sheet: [string, number, number][] = [
      ['חדר שינה', 345, 280],
      ['חדר שינה', 280, 335],
      ['חדר הורים', 305, 318],
      ['רחצת הורים', 185, 165],
      ['מקלחת אורחים', 115, 168],
      ['חדר שירות', 150, 227],
      ['רחצה', 180, 227],
      ['ממ״ד / חדר', 320, 275],
      ['סלון', 410, 417],
      ['מטבח', 355, 275],
      ['פינת אוכל', 430, 275],
    ];
    const withDims = m.rooms.filter((r) => r.dims);
    expect(withDims.map((r) => [r.label, ...r.dims!])).toEqual(sheet);
    for (const r of withDims) expect(dimsDeviation(r), r.label).toBeLessThanOrEqual(3);
    // the corridor and the balcony are modelled too
    expect(m.rooms.find((r) => r.type === 'hall')!.areaM2).toBeGreaterThan(8);
    const balcony = m.outdoor.find((o) => o.type === 'balcony')!;
    expect(balcony.covered).toBe(true);
    // balcony 386 cm wide at the top, 441 cm at the bottom, 938 cm long (sheet labels)
    const xs = balcony.rects.map((r) => r[2]).sort((a, b) => a - b);
    expect(xs).toEqual([386, 441]);
    expect(balcony.rects.reduce((s, r) => s + r[3], 0)).toBe(938);
  });

  it('T-T5C: furniture and railings stay inside the unit and off the walls', async () => {
    const m = (await loadPlanModel('T-T5C'))!;
    expect(m.furniture!.length).toBeGreaterThan(20);
    expect(m.rails!.length).toBeGreaterThan(0);
    const overlaps = (a: Rect, b: Rect) =>
      a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
    const spaces = [...m.rooms, ...m.outdoor].flatMap((r) => r.rects);
    for (const f of m.furniture!) {
      expect(
        m.walls.some((w) => overlaps(f.rect, w)),
        `${f.kind} ${f.rect.join(',')}`,
      ).toBe(false);
      expect(
        spaces.some((s) => overlaps(f.rect, s)),
        `${f.kind} ${f.rect.join(',')}`,
      ).toBe(true);
    }
    for (const k of ['bed-double', 'sofa', 'table', 'counter', 'toilet', 'bathtub'])
      expect(m.furniture!.some((f) => f.kind === k)).toBe(true);
  });

  it('every plan type of the project has a model (no schematic fallback left)', () => {
    const types = new Set(apartments.map((a) => a.planType));
    const missing = [...types].filter((t) => !hasPlanModel(t));
    expect(missing).toEqual([]);
  });

  describe.each(modelledPlanTypes())('%s geometry', (t) => {
    let m: PlanModel;
    beforeAll(async () => {
      m = (await loadPlanModel(t))!;
    });
    const spaces = () => [...m.rooms, ...m.outdoor];

    it('rooms, walls and openings do not overlap; one entrance', () => {
      const solids = [...m.walls, ...m.openings.map((o) => o.rect)];
      for (const r of spaces())
        for (const q of r.rects)
          expect(
            solids.some((s) => overlaps(q, s)),
            `${r.label} [${q.join(',')}]`,
          ).toBe(false);
      const all = spaces().flatMap((r) => r.rects.map((q) => [r.id, q] as const));
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++)
          if (all[i]![0] !== all[j]![0])
            expect(overlaps(all[i]![1], all[j]![1]), `${all[i]![0]} × ${all[j]![0]}`).toBe(false);
      expect(m.openings.filter((o) => o.kind === 'entrance')).toHaveLength(1);
      expect(m.openings.some((o) => o.kind === 'window' || o.kind === 'slider')).toBe(true);
    });

    it('has the rooms of an apartment at realistic sizes, corridors included', () => {
      const types = m.rooms.map((r) => r.type);
      expect(types).toEqual(expect.arrayContaining(['salon', 'bath', 'mamad']));
      // the kitchen is a room of its own or part of the open-plan salon
      expect(m.rooms.some((r) => r.type === 'kitchen' || r.label.includes('מטבח'))).toBe(true);
      expect(types.filter((x) => x === 'master').length).toBeGreaterThanOrEqual(1);
      for (const r of m.rooms) {
        const [w, d] = bbox(r.rects);
        if (r.type === 'mamad') expect(r.areaM2, r.label).toBeGreaterThan(8.3);
        if (r.type === 'master') expect(r.areaM2, r.label).toBeGreaterThan(10);
        // bedrooms: a "half room" is ~6.5 m² and 2 m wide, the others at least 2.6 m wide
        if (r.type === 'bed') {
          expect(r.areaM2, r.label).toBeGreaterThan(6);
          expect(Math.min(w, d), r.label).toBeGreaterThanOrEqual(r.areaM2 < 8 ? 190 : 260);
        }
        if (r.type === 'salon') expect(r.areaM2, r.label).toBeGreaterThan(17);
        if (r.type === 'bath' || r.type === 'wc') expect(r.areaM2, r.label).toBeLessThan(7);
      }
      // the hall of all but the smallest open-plan units is a room of its own
      if (m.rooms.filter((r) => COUNTED_TYPES.has(r.type)).length >= 4)
        expect(types).toContain('hall');
    });

    it('is furnished: pieces inside rooms, off walls and openings', () => {
      const f = m.furniture ?? [];
      expect(f.length).toBeGreaterThan(8);
      const solids = [...m.walls, ...m.openings.map((o) => o.rect)];
      for (const p of f) {
        const where = `${p.kind} ${p.rect.join(',')}`;
        expect(
          solids.some((s) => overlaps(p.rect, s)),
          where,
        ).toBe(false);
        expect(
          spaces().some((r) => insideUnion(p.rect, r.rects)),
          where,
        ).toBe(true);
      }
      for (const k of ['sofa', 'counter', 'toilet', 'table'] as const)
        expect(
          f.some((p) => p.kind === k),
          k,
        ).toBe(true);
      // a bed in every bedroom
      const beds = f.filter((p) => p.kind === 'bed-double' || p.kind === 'bed-single');
      for (const r of m.rooms.filter((x) => ['master', 'bed', 'mamad'].includes(x.type)))
        expect(
          beds.some((b) => insideUnion(b.rect, r.rects)),
          `${r.label} ${r.areaM2}`,
        ).toBe(true);
    });

    it('balconies / roof terraces match the price file (net 75–100 % of the gross figure)', () => {
      const a = apartments.find((x) => x.planType === t)!;
      const sum = (k: string) =>
        m.outdoor.filter((o) => o.type === k).reduce((s, o) => s + o.areaM2, 0);
      // garden units: the price file mixes the patio and the garden, so no comparison
      if (sum('garden') > 0) return;
      const net = sum('balcony') + sum('roof-terrace');
      expect(net / a.outdoor).toBeGreaterThanOrEqual(0.75);
      expect(net / a.outdoor).toBeLessThanOrEqual(1.0);
    });
  });

  it('1:100 tracing (T-T5C on the D13 sheet) reproduces the 1:50 dimension labels', async () => {
    // the same plan traced by `npm run plans:vector` from the 1:100 building sheet, checked
    // against the labels written on the 1:50 unit sheet: this calibrates every vector model
    const traced = traced5C as unknown as PlanModel;
    const measured = (await loadPlanModel('T-T5C'))!;
    const devOf = (rects: readonly Rect[], [w, d]: readonly [number, number]) => {
      const fit = ([a, b]: readonly number[]) =>
        Math.min(
          Math.max(Math.abs(a! - w), Math.abs(b! - d)),
          Math.max(Math.abs(a! - d), Math.abs(b! - w)),
        );
      const big = rects.reduce((x, q) => (q[2] * q[3] > x[2] * x[3] ? q : x));
      return Math.min(fit(bbox(rects)), fit([big[2], big[3]]));
    };
    const report: Record<string, number> = {};
    for (const r of measured.rooms.filter((x) => x.dims)) {
      const cands = traced.rooms.filter((x) => x.label.split(', ').includes(r.label));
      report[`${r.label} ${r.dims!.join('×')}`] = Math.min(
        ...cands.map((c) => devOf(c.rects, r.dims!)),
      );
    }
    // closed rooms: within 5 cm of the label in both directions
    for (const [k, dev] of Object.entries(report))
      if (!/סלון|מטבח|פינת אוכל|חדר הורים/.test(k)) expect(dev, k).toBeLessThanOrEqual(5);
    // the open-plan salon (traced together with the dining corner) keeps its 410 × 417
    const salon = traced.rooms.find((x) => x.type === 'salon')!;
    const big = salon.rects.reduce((x, q) => (q[2] * q[3] > x[2] * x[3] ? q : x));
    expect(Math.abs(big[2] - 410) + Math.abs(big[3] - 417)).toBeLessThanOrEqual(5);
    // and the whole unit agrees with the hand-measured model within 2 %
    expect(netArea(traced) / netArea(measured)).toBeGreaterThan(0.98);
    expect(netArea(traced) / netArea(measured)).toBeLessThan(1.02);
  });

  it('T-T5C: measured from the 1:50 sheet', async () => {
    const m = (await loadPlanModel('T-T5C'))!;
    // contract area 128.2 m² includes walls; the rooms inside are ~80–85 % of it
    expect(netArea(m)).toBeGreaterThan(102);
    expect(netArea(m)).toBeLessThan(110);
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
