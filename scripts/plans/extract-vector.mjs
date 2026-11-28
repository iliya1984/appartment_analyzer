// Builds plan models from the 1:100 building sheets (vector PDFs without layers).
//
//   npm run plans:vector [-- T-T5.5F ...]            build the models listed in vector-specs.json
//   npm run plans:vector -- --debug T-T5.5F [B2 1]   segmentation view for writing a spec
//
// Specs (scripts/plans/vector-specs.json) name the sheet and give one seed point (sheet pt) per
// room with its type and Hebrew name, as read off the sheet, plus split lines between open-plan
// spaces and outdoor seeds. Geometry comes from the drawing itself (vector/segment.mjs):
//  - walls = the black 1.8 / 1.44 pt outlines with their thin interiors, at 1 cm/px;
//  - openings = gaps between two wall ends, typed by what lies on each side;
//  - rooms = the free regions around the seeds; balconies = regions inside the railing lines.
// The result goes through the same checks and builder as the hand-measured specs, then furniture
// is placed by vector/furnish.mjs. A check image of every model (model over the sheet) is written
// to node_modules/.cache/plans-debug/<planType>-model.png.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { buildModel, checkSpec } from './build-measured.mjs';
import { distance, label, rectangles } from './extract-model.mjs';
import { debugType, drawGrid, renderBackground, sheetsWith } from './vector/debug.mjs';
import { furnish } from './vector/furnish.mjs';
import { anchorOf, parseSheet, sheetFile } from './vector/parse.mjs';
import { segment } from './vector/segment.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const SPECS = join(import.meta.dirname, 'vector-specs.json');
const OUT_DIR = join(ROOT, 'src', 'data', 'plan-models');
const DEBUG_DIR = join(ROOT, 'node_modules', '.cache', 'plans-debug');
const WALL_KEEP = 45; // cm: walls kept around the unit (outer walls are ≤ 40 cm thick)
const RAIL = 5; // cm: railing thickness
const GROW_LINE = false;
const PLASTER = 2; // cm trimmed off every wall face of a room (see the T-T5C calibration)

const HEIGHTS = { door: [0, 210], entrance: [0, 210], window: [90, 220], slider: [0, 230] };

/** Region id at sheet point `pt`, or the nearest region within 40 cm. */
function regionAt(lab, W, H, [x, y]) {
  if (x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] >= 0) return lab[y * W + x];
  let best = -1;
  let bd = Infinity;
  for (let yy = Math.max(0, y - 40); yy < Math.min(H, y + 40); yy++)
    for (let xx = Math.max(0, x - 40); xx < Math.min(W, x + 40); xx++) {
      const r = lab[yy * W + xx];
      const d = (xx - x) ** 2 + (yy - y) ** 2;
      if (r >= 0 && d < bd) {
        bd = d;
        best = r;
      }
    }
  return best;
}

const nb4 = (p, W, N) => {
  const x = p % W;
  return [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p + W < N ? p + W : -1];
};

