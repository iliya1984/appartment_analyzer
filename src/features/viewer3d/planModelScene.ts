/**
 * Builds the three.js scene of a plan-based model (real walls, openings and rooms). No renderer
 * here, so it can be unit-tested without WebGL. Units: the model is in cm, the scene in metres;
 * plan +x → scene +x, plan +y (down the sheet) → scene +z, so the top of the sheet faces -z
 * (north) before the northDeg rotation.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlanModel, PlanRoomType, Rect } from '@/domain/planModel';
import { he } from '@/i18n/he';
import {
  addEnvironment,
  addNorthMarker,
  type ApartmentModel,
  applyNeutralLight,
  makeLabel,
} from './apartmentModel';

/** Clear height (m), as in the schematic model. */
export const CLEAR_H = 2.7;
/** Dollhouse cut: walls above this height hide when "low walls" is on. */
export const CUT_H = 1.2;

export const PLAN_ROOM_COLOR: Readonly<Record<PlanRoomType, string>> = {
  salon: '#d2b98f',
  dining: '#d8c29c',
  kitchen: '#dcd7cb',
  master: '#cdd9e6',
  bed: '#d6e0e8',
  mamad: '#c9c6d6',
  bath: '#b9d3d9',
  wc: '#b9d3d9',
  service: '#d5d5d5',
  storage: '#d0ccc4',
  hall: '#e3ddd0',
  balcony: '#a9a59b',
  garden: '#7fae6a',
  'roof-terrace': '#b4ae9f',
  other: '#dedede',
};

const M = 0.01; // cm → m

type Bucket = Map<THREE.Material, THREE.BufferGeometry[]>;

function push(bucket: Bucket, mat: THREE.Material, geo: THREE.BufferGeometry) {
  const list = bucket.get(mat);
  if (list) list.push(geo);
  else bucket.set(mat, [geo]);
}

/** A box over a plan rectangle between heights y0 and y1 (m). */
function boxGeo(r: Rect, y0: number, y1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(r[2] * M, y1 - y0, r[3] * M);
  g.translate((r[0] + r[2] / 2) * M, (y0 + y1) / 2, (r[1] + r[3] / 2) * M);
  return g;
}

/** Thin pane in the middle of an opening rectangle. */
function paneGeo(r: Rect, y0: number, y1: number): THREE.BufferGeometry {
  const horizontal = r[2] >= r[3];
  const t = 2; // cm
  const pane: Rect = horizontal
    ? [r[0], r[1] + r[3] / 2 - t / 2, r[2], t]
    : [r[0] + r[2] / 2 - t / 2, r[1], t, r[3]];
  return boxGeo(pane, y0, y1);
}

/** Adds a vertical slab split at the cut height: the lower part always, the upper part as a top. */
function addSplit(
  low: Bucket,
  top: Bucket,
  ghosts: THREE.BufferGeometry[],
  mat: THREE.Material,
  make: (y0: number, y1: number) => THREE.BufferGeometry,
  y0: number,
  y1: number,
) {
  if (y1 - y0 < 0.005) return;
  if (y1 <= CUT_H) push(low, mat, make(y0, y1));
  else if (y0 >= CUT_H) {
    push(top, mat, make(y0, y1));
    ghosts.push(make(y0, y1));
  } else {
    push(low, mat, make(y0, CUT_H));
    push(top, mat, make(CUT_H, y1));
    ghosts.push(make(CUT_H, y1));
  }
}

function meshes(bucket: Bucket, name: string, shadows = true): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const [mat, geos] of bucket) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}

export interface PlanSceneModel extends ApartmentModel {
  plan: PlanModel;
  /** Group in plan space (metres): plan point (x, y) cm ↦ local (x/100, h, y/100). */
  planSpace: THREE.Group;
}

/**
 * The plan model as a scene. `known` true: the model is rotated to true north (from the plan)
 * and the sun simulation applies; the north marker is shown.
 */
