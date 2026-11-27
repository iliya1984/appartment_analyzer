// Bundle budget (migration plan R3): initial JS ≤ 200 kB gzip. Lazy chunks (three, xlsx) are
// reported but not counted. Run after `npm run build`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200;
const dist = join(import.meta.dirname, '..', 'dist');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

// Initial JS = entry scripts + modulepreload links referenced by index.html.
const initial = [...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const kb = (file) => gzipSync(readFileSync(join(dist, file))).length / 1024;

let total = 0;
for (const f of new Set(initial)) {
  const size = kb(f);
  total += size;
  console.log(`initial  ${f.padEnd(40)} ${size.toFixed(1)} kB gzip`);
}
console.log(`total initial JS: ${total.toFixed(1)} kB gzip (budget ${BUDGET_KB} kB)`);
if (total > BUDGET_KB) {
  console.error('Bundle budget exceeded.');
  process.exit(1);
}
