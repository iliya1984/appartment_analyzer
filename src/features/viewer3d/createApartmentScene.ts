import * as THREE from 'three';
import type { Orientation } from '@/domain/orientation';
import type { Apartment } from '@/domain/types';
import { applySun, buildApartmentModel, disposeModel } from './apartmentModel';

export interface SceneHandle {
  setSun: (hour: number, dayOfYear: number) => void;
  setAutoRotate: (on: boolean) => void;
  setLabels: (visible: boolean) => void;
  dispose: () => void;
}

export interface SceneOptions {
  /** Called when the user starts dragging (auto-rotate stops). */
  onUserInteract?: () => void;
  /** For tests: renderer factory. */
  createRenderer?: () => THREE.WebGLRenderer;
}

export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}

// Keep the legacy (r128) colour pipeline: hex colours are used as-is and output is not
// sRGB-encoded. Without this the schematic looks washed out compared with the legacy site.
THREE.ColorManagement.enabled = false;

/**
 * Creates the interactive 3D schematic inside `host` (drag to orbit, pinch / wheel to zoom,
 * optional auto-rotation). Throws WebGLUnavailableError when WebGL cannot be initialised.
 */
export function createApartmentScene(
  host: HTMLElement,
  apartment: Apartment,
  orientation: Orientation | null,
  options: SceneOptions = {},
): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = options.createRenderer?.() ?? new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    throw new WebGLUnavailableError(e instanceof Error ? e.message : String(e));
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  host.appendChild(el);

  const model = buildApartmentModel(apartment, orientation);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const cam = { az: 0.7, pol: 1.0, dist: model.cameraDistance, auto: true };
  const target = new THREE.Vector3(0, 0.7, 0);
  const placeCamera = () => {
    camera.position.set(
      target.x + cam.dist * Math.sin(cam.pol) * Math.sin(cam.az),
      target.y + cam.dist * Math.cos(cam.pol),
      target.z + cam.dist * Math.sin(cam.pol) * Math.cos(cam.az),
    );
    camera.lookAt(target);
  };

  // Pointer orbit + pinch zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cam.auto) {
      cam.auto = false;
      options.onUserInteract?.();
    }
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 1) {
      cam.az -= (e.clientX - p.x) * 0.008;
      cam.pol = Math.max(0.2, Math.min(1.5, cam.pol - (e.clientY - p.y) * 0.006));
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) cam.dist = Math.max(5, Math.min(60, (cam.dist * lastPinch) / d));
      lastPinch = d;
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    lastPinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    cam.dist = Math.max(5, Math.min(60, cam.dist * (1 + e.deltaY * 0.001)));
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  const resize = () => {
    const w = host.clientWidth || 600;
    const h = Math.max(280, Math.min(480, Math.round(w * 0.72)));
    renderer.setSize(w, h, false);
    el.style.width = '100%';
    el.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  let alive = true;
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (cam.auto) cam.az += 0.004;
    placeCamera();
    renderer.render(model.scene, camera);
  };
  loop();

  return {
    setSun: (hour, doy) => {
      applySun(model, hour, doy);
    },
    setAutoRotate: (on) => {
      cam.auto = on;
    },
    setLabels: (visible) => {
      for (const l of model.labels) l.visible = visible;
    },
    dispose: () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      disposeModel(model);
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}