export function buildPlanModelScene(m: PlanModel): PlanSceneModel {
  const scene = new THREE.Scene();
  const W = m.bounds[0] * M;
  const D = m.bounds[1] * M;
  const R = Math.max(W, D) * 0.85 + 3;
  const { hemi, sun, sunBall, ground } = addEnvironment(scene, R);

  const outer = new THREE.Group();
  outer.rotation.y = (-m.northDeg * Math.PI) / 180;
  const g = new THREE.Group();
  g.position.set(-W / 2, 0, -D / 2);
  outer.add(g);
  scene.add(outer);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd3e6,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5d6970, roughness: 0.6 });
  const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const low: Bucket = new Map();
  const top: Bucket = new Map();
  const ghostGeos: THREE.BufferGeometry[] = [];

  for (const r of m.walls)
    addSplit(low, top, ghostGeos, wallMat, (a, b) => boxGeo(r, a, b), 0, CLEAR_H);

  for (const o of m.openings) {
    const sill = o.sill / 100;
    const head = Math.min(o.head / 100, CLEAR_H);
    // under the window (sill) and above it (lintel)
    if (sill > 0) addSplit(low, top, ghostGeos, wallMat, (a, b) => boxGeo(o.rect, a, b), 0, sill);
    addSplit(low, top, ghostGeos, wallMat, (a, b) => boxGeo(o.rect, a, b), head, CLEAR_H);
    if (o.kind === 'window' || o.kind === 'slider') {
      addSplit(low, top, [], glassMat, (a, b) => paneGeo(o.rect, a, b), sill, head);
      // a slim frame line at the sill and the head
      push(low, frameMat, paneGeo(o.rect, sill, sill + 0.04));
      push(top, frameMat, paneGeo(o.rect, head - 0.04, head));
    }
  }

  const walls = new THREE.Group();
  walls.name = 'walls';
  for (const mesh of meshes(low, 'walls-low')) walls.add(mesh);
  const tops = new THREE.Group();
  tops.name = 'walls-top';
  for (const mesh of meshes(top, 'walls-top')) tops.add(mesh);
  // Invisible copies of the upper parts keep casting shadows when the tops are hidden.
  if (ghostGeos.length) {
    const shade = new THREE.Mesh(mergeGeometries(ghostGeos, false), ghost);
    for (const geo of ghostGeos) geo.dispose();
    shade.castShadow = true;
    shade.name = 'walls-shadow';
    g.add(shade);
  }
  g.add(walls, tops);

  // Floor slab under the unit and room floors on top of it.
  const slab = new THREE.Mesh(
    boxGeo([0, 0, m.bounds[0], m.bounds[1]], -0.2, 0),
    new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 1 }),
  );
  slab.receiveShadow = true;
  slab.name = 'slab';
  g.add(slab);

  const ceilingGeos: THREE.BufferGeometry[] = [];
  const labels: THREE.Sprite[] = [];
  const floorMats = new Map<PlanRoomType, THREE.MeshStandardMaterial>();
  const floorMat = (t: PlanRoomType) => {
    let mat = floorMats.get(t);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color: PLAN_ROOM_COLOR[t], roughness: 0.9 });
      floorMats.set(t, mat);
    }
    return mat;
  };

  for (const room of m.rooms) {
    const geos = room.rects.map((r) => boxGeo(r, 0, 0.012));
    const floor = new THREE.Mesh(mergeGeometries(geos, false), floorMat(room.type));
    for (const geo of geos) geo.dispose();
    floor.receiveShadow = true;
    floor.name = `floor:${room.type}:${room.id}`;
    g.add(floor);
    for (const r of room.rects) ceilingGeos.push(boxGeo(r, CLEAR_H, CLEAR_H + 0.02));
    const sp = makeLabel(
      room.label.split(', ')[0] ?? room.label,
      he.schematic.area(room.areaM2.toFixed(1)),
    );
    sp.position.set(room.center[0] * M, 0.5, room.center[1] * M);
    sp.name = `label:${room.id}`;
    g.add(sp);
    labels.push(sp);
  }
  for (const out of m.outdoor) {
    const geos = out.rects.map((r) => boxGeo(r, -0.16, 0));
    const deck = new THREE.Mesh(mergeGeometries(geos, false), floorMat(out.type));
    for (const geo of geos) geo.dispose();
    deck.receiveShadow = true;
    deck.name = `outdoor:${out.type}:${out.id}`;
    g.add(deck);
    if (out.covered)
      for (const r of out.rects) ceilingGeos.push(boxGeo(r, CLEAR_H + 0.1, CLEAR_H + 0.3));
    const sp = makeLabel(out.label, he.schematic.area(out.areaM2.toFixed(1)));
    sp.position.set(out.center[0] * M, 0.5, out.center[1] * M);
    sp.name = `label:${out.id}`;
    g.add(sp);
    labels.push(sp);
  }
  // Invisible ceiling (and balcony roof): sunlight only reaches the floor through openings.
  if (ceilingGeos.length) {
    const ceil = new THREE.Mesh(mergeGeometries(ceilingGeos, false), ghost);
    for (const geo of ceilingGeos) geo.dispose();
    ceil.castShadow = true;
    ceil.name = 'ceiling';
    g.add(ceil);
  }

  addNorthMarker(scene, R);

  const model: PlanSceneModel = {
    scene,
    sun,
    hemi,
    sunBall,
    ground,
    labels,
    outer,
    cameraDistance: Math.max(W, D) * 1.05 + 2,
    orientationKnown: true,
    wallTops: [tops],
    plan: m,
    planSpace: g,
    size: { w: W, d: D },
  };
  applyNeutralLight(model);
  return model;
}