export async function extractVector(planType, spec) {
  const [building, page] = spec.sheet;
  const sheet = await parseSheet(building, page);
  const a = anchorOf(sheet, planType);
  if (!a && !spec.center) throw new Error(`${planType}: no label on ${building} p${page}`);
  const center = spec.center ?? [a.x, a.y];
  const seg = segment(sheet, center, spec.half ?? 1500, spec.splits ?? []);
  const { W, H } = seg;
  const N = W * H;
  const problems = [];
  // cut: [x0, y0, x1, y1] sheet pt, openings drawn inside a wall line (no gap on the sheet)
  for (const [ax, ay, bx, by] of spec.cut ?? []) {
    const [px0, py0] = seg.toPx([ax, ay]);
    const [px1, py1] = seg.toPx([bx, by]);
    for (let y = py0; y < py1; y++)
      for (let x = px0; x < px1; x++) {
        const p = y * W + x;
        if (seg.wall[p]) {
          seg.wall[p] = 0;
          seg.gap[p] = 1;
        }
      }
  }

  // ---- rooms: the regions around the seeds (several seeds in one region = open plan)
  const rooms = [];
  const byRegion = new Map();
  for (const [x, y, type, name] of spec.rooms) {
    const r = regionAt(seg.region, W, H, seg.toPx([x, y]));
    if (r < 0) {
      problems.push(`room seed ${name} @${x},${y} is not in a region`);
      continue;
    }
    const at = seg.toPx([x, y]);
    const prev = byRegion.get(r);
    if (prev) {
      if (!prev.names.includes(name)) prev.names.push(name);
      prev.anchors.push([...at, name]);
      continue;
    }
    const room = { region: r, type, names: [name], anchors: [[...at, name]] };
    byRegion.set(r, room);
    rooms.push(room);
  }
  const owner = new Int16Array(N).fill(-1);
  for (let p = 0; p < N; p++) {
    const room = byRegion.get(seg.region[p]);
    if (room) owner[p] = rooms.indexOf(room);
  }
  for (let p = 0; p < N; p++) {
    const x = p % W;
    const y = (p - x) / W;
    if (owner[p] >= 0 && (x === 0 || y === 0 || x === W - 1 || y === H - 1))
      problems.push(`room ${rooms[owner[p]].names[0]} leaks out of the window`);
    if (owner[p] >= 0 && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) break;
  }
  // optionally grow each room into the drawn line next to it (calibrated against the 1:50 labels
  // of T-T5C: without growing, rooms come out 0–3 cm larger than the labels, so it is off)
  const grown = owner.slice();
  if (GROW_LINE)
  for (let p = 0; p < N; p++) {
    if (!seg.ink[p] || seg.gap[p] || owner[p] >= 0) continue;
    const near = nb4(p, W, N).map((q) => (q >= 0 ? owner[q] : -1)).filter((o) => o >= 0);
    if (near.length && near.every((o) => o === near[0])) grown[p] = near[0];
  }
  owner.set(grown);
  // the sheet's room dimensions are clear (finished) sizes: calibrated against the 1:50 labels of
  // T-T5C, rooms traced between the wall lines come out ~3.5 cm larger, so trim each wall face
  const plaster = new Uint8Array(N);
  {
    const notWall = new Uint8Array(N);
    const notSolid = new Uint8Array(N);
    for (let p = 0; p < N; p++) {
      notWall[p] = seg.wall[p] ? 0 : 1;
      notSolid[p] = seg.wall[p] || seg.gap[p] ? 0 : 1;
    }
    const dw = distance(notWall, W, H);
    const ds = distance(notSolid, W, H);
    // in front of openings the trimmed sliver stays empty floor (no wall in the doorway)
    for (let p = 0; p < N; p++)
      if (owner[p] >= 0 && ds[p] <= PLASTER) {
        owner[p] = -1;
        plaster[p] = dw[p] <= PLASTER ? 1 : 2;
      }
  }

  // ---- outdoor: regions bounded by walls, openings and the thin lines (railings, louvres)
  const free2 = new Uint8Array(N);
  for (let p = 0; p < N; p++) free2[p] = seg.wall[p] || seg.gap[p] || seg.thin[p] || owner[p] >= 0 ? 0 : 1;
  const lab2 = label(free2, W, H).labels;
  const outdoor = [];
  const outOwner = new Int16Array(N).fill(-1);
  for (const [x, y, type, name, covered, clip, mode] of spec.outdoor ?? []) {
    // clip: [x0, y0, x1, y1] sheet pt, for balconies whose railing is not drawn as a closed line;
    // mode 'fill': the whole clip box (minus walls, openings, rooms), ignoring paving lines
    const [cx0, cy0] = clip ? seg.toPx([clip[0], clip[1]]) : [0, 0];
    const [cx1, cy1] = clip ? seg.toPx([clip[2], clip[3]]) : [W, H];
    let r = mode === 'fill' ? -1 : regionAt(lab2, W, H, seg.toPx([x, y]));
    if (r < 0 && clip) {
      // paving / hatch drawn in thin lines fills the whole area: take the clip box itself
      // (minus walls, openings and rooms) as the region
      const fill = new Uint8Array(N);
      for (let yy = Math.max(0, cy0); yy < Math.min(H, cy1); yy++)
        for (let xx = Math.max(0, cx0); xx < Math.min(W, cx1); xx++) {
          const p = yy * W + xx;
          fill[p] = seg.wall[p] || seg.gap[p] || owner[p] >= 0 ? 0 : 1;
        }
      const lf = label(fill, W, H).labels;
      const rf = regionAt(lf, W, H, seg.toPx([x, y]));
      if (rf >= 0) {
        r = lab2.length; // a fresh id outside lab2's range
        for (let p = 0; p < N; p++) if (lf[p] === rf && outOwner[p] < 0) lab2[p] = r;
      }
    }
    if (r < 0) {
      problems.push(`outdoor seed ${name} @${x},${y} is not in a region`);
      continue;
    }
    const same = outdoor.find((o) => o.region === r && !(clip && o.clip));
    if (same) {
      problems.push(`outdoor ${name} is the same area as ${same.names[0]} (not separated on the sheet)`);
      continue;
    }
    // seeds with the same name add to one area (an area cut by a drawn line)
    const prev = outdoor.findIndex((o) => o.names[0] === name && o.type === type);
    const i = prev >= 0 ? prev : outdoor.length;
    let border = false;
    for (let p = 0; p < N; p++)
      if (lab2[p] === r) {
        const px = p % W;
        const py = (p - px) / W;
        if (px < cx0 || py < cy0 || px >= cx1 || py >= cy1 || outOwner[p] >= 0) continue;
        outOwner[p] = i;
        if (px === 0 || py === 0 || px === W - 1 || py === H - 1) border = true;
      }
    if (border) problems.push(`outdoor ${name} is not closed (leaks out of the window)`);
    if (prev < 0) outdoor.push({ region: r, clip, type, names: [name], covered: covered !== false });
  }
  // fill small holes (drains, labels, posts) inside outdoor areas
  {
    const notOut = new Uint8Array(N);
    for (let p = 0; p < N; p++) notOut[p] = outOwner[p] < 0 ? 1 : 0;
    const lh = label(notOut, W, H);
    const info = Array.from({ length: lh.count }, () => ({ size: 0, border: false, solid: false, around: -1 }));
    for (let p = 0; p < N; p++) {
      const l = lh.labels[p];
      if (l < 0) continue;
      const s = info[l];
      s.size++;
      const x = p % W;
      const y = (p - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) s.border = true;
      if (owner[p] >= 0 || seg.gap[p]) s.solid = true;
      for (const q of nb4(p, W, N)) if (q >= 0 && outOwner[q] >= 0) s.around = outOwner[q];
    }
    for (let p = 0; p < N; p++) {
      const l = lh.labels[p];
      if (l < 0) continue;
      const s = info[l];
      if (!s.border && !s.solid && s.size < 30000 && s.around >= 0) {
        outOwner[p] = s.around;
      }
    }
  }

  // ---- openings: gaps, typed by their two sides
  const lg = label(seg.gap, W, H);
  const boxes = Array.from({ length: lg.count }, () => [Infinity, Infinity, -1, -1]);
  for (let p = 0; p < N; p++) {
    const l = lg.labels[p];
    if (l < 0) continue;
    const x = p % W;
    const y = (p - x) / W;
    const b = boxes[l];
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  const lab1Border = new Set();
  const regSize = new Map();
  for (let p = 0; p < N; p++) {
    const r = seg.region[p];
    if (r < 0) continue;
    regSize.set(r, (regSize.get(r) ?? 0) + 1);
    const x = p % W;
    const y = (p - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) lab1Border.add(r);
  }
  const side = (x, y, dx, dy) => {
    let found = null; // an exterior region: look on a little for an outdoor area (sills, clips)
    for (let s = 1; s < 80; s++) {
      const xx = x + dx * s;
      const yy = y + dy * s;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return found ?? { border: true };
      if (found && s > found.at + 20) return found;
      const p = yy * W + xx;
      if (seg.gap[p] || plaster[p]) continue;
      if (owner[p] >= 0) return { room: owner[p] };
      if (outOwner[p] >= 0) return { out: outOwner[p] };
      if (seg.thin[p]) continue; // window panes and sills drawn just outside the gap
      const r = seg.region[p];
      if (r >= 0 && !found) {
        found = { region: r, border: lab1Border.has(r), size: regSize.get(r) ?? 0, at: s };
        if (!found.border) return found;
      }
      // wall ink at the jambs: keep looking
    }
    return found ?? { none: true };
  };
  const openings = [];
  const unused = new Set();
  const entranceCands = [];
  const spare = []; // gaps of the unit onto small or unknown spaces (a spec entrance may pick one)
  for (let l = 0; l < lg.count; l++) {
    const [x0, y0, x1, y1] = boxes[l];
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const len = Math.max(bw, bh);
    const thick = Math.min(bw, bh);
    const horizontal = bw >= bh;
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const A = horizontal ? side(cx, y0, 0, -1) : side(x0, cy, -1, 0);
    const B = horizontal ? side(cx, y1, 0, 1) : side(x1, cy, 1, 0);
    const mine = (s) => s.room !== undefined;
    if (!mine(A) && !mine(B)) {
      // not an opening of this unit (unless it borders an outdoor area of the unit)
      continue;
    }
    const rect = [x0, y0, bw, bh];
    if (len < 40 || thick < 3 || thick > 70) {
      unused.add(l);
      continue;
    }
    if (mine(A) && mine(B)) {
      if (A.room === B.room) unused.add(l);
      else openings.push({ l, kind: 'door', rect });
      continue;
    }
    const other = mine(A) ? B : A;
    if (other.out !== undefined) {
      // glazing onto a balcony / terrace / garden is a door-height slider; onto a drying yard a window
      const walkable = ['balcony', 'roof-terrace', 'garden'].includes(outdoor[other.out].type);
      openings.push({ l, kind: walkable && len >= 80 ? 'slider' : 'window', rect });
    }
    else if (other.border || other.none) openings.push({ l, kind: 'window', rect });
    else if (other.region !== undefined && other.size >= 30000) entranceCands.push({ l, rect, size: other.size });
    else {
      unused.add(l);
      spare.push({ l, rect });
    }
  }
  // the entrance: the spec's point, else the opening onto the biggest enclosed space (the lobby)
  if (entranceCands.length) {
    let pick = entranceCands[0];
    if (spec.entrance) {
      const [ex, ey] = seg.toPx(spec.entrance);
      const d = (c) => Math.hypot(c.rect[0] + c.rect[2] / 2 - ex, c.rect[1] + c.rect[3] / 2 - ey);
      pick = entranceCands.reduce((m, c) => (d(c) < d(m) ? c : m));
    } else pick = entranceCands.reduce((m, c) => (c.size > m.size ? c : m));
    for (const c of entranceCands)
      openings.push({ l: c.l, kind: c === pick ? 'entrance' : 'window', rect: c.rect });
  } else if (spec.entrance) {
    // the lobby is not closed on this sheet: take the spec's point among all the unit's gaps
    const [ex, ey] = seg.toPx(spec.entrance);
    const d = (c) => Math.hypot(c.rect[0] + c.rect[2] / 2 - ex, c.rect[1] + c.rect[3] / 2 - ey);
    const all = [...openings.filter((o) => o.kind !== 'door'), ...spare];
    const pick = all.reduce((m, c) => (d(c) < d(m) ? c : m), all[0]);
    if (process.env.DEBUG_ENTRANCE) console.error(all.map((c) => `${seg.toPt([c.rect[0], c.rect[1]]).map((v) => v.toFixed(0))} ${c.rect[2]}x${c.rect[3]} d=${d(c).toFixed(0)}`).join('\n'));
    if (pick && d(pick) < 150) {
      const known = openings.find((o) => o.l === pick.l);
      if (known) known.kind = 'entrance';
      else {
        unused.delete(pick.l);
        openings.push({ l: pick.l, kind: 'entrance', rect: pick.rect });
      }
    } else problems.push('no entrance near the spec point');
  } else problems.push('no entrance found');

  // opening rectangles win over the 1 cm fringes of rooms and outdoor areas around them
  const opMask = new Uint8Array(N);
  for (const o of openings) {
    const [ox, oy, ow, oh] = o.rect;
    for (let y = oy; y < oy + oh; y++) for (let x = ox; x < ox + ow; x++) opMask[y * W + x] = 1;
  }
  for (let p = 0; p < N; p++)
    if (opMask[p]) {
      owner[p] = -1;
      outOwner[p] = -1;
    }

  // ---- walls: wall pixels (and unused gaps) near the unit
  const unitMask = new Uint8Array(N);
  for (let p = 0; p < N; p++) unitMask[p] = owner[p] >= 0 || outOwner[p] >= 0 ? 0 : 1;
  const dist = distance(unitMask, W, H);
  const usedGap = new Set(openings.map((o) => o.l));
  const wallOut = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (owner[p] >= 0 || outOwner[p] >= 0 || opMask[p] || dist[p] > WALL_KEEP) continue;
    const l = lg.labels[p];
    if (l >= 0 && usedGap.has(l)) continue;
    if (seg.wall[p] || plaster[p] === 1 || l >= 0) wallOut[p] = 1;
  }
  // ---- railings: a thin band around the outdoor areas where there is no wall
  const outMask = new Uint8Array(N);
  for (let p = 0; p < N; p++) outMask[p] = outOwner[p] >= 0 ? 0 : 1;
  const dOut = distance(outMask, W, H);
  const rail = new Uint8Array(N);
  for (let p = 0; p < N; p++)
    if (outOwner[p] < 0 && owner[p] < 0 && dOut[p] > 0 && dOut[p] <= RAIL && !wallOut[p] && !opMask[p] && lg.labels[p] < 0) {
      // only where the unit's walls are not right there
      rail[p] = 1;
    }

  // ---- rectangles, shifted so that the model starts at 0,0
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let p = 0; p < N; p++) {
    if (!(owner[p] >= 0 || outOwner[p] >= 0 || wallOut[p] || rail[p] || opMask[p])) continue;
    const x = p % W;
    const y = (p - x) / W;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const shift = (r) => [r[0] - minX, r[1] - minY, r[2], r[3]];
  const maskRects = (pred) => {
    const m = new Uint8Array(N);
    for (let p = 0; p < N; p++) m[p] = pred(p) ? 1 : 0;
    return rectangles(m, W, H).map(shift);
  };
  const outSpec = {
    planType,
    source: { file: sheetFile(building), page, scale: 100, method: 'vector' },
    northDeg: 0,
    bounds: [maxX - minX + 1, maxY - minY + 1],
    entrance: null,
    walls: maskRects((p) => wallOut[p] === 1),
    openings: openings.map((o) => {
      const [sill, head] = HEIGHTS[o.kind];
      return { kind: o.kind, rect: shift(o.rect), sill, head };
    }),
    rooms: rooms.map((r, i) => ({
      type: r.type,
      label: r.names.join(', '),
      rects: maskRects((p) => owner[p] === i),
      anchors: r.anchors.map(([x, y, n]) => [x - minX, y - minY, n]),
    })),
    outdoor: outdoor.map((o, i) => ({
      type: o.type,
      label: o.names.join(', '),
      rects: maskRects((p) => outOwner[p] === i),
      covered: o.covered,
    })),
    rails: maskRects((p) => rail[p] === 1),
  };
  const ent = outSpec.openings.find((o) => o.kind === 'entrance');
  if (ent) outSpec.entrance = [Math.round(ent.rect[0] + ent.rect[2] / 2), Math.round(ent.rect[1] + ent.rect[3] / 2)];
  // clear dimensions of rectangular rooms, from the traced geometry (±5 cm, see the T-T5C
  // calibration in models.test.ts); open-plan spaces and corridors have none
  for (const r of outSpec.rooms) {
    if (r.type === 'hall' || r.type === 'salon' || !r.rects.length) continue;
    const total = r.rects.reduce((t, q) => t + q[2] * q[3], 0);
    const big = r.rects.reduce((m, q) => (q[2] * q[3] > m[2] * m[3] ? q : m));
    if ((big[2] * big[3]) / total >= 0.9) r.dims = [big[2], big[3]];
  }
  outSpec.furniture = furnish(outSpec, spec.furniture ?? {});
  for (const r of outSpec.rooms) delete r.anchors;
  return { spec: outSpec, problems, seg, origin: [minX, minY], building, page };
}

