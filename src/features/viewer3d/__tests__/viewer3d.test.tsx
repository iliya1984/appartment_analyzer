import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import {
  applySun,
  buildApartmentModel,
  disposeModel,
  LIGHT_SCALE,
  sunLighting,
} from '@/features/viewer3d/apartmentModel';
import { ApartmentViewer } from '@/features/viewer3d/ApartmentViewer';
import {
  createApartmentScene,
  WebGLUnavailableError,
} from '@/features/viewer3d/createApartmentScene';
import { dataset, row } from '@/test/factories';

beforeEach(() => {
  // jsdom has no 2D canvas; labels are still created (without drawing).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const d = dataset([
  row({ unit: 1, plan: 'T-T4A', rooms: 4 }),
  row({ unit: 2, plan: 'T-P6A', rooms: 6, outdoor: 150 }),
  row({ unit: 3, plan: 'T-G5A', rooms: 5, outdoor: 90 }),
]);
const [regular, pent, garden] = d.apartments as [never, never, never];
const named = (m: ReturnType<typeof buildApartmentModel>, name: string) =>
  m.scene.getObjectByName(name);

/** A stand-in for WebGLRenderer that records calls. */
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

describe('buildApartmentModel', () => {
  it('builds floors and labels for every room', () => {
    const m = buildApartmentModel(regular, null);
    expect(m.labels).toHaveLength(7);
    expect(named(m, 'floor:salon')).toBeDefined();
    expect(named(m, 'balcony')).toBeDefined();
    expect(named(m, 'north-arrow')).toBeUndefined();
    expect(m.orientationKnown).toBe(false);
    expect(m.sunBall.visible).toBe(false); // neutral lighting
    expect(m.sun.intensity).toBeCloseTo(0.75 * LIGHT_SCALE);
  });

  it('adds a roof terrace for penthouses and a lawn for garden apartments', () => {
    expect(named(buildApartmentModel(pent, null), 'terrace')).toBeDefined();
    expect(named(buildApartmentModel(pent, null), 'balcony')).toBeUndefined();
    expect(named(buildApartmentModel(garden, null), 'lawn')).toBeDefined();
  });

  it('rotates to the orientation and shows north when it is known', () => {
    const m = buildApartmentModel(regular, 90);
    expect(m.outer.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(named(m, 'north-arrow')).toBeDefined();
    expect(named(m, 'north-label')).toBeDefined();
  });

  it('disposes every geometry and material', () => {
    const m = buildApartmentModel(regular, 0);
    const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    disposeModel(m);
    expect(spy.mock.calls.length).toBeGreaterThan(20);
  });
});

describe('sun lighting', () => {
  it('is dark at night, warm at dusk and bright by day', () => {
    expect(sunLighting(-5)).toMatchObject({ sun: 0, groundColor: 0x3a4147 });
    expect(sunLighting(30).sun).toBeCloseTo(1.25 * LIGHT_SCALE);
    expect(sunLighting(6).sky.getHex()).not.toBe(sunLighting(30).sky.getHex());
  });

  it('places the sun in the south at noon', () => {
    const m = buildApartmentModel(regular, 180);
    const s = applySun(m, 12, 172);
    expect(s.az).toBeCloseTo(180);
    expect(m.sun.position.z).toBeGreaterThan(0); // south = +z
    expect(m.sunBall.visible).toBe(true);
  });
});

describe('createApartmentScene', () => {
  it('renders, reacts to controls, and cleans up on dispose', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const host = document.createElement('div');
    const r = fakeRenderer();
    const onUserInteract = vi.fn();
    const h = createApartmentScene(host, regular, 45, { createRenderer: () => r, onUserInteract });
    expect(host.querySelector('canvas')).not.toBeNull();
    expect(r.render).toHaveBeenCalledOnce();
    expect(raf).toHaveBeenCalled();

    r.domElement.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    r.domElement.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 30, clientY: 10 }),
    );
    r.domElement.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    r.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
    expect(onUserInteract).toHaveBeenCalledOnce();

    h.setSun(9, 355);
    h.setLabels(false);
    h.setAutoRotate(true);
    h.dispose();
    expect(r.dispose).toHaveBeenCalled();
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('throws WebGLUnavailableError when the renderer cannot be created', () => {
    expect(() =>
      createApartmentScene(document.createElement('div'), regular, null, {
        createRenderer: () => {
          throw new Error('no webgl');
        },
      }),
    ).toThrow(WebGLUnavailableError);
  });
});

describe('ApartmentViewer', () => {
  const a = builtInDataset.apartments[0]!;

  it('shows a message when WebGL is not available', () => {
    render(<ApartmentViewer apartment={a} orientation={null} sun={null} autoRotate labels />);
    expect(screen.getByText('הדפדפן לא תומך בתצוגת תלת־ממד.')).toBeInTheDocument();
  });

  it('mounts the scene and disposes it on unmount', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const r = fakeRenderer();
    const { unmount, rerender } = render(
      <ApartmentViewer
        apartment={a}
        orientation={90}
        sun={{ hour: 9, dayOfYear: 355 }}
        autoRotate
        labels
        createRenderer={() => r}
      />,
    );
    expect(screen.getByRole('img', { name: 'הדמיה תלת־ממדית של הדירה' })).toBeInTheDocument();
    rerender(
      <ApartmentViewer
        apartment={a}
        orientation={90}
        sun={{ hour: 12, dayOfYear: 355 }}
        autoRotate={false}
        labels={false}
        createRenderer={() => r}
      />,
    );
    unmount();
    expect(r.dispose).toHaveBeenCalled();
  });

  it('falls back to a message if the renderer fails after the capability check', () => {
    render(
      <ApartmentViewer
        apartment={a}
        orientation={null}
        sun={null}
        autoRotate
        labels
        createRenderer={() => {
          throw new Error('context lost');
        }}
      />,
    );
    expect(screen.getByText('הדפדפן לא תומך בתצוגת תלת־ממד.')).toBeInTheDocument();
  });
});
