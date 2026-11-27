// Golden-master generator (migration plan, Phase 0 / risk R2).
//
// Runs the *legacy* app logic from legacy/template.html (with legacy/data.js inlined) inside a
// Node sandbox and records everything it computes: derived apartment fields, building stats,
// insights, filter/sort results, formatting helpers, solar math, schematic layouts and the
// export rows. The React port is tested against this file (src/**/__tests__/*golden*.test.ts).
//
// Usage: node scripts/generate-legacy-fixtures.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'legacy/template.html'), 'utf8');
const data = readFileSync(join(root, 'legacy/data.js'), 'utf8');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const app = scripts.find((s) => s.includes('/*DATA*/'));
if (!app) throw new Error('legacy app script not found');
const bootAt = app.indexOf('/* ---------- boot ---------- */');
const logic = app.slice(0, bootAt).replace('/*DATA*/', data);

// Minimal DOM stand-ins: only what the functions called below touch.
const stubEl = () => ({
  textContent: '',
  innerHTML: '',
  value: '',
  hidden: false,
  scrollTop: 0,
  classList: { add() {}, remove() {} },
  setAttribute() {},
  focus() {},
  querySelectorAll: () => [],
});
const elements = new Map();
const context = {
  console,
  setTimeout: () => 0,
  clearTimeout: () => {},
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { clipboard: { writeText: async () => {} } },
  document: {
    querySelector: (s) => {
      if (!elements.has(s)) elements.set(s, stubEl());
      return elements.get(s);
    },
    querySelectorAll: () => [],
    body: { style: {} },
    addEventListener() {},
  },
  window: {},
  Blob: class {
    constructor(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    }
  },
};
context.globalThis = context;

