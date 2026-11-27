/**
 * Builds the three.js scene graph of the schematic apartment (ported from the legacy makeViewer).
 * No renderer here, so it can be unit-tested without WebGL.
 */
import * as THREE from 'three';
import type { Orientation } from '@/domain/orientation';
import { layoutFor, ROOM_COLOR } from '@/domain/schematic';
import { solarPosition } from '@/domain/solar';
import type { Apartment } from '@/domain/types';
import { r1 } from '@/domain/format';
import { he } from '@/i18n/he';

/**
 * three r155+ uses physically based light units; r128 (legacy) scaled light intensities by π
 * internally. Multiplying by π keeps the legacy brightness.
 */
export const LIGHT_SCALE = Math.PI;
const WALL_H = 2.7;

interface Opening {
  s: number;
  e: number;
  sill: number;
  head: number;
}

export interface ApartmentModel {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sunBall: THREE.Mesh;
  ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  labels: THREE.Sprite[];
  /** Apartment group (rotated to the chosen orientation). */
  outer: THREE.Group;
  /** Initial camera distance. */
  cameraDistance: number;
  orientationKnown: boolean;
}

/** Canvas texture label (room name + size). Draws nothing when 2D canvas is unavailable. */
function makeLabel(name: string, sub: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 120;
  const x = c.getContext('2d');
  if (x) {
    x.fillStyle = 'rgba(12,32,40,.82)';
    x.fillRect(0, 0, 320, 120);
    x.fillStyle = '#fff';
    x.font = '700 40px Assistant, Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText(name, 160, 52);
    x.fillStyle = '#9fe0f2';
    x.font = '600 32px Assistant, Arial, sans-serif';
    x.fillText(sub, 160, 98);
  }
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      depthTest: false,
      transparent: true,
    }),
  );
  sp.scale.set(2.3, 0.86, 1);
  sp.renderOrder = 10;
  return sp;
}

