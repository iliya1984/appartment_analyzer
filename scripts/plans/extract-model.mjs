// Extracts a 3D plan model (walls, openings, rooms, outdoor areas) from a sales-plan PDF page.
//
//   npm run plans:model -- T-T5C [--debug=<dir>]
//
// Model specs live in scripts/plans/model-specs.json (which PDF/page, which layers or colours,
// the unit's crop box and one seed point per room with its type and Hebrew name). Output goes
// to src/data/plan-models/<planType>.json and is then checked by the model validation tests.
//
// Method (raster based, 2 cm per pixel):
//  1. Render the walls (and, separately, walls + doors/windows) of the unit: by CAD layer on
//     1:50 sheets ("layers") or by fill colour on 1:100 sheets ("colors").
//  2. Walls are drawn as outlines; thin enclosed areas (< 60 cm across) are wall interiors.
//  3. Free space is split into rooms at door-sized necks (erode 44 cm, grow back).
//  4. Gaps between two wall ends of the same wall band are openings: windows/sliders when one
//     side is outside or a balcony, otherwise doors.
//  5. Masks become rectangles (greedy meshing) in centimetres, origin at the unit's top-left.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const CM_PER_PX = 2;
const WALL_MAX_HALF = 15; // px: wall interiors are at most ~60 cm thick
const NECK = 22; // px: 44 cm erosion separates rooms at doors (≤ 90 cm)
const GAP_MAX = 240; // px: longest opening, 480 cm
const END_CAP_MAX = 32; // px: a wall end is at most 64 cm thick
const MIN_REGION = 1500; // px²: 0.6 m²

// ---------------------------------------------------------------- raster helpers (exported for tests)

export class Grid {
  constructor(w, h, Type = Uint8Array) {
    this.w = w;
    this.h = h;
    this.d = new Type(w * h);
  }
  i(x, y) {
    return y * this.w + x;
  }
}

/** Connected components of `mask` (4-neighbourhood). Returns {labels:Int32Array, count}. */
export function label(mask, w, h) {
  const labels = new Int32Array(w * h).fill(-1);
  let count = 0;
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s] !== -1) continue;
    labels[s] = count;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) {
        if (q >= 0 && mask[q] && labels[q] === -1) {
          labels[q] = count;
          stack.push(q);
        }
      }
    }
    count++;
  }
  return { labels, count };
}

/** Chamfer (3-4) distance from every `mask` pixel to the nearest non-mask pixel, in px. */
export function distance(mask, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) d[p] = mask[p] ? INF : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!d[p]) continue;
      let v = d[p];
      if (x > 0) v = Math.min(v, d[p - 1] + 3);
      if (y > 0) v = Math.min(v, d[p - w] + 3);
      if (x > 0 && y > 0) v = Math.min(v, d[p - w - 1] + 4);
      if (x < w - 1 && y > 0) v = Math.min(v, d[p - w + 1] + 4);
      d[p] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (!d[p]) continue;
      let v = d[p];
      if (x < w - 1) v = Math.min(v, d[p + 1] + 3);
      if (y < h - 1) v = Math.min(v, d[p + w] + 3);
      if (x < w - 1 && y < h - 1) v = Math.min(v, d[p + w + 1] + 4);
      if (x > 0 && y < h - 1) v = Math.min(v, d[p + w - 1] + 4);
      d[p] = v;
    }
  for (let p = 0; p < w * h; p++) d[p] /= 3;
  return d;
}

/** Greedy meshing: covers `mask` with axis-aligned rectangles [x, y, w, h] (px). */
export function rectangles(mask, w, h) {
  const used = new Uint8Array(w * h);
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!mask[p] || used[p]) continue;
      let x1 = x;
      while (x1 + 1 < w && mask[y * w + x1 + 1] && !used[y * w + x1 + 1]) x1++;
      let y1 = y;
      grow: while (y1 + 1 < h) {
        for (let k = x; k <= x1; k++) {
          const q = (y1 + 1) * w + k;
          if (!mask[q] || used[q]) break grow;
        }
        y1++;
      }
      for (let yy = y; yy <= y1; yy++) for (let k = x; k <= x1; k++) used[yy * w + k] = 1;
      out.push([x, y, x1 - x + 1, y1 - y + 1]);
    }
  }
  return out;
}