// ---------------------------------------------------------------- check image

const TYPE_COLOR = {
  salon: '#f4c542', kitchen: '#f08a5d', dining: '#f6b26b', master: '#6fa8dc', bed: '#9fc5e8',
  mamad: '#8e7cc3', bath: '#76d7c4', wc: '#a2d9ce', service: '#b4a7d6', storage: '#cccccc',
  hall: '#e6b8af', balcony: '#93c47d', garden: '#6aa84f', 'roof-terrace': '#b6d7a8', other: '#dddddd',
};

export async function checkImage(res, model) {
  try {
    GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf', 'DebugSans');
  } catch {
    // fonts are only for the debug image
  }
  const { seg, origin } = res;
  const bg = await renderBackground(res.building, res.page, seg.win);
  const ctx = bg.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const o = ([x, y, w, h]) => [x + origin[0], y + origin[1], w, h];
  ctx.globalAlpha = 0.45;
  for (const r of [...model.rooms, ...model.outdoor]) {
    ctx.fillStyle = TYPE_COLOR[r.type] ?? '#ddd';
    for (const q of r.rects) ctx.fillRect(...o(q));
  }
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#000';
  for (const q of model.walls) ctx.fillRect(...o(q));
  ctx.fillStyle = '#0a0';
  for (const q of model.rails ?? []) ctx.fillRect(...o(q));
  ctx.globalAlpha = 1;
  const OC = { door: '#00f', entrance: '#f00', window: '#0cf', slider: '#0a0' };
  ctx.lineWidth = 4;
  for (const op of model.openings) {
    ctx.strokeStyle = OC[op.kind];
    ctx.strokeRect(...o(op.rect));
  }
  ctx.strokeStyle = '#a0522d';
  ctx.lineWidth = 3;
  for (const f of model.furniture ?? []) ctx.strokeRect(...o(f.rect));
  drawGrid(ctx, seg);
  ctx.font = '34px DebugSans';
  for (const r of [...model.rooms, ...model.outdoor]) {
    const [x, y] = [r.center[0] + origin[0], r.center[1] + origin[1]];
    const big = r.rects.reduce((m, q) => (q[2] * q[3] > m[2] * m[3] ? q : m));
    const t = `${r.type} ${r.areaM2}m² ${big[2]}x${big[3]}`;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 10, y - 30, ctx.measureText(t).width + 20, 42);
    ctx.fillStyle = '#000';
    ctx.fillText(t, x, y);
  }
  // crop to the model, ×0.5
  const [x0, y0] = origin;
  const [bw, bh] = model.bounds;
  const pad = 120;
  const sx = Math.max(0, x0 - pad);
  const sy = Math.max(0, y0 - pad);
  const cw = Math.min(seg.W - sx, bw + 2 * pad);
  const ch = Math.min(seg.H - sy, bh + 2 * pad);
  const out = createCanvas(Math.round(cw / 2), Math.round(ch / 2));
  out.getContext('2d').drawImage(bg, sx, sy, cw, ch, 0, 0, cw / 2, ch / 2);
  mkdirSync(DEBUG_DIR, { recursive: true });
  const file = join(DEBUG_DIR, `${res.key ?? model.planType}-model.png`);
  writeFileSync(file, out.toBuffer('image/png'));
  return file;
}

