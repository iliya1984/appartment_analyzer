import { buildDataset } from '@/domain/dataset';
import type { Dataset, ProjectMeta, RawRow } from '@/domain/types';

export const testMeta: ProjectMeta = {
  dev: 'יזם בדיקה',
  lottery: 1234,
  base: 15000,
  file: 'test.xlsx',
};

export interface RowInput {
  building?: string;
  plot?: number;
  unit?: number;
  plan?: string;
  sale?: string;
  floor?: number;
  rooms?: number;
  area?: number;
  outdoor?: number;
  storageArea?: number;
  parking?: number;
  target?: 0 | 1;
  price?: number | null;
  storageNo?: string;
  storageFloor?: string;
}

/** A RawRow with sensible defaults (a 4-room regular apartment in A1). */
export function row(r: RowInput = {}): RawRow {
  return [
    r.building ?? 'A1',
    r.plot ?? 211,
    r.unit ?? 1,
    r.plan ?? 'T-T4A',
    r.sale ?? 'A',
    r.floor ?? 1,
    r.rooms ?? 4,
    r.area ?? 100,
    r.outdoor ?? 12,
    r.storageArea ?? 6,
    r.parking ?? 1,
    r.target ?? 1,
    r.price === undefined ? 1_500_000 : r.price,
    r.storageNo ?? '1',
    r.storageFloor ?? '-1',
  ];
}

export const dataset = (rows: RawRow[]): Dataset => buildDataset(rows, testMeta);