/**
 * Fills gaps between two wall ends of the same wall band. A run of non-wall pixels along a row
 * (or column) counts when it is ≤ maxLen and the wall pixels at both of its ends are short
 * across the run direction (≤ capMax): the ends of a wall, not a wall running alongside.
 */
export function wallGaps(wall, w, h, maxLen = GAP_MAX, capMax = END_CAP_MAX) {
  const gap = new Uint8Array(w * h);
  const across = (x, y, horizontal) => {
    // length of the wall run through (x, y) perpendicular to the scan direction
    let n = 1;
    if (horizontal) {
      for (let k = y - 1; k >= 0 && wall[k * w + x]; k--) n++;
      for (let k = y + 1; k < h && wall[k * w + x]; k++) n++;
    } else {
      for (let k = x - 1; k >= 0 && wall[y * w + k]; k--) n++;
      for (let k = x + 1; k < w && wall[y * w + k]; k++) n++;
    }
    return n;
  };
  const scan = (horizontal) => {
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;
    const at = (o, k) => (horizontal ? o * w + k : k * w + o);
    for (let o = 0; o < outer; o++) {
      let last = -1;
      for (let k = 0; k < inner; k++) {
        if (!wall[at(o, k)]) continue;
        if (last >= 0 && k - last > 1 && k - last - 1 <= maxLen) {
          const [ax, ay] = horizontal ? [last, o] : [o, last];
          const [bx, by] = horizontal ? [k, o] : [o, k];
          if (across(ax, ay, horizontal) <= capMax && across(bx, by, horizontal) <= capMax)
            for (let m = last + 1; m < k; m++) gap[at(o, m)] = 1;
        }
        last = k;
      }
    }
  };
  scan(true);
  scan(false);
  // A gap pixel must be bounded on both sides by gap or wall across its run (thin band only).
  return gap;
}

// ---------------------------------------------------------------- extraction

async function renderMask(page, cfg, spec, k, visibleLayers, colors) {
  const { createCanvas } = await import('@napi-rs/canvas');
  if (cfg) {
    const rx = new RegExp(visibleLayers, 'i');
    for (const [id, g] of cfg) cfg.setVisibility(id, rx.test(g.name));
  }
  const vp = page.getViewport({ scale: k });
  const [cx0, cy0, cx1, cy1] = spec.cropPt.map((v) => Math.round(v * k));
  const W = cx1 - cx0;
  const H = cy1 - cy0;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-cx0, -cy0);
  await page.render({
    canvasContext: ctx,
    viewport: vp,
    ...(cfg ? { optionalContentConfigPromise: Promise.resolve(cfg) } : {}),
  }).promise;
  const img = ctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const r = img[p * 4];
    const g = img[p * 4 + 1];
    const b = img[p * 4 + 2];
    if (colors) {
      mask[p] = colors.some(([cr, cg, cb]) => Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb) < 40) ? 1 : 0;
    } else {
      mask[p] = 0.3 * r + 0.59 * g + 0.11 * b < 215 ? 1 : 0;
    }
  }
  return { mask, W, H, canvas: c };
}

