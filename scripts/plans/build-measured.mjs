// Builds plan models from hand-measured specs (scripts/plans/measured/<planType>.json).
//
//   npm run plans:measured [-- T-T5C ...]
//
// A measured spec holds walls, openings, rooms and furniture as [x, y, w, h] rectangles in cm,
// read off the sales sheet (and checked against its dimension labels). This script adds the
// derived fields (ids, areas, label points), checks the geometry and writes
// src/data/plan-models/<planType>.json. Measured specs take precedence over `npm run plans:model`
// (the raster extractor), which is kept for drafting new types.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SPEC_DIR = join(import.meta.dirname, 'measured');
const OUT_DIR = join(ROOT, 'src', 'data', 'plan-models');

const area = (rs) => rs.reduce((s, r) => s + r[2] * r[3], 0);
const overlap = (a, b) =>
  Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));

/** Label point: the centre of the room's largest rectangle (always inside the room). */
const labelPoint = (rs) => {
  const big = rs.reduce((m, r) => (r[2] * r[3] > m[2] * m[3] ? r : m));
  return [Math.round(big[0] + big[2] / 2), Math.round(big[1] + big[3] / 2)];
};

/** Overlaps (cm²) between rectangles that must stay disjoint, as readable messages. */
export function checkSpec(spec) {
  const problems = [];
  const spaces = [...spec.rooms, ...spec.outdoor].flatMap((r) => r.rects.map((q) => [r.label, q]));
  const solids = [
    ...spec.walls.map((q) => ['wall', q]),
    ...spec.openings.map((o) => [o.kind, o.rect]),
  ];
  for (const [name, q] of spaces)
    for (const [what, s] of solids)
      if (overlap(q, s) > 0) problems.push(`${name} [${q}] overlaps ${what} [${s}]`);
  for (let i = 0; i < spaces.length; i++)
    for (let j = i + 1; j < spaces.length; j++)
      if (overlap(spaces[i][1], spaces[j][1]) > 0)
        problems.push(`${spaces[i][0]} overlaps ${spaces[j][0]}`);
  for (const o of spec.openings)
    for (const w of spec.walls)
      if (overlap(o.rect, w) > 0) problems.push(`${o.kind} [${o.rect}] overlaps wall [${w}]`);
  for (const f of spec.furniture ?? []) {
    for (const [what, s] of solids)
      if (overlap(f.rect, s) > 0) problems.push(`${f.kind} [${f.rect}] overlaps ${what} [${s}]`);
    if (!spaces.some(([, q]) => overlap(f.rect, q) > 0))
      problems.push(`${f.kind} [${f.rect}] is outside every room`);
  }
  return problems;
}

export function buildModel(spec) {
  let n = 0;
  const room = ({ dims, covered, ...r }) => ({
    id: `r${++n}`,
    ...r,
    areaM2: Math.round(area(r.rects) / 1000) / 10,
    center: labelPoint(r.rects),
    ...(dims ? { dims } : {}),
    ...(covered === undefined ? {} : { covered }),
  });
  return {
    planType: spec.planType,
    source: spec.source,
    unitsCm: true,
    northDeg: spec.northDeg,
    bounds: spec.bounds,
    entrance: spec.entrance,
    walls: spec.walls,
    openings: spec.openings,
    rooms: spec.rooms.map(room),
    outdoor: spec.outdoor.map(room),
    rails: spec.rails ?? [],
    furniture: spec.furniture ?? [],
  };
}

function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const types = wanted.length
    ? wanted
    : readdirSync(SPEC_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5));
  mkdirSync(OUT_DIR, { recursive: true });
  let failed = false;
  for (const t of types) {
    const spec = JSON.parse(readFileSync(join(SPEC_DIR, `${t}.json`), 'utf8'));
    const problems = checkSpec(spec);
    if (problems.length) {
      failed = true;
      console.error(`${t}: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
      continue;
    }
    const model = buildModel(spec);
    writeFileSync(join(OUT_DIR, `${t}.json`), JSON.stringify(model) + '\n');
    const net = model.rooms.reduce((s, r) => s + r.areaM2, 0);
    const out = model.outdoor.reduce((s, r) => s + r.areaM2, 0);
    console.log(
      `${t}: ${model.rooms.length} rooms ${net.toFixed(1)} m² net, outdoor ${out.toFixed(1)} m², ` +
        `${model.walls.length} walls, ${model.openings.length} openings, ${model.furniture.length} furniture`,
    );
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('build-measured.mjs')) main();
