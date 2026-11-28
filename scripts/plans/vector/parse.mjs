// Reads a 1:100 sales sheet (vector PDF without layers) into classified polylines in PDF points
// (origin top-left, y down). Classes come from stroke colour + plotted line width, which the
// architect's plot style keeps consistent on every sheet:
//   wall  — black 1.8 pt (concrete / outer walls) and 1.44 pt (partitions)
//   thin  — black 0.48 / 0.24 / 0.12 pt (door leaves and swings, window panes, railings)
//   text  — black 0.84 pt (room names are drawn as stroked glyphs, not as PDF text)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..', '..');
export const PLAN_DIR = join(ROOT, 'resources', 'building_plans');

const CLASS = [
  ['#000000', 1.8, 'wall'],
  ['#000000', 1.44, 'wall'],
  ['#000000', 0.84, 'text'],
  ['#000000', 0.48, 'thin'],
  ['#000000', 0.24, 'thin'],
  ['#000000', 0.12, 'thin'],
];

export function sheetFile(building) {
  const f = readdirSync(PLAN_DIR).find(
    (n) => n.includes(`-${building}.pdf`) && !n.includes('-50.pdf'),
  );
  if (!f) throw new Error(`no sheet PDF for building ${building}`);
  return f;
}

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Flattens pdf.js path data (DrawOPS) to subpaths of [x, y] points under matrix m. */
function flatten(d, m) {
  const tx = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const subs = [];
  let cur = null;
  let last = [0, 0];
  let start = [0, 0];
  for (let j = 0; j < d.length; ) {
    const o = d[j++];
    if (o === 0) {
      last = [d[j++], d[j++]];
      start = last;
      cur = [tx(...last)];
      subs.push(cur);
    } else if (o === 1) {
      last = [d[j++], d[j++]];
      cur?.push(tx(...last));
    } else if (o === 2 || o === 3) {
      const n = o === 2 ? 3 : 2;
      const c = [];
      for (let q = 0; q < n; q++) c.push([d[j++], d[j++]]);
      const p0 = last;
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        let p;
        if (n === 3) {
          const u = 1 - t;
          p = [0, 1].map(
            (k) =>
              u * u * u * p0[k] + 3 * u * u * t * c[0][k] + 3 * u * t * t * c[1][k] + t * t * t * c[2][k],
          );
        } else {
          const u = 1 - t;
          p = [0, 1].map((k) => u * u * p0[k] + 2 * u * t * c[0][k] + t * t * c[1][k]);
        }
        cur?.push(tx(...p));
      }
      last = c[n - 1];
    } else if (o === 4) {
      cur?.push(tx(...start));
      last = start;
    }
  }
  return subs;
}

const cache = new Map();
const DISK = join(ROOT, "node_modules", ".cache", "plans-vector");

/** { width, height, paths: [{cls, subs, bb:[x0,y0,x1,y1], sig?}], labels: [{t, x, y, h}] } in pt. */
export async function parseSheet(building, pageNo) {
  const key = `${building}-${pageNo}`;
  if (cache.has(key)) return cache.get(key);
  const file = join(DISK, `${key}.json`);
  if (existsSync(file)) {
    const hit = JSON.parse(readFileSync(file, "utf8"));
    cache.set(key, hit);
    return hit;
  }
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = readFileSync(join(PLAN_DIR, sheetFile(building)));
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  const text = await page.getTextContent();
  // the viewport transform handles MediaBox offsets (some sheets do not start at 0,0)
  let st = { m: [...vp.transform], stroke: '#000000', fill: '#000000', lw: 1 };
  const stack = [];
  const paths = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const a = ol.argsArray[i];
    if (fn === OPS.save) stack.push({ ...st });
    else if (fn === OPS.restore) st = stack.pop() ?? st;
    else if (fn === OPS.transform) st.m = mul(st.m, a);
    else if (fn === OPS.setStrokeRGBColor) st.stroke = a[0];
    else if (fn === OPS.setFillRGBColor) st.fill = a[0];
    else if (fn === OPS.setLineWidth) st.lw = a[0];
    else if (fn === OPS.constructPath) {
      if (a[0] !== OPS.stroke && a[0] !== OPS.closeStroke) continue;
      const lwPt = Math.round(st.lw * Math.hypot(st.m[0], st.m[1]) * 100) / 100;
      const cls = CLASS.find(([c, w]) => c === st.stroke && w === lwPt)?.[2];
      if (!cls) continue;
      const d = a[1]?.[0];
      if (!d) continue;
      const subs = flatten(d, st.m);
      const pts = subs.flat();
      if (!pts.length) continue;
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const path = { cls, subs, bb };
      if (cls === 'text') {
        // translation-invariant shape signature (glyphs repeat exactly)
        path.sig = `${pts.length}:${Math.round((bb[2] - bb[0]) * 4)}x${Math.round((bb[3] - bb[1]) * 4)}`;
      }
      paths.push(path);
    }
  }
  const labels = [];
  for (const it of text.items) {
    const t = it.str.trim();
    if (!/^T-[A-Z]+[\d.]+[A-Z]*$/.test(t)) continue;
    const h = Math.hypot(it.transform[2], it.transform[3]);
    const [px, py] = vp.convertToViewportPoint(it.transform[4] + it.width / 2, it.transform[5] + h / 2);
    labels.push({ t, x: px, y: py, h });
  }
  await task.destroy();
  const out = { width: vp.width, height: vp.height, paths, labels };
  cache.set(key, out);
  mkdirSync(DISK, { recursive: true });
  writeFileSync(file, JSON.stringify(out));
  return out;
}

/** The plan-type label inside the unit (the biggest one; the others are table headers). */
export function anchorOf(sheet, planType) {
  const c = sheet.labels.filter((l) => l.t === planType).sort((a, b) => b.h - a.h);
  return c[0] ?? null;
}

/**
 * Groups text glyphs into words: glyphs on one line (vertical overlap) less than `gap` pt apart.
 * Returns [{sig, bb, cx, cy}] where sig is the joined glyph signatures, left to right.
 */
export function words(sheet, gap = 1.6) {
  const g = sheet.paths.filter((p) => p.cls === 'text' && p.bb[3] - p.bb[1] < 8 && p.bb[2] - p.bb[0] < 8);
  g.sort((a, b) => a.bb[0] - b.bb[0]);
  const used = new Uint8Array(g.length);
  const out = [];
  for (let i = 0; i < g.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const w = [g[i]];
    let bb = [...g[i].bb];
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < g.length; j++) {
        if (used[j]) continue;
        const q = g[j].bb;
        if (q[0] > bb[2] + gap) break;
        const vOverlap = Math.min(bb[3], q[3]) - Math.max(bb[1], q[1]);
        const lineH = Math.max(bb[3] - bb[1], 2.5);
        const near = q[0] <= bb[2] + gap && q[2] >= bb[0] - gap;
        // same line: overlapping vertically (dots and short strokes sit inside the line box)
        if (near && vOverlap >= -0.2 && q[1] >= bb[1] - lineH * 0.6 && q[3] <= bb[3] + lineH * 0.6) {
          used[j] = 1;
          w.push(g[j]);
          bb = [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[2]), Math.max(bb[3], q[3])];
          grew = true;
        }
      }
    }
    w.sort((a, b) => a.bb[0] - b.bb[0] || a.bb[1] - b.bb[1]);
    const sig = w
      .map((p) => p.sig)
      .join('|');
    out.push({ sig, bb, cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, n: w.length });
  }
  return out;
}
