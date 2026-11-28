// Debug view for writing a vector spec: npm run plans:vector -- --debug <planType> [building page]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf', 'DebugSans');
import { anchorOf, parseSheet, PLAN_DIR, sheetFile } from './parse.mjs';
import { CM_PER_PT, regionStats, segment } from './segment.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');

export function sheetsWith(planType) {
  const gen = JSON.parse(readFileSync(join(ROOT, 'src/data/floor-plans/sheets.generated.json'), 'utf8'));
  return Object.values(gen)
    .filter((g) => g.anchors[planType] && g.building !== 'D15')
    .map((g) => [g.building, g.page]);
}

export async function renderBackground(building, page, win) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(readFileSync(join(PLAN_DIR, sheetFile(building)))), verbosity: 0 }).promise;
  const pg = await doc.getPage(page);
  const [x0, y0, W, H] = win;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(-x0 * CM_PER_PT, -y0 * CM_PER_PT);
  await pg.render({ canvasContext: ctx, viewport: pg.getViewport({ scale: CM_PER_PT }) }).promise;
  await doc.cleanup();
  return c;
}

/** Sheet-point grid: thin lines every 10 pt, labelled every 50 pt. */
export function drawGrid(ctx, seg) {
  const [x0, y0, W, H] = seg.win;
  ctx.font = '30px DebugSans';
  for (let v = Math.ceil(x0 / 10) * 10; (v - x0) * CM_PER_PT < W; v += 10) {
    const X = (v - x0) * CM_PER_PT;
    ctx.strokeStyle = v % 50 ? 'rgba(0,150,0,0.25)' : 'rgba(0,150,0,0.7)';
    ctx.lineWidth = v % 50 ? 1 : 2;
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke();
    if (v % 50 === 0) { ctx.fillStyle = '#080'; ctx.fillText(String(v), X + 3, 30); ctx.fillText(String(v), X + 3, H - 8); }
  }
  for (let v = Math.ceil(y0 / 10) * 10; (v - y0) * CM_PER_PT < H; v += 10) {
    const Y = (v - y0) * CM_PER_PT;
    ctx.strokeStyle = v % 50 ? 'rgba(0,150,0,0.25)' : 'rgba(0,150,0,0.7)';
    ctx.lineWidth = v % 50 ? 1 : 2;
    ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(W, Y); ctx.stroke();
    if (v % 50 === 0) { ctx.fillStyle = '#080'; ctx.fillText(String(v), 3, Y - 4); ctx.fillText(String(v), W - 70, Y - 4); }
  }
}

export async function debugType(planType, building, page, outDir, halfCm = 1500) {
  const sheet = await parseSheet(building, page);
  const a = anchorOf(sheet, planType);
  if (!a) throw new Error(`${planType} not on ${building} p${page}`);
  const c = process.env.CENTER ? process.env.CENTER.split(',').map(Number) : [a.x, a.y];
  const seg = segment(sheet, c, +(process.env.HALF ?? halfCm));
  const st = regionStats(seg);
  const bg = await renderBackground(building, page, seg.win);
  const { W, H } = seg;
  const ctx = bg.getContext('2d');
  const im = ctx.getImageData(0, 0, W, H);
  const pal = (n) => [(n * 97) % 160 + 80, (n * 57) % 160 + 80, (n * 151) % 160 + 80];
  for (let p = 0; p < W * H; p++) {
    const r = seg.region[p];
    let col = null;
    if (seg.gap[p]) col = [255, 0, 0];
    else if (r >= 0 && !st[r].border && st[r].size > 5000) col = pal(r);
    if (!col) continue;
    const k = seg.gap[p] ? 0.8 : 0.35;
    for (let c = 0; c < 3; c++) im.data[p * 4 + c] = im.data[p * 4 + c] * (1 - k) + col[c] * k;
  }
  ctx.putImageData(im, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawGrid(ctx, seg);
  ctx.font = '40px DebugSans';
  const table = [];
  for (const s of st) {
    if (s.border || s.size < 5000) continue;
    const [px, py] = seg.toPt([s.cx, s.cy]);
    ctx.fillStyle = '#00f';
    ctx.fillText(String(s.id), s.cx - 15, s.cy + 12);
    const b0 = seg.toPt([s.bb[0], s.bb[1]]).map((v) => v.toFixed(1));
    const b1 = seg.toPt([s.bb[2] + 1, s.bb[3] + 1]).map((v) => v.toFixed(1));
    table.push(
      `${s.id}\t${(s.size / 1e4).toFixed(1)} m²\tat ${px.toFixed(0)},${py.toFixed(0)}\tbox ${b0} – ${b1}\t${s.bb[2] - s.bb[0] + 1}x${s.bb[3] - s.bb[1] + 1}`,
    );
  }
  mkdirSync(outDir, { recursive: true });
  // downscale ×0.5 for viewing
  const out = createCanvas(Math.round(W / 2), Math.round(H / 2));
  out.getContext('2d').drawImage(bg, 0, 0, W / 2, H / 2);
  const file = join(outDir, `${planType}-${building}-p${page}.png`);
  writeFileSync(file, out.toBuffer('image/png'));
  return { file, table, anchor: [a.x, a.y] };
}

if (process.argv[1]?.endsWith('debug.mjs')) {
  const [t, b, p] = process.argv.slice(2);
  const out = process.env.OUT ?? join(ROOT, 'node_modules', '.cache', 'plans-debug');
  const [bb, pp] = b ? [b, +p] : sheetsWith(t)[0];
  const r = await debugType(t, bb, pp, out);
  console.log(r.file, 'anchor', r.anchor.map((v) => v.toFixed(0)).join(','));
  console.log(r.table.join('\n'));
}
