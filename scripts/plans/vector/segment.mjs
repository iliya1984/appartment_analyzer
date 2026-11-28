// Segments the area around a unit on a 1:100 sheet into walls, openings (gaps between wall ends)
// and free regions, on a 1 cm/px raster. Coordinates of the result are px = cm from the window's
// top-left; `toPt`/`toPx` convert to and from sheet points.
import { createCanvas } from '@napi-rs/canvas';
import { distance, label, wallGaps } from '../extract-model.mjs';

export const CM_PER_PT = 3.528; // 1 pt = 0.3528 mm on paper, ×100
const WALL_MAX_HALF = 25; // px: enclosed areas thinner than ~50 cm are wall interiors
const GAP_MAX = 480;
const CAP_MAX = 64;

function drawPaths(paths, cls, win, lineWidth = 1) {
  const [x0, y0, W, H] = win;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';
  const x1 = x0 + W / CM_PER_PT;
  const y1 = y0 + H / CM_PER_PT;
  for (const p of paths) {
    if (!cls.includes(p.cls)) continue;
    if (p.bb[2] < x0 || p.bb[0] > x1 || p.bb[3] < y0 || p.bb[1] > y1) continue;
    ctx.beginPath();
    for (const s of p.subs) {
      s.forEach(([x, y], j) => {
        const X = (x - x0) * CM_PER_PT;
        const Y = (y - y0) * CM_PER_PT;
        if (j) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      });
    }
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) mask[p] = img[p * 4] < 170 ? 1 : 0;
  return mask;
}

/**
 * @param sheet parsed sheet (parse.mjs)
 * @param center [x, y] pt, the window centre
 * @param halfCm half the window size in cm
 */
export function segment(sheet, center, halfCm = 1500, splits = []) {
  const half = halfCm / CM_PER_PT;
  const x0 = Math.max(0, center[0] - half);
  const y0 = Math.max(0, center[1] - half);
  const W = Math.round((Math.min(sheet.width, center[0] + half) - x0) * CM_PER_PT);
  const H = Math.round((Math.min(sheet.height, center[1] + half) - y0) * CM_PER_PT);
  const win = [x0, y0, W, H];
  const N = W * H;
  const ink = drawPaths(sheet.paths, ['wall'], win);
  // wall interiors: enclosed thin areas between the two outlines of a wall
  const free0 = new Uint8Array(N);
  for (let p = 0; p < N; p++) free0[p] = ink[p] ? 0 : 1;
  const l0 = label(free0, W, H);
  const d0 = distance(free0, W, H);
  const maxD = new Float32Array(l0.count);
  const border0 = new Uint8Array(l0.count);
  for (let p = 0; p < N; p++) {
    const l = l0.labels[p];
    if (l < 0) continue;
    if (d0[p] > maxD[l]) maxD[l] = d0[p];
    const x = p % W;
    const y = (p - x) / W;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border0[l] = 1;
  }
  const wall = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const l = l0.labels[p];
    wall[p] = ink[p] || (l >= 0 && !border0[l] && maxD[l] <= WALL_MAX_HALF) ? 1 : 0;
  }
  const gap = wallGaps(wall, W, H, GAP_MAX, CAP_MAX);
  // split lines: separate open-plan spaces (e.g. salon | corridor) without adding a wall
  const cut = new Uint8Array(N);
  if (splits.length) {
    const c = createCanvas(W, H);
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, W, H);
    cx.strokeStyle = '#000';
    cx.lineWidth = 2;
    for (const [ax, ay, bx, by] of splits) {
      cx.beginPath();
      cx.moveTo((ax - x0) * CM_PER_PT, (ay - y0) * CM_PER_PT);
      cx.lineTo((bx - x0) * CM_PER_PT, (by - y0) * CM_PER_PT);
      cx.stroke();
    }
    const d = cx.getImageData(0, 0, W, H).data;
    for (let p = 0; p < N; p++) cut[p] = d[p * 4] < 200 && !wall[p] && !gap[p] ? 1 : 0;
  }
  const free = new Uint8Array(N);
  for (let p = 0; p < N; p++) free[p] = wall[p] || gap[p] || cut[p] ? 0 : 1;
  const reg = label(free, W, H);
  // give the cut pixels back to a neighbouring region so rooms tile without holes
  for (let pass = 0; pass < 4; pass++)
    for (let p = 0; p < N; p++) {
      if (!cut[p] || reg.labels[p] >= 0) continue;
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, p - W, x < W - 1 ? p + 1 : -1, p + W])
        if (q >= 0 && q < N && reg.labels[q] >= 0 && !cut[q]) {
          reg.labels[p] = reg.labels[q];
          break;
        }
    }
  const thin = drawPaths(sheet.paths, ['thin'], win);
  return {
    W,
    H,
    win,
    ink,
    wall,
    gap,
    cut,
    region: reg.labels,
    regionCount: reg.count,
    thin,
    toPx: ([x, y]) => [Math.round((x - x0) * CM_PER_PT), Math.round((y - y0) * CM_PER_PT)],
    toPt: ([x, y]) => [x / CM_PER_PT + x0, y / CM_PER_PT + y0],
  };
}

/** Per-region stats: size (px), bbox, centroid, touches the window border. */
export function regionStats(seg) {
  const { W, H, region, regionCount } = seg;
  const st = Array.from({ length: regionCount }, (_, i) => ({
    id: i,
    size: 0,
    sx: 0,
    sy: 0,
    bb: [Infinity, Infinity, -1, -1],
    border: false,
  }));
  for (let p = 0; p < W * H; p++) {
    const r = region[p];
    if (r < 0) continue;
    const s = st[r];
    const x = p % W;
    const y = (p - x) / W;
    s.size++;
    s.sx += x;
    s.sy += y;
    if (x < s.bb[0]) s.bb[0] = x;
    if (y < s.bb[1]) s.bb[1] = y;
    if (x > s.bb[2]) s.bb[2] = x;
    if (y > s.bb[3]) s.bb[3] = y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) s.border = true;
  }
  for (const s of st) {
    s.cx = Math.round(s.sx / Math.max(1, s.size));
    s.cy = Math.round(s.sy / Math.max(1, s.size));
  }
  return st;
}
