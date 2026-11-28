import * as THREE from 'three';
import type { Orientation } from '@/domain/orientation';
import { hitsWall, type PlanModel, startPoint } from '@/domain/planModel';
import type { Apartment } from '@/domain/types';
import { type ApartmentModel, applySun, buildApartmentModel, disposeModel } from './apartmentModel';
import { buildPlanModelScene, type PlanSceneModel } from './planModelScene';
import type { VIEW_MODES } from './viewModes';

/** dollhouse = orbit from above, top = orthographic plan (north up), walk = eye height. */
export type ViewMode = (typeof VIEW_MODES)[number];

export interface SceneHandle {
  setSun: (hour: number, dayOfYear: number) => void;
  setAutoRotate: (on: boolean) => void;
  setLabels: (visible: boolean) => void;
  /** Plan models only (the schematic has a single orbit view). */
  setView: (view: ViewMode) => void;
  /** true = dollhouse cut (walls end at 1.2 m). */
  setWallsCut: (cut: boolean) => void;
  /** Back to the start view (dollhouse: initial angle; walk: the entrance). */
  reset: () => void;
  /** Walk mode: move (m) forward / sideways and turn (rad). Returns false when a wall blocks. */
  walk: (forward: number, strafe: number, turn?: number) => boolean;
  /** For tests: the active camera. */
  camera: () => THREE.Camera;
  dispose: () => void;
}

export interface SceneOptions {
  /** Called when the user starts dragging (auto-rotate stops). */
  onUserInteract?: () => void;
  /** For tests: renderer factory. */
  createRenderer?: () => THREE.WebGLRenderer;
  /** Real geometry from the plans; without it the schematic is shown. */
  plan?: PlanModel | null;
}

export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}

// Keep the legacy (r128) colour pipeline: hex colours are used as-is and output is not
// sRGB-encoded. Without this the schematic looks washed out compared with the legacy site.
THREE.ColorManagement.enabled = false;

const EYE = 1.6;
const WALK_SPEED = 1.4; // m/s

