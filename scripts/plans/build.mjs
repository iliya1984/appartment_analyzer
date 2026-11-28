// Renders the contractor's sales plans (resources/building_plans/*.pdf) to WebP images and
// extracts the plan-type label positions (unit anchors). Offline step, not part of `npm run build`:
//
//   npm run plans:build            # only sheets whose PDF or settings changed
//   npm run plans:build -- --force # everything
//
// Inputs:  src/data/floor-plans/sheet-map.json (hand-maintained page -> floors map)
// Outputs: resources/plans_rendered/<building>/<sheetId>@{1x,2x}.webp
//          resources/plans_rendered/hashes.json        (render cache)
//          src/data/floor-plans/sheets.generated.json  (image sizes + anchors)
//
// Each building is rendered in a child process: pdf.js keeps large operator lists alive and a
// single process runs out of memory on the 1:100 sheets (~120k paths each).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..', '..');
const PDF_DIR = join(ROOT, 'resources', 'building_plans');
const OUT_DIR = join(ROOT, 'resources', 'plans_rendered');
const MAP_FILE = join(ROOT, 'src', 'data', 'floor-plans', 'sheet-map.json');
const GENERATED = join(ROOT, 'src', 'data', 'floor-plans', 'sheets.generated.json');

/** Image widths (px) of the cropped sheet. */
export const WIDTH_1X = 1600;
export const WIDTH_2X = 3200;
const QUALITY = 82;
/** Crop box (fractions of the page): drops the title block on the left and the frame. */
export const CROP = { x0: 0.142, y0: 0.012, x1: 0.993, y1: 0.988 };
const SETTINGS = JSON.stringify({ WIDTH_1X, WIDTH_2X, QUALITY, CROP, v: 1 });

const PLAN_LABEL = /^T-[TGP][\d.]+[A-Z]?$/;

export const sheetId = (building, page) => `${building}-p${page}`;

function pdfFor(building) {
  const files = readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf'));
  const hit =
    files.find((f) => f.endsWith(`-${building}.pdf`)) ??
    files.find((f) => f.includes(`-${building}-`));
  if (!hit) throw new Error(`No PDF for building ${building}`);
  return join(PDF_DIR, hit);
}

/** Picks one anchor per plan type: the biggest label (the circle in the salon, not a table header). */
export function pickAnchors(labels) {
  const best = new Map();
  for (const l of labels) {
    const cur = best.get(l.t);
    const centre = Math.hypot(l.x - 0.5, l.y - 0.5);
    if (
      !cur ||
      l.h > cur.h + 0.5 ||
      (Math.abs(l.h - cur.h) <= 0.5 && centre < Math.hypot(cur.x - 0.5, cur.y - 0.5))
    )
      best.set(l.t, l);
  }
  // Unit labels are the big ones (circle in the salon, 9.9–11.9 pt). A small label (7.9 pt,
  // table header or note) only counts on sheets that have no big labels at all.
  const maxH = Math.max(0, ...[...best.values()].map((l) => l.h));
  for (const [t, l] of best) if (l.h < 9 && l.h < maxH - 1) best.delete(t);
  return Object.fromEntries(
    [...best.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([t, l]) => [t, [round(l.x), round(l.y)]]),
  );
}

const round = (v) => Math.round(v * 10000) / 10000;

async function renderBuilding(building, force) {
  const [{ getDocument }, { createCanvas }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('@napi-rs/canvas'),
  ]);
  const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
  const file = pdfFor(building);
  const bytes = readFileSync(file);
  const pdfHash = createHash('sha256').update(bytes).update(SETTINGS).digest('hex').slice(0, 16);
  const hashesFile = join(OUT_DIR, 'hashes.json');
  const hashes = existsSync(hashesFile) ? JSON.parse(readFileSync(hashesFile, 'utf8')) : {};
  const generated = existsSync(GENERATED) ? JSON.parse(readFileSync(GENERATED, 'utf8')) : {};
  const dir = join(OUT_DIR, building);
  mkdirSync(dir, { recursive: true });

  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  for (const entry of map.buildings[building].pages) {
    const id = sheetId(building, entry.page);
    const f1 = join(dir, `${id}@1x.webp`);
    const f2 = join(dir, `${id}@2x.webp`);
    const fresh = hashes[id] === pdfHash && existsSync(f1) && existsSync(f2) && generated[id];
    if (fresh && !force) {
      console.log(`  ${id} up to date`);
      continue;
    }
    const page = await doc.getPage(entry.page);
    const base = page.getViewport({ scale: 1 });
    const cropW = base.width * (CROP.x1 - CROP.x0);
    const cropH = base.height * (CROP.y1 - CROP.y0);
    const scale = WIDTH_2X / cropW;
    const vp = page.getViewport({ scale });
    const W2 = WIDTH_2X;
    const H2 = Math.round(cropH * scale);
    const c2 = createCanvas(W2, H2);
    const ctx = c2.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W2, H2);
    ctx.translate(-vp.width * CROP.x0, -vp.height * CROP.y0);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    writeFileSync(f2, await c2.encode('webp', QUALITY));
    const H1 = Math.round((H2 * WIDTH_1X) / W2);
    const c1 = createCanvas(WIDTH_1X, H1);
    c1.getContext('2d').drawImage(c2, 0, 0, WIDTH_1X, H1);
    writeFileSync(f1, await c1.encode('webp', QUALITY));

    // Plan-type labels are real text: convert to normalised coordinates of the cropped image.
    const text = await page.getTextContent();
    const labels = [];
    for (const it of text.items) {
      const t = it.str?.trim();
      if (!t || !PLAN_LABEL.test(t)) continue;
      const [px, py] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
      const [qx, qy] = vp.convertToViewportPoint(
        it.transform[4] + it.width / 2,
        it.transform[5] + Math.hypot(it.transform[2], it.transform[3]) / 2,
      );
      const x = (qx - vp.width * CROP.x0) / W2;
      const y = (qy - vp.height * CROP.y0) / H2;
      if (x < 0 || x > 1 || y < 0 || y > 1 || Number.isNaN(px + py)) continue;
      labels.push({ t, x, y, h: Math.hypot(it.transform[2], it.transform[3]) });
    }
    generated[id] = {
      building,
      page: entry.page,
      width: WIDTH_1X,
      height: H1,
      anchors: pickAnchors(labels),
    };
    hashes[id] = pdfHash;
    page.cleanup();
    console.log(`  ${id} rendered (${WIDTH_1X}x${H1}, ${Object.keys(generated[id].anchors).length} anchors)`);
  }
  await task.destroy();
  const sorted = Object.fromEntries(Object.entries(generated).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(GENERATED, JSON.stringify(sorted, null, 2) + '\n');
  writeFileSync(hashesFile, JSON.stringify(hashes, null, 2) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.find((a) => a.startsWith('--building='))?.slice('--building='.length);
  if (only) {
    await renderBuilding(only, force);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
  for (const b of Object.keys(map.buildings)) {
    console.log(b);
    execFileSync(
      process.execPath,
      ['--max-old-space-size=6000', fileURLToPath(import.meta.url), `--building=${b}`, ...(force ? ['--force'] : [])],
      { stdio: 'inherit' },
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