export function buildApartmentModel(a: Apartment, orientation: Orientation | null): ApartmentModel {
  const scene = new THREE.Scene();
  const L = layoutFor(a);
  const { W, D } = L;
  const R = Math.max(W, D) * 0.85 + 3;
  const known = orientation != null;

  const hemi = new THREE.HemisphereLight(0xdfeefa, 0x8a8372, 0.55 * LIGHT_SCALE);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d0, 1 * LIGHT_SCALE);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 120 });
  scene.add(sun);
  scene.add(sun.target);
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffd34d }),
  );
  scene.add(sunBall);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0xb7bfb4, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.22;
  ground.receiveShadow = true;
  scene.add(ground);

  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.position.set(-W / 2, 0, -D / 2);
  outer.add(g);
  outer.rotation.y = (-(orientation ?? 0) * Math.PI) / 180;
  scene.add(outer);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.95 });
  const partyMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.95 });
  const intMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f3, roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd3e6,
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
  });
  // Invisible shadow casters: the "removed" walls and ceiling still shade the floor.
  const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  const wall = (
    axis: 'x' | 'z',
    fixed: number,
    a0: number,
    a1: number,
    th: number,
    openings: Opening[],
    mat: THREE.Material,
    h: number,
    glass = false,
  ) => {
    const ops = openings.slice().sort((p, q) => p.s - q.s);
    let cur = a0;
    const box = (s: number, e: number, y0: number, y1: number) => {
      if (e - s < 0.01 || y1 - y0 < 0.01) return;
      const l = e - s;
      const hh = y1 - y0;
      const c = (s + e) / 2;
      const m = new THREE.Mesh(
        axis === 'x' ? new THREE.BoxGeometry(l, hh, th) : new THREE.BoxGeometry(th, hh, l),
        mat,
      );
      if (axis === 'x') m.position.set(c, y0 + hh / 2, fixed);
      else m.position.set(fixed, y0 + hh / 2, c);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    for (const o of ops) {
      box(cur, o.s, 0, h);
      box(o.s, o.e, 0, o.sill);
      box(o.s, o.e, o.head, h);
      if (glass) {
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.e - o.s, o.head - o.sill), glassMat);
        const c = (o.s + o.e) / 2;
        const y = (o.sill + o.head) / 2;
        if (axis === 'x') gl.position.set(c, y, fixed);
        else {
          gl.position.set(fixed, y, c);
          gl.rotation.y = Math.PI / 2;
        }
        g.add(gl);
      }
      cur = o.e;
    }
    box(cur, a1, 0, h);
  };

  const ghostWall = (axis: 'x' | 'z', fixed: number, a0: number, a1: number, th: number) => {
    const l = a1 - a0;
    const m = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(l, WALL_H, th) : new THREE.BoxGeometry(th, WALL_H, l),
      ghost,
    );
    if (axis === 'x') m.position.set((a0 + a1) / 2, WALL_H / 2, fixed);
    else m.position.set(fixed, WALL_H / 2, (a0 + a1) / 2);
    m.castShadow = true;
    g.add(m);
  };

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.5, 0.2, D + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 1 }),
  );
  slab.position.set(W / 2, -0.1, D / 2);
  slab.receiveShadow = true;
  slab.castShadow = true;
  g.add(slab);

  for (const rm of L.rooms) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(rm.w - 0.02, rm.d - 0.02),
      new THREE.MeshStandardMaterial({ color: ROOM_COLOR[rm.k], roughness: 0.9 }),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set((rm.x0 + rm.x1) / 2, 0.01, (rm.z0 + rm.z1) / 2);
    p.receiveShadow = true;
    p.name = `floor:${rm.k}`;
    g.add(p);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, D + 0.5), ghost);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, WALL_H, D / 2);
  ceil.castShadow = true;
  g.add(ceil);

  const frontOps: Opening[] = [];
  for (const rm of L.rooms) {
    if (!rm.win.includes('F')) continue;
    const c = (rm.x0 + rm.x1) / 2;
    if (rm.k === 'salon') {
      const w = Math.min(rm.w * 0.75, 4.2);
      frontOps.push({ s: c - w / 2, e: c + w / 2, sill: 0, head: 2.25 });
    } else {
      const w = Math.min(rm.w - 0.9, 2.2);
      frontOps.push({ s: c - w / 2, e: c + w / 2, sill: 0.95, head: 2.2 });
    }
  }
  wall('x', 0, -0.12, W + 0.12, 0.24, frontOps, wallMat, WALL_H, true);
  const sideOps: Opening[] = [];
  for (const rm of L.rooms) {
    if (!rm.win.includes('S')) continue;
    const w = Math.min(rm.d - 0.8, 2.4);
    const c = (rm.z0 + rm.z1) / 2;
    sideOps.push({ s: c - w / 2, e: c + w / 2, sill: rm.k === 'salon' ? 0.4 : 0.95, head: 2.2 });
  }
  wall('z', 0, 0, D, 0.24, sideOps, wallMat, WALL_H, true);
  wall('x', D, 0, W, 0.24, [], partyMat, 1.5);
  wall('z', W, 0, D, 0.24, [], partyMat, 1.5);
  ghostWall('x', D, 0, W, 0.24);
  ghostWall('z', W, 0, D, 0.24);

  // Interior partitions with door openings (each shared edge once).
  const seen = new Set<string>();
  for (const rm of L.rooms) {
    const edges: ['x' | 'z', number, number, number][] = [
      ['x', rm.z0, rm.x0, rm.x1],
      ['x', rm.z1, rm.x0, rm.x1],
      ['z', rm.x0, rm.z0, rm.z1],
      ['z', rm.x1, rm.z0, rm.z1],
    ];
    for (const [ax, fx, a0, a1] of edges) {
      const bound =
        ax === 'x' ? fx < 0.01 || Math.abs(fx - D) < 0.01 : fx < 0.01 || Math.abs(fx - W) < 0.01;
      if (bound) continue;
      const key = `${ax}${fx.toFixed(2)}|${a0.toFixed(2)}|${a1.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const len = a1 - a0;
      const c = (a0 + a1) / 2;
      const ops: Opening[] = [];
      const wide = rm.k === 'kit' && ax === 'x' && Math.abs(fx - rm.z0) < 0.01;
      const dw = wide ? Math.max(0.9, len - 0.5) : Math.min(0.9, len - 0.4);
      if (len > 1.2) ops.push({ s: c - dw / 2, e: c + dw / 2, sill: 0, head: 2.05 });
      wall(ax, fx, a0, a1, 0.12, ops, intMat, 1.3);
    }
  }

  const sal = L.rooms.find((r) => r.k === 'salon') ?? L.rooms[0];
  const bw = Math.min((sal?.w ?? W) * 0.9, 5.5);
  const bx = sal ? (sal.x0 + sal.x1) / 2 : W / 2;
  if (a.kind === 'P') {
    const dep = Math.min(6, Math.max(2, a.outdoor / W));
    const terr = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.16, dep),
      new THREE.MeshStandardMaterial({ color: 0xb4ae9f, roughness: 1 }),
    );
    terr.position.set(W / 2, -0.08, -dep / 2);
    terr.castShadow = terr.receiveShadow = true;
    terr.name = 'terrace';
    g.add(terr);
  } else {
    const bal = new THREE.Mesh(
      new THREE.BoxGeometry(bw, 0.16, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xa9a59b, roughness: 1 }),
    );
    bal.position.set(bx, -0.08, -0.95);
    bal.castShadow = bal.receiveShadow = true;
    bal.name = 'balcony';
    g.add(bal);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.0, 0.04), glassMat);
    rail.position.set(bx, 0.5, -1.78);
    g.add(rail);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 1.7), glassMat);
      r.position.set(bx + (s * bw) / 2, 0.5, -0.95);
      g.add(r);
    }
  }
  if (a.kind === 'G') {
    const gd = Math.max(2, Math.min(14, a.outdoor / W));
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 1.5, gd),
      new THREE.MeshStandardMaterial({ color: 0x7fae6a, roughness: 1 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(W / 2, -0.19, -gd / 2 - 0.2);
    lawn.receiveShadow = true;
    lawn.name = 'lawn';
    g.add(lawn);
  }

  const labels: THREE.Sprite[] = [];
  for (const rm of L.rooms) {
    const sp = makeLabel(rm.name, he.schematic.labelSize(r1(rm.w), r1(rm.d)));
    sp.position.set((rm.x0 + rm.x1) / 2, 0.5, (rm.z0 + rm.z1) / 2);
    g.add(sp);
    labels.push(sp);
  }
  if (known) {
    const north = makeLabel(he.schematic.north, 'N');
    north.position.set(0, 0.6, -(R + 1.5));
    north.name = 'north-label';
    scene.add(north);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.9, 16),
      new THREE.MeshBasicMaterial({ color: 0xd94a4a }),
    );
    cone.position.set(0, 0.3, -(R - 0.3));
    cone.rotation.x = -Math.PI / 2;
    cone.name = 'north-arrow';
    scene.add(cone);
  }

  const model: ApartmentModel = {
    scene,
    sun,
    hemi,
    sunBall,
    ground,
    labels,
    outer,
    cameraDistance: Math.max(W, D) * 1.45 + 3,
    orientationKnown: known,
  };
  if (!known) applyNeutralLight(model);
  return model;
}

const DAY = 0xcfe5ee;
const DUSK = 0xf2c9a0;
const NIGHT = 0x18232e;

/** Even daylight when the orientation is unknown (no sun simulation). */
export function applyNeutralLight(m: ApartmentModel): void {
  m.sun.position.set(12, 34, 16);
  m.sun.intensity = 0.75 * LIGHT_SCALE;
  m.hemi.intensity = 0.6 * LIGHT_SCALE;
  m.sunBall.visible = false;
  m.scene.background = new THREE.Color(DAY);
}

/** Light levels for a sun elevation (degrees): pure, for tests. */
export function sunLighting(elevation: number): {
  sun: number;
  hemi: number;
  sky: THREE.Color;
  groundColor: number;
} {
  const k = Math.max(0, Math.min(1, elevation / 25));
  const sky =
    elevation <= 0
      ? new THREE.Color(NIGHT)
      : elevation < 12
        ? new THREE.Color(DUSK).lerp(new THREE.Color(DAY), elevation / 12)
        : new THREE.Color(DAY);
  return {
    sun: elevation > 0 ? (0.25 + 1.0 * k) * LIGHT_SCALE : 0,
    hemi: (0.28 + 0.4 * k) * LIGHT_SCALE,
    sky,
    groundColor: elevation > 0 ? 0xb7bfb4 : 0x3a4147,
  };
}

/** Moves the sun to the given solar time and season and updates the lighting. */
export function applySun(m: ApartmentModel, hour: number, dayOfYear: number) {
  const s = solarPosition(hour, dayOfYear);
  const r = Math.PI / 180;
  const e = s.el * r;
  const az = s.az * r;
  // North is -z, east is +x.
  const dir = new THREE.Vector3(
    Math.cos(e) * Math.sin(az),
    Math.sin(e),
    -Math.cos(e) * Math.cos(az),
  );
  m.sun.position.copy(dir.clone().multiplyScalar(45));
  m.sun.target.position.set(0, 0, 0);
  m.sunBall.position.copy(dir.clone().multiplyScalar(26));
  m.sunBall.visible = s.el > 0;
  const l = sunLighting(s.el);
  m.sun.intensity = l.sun;
  m.hemi.intensity = l.hemi;
  m.scene.background = l.sky;
  m.ground.material.color.set(l.groundColor);
  return s;
}

/** Frees every GPU resource owned by the scene graph. */
export function disposeModel(m: ApartmentModel): void {
  m.scene.traverse((o) => {
    const node = o as Partial<Pick<THREE.Mesh, 'geometry'>> & {
      material?: THREE.Material | THREE.Material[];
    };
    node.geometry?.dispose();
    const mat = node.material;
    if (!mat) return;
    for (const x of Array.isArray(mat) ? mat : [mat]) {
      (x as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
      x.dispose();
    }
  });
}
