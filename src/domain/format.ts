import { he } from '@/i18n/he';
import type { Apartment, PriceCategory } from './types';

const LRI = '⁦'; // left-to-right isolate: keeps "+3.5%" readable inside RTL text
const PDI = '⁩';
const LRM = '‎';
const MINUS = '−';

/** Rounded integer with Hebrew thousands separators: 1791623 → "1,791,623". */
export const fmt = (n: number): string => Math.round(n).toLocaleString('he-IL');

/** "1,791,623 ₪" */
export const money = (n: number): string => `${fmt(n)} ₪`;

/** Signed percentage wrapped in an LTR isolate: 0.0349 → "⁦+3.5%⁩", -0.03 → "⁦−3.0%⁩". */
export const pct = (x: number): string =>
  `${LRI}${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(1)}%${PDI}`;

/** Area with at most one decimal: 125.89 → "125.9". */
export const m2 = (x: number): string =>
  (Math.round(x * 10) / 10).toLocaleString('he-IL', { maximumFractionDigits: 1 });

/** One decimal, always shown: 2.449 → "2.4". */
export const r1 = (x: number): string => (Math.round(x * 10) / 10).toFixed(1);

/** Positive modulo. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Floor number for display: 0 → "קרקע", -1 → "‎−1", 3 → "3". */
export const floorLabel = (f: number): string =>
  f === 0 ? he.common.ground : f < 0 ? `${LRM}${MINUS}${-f}` : String(f);

/** "קרקע" or "קומה 3". */
export const floorName = (f: number): string =>
  f === 0 ? he.common.ground : `${he.common.floor} ${floorLabel(f)}`;

export const categoryLabel = (c: PriceCategory): string =>
  c === 'target' ? he.common.target : he.common.free;

export const kindLabel = (k: Apartment['kind']): string => he.kind[k];

/** Card tag for the outdoor area: garden / roof terrace / balcony. */
export const outdoorLabel = (a: Pick<Apartment, 'kind' | 'outdoor'>): string =>
  a.kind === 'G'
    ? he.card.garden(m2(a.outdoor))
    : a.kind === 'P'
      ? he.card.roofTerrace(m2(a.outdoor))
      : he.card.balcony(m2(a.outdoor));

/** Storage level as a floor label, e.g. "-1" → "‎−1". */
export const storageLevelLabel = (floor: string): string => floorLabel(parseInt(floor, 10));
