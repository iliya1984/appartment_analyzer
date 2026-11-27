import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Shape of fixtures/legacy-derived.json (see scripts/generate-legacy-fixtures.mjs). */
export interface LegacyUnit {
  id: string;
  b: string;
  plot: number;
  n: number;
  typ: string;
  sale: string;
  f: number;
  rooms: number;
  area: number;
  outdoor: number;
  kind: string;
  park: number;
  cat: string;
  price: number | null;
  storage: { no: string; area: number; floor: string; sub: string };
  ppsqm: number | null;
  rk: number;
  top: boolean;
  bottom: boolean;
  gKey?: string;
  gLabel?: string;
  gMean?: number;
  delta?: number;
  gRank?: number;
  gN?: number;
  gMin?: number;
  gMax?: number;
  gOut?: number;
}

export interface LegacyFixture {
  buildings: string[];
  buildingStats: {
    id: string;
    n: number;
    plot: number;
    fmin: number;
    fmax: number;
    tgt: number;
    avgArea: number;
    pmin: number | null;
    pmax: number | null;
    avgSto: number;
  }[];
  units: LegacyUnit[];
  insights: Record<
    string,
    {
      items: { tone: string; icon: string; title: string; text: string }[];
      kpis: [string, string][];
      gauge: number | null;
      gaugeLabels: [string, string, string] | null;
    }
  >;
  filterScenarios: {
    name: string;
    min?: number;
    max?: number;
    rooms?: number[];
    fmin?: number;
    fmax?: number;
    bld?: string[];
    cat?: string;
    flags?: string[];
    sto?: string[];
    sort?: string;
    ids: string[];
    counts: Record<string, number>;
  }[];
  format: Record<'fmt' | 'money' | 'pct' | 'm2' | 'fl' | 'r1' | 'dirName', [number, string][]>;
  solar: { hour: number; doy: number; el: number; az: number }[];
  sunHours: { az: number; doy: number; h: number }[];
  layouts: Record<string, unknown>;
  exportList: { id: string; note: string }[];
  exportAoa: (string | number)[][];
}

let cached: LegacyFixture | undefined;

export function legacyFixture(): LegacyFixture {
  cached ??= JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures/legacy-derived.json'), 'utf8'),
  ) as LegacyFixture;
  return cached;
}
