import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { loadPlanModel } from '@/data/plan-models';
import {
  FURNITURE_KINDS,
  type PlanFurniture,
  type PlanModel,
  type PlanSide,
} from '@/domain/planModel';
import { applySun, disposeModel } from '@/features/viewer3d/apartmentModel';
import { ApartmentViewer } from '@/features/viewer3d/ApartmentViewer';
import { createApartmentScene, type SceneHandle } from '@/features/viewer3d/createApartmentScene';
import {
  buildFurniture,
  buildPlanModelScene,
  CLEAR_H,
  CUT_H,
  furnitureParts,
  RAIL_H,
} from '@/features/viewer3d/planModelScene';

let model: PlanModel;
beforeAll(async () => {
  model = (await loadPlanModel('T-T5C'))!;
});
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const apt = builtInDataset.apartments.find((a) => a.planType === 'T-T5C')!;

function fakeRenderer() {
  const canvas = document.createElement('canvas');
  return {
    domElement: canvas,
    shadowMap: { enabled: false, type: 0 },
    outputColorSpace: '',
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  } as unknown as THREE.WebGLRenderer & {
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
}

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe('buildPlanModelScene', () => {
  it('builds walls, floors, outdoor decks and a label per space', () => {
    const m = buildPlanModelScene(model);
    expect(m.labels).toHaveLength(model.rooms.length + model.outdoor.length);
    for (const r of model.rooms)
      expect(m.scene.getObjectByName(`floor:${r.type}:${r.id}`)).toBeDefined();
    expect(m.scene.getObjectByName(`outdoor:balcony:${model.outdoor[0]!.id}`)).toBeDefined();
    expect(m.scene.getObjectByName('north-arrow')).toBeDefined();
    expect(m.orientationKnown).toBe(true);
    // geometry is merged per material: few draw calls
    let meshes = 0;
    m.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes++;
    });
    expect(meshes).toBeLessThan(40);
  });

  it('adds furniture (merged per material) and 1.05 m balcony railings', () => {
    const m = buildPlanModelScene(model);
    const furniture = m.scene.getObjectByName('furniture')!;
    expect(furniture.children.length).toBeGreaterThan(2);
    expect(furniture.children.length).toBeLessThanOrEqual(6); // one mesh per material
    const fb = box(furniture);
    expect(fb.min.y).toBeCloseTo(0, 2);
    expect(fb.max.y).toBeCloseTo(2.4, 2); // the wardrobes are the tallest pieces
    const rails = box(m.scene.getObjectByName('rails-bar')!);
    expect(rails.max.y).toBeCloseTo(RAIL_H, 2);
    expect(m.scene.getObjectByName('rails')).toBeDefined();
  });

  it('shapes each piece of furniture by kind, with the back on its side', () => {
    const top = (kind: PlanFurniture['kind']) =>
      Math.max(...furnitureParts({ kind, rect: [0, 0, 100, 200] }).map((p) => p[2]));
    expect(top('wardrobe')).toBe(2.4);
    expect(top('counter')).toBe(0.9);
    expect(top('table')).toBe(0.75);
    expect(top('fridge')).toBe(1.9);
    expect(top('shower')).toBe(0.05);
    for (const kind of FURNITURE_KINDS) expect(top(kind)).toBeGreaterThan(0);
    const back = (side: PlanSide) =>
      furnitureParts({ kind: 'sofa', rect: [0, 0, 200, 90], side })[1]![0];
    expect(back('n')).toEqual([0, 0, 200, 20]);
    expect(back('s')).toEqual([0, 70, 200, 20]);
    expect(back('w')).toEqual([0, 0, 20, 90]);
    expect(back('e')).toEqual([180, 0, 20, 90]);
    expect(buildFurniture([])).toBeNull();
  });

  it('is to scale: walls 2.7 m high, plan size in metres, centred', () => {
    const m = buildPlanModelScene(model);
    m.scene.updateMatrixWorld(true);
    const low = box(m.scene.getObjectByName('walls')!);
    const top = box(m.wallTops[0]!);
    expect(low.max.y).toBeCloseTo(CUT_H, 2);
    expect(top.min.y).toBeCloseTo(CUT_H, 2);
    expect(top.max.y).toBeCloseTo(CLEAR_H, 2);
    const all = box(m.planSpace.getObjectByName('slab')!);
    expect(all.max.x - all.min.x).toBeCloseTo(model.bounds[0] / 100, 1);
    expect(all.max.z - all.min.z).toBeCloseTo(model.bounds[1] / 100, 1);
    expect((all.max.x + all.min.x) / 2).toBeCloseTo(0, 1);
  });

  it('rotates the plan to true north', () => {
    const m = buildPlanModelScene({ ...model, northDeg: 90 });
    expect(m.outer.rotation.y).toBeCloseTo(-Math.PI / 2);
  });

  it('lets the sun in and disposes cleanly', () => {
    const m = buildPlanModelScene(model);
    const s = applySun(m, 9, 355);
    expect(s.el).toBeGreaterThan(0);
    expect(m.sun.intensity).toBeGreaterThan(0);
    const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    disposeModel(m);
    expect(spy.mock.calls.length).toBeGreaterThan(10);
  });
});

