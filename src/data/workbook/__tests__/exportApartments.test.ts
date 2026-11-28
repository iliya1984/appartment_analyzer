import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  buildResultsTable,
  buildSummaryTable,
  exportApartments,
  isoDate,
} from '@/data/workbook/exportApartments';
import { applyFilters, DEFAULT_FILTERS, type Filters } from '@/domain/filters';
import { dataset, row } from '@/test/factories';

const d = dataset([
  row({ building: 'A1', unit: 1, rooms: 5, floor: 1, plan: 'T-T5A', price: 1_800_000 }),
  row({ building: 'A1', unit: 2, rooms: 3, floor: 2, plan: 'T-T3B', price: null, target: 0 }),
  row({ building: 'B2', unit: 3, rooms: 5, floor: 8, plan: 'T-T5A', price: 2_000_000 }),
]);
const filters: Filters = {
  ...DEFAULT_FILTERS,
  typeQuery: ['T5A'],
  sort: [
    { field: 'rooms', dir: 'asc' },
    { field: 'floor', dir: 'desc' },
  ],
};
const list = applyFilters(d, filters);
const now = new Date(2026, 10, 28, 12, 0);

describe('buildResultsTable', () => {
  it('keeps the display order, numbers rows and marks list entries', () => {
    const t = buildResultsTable(list, new Set(['A1-1']));
    expect(t.head[0]).toBe('#');
    expect(t.head.at(-1)).toBe('ברשימה שלי');
    expect(t.head).toHaveLength(19);
    expect(t.rows.map((r) => [r[0], r[1], r[2], r.at(-1)])).toEqual([
      [1, 'B2', 3, ''],
      [2, 'A1', 1, '✓'],
    ]);
    expect(t.autofilter).toBe(true);
  });

  it('writes "not published" for missing prices', () => {
    const t = buildResultsTable(applyFilters(d, DEFAULT_FILTERS), new Set());
    expect(t.rows.at(-1)?.[10]).toBe('לא פורסם');
  });
});

describe('buildSummaryTable', () => {
  it('records the date, row count, filters and sort', () => {
    expect(buildSummaryTable(filters, 2, now).rows).toEqual([
      ['תאריך ייצוא', '2026-11-28'],
      ['מספר דירות', 2],
      ['חיפוש טיפוס', 'T5A'],
      ['מיון', 'חדרים (מהמעט להרבה), ואז קומה (מהגבוהה לנמוכה)'],
    ]);
  });
});

describe('isoDate', () => {
  it('pads month and day', () => {
    expect(isoDate(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('exportApartments', () => {
  const input = { list, filters, myListIds: new Set<string>(), now };

  it('returns null when nothing matches', async () => {
    expect(await exportApartments({ ...input, list: [] }, () => Promise.resolve(XLSX))).toBeNull();
  });

  it('writes the results and summary sheets', async () => {
    const f = await exportApartments(input, () => Promise.resolve(XLSX));
    expect(f?.name).toBe('almogim-apartments-2026-11-28.xlsx');
    const wb = XLSX.read(await f!.blob.arrayBuffer(), { type: 'array', cellNF: true });
    expect(wb.SheetNames).toEqual(['דירות', 'סינון']);
    expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);
    const ws = wb.Sheets['דירות']!;
    expect(ws.B2?.v).toBe('B2');
    expect(ws.B3?.v).toBe('A1');
    expect(ws.K2?.z).toBe('#,##0');
    expect(ws['!autofilter']?.ref).toBe('A1:S3');
    expect(wb.Sheets['סינון']!.B2?.v).toBe('2026-11-28');
  });

  it('falls back to CSV when SheetJS cannot be loaded', async () => {
    const f = await exportApartments(input, () => Promise.reject(new Error('offline')));
    expect(f?.name).toBe('almogim-apartments-2026-11-28.csv');
    expect(await f?.blob.text()).toContain('"ברשימה שלי"');
  });
});