const harness = String.raw`
const unesc = s => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
derive(RAW);
const out = {};
out.buildings = BLDS.slice();
out.buildingStats = BLDS.map(b => BST[b]);
out.units = UNITS.map(u => JSON.parse(JSON.stringify(u)));

// insights + KPI strings exactly as rendered by renderIns
out.insights = {};
UNITS.forEach(u => {
  const body = { innerHTML: '' };
  renderIns(u, body);
  const h = body.innerHTML;
  const items = [...h.matchAll(/<div class="it ([^"]*)"><span class="ic">([^<]*)<\/span><div><h4>([\s\S]*?)<\/h4><p>([\s\S]*?)<\/p><\/div><\/div>/g)]
    .map(m => ({ tone: m[1], icon: m[2], title: unesc(m[3]), text: unesc(m[4]) }));
  const kpis = [...h.matchAll(/<div><small>([^<]*)<\/small><strong class="num">([^<]*)<\/strong><\/div>/g)].map(m => [m[1], unesc(m[2])]);
  const gauge = (h.match(/inset-inline-start:([-\d.e]+)%/) || [])[1];
  const gaugeLabels = [...h.matchAll(/<div class="gl num"><span>([^<]*)<\/span><span>([^<]*)<\/span><span>([^<]*)<\/span>/g)].map(m => [m[1], m[2], m[3]])[0] || null;
  out.insights[u.id] = { items, kpis, gauge: gauge == null ? null : Number(gauge), gaugeLabels };
});

// filter + sort scenarios
const scen = [
  { name: 'default' },
  { name: 'budget-min', min: 1500 },
  { name: 'budget-max', max: 1400 },
  { name: 'budget-range', min: 1200, max: 1800, sort: 'priceA' },
  { name: 'rooms-3', rooms: [3] },
  { name: 'rooms-4-5', rooms: [4, 5], sort: 'area' },
  { name: 'rooms-6', rooms: [6], sort: 'priceD' },
  { name: 'floor-range', fmin: 2, fmax: 5, sort: 'floor' },
  { name: 'floor-neg', fmax: 0 },
  { name: 'building-A1', bld: ['A1'], sort: 'id' },
  { name: 'buildings-multi', bld: ['B4', 'C14', 'D15'], sort: 'delta' },
  { name: 'cat-target', cat: 'target' },
  { name: 'cat-free', cat: 'free', sort: 'id' },
  { name: 'flag-garden', flags: ['garden'] },
  { name: 'flag-pent', flags: ['pent'], sort: 'priceD' },
  { name: 'flag-top', flags: ['top'], sort: 'area' },
  { name: 'flags-combined', flags: ['garden', 'top'] },
  { name: 'storage-ground', sto: ['קרקע'] },
  { name: 'storage-minus', sto: ['-1', '-2'], sort: 'floor' },
  { name: 'combo', min: 1000, max: 2500, rooms: [4, 5], fmin: 1, bld: ['B5', 'B6', 'A7'], cat: 'target', sto: ['-1', 'קרקע'], sort: 'delta' },
  { name: 'sort-ppsqm', sort: 'ppsqm' },
  { name: 'sort-delta', sort: 'delta' },
  { name: 'sort-priceA', sort: 'priceA' },
  { name: 'sort-priceD', sort: 'priceD' },
  { name: 'sort-area', sort: 'area' },
  { name: 'sort-floor', sort: 'floor' },
  { name: 'sort-id', sort: 'id' },
  { name: 'no-match', min: 99999 },
];
out.filterScenarios = scen.map(s => {
  Object.assign(F, { min: s.min || 0, max: s.max || 0, fmin: s.fmin ?? null, fmax: s.fmax ?? null, cat: s.cat || 'all', sort: s.sort || 'ppsqm' });
  F.rooms = new Set(s.rooms || []); F.bld = new Set(s.bld || []); F.flags = new Set(s.flags || []); F.sto = new Set(s.sto || []);
  const ids = filtered().map(u => u.id);
  const counts = {}; UNITS.forEach(u => { if (match(u)) counts[u.b] = (counts[u.b] || 0) + 1; });
  return { ...s, ids, counts };
});

// formatting helpers
const nums = [0, 1, 999.5, 1234.4, 1234.5, -1234.5, 15460.36, 1791623, 12345678.9];
out.format = {
  fmt: nums.map(n => [n, fmt(n)]),
  money: nums.map(n => [n, money(n)]),
  pct: [0, 0.0349, -0.0349, 0.03, -0.03, 0.12345, -0.5, 1e-9, -1e-9].map(x => [x, pct(x)]),
  m2: [0, 5.8, 84.97, 125.89, 125.95, 1234.56, 152.5].map(x => [x, m2(x)]),
  fl: [-2, -1, 0, 1, 12].map(f => [f, fl(f)]),
  r1: [0, 1.04, 1.05, 2.449, 3.95].map(x => [x, r1(x)]),
  dirName: [0, 22, 23, 45, 90, 180, 270, 315, 337, 338, 360, -45, 720].map(a => [a, dirName(a)]),
};

// solar
out.solar = [];
[355, 80, 172].forEach(doy => [5, 6.5, 9, 12, 15.25, 19.5].forEach(h => out.solar.push({ hour: h, doy, ...solar(h, doy) })));
out.sunHours = [];
[0, 45, 90, 135, 180, 225, 270, 315].forEach(az => [355, 80, 172].forEach(doy => out.sunHours.push({ az, doy, h: sunHours(az, doy) })));

// schematic layouts for one apartment of each room count
out.layouts = {};
[3, 4, 4.5, 5, 5.5, 6, 6.5].forEach(r => { const u = UNITS.find(x => x.rooms === r); if (u) out.layouts[u.id] = layoutFor(u); });

// export rows: first six units, mixed priced / unpriced, with notes
const free = UNITS.filter(u => u.price == null).slice(0, 2), priced = UNITS.filter(u => u.price != null).slice(0, 4);
PRIO = [...priced, ...free].map((u, i) => ({ id: u.id, note: i % 2 ? 'הערה "בדיקה", עם פסיק' : '' }));
let aoa = null;
globalThis.XLSX = { utils: { aoa_to_sheet: a => { aoa = a; return {}; }, encode_cell: () => 'A1', book_new: () => ({}), book_append_sheet() {} }, write: () => new ArrayBuffer(0) };
exportXlsx();
out.exportList = PRIO.map(p => ({ ...p }));
out.exportAoa = aoa;
globalThis.__OUT__ = out;
`;

vm.createContext(context);
vm.runInContext(`'use strict';\n${logic}\n${harness}`, context, { filename: 'legacy-template.js' });
const out = context.__OUT__;
out.generatedFrom = 'legacy/template.html + legacy/data.js';

const dest = join(root, 'fixtures/legacy-derived.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log(
  `wrote ${dest}: ${out.units.length} units, ${out.filterScenarios.length} filter scenarios`,
);