/**
 * Creates the interactive 3D view inside `host`: drag to orbit / pan / look, pinch or wheel to
 * zoom, keyboard in walk mode. Throws WebGLUnavailableError when WebGL cannot be initialised.
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
  el.tabIndex = -1;
  host.appendChild(el);

  const plan = options.plan ?? null;
  const model: ApartmentModel = plan
    ? buildPlanModelScene(plan)
    : buildApartmentModel(apartment, orientation);
  const planScene = plan ? (model as PlanSceneModel) : null;

  const persp = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const cam = { az: 0.7, pol: 1.0, dist: model.cameraDistance, auto: true };
  const target = new THREE.Vector3(0, 0.7, 0);
  let view: ViewMode = 'dollhouse';
  let aspect = 1;
  const top = { x: 0, z: 0, zoom: 1 };
  // walker: position in plan space (cm) and heading (rad, 0 = plan "up" / -y)
  const walker = { x: 0, y: 0, yaw: 0, pitch: 0 };

  const placeWalker = () => {
    if (!plan) return;
    const [x, y] = startPoint(plan);
    walker.x = x;
    walker.y = y;
    // look towards the salon / the middle of the unit
    const salon = plan.rooms.find((r) => r.type === 'salon');
    const tx = salon?.center[0] ?? plan.bounds[0] / 2;
    const ty = salon?.center[1] ?? plan.bounds[1] / 2;
    walker.yaw = Math.atan2(tx - x, -(ty - y));
    walker.pitch = 0;
  };
  placeWalker();

  const planToWorld = (x: number, h: number, y: number) =>
    planScene
      ? planScene.planSpace.localToWorld(new THREE.Vector3(x / 100, h, y / 100))
      : new THREE.Vector3();

  const activeCamera = (): THREE.Camera => (view === 'top' ? ortho : persp);

  const placeCamera = () => {
    if (view === 'top') {
      const half = (Math.max(model.size.w, model.size.d) * 0.62) / top.zoom;
      ortho.left = -half * aspect;
      ortho.right = half * aspect;
      ortho.top = half;
      ortho.bottom = -half;
      ortho.updateProjectionMatrix();
      ortho.position.set(top.x, 40, top.z);
      ortho.up.set(0, 0, -1); // north up
      ortho.lookAt(top.x, 0, top.z);
      return;
    }
    if (view === 'walk' && planScene) {
      planScene.scene.updateMatrixWorld();
      const eye = planToWorld(walker.x, EYE, walker.y);
      const ahead = planToWorld(
        walker.x + Math.sin(walker.yaw) * 100,
        EYE + Math.tan(walker.pitch),
        walker.y - Math.cos(walker.yaw) * 100,
      );
      persp.fov = 70;
      persp.updateProjectionMatrix();
      persp.position.copy(eye);
      persp.lookAt(ahead);
      return;
    }
    if (persp.fov !== 36) {
      persp.fov = 36;
      persp.updateProjectionMatrix();
    }
    persp.position.set(
      target.x + cam.dist * Math.sin(cam.pol) * Math.sin(cam.az),
      target.y + cam.dist * Math.cos(cam.pol),
      target.z + cam.dist * Math.sin(cam.pol) * Math.cos(cam.az),
    );
    persp.lookAt(target);
  };

  const walk = (forward: number, strafe: number, turn = 0): boolean => {
    if (!plan) return false;
    walker.yaw += turn;
    const sx = Math.sin(walker.yaw);
    const sy = -Math.cos(walker.yaw);
    const nx = walker.x + (sx * forward - sy * strafe) * 100;
    const ny = walker.y + (sy * forward + sx * strafe) * 100;
    if (hitsWall(plan, nx, ny)) return false;
    walker.x = nx;
    walker.y = ny;
    return true;
  };

  const stopAuto = () => {
    if (cam.auto) {
      cam.auto = false;
      options.onUserInteract?.();
    }
  };

  // Pointer: orbit (dollhouse), pan (top), look (walk); pinch zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  const onDown = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    el.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAuto();
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (pointers.size === 1) {
      if (view === 'top') {
        const k =
          (Math.max(model.size.w, model.size.d) * 1.24) /
          top.zoom /
          Math.max(1, host.clientHeight || 300);
        top.x -= dx * k;
        top.z -= dy * k;
      } else if (view === 'walk') {
        walker.yaw -= dx * 0.005;
        walker.pitch = Math.max(-0.6, Math.min(0.6, walker.pitch + dy * 0.004));
      } else {
        cam.az -= dx * 0.008;
        cam.pol = Math.max(0.2, Math.min(1.5, cam.pol - dy * 0.006));
      }
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastPinch) zoomBy(lastPinch / d);
      lastPinch = d;
    }
  };
  const zoomBy = (k: number) => {
    if (view === 'top') top.zoom = Math.max(0.6, Math.min(6, top.zoom / k));
    else if (view === 'dollhouse') cam.dist = Math.max(5, Math.min(60, cam.dist * k));
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    lastPinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (view === 'walk') walk(-e.deltaY * 0.002, 0);
    else zoomBy(1 + e.deltaY * 0.001);
  };
  // Walk keys: arrows / WASD, held keys move every frame.
  const held = new Set<string>();
  const WALK_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'w',
    'a',
    's',
    'd',
    'W',
    'A',
    'S',
    'D',
  ]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (view !== 'walk' || !WALK_KEYS.has(e.key)) return;
    e.preventDefault();
    held.add(e.key.toLowerCase());
  };
  const onKeyUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('keyup', onKeyUp);
  el.addEventListener('blur', () => held.clear());

  const resize = () => {
    const w = host.clientWidth || 600;
    const full =
      (document.fullscreenElement?.contains(host) ?? false) ||
      host.closest('[data-fullscreen="true"]') != null;
    const h = full
      ? Math.max(280, window.innerHeight - 170)
      : Math.max(280, Math.min(480, Math.round(w * 0.72)));
    renderer.setSize(w, h, false);
    el.style.width = '100%';
    el.style.height = `${h}px`;
    aspect = w / h;
    persp.aspect = aspect;
    persp.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  let alive = true;
  let last = 0;
  const loop = (t?: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const now = t ?? 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (view === 'walk' && held.size) {
      const f =
        (held.has('arrowup') || held.has('w') ? 1 : 0) -
        (held.has('arrowdown') || held.has('s') ? 1 : 0);
      const turn = (held.has('arrowright') ? 1 : 0) - (held.has('arrowleft') ? 1 : 0);
      const strafe = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0);
      walk(f * WALK_SPEED * dt, strafe * WALK_SPEED * dt, turn * 1.6 * dt);
    }
    if (cam.auto && view === 'dollhouse') cam.az += 0.004;
    placeCamera();
    renderer.render(model.scene, activeCamera());
  };
  loop();

  const setWallsCut = (cut: boolean) => {
    for (const t of model.wallTops) t.visible = !cut;
  };

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
    setView: (v) => {
      if (!plan) return;
      view = v;
      if (v === 'walk') {
        cam.auto = false;
        setWallsCut(false);
        el.focus({ preventScroll: true });
      }
      if (v === 'top') {
        top.x = 0;
        top.z = 0;
        top.zoom = 1;
      }
    },
    setWallsCut,
    reset: () => {
      cam.az = 0.7;
      cam.pol = 1.0;
      cam.dist = model.cameraDistance;
      top.x = 0;
      top.z = 0;
      top.zoom = 1;
      placeWalker();
    },
    walk,
    camera: () => {
      placeCamera();
      return activeCamera();
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
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('keyup', onKeyUp);
      disposeModel(model);
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}