// ---------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--debug') {
    const [t, b, p] = args.slice(1);
    const [bb, pp] = b ? [b, +p] : sheetsWith(t)[0];
    const r = await debugType(t, bb, pp, DEBUG_DIR);
    console.log(r.file);
    console.log(r.table.join('\n'));
    return;
  }
  const specs = JSON.parse(readFileSync(SPECS, 'utf8')).models;
  const wanted = args.filter((a) => !a.startsWith('--'));
  const types = wanted.length ? wanted : Object.keys(specs);
  let failed = false;
  for (const t of types) {
    const spec = specs[t];
    if (!spec) throw new Error(`no vector spec for ${t}`);
    const res = await extractVector(spec.planType ?? t, spec);
    for (const k of ['rooms', 'outdoor']) {
      const empty = res.spec[k].filter((r) => !r.rects.length);
      for (const r of empty) res.problems.push(`${r.label}: no area left`);
      res.spec[k] = res.spec[k].filter((r) => r.rects.length);
    }
    const problems = [...res.problems, ...checkSpec(res.spec)];
    res.key = t;
    const model = buildModel(res.spec);
    const img = await checkImage(res, model);
    if (problems.length) {
      failed = true;
      console.error(`${t}: ${problems.length} problem(s)\n  ${problems.slice(0, 15).join('\n  ')}`);
      console.error(`  see ${img}`);
      continue;
    }
    const dest = spec.out ? join(ROOT, spec.out) : join(OUT_DIR, `${t}.json`);
    writeFileSync(dest, JSON.stringify(model) + '\n');
    const net = model.rooms.reduce((s, r) => s + r.areaM2, 0);
    const out = model.outdoor.reduce((s, r) => s + r.areaM2, 0);
    console.log(
      `${t}: ${model.rooms.length} rooms ${net.toFixed(1)} m² net, outdoor ${out.toFixed(1)} m², ` +
        `${model.walls.length} walls, ${model.openings.length} openings, ${model.furniture.length} furniture  (${img})`,
    );
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('extract-vector.mjs')) await main();
