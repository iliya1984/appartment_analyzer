import { describe, expect, it } from 'vitest';
import {
  countedRooms,
  dimsDeviation,
  hitsWall,
  mirrorModel,
  modelSize,
  netArea,
  outdoorArea,
  type PlanModel,
  type Rect,
  rectsArea,
  salonFacade,
  startPoint,
  validateModel,
} from '@/domain/planModel';

/**
 * 10 m × 8 m unit, 20 cm walls. Salon (left) with a slider in the top wall, bedroom (right).
 *   y=0   ┌──────[slider]──┬───────────┐
 *         │ salon 480×760  │ bed       │
 *   y=800 └──[entrance]────┴───────────┘
 */
const model: PlanModel = {
  planType: 'T-T2X',
  source: { file: 'x.pdf', page: 1, scale: 50, method: 'layers' },
  unitsCm: true,
  northDeg: 0,
  bounds: [1000, 800],
  entrance: [250, 790],
  walls: [
    [0, 0, 100, 20],
    [400, 0, 600, 20],
    [0, 780, 200, 20],
    [300, 780, 700, 20],
    [0, 20, 20, 760],
    [980, 20, 20, 760],
    [500, 20, 20, 760],
  ],
  openings: [
    { kind: 'slider', rect: [100, 0, 300, 20], sill: 0, head: 230 },
    { kind: 'entrance', rect: [200, 780, 100, 20], sill: 0, head: 210 },
  ],
  rooms: [
    {
      id: 'r1',
      type: 'salon',
      label: 'סלון',
      rects: [[20, 20, 480, 760]],
      areaM2: 36.5,
      center: [260, 400],
    },
    {
      id: 'r2',
      type: 'bed',
      label: 'חדר שינה',
      rects: [[520, 20, 460, 760]],
      areaM2: 35,
      center: [750, 400],
    },
  ],
  outdoor: [
    {
      id: 'o1',
      type: 'balcony',
      label: 'מרפסת',
      rects: [[0, -200, 500, 200]],
      areaM2: 10,
      center: [250, -100],
      covered: false,
    },
  ],
};

describe('plan model helpers', () => {
  it('sums areas and counts rooms', () => {
    expect(rectsArea(model.rooms[0]!.rects)).toBe(480 * 760);
    expect(netArea(model)).toBeCloseTo(71.5);
    expect(outdoorArea(model)).toBe(10);
    expect(countedRooms(model)).toBe(2);
    expect(modelSize(model)).toEqual({ w: 10, d: 8 });
  });

  it('validates against the dataset', () => {
    const ok = validateModel(model, [{ planType: 'T-T2X', area: 82, outdoor: 10, rooms: 2 }]);
    expect(ok.filter((i) => i.level === 'error')).toEqual([]);
    const bad = validateModel(model, [{ planType: 'T-T2X', area: 60, outdoor: 20, rooms: 3 }]);
    expect(bad.map((i) => i.level)).toEqual(['error', 'warn', 'error']);
    const broken = validateModel(
      {
        ...model,
        rooms: [{ ...model.rooms[0]!, areaM2: 50 }],
        openings: [{ kind: 'window', rect: [0, 0, 2000, 20], sill: 100, head: 90 }],
      },
      [],
    );
    expect(broken.map((i) => i.message)).toEqual([
      expect.stringMatching(/^r1: area 50/),
      'geometry outside bounds',
      'bad opening heights 100–90',
    ]);
  });

  it('finds the facade of the salon and rotates it with north', () => {
    expect(salonFacade(model)).toBe(0); // slider in the top wall, top = north
    expect(salonFacade({ ...model, northDeg: 90 })).toBe(90);
    expect(salonFacade({ ...model, openings: [] })).toBeNull();
    expect(salonFacade({ ...model, rooms: [model.rooms[1]!] })).toBeNull();
    const east: PlanModel = {
      ...model,
      openings: [{ kind: 'window', rect: [500, 300, 20, 120], sill: 90, head: 220 }],
    };
    expect(salonFacade(east)).toBe(90);
  });

  it('mirrors left ↔ right', () => {
    const mm = mirrorModel(model, 'T-T2Y');
    expect(mm.planType).toBe('T-T2Y');
    expect(mm.walls[0]).toEqual([900, 0, 100, 20]);
    expect(mm.rooms[0]!.center).toEqual([740, 400]);
    expect(mm.entrance).toEqual([750, 790]);
    expect(netArea(mm)).toBeCloseTo(netArea(model));
    expect(mirrorModel({ ...model, entrance: null }, 'Z').entrance).toBeNull();
  });

  it('mirrors rails and furniture, swapping east and west sides', () => {
    const m: PlanModel = {
      ...model,
      rails: [[0, 0, 100, 6]],
      furniture: [
        { kind: 'sofa', rect: [10, 10, 200, 90], side: 'w' },
        { kind: 'bed-double', rect: [600, 100, 180, 200], side: 'n' },
        { kind: 'table', rect: [300, 300, 100, 100] },
      ],
    };
    const mm = mirrorModel(m, 'Z');
    expect(mm.rails).toEqual([[900, 0, 100, 6]]);
    expect(mm.furniture).toEqual([
      { kind: 'sofa', rect: [790, 10, 200, 90], side: 'e' },
      { kind: 'bed-double', rect: [220, 100, 180, 200], side: 'n' },
      { kind: 'table', rect: [600, 300, 100, 100] },
    ]);
    // models without the optional parts stay without them
    expect(mirrorModel(model, 'Z')).not.toHaveProperty('furniture');
  });

  it('measures how far a room is from the dimensions written on the sheet', () => {
    const room = (rects: Rect[], dims?: [number, number]) => ({
      id: 'r',
      type: 'bed' as const,
      label: '',
      rects,
      areaM2: 1,
      center: [0, 0] as const,
      ...(dims ? { dims } : {}),
    });
    expect(dimsDeviation(room([[0, 0, 347, 282]]))).toBeNull();
    expect(dimsDeviation(room([[0, 0, 347, 282]], [345, 280]))).toBe(2);
    // either orientation; the largest rect of an L-shaped room counts
    expect(
      dimsDeviation(
        room(
          [
            [0, 0, 280, 345],
            [0, 345, 50, 50],
          ],
          [345, 280],
        ),
      ),
    ).toBe(0);
    expect(dimsDeviation(room([[0, 0, 300, 300]], [345, 280]))).toBe(45);
  });

  it('collides with walls and starts inside the entrance', () => {
    expect(hitsWall(model, 10, 400)).toBe(true);
    expect(hitsWall(model, 260, 400)).toBe(false);
    const [x, y] = startPoint(model);
    expect(hitsWall(model, x, y)).toBe(false);
    expect(y).toBeLessThan(790);
    expect(startPoint({ ...model, entrance: null })).toEqual([260, 400]);
  });
});