describe('createApartmentScene with a plan model', () => {
  let h: SceneHandle;
  const setup = () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const host = document.createElement('div');
    const r = fakeRenderer();
    const onUserInteract = vi.fn();
    h = createApartmentScene(host, apt, null, {
      createRenderer: () => r,
      plan: model,
      onUserInteract,
    });
    return { host, r, onUserInteract };
  };

  it('switches between dollhouse, top and walk cameras', () => {
    const { r } = setup();
    expect(h.camera()).toBeInstanceOf(THREE.PerspectiveCamera);
    h.setView('top');
    const top = h.camera();
    expect(top).toBeInstanceOf(THREE.OrthographicCamera);
    expect(top.position.y).toBeGreaterThan(10);
    h.setView('walk');
    const eye = h.camera();
    expect(eye.position.y).toBeCloseTo(1.6, 1);
    expect(eye instanceof THREE.PerspectiveCamera && eye.fov).toBe(70);
    h.setView('dollhouse');
    const orbit = h.camera();
    expect(orbit instanceof THREE.PerspectiveCamera && orbit.fov).toBe(36);
    h.dispose();
    expect(r.dispose).toHaveBeenCalled();
  });

  it('walks inside the apartment and stops at walls', () => {
    setup();
    h.setView('walk');
    const start = h.camera().position.clone();
    expect(h.walk(0.5, 0)).toBe(true);
    expect(h.camera().position.distanceTo(start)).toBeCloseTo(0.5, 1);
    // keep walking: sooner or later a wall blocks the way
    let blocked = false;
    for (let i = 0; i < 60 && !blocked; i++) blocked = !h.walk(0.5, 0);
    expect(blocked).toBe(true);
    h.walk(0, 0, Math.PI / 2);
    h.reset();
    expect(h.camera().position.distanceTo(start)).toBeCloseTo(0, 1);
    h.dispose();
  });

  it('toggles the dollhouse cut, labels, sun and reacts to input', () => {
    const { r, onUserInteract } = setup();
    h.setWallsCut(true);
    h.setLabels(false);
    h.setSun(12, 172);
    r.domElement.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    r.domElement.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 20, clientY: 5 }),
    );
    r.domElement.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    r.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
    h.setView('top');
    r.domElement.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 }),
    );
    r.domElement.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 2, clientX: 30, clientY: 30 }),
    );
    r.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    h.setView('walk');
    r.domElement.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 2, clientX: 60, clientY: 40 }),
    );
    r.domElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    r.domElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    r.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(onUserInteract).toHaveBeenCalledOnce();
    h.setAutoRotate(true);
    h.dispose();
  });

  it('ignores view changes for the schematic', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const r = fakeRenderer();
    const s = createApartmentScene(document.createElement('div'), apt, 90, {
      createRenderer: () => r,
    });
    s.setView('top');
    expect(s.camera()).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(s.walk(1, 0)).toBe(false);
    s.dispose();
  });
});

describe('ApartmentViewer with a plan model', () => {
  it('passes view and wall props to the scene and reports the handle', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const r = fakeRenderer();
    const onHandle = vi.fn();
    const { rerender, unmount } = render(
      <ApartmentViewer
        apartment={apt}
        orientation={null}
        plan={model}
        view="top"
        wallsCut
        sun={{ hour: 9, dayOfYear: 355 }}
        autoRotate={false}
        labels
        onHandle={onHandle}
        createRenderer={() => r}
      />,
    );
    expect(onHandle).toHaveBeenCalledWith(
      expect.objectContaining({ setView: expect.any(Function) }),
    );
    expect(screen.getByText('גררו להזזה, גלגלת או צביטה לזום')).toBeInTheDocument();
    rerender(
      <ApartmentViewer
        apartment={apt}
        orientation={null}
        plan={model}
        view="walk"
        wallsCut={false}
        sun={{ hour: 12, dayOfYear: 172 }}
        autoRotate={false}
        labels={false}
        onHandle={onHandle}
        createRenderer={() => r}
      />,
    );
    expect(screen.getByText(/W A S D/)).toBeInTheDocument();
    unmount();
    expect(onHandle).toHaveBeenLastCalledWith(null);
  });
});