export async function extract(spec, { debugDir } = {}) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = readFileSync(join(ROOT, 'resources', 'building_plans', spec.file));
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(spec.page);
  const cmPerPt = (0.3528 / 10) * spec.scale; // 1 pt = 0.3528 mm on paper
  const k = cmPerPt / CM_PER_PX;
  const cfg = spec.method === 'layers' ? await doc.getOptionalContentConfig() : null;

  const A = await renderMask(page, cfg, spec, k, spec.wallLayers, spec.wallColors);
  const B = await renderMask(page, cfg, spec, k, `${spec.wallLayers}|${spec.openingLayers ?? '$^'}`, spec.wallColors);
  await task.destroy();
  const { W, H } = A;
  const N = W * H;

  // 2. wall interiors: thin enclosed areas of !inkA
  const freeA = new Uint8Array(N);
  for (let p = 0; p < N; p++) freeA[p] = A.mask[p] ? 0 : 1;
  const la = label(freeA, W, H);
  const da = distance(freeA, W, H);
  const maxD = new Float32Array(la.count);
  const border = new Uint8Array(la.count);
  for (let p = 0; p < N; p++) {
    const l = la.labels[p];
    if (l < 0) continue;
    if (da[p] > maxD[l]) maxD[l] = da[p];
    const x = p % W;
    const y = (p - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border[l] = 1;
  }
  const wall = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const l = la.labels[p];
    wall[p] = A.mask[p] || (l >= 0 && !border[l] && maxD[l] <= WALL_MAX_HALF) ? 1 : 0;
  }

  // 3. rooms: free space of walls + openings, split at necks
  const space = new Uint8Array(N);
  for (let p = 0; p < N; p++) space[p] = wall[p] || B.mask[p] ? 0 : 1;
  const ds = distance(space, W, H);
  const core = new Uint8Array(N);
  for (let p = 0; p < N; p++) core[p] = ds[p] > NECK ? 1 : 0;
  const lc = label(core, W, H);
  const region = new Int32Array(N).fill(-1);
  const queue = [];
  for (let p = 0; p < N; p++)
    if (lc.labels[p] >= 0) {
      region[p] = lc.labels[p];
      queue.push(p);
    }
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi];
    const x = p % W;
    const y = (p - x) / W;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
      if (q >= 0 && space[q] && region[q] === -1) {
        region[q] = region[p];
        queue.push(q);
      }
    }
  }
  const outside = new Set();
  const size = new Int32Array(lc.count);
  for (let p = 0; p < N; p++) {
    const r = region[p];
    if (r < 0) continue;
    size[r]++;
    const x = p % W;
    const y = (p - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) outside.add(r);
  }

  if (debugDir) {
    const { createCanvas } = await import('@napi-rs/canvas');
    mkdirSync(debugDir, { recursive: true });
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(W, H);
    for (let p = 0; p < N; p++) {
      const r = region[p];
      const col = wall[p] ? [30, 30, 30] : B.mask[p] ? [250, 120, 0] : r < 0 ? [255, 255, 255] : outside.has(r) ? [200, 230, 255] : [(r * 97) % 200 + 40, (r * 57) % 200 + 40, (r * 151) % 200 + 40];
      im.data.set([...col, 255], p * 4);
    }
    ctx.putImageData(im, 0, 0);
    ctx.fillStyle = '#f00';
    for (const sd of spec.rooms) {
      const [x, y] = [Math.round(sd.at[0] * k - spec.cropPt[0] * k), Math.round(sd.at[1] * k - spec.cropPt[1] * k)];
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    writeFileSync(join(debugDir, `${spec.planType}-regions.png`), c.toBuffer('image/png'));
  }

  // seeds → typed regions
  const toPx = ([xPt, yPt]) => [Math.round(xPt * k - spec.cropPt[0] * k), Math.round(yPt * k - spec.cropPt[1] * k)];
  const typed = new Map(); // region → seed
  for (const s of spec.rooms) {
    const [x, y] = toPx(s.at);
    let r = region[y * W + x];
    if (r == null || r < 0) {
      // seed fell on furniture ink: take the nearest region pixel
      let best = Infinity;
      for (let yy = Math.max(0, y - 30); yy < Math.min(H, y + 30); yy++)
        for (let xx = Math.max(0, x - 30); xx < Math.min(W, x + 30); xx++) {
          const q = region[yy * W + xx];
          const dd = (xx - x) ** 2 + (yy - y) ** 2;
          if (q >= 0 && dd < best) {
            best = dd;
            r = q;
          }
        }
    }
    if (r == null || r < 0) throw new Error(`Seed "${s.label}" is not inside any region`);
    if (outside.has(r)) throw new Error(`Seed "${s.label}" is outside the unit`);
    const prev = typed.get(r);
    // open plan: several names in one space ("סלון, מטבח, פינת אוכל"); the first seed sets the type
    if (prev) {
      if (!prev.label.split(', ').includes(s.label)) typed.set(r, { ...prev, label: `${prev.label}, ${s.label}` });
    } else typed.set(r, s);
  }

  // 4. openings
  const gap = wallGaps(wall, W, H);
  const lg = label(gap, W, H);
  const gapBoxes = Array.from({ length: lg.count }, () => [Infinity, Infinity, -1, -1]);
  for (let p = 0; p < N; p++) {
    const l = lg.labels[p];
    if (l < 0) continue;
    const x = p % W;
    const y = (p - x) / W;
    const b = gapBoxes[l];
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  const isOutdoor = (r) => r < 0 || outside.has(r) || typed.get(r)?.outdoor === true || !typed.has(r);
  const regionAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : region[y * W + x]);
  const sideRegion = (x, y, dx, dy) => {
    for (let s = 1; s < 40; s++) {
      const r = regionAt(x + dx * s, y + dy * s);
      if (r >= 0 || x + dx * s < 0 || y + dy * s < 0 || x + dx * s >= W || y + dy * s >= H) return r;
    }
    return -1;
  };
  const openings = [];
  for (const [x0, y0, x1, y1] of gapBoxes) {
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const len = Math.max(bw, bh);
    if (len < 25 || Math.min(bw, bh) > 40 || Math.min(bw, bh) < 4) continue; // < 50 cm: not an opening
    const horizontal = bw >= bh;
    const cx = Math.round((x0 + x1) / 2);
    const cy = Math.round((y0 + y1) / 2);
    const a = horizontal ? sideRegion(cx, y0, 0, -1) : sideRegion(x0, cy, -1, 0);
    const b = horizontal ? sideRegion(cx, y1, 0, 1) : sideRegion(x1, cy, 1, 0);
    const toOut = isOutdoor(a) || isOutdoor(b);
    if (isOutdoor(a) && isOutdoor(b)) continue; // e.g. the balcony edge: no indoor side
    const cm = len * CM_PER_PX;
    const ent = spec.entrancePt ? toPx(spec.entrancePt) : null;
    const atEntrance = ent != null && ent[0] >= x0 - 60 && ent[0] <= x1 + 60 && ent[1] >= y0 - 25 && ent[1] <= y1 + 25;
    const kind = atEntrance ? 'entrance' : !toOut ? 'door' : cm >= 160 ? 'slider' : 'window';
    const [sill, head] = kind === 'door' || kind === 'entrance' ? [0, 210] : kind === 'slider' ? [0, 230] : [90, 220];
    openings.push({ kind, rect: [x0, y0, bw, bh].map((v) => v * CM_PER_PX), sill, head });
  }
  for (let p = 0; p < N; p++) if (gap[p]) wall[p] = 0; // keep wall and opening rectangles disjoint

  // 5. rectangles + areas
  const roomsOut = [];
  const outdoorOut = [];
  let idx = 0;
  for (const [r, seed] of typed) {
    if (size[r] < MIN_REGION) continue;
    const m = new Uint8Array(N);
    let sx = 0;
    let sy = 0;
    for (let p = 0; p < N; p++)
      if (region[p] === r) {
        m[p] = 1;
        sx += p % W;
        sy += Math.floor(p / W);
      }
    const rects = rectangles(m, W, H).map((q) => q.map((v) => v * CM_PER_PX));
    const area = Math.round(((size[r] * CM_PER_PX * CM_PER_PX) / 10000) * 10) / 10;
    const center = [Math.round((sx / size[r]) * CM_PER_PX), Math.round((sy / size[r]) * CM_PER_PX)];
    const item = { id: `r${++idx}`, type: seed.type, label: seed.label, rects, areaM2: area, center };
    if (seed.outdoor) outdoorOut.push({ ...item, covered: seed.covered ?? false });
    else roomsOut.push(item);
  }
  const wallsOut = rectangles(wall, W, H).map((q) => q.map((v) => v * CM_PER_PX));
  // keep only walls touching the unit (drop stray ink far from typed rooms)
  const model = {
    planType: spec.planType,
    source: { file: spec.file, page: spec.page, scale: spec.scale, method: spec.method },
    unitsCm: true,
    northDeg: spec.northDeg ?? 0,
    bounds: [W * CM_PER_PX, H * CM_PER_PX],
    entrance: spec.entrancePt ? toPx(spec.entrancePt).map((v) => v * CM_PER_PX) : null,
    walls: wallsOut,
    openings,
    rooms: roomsOut,
    outdoor: outdoorOut,
  };

  if (debugDir) {
    const { createCanvas } = await import('@napi-rs/canvas');
    mkdirSync(debugDir, { recursive: true });
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(W, H);
    const pal = (n) => [(n * 97) % 200 + 40, (n * 57) % 200 + 40, (n * 151) % 200 + 40];
    for (let p = 0; p < N; p++) {
      let col = [255, 255, 255];
      if (region[p] >= 0) col = typed.has(region[p]) ? pal(region[p]) : [235, 235, 235];
      if (wall[p]) col = [30, 30, 30];
      if (gap[p]) col = [255, 0, 0];
      im.data.set([...col, 255], p * 4);
    }
    ctx.putImageData(im, 0, 0);
    ctx.font = 'bold 16px sans-serif';
    for (const r of [...roomsOut, ...outdoorOut]) {
      ctx.fillStyle = '#000';
      ctx.fillText(`${r.type} ${r.areaM2}`, r.center[0] / CM_PER_PX - 30, r.center[1] / CM_PER_PX);
    }
    for (const o of openings) {
      ctx.strokeStyle = o.kind === 'door' ? '#00f' : o.kind === 'slider' ? '#0a0' : '#f0f';
      ctx.lineWidth = 3;
      ctx.strokeRect(...o.rect.map((v) => v / CM_PER_PX));
    }
    writeFileSync(join(debugDir, `${spec.planType}.png`), c.toBuffer('image/png'));
  }
  return model;
}

async function main() {
  const args = process.argv.slice(2);
  const debugDir = args.find((a) => a.startsWith('--debug='))?.slice(8);
  const specs = JSON.parse(readFileSync(join(import.meta.dirname, 'model-specs.json'), 'utf8'));
  const wanted = args.filter((a) => !a.startsWith('--'));
  const types = wanted.length ? wanted : Object.keys(specs.models);
  const outDir = join(ROOT, 'src', 'data', 'plan-models');
  mkdirSync(outDir, { recursive: true });
  for (const t of types) {
    const spec = { planType: t, ...specs.models[t] };
    const model = await extract(spec, { debugDir });
    writeFileSync(join(outDir, `${t}.json`), JSON.stringify(model) + '\n');
    const rooms = model.rooms.reduce((s, r) => s + r.areaM2, 0);
    console.log(
      `${t}: ${model.walls.length} wall boxes, ${model.openings.length} openings, ${model.rooms.length} rooms (${rooms.toFixed(1)} m² net), ${model.outdoor.length} outdoor`,
    );
  }
}

if (process.argv[1]?.endsWith('extract-model.mjs')) await main();
