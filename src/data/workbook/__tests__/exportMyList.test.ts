import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  buildExportTable,
  exportMyList,
  toCsv,
  toXlsxBlob,
  XLSX_MIME,
} from '@/data/workbook/exportMyList';
import { dataset, row } from '@/test/factories';

const d = dataset([
  row({ building: 'A1', unit: 1, price: 1_200_000, area: 100 }),
  row({ building: 'A1', unit: 2, price: null, target: 0 }),
]);
const entries = [
  { id: 'A1-2', note: 'שאלה "חשובה", עם פסיק' },
  { id: 'gone-1', note: '' },
  { id: 'A1-1', note: '' },
];

describe('buildExportTable', () => {
  it('numbers rows by priority and skips apartments that no longer exist', () => {
    const t = buildExportTable(entries, d);
    expect(t.head).toHaveLength(19);
    expect(t.rows.map((r) => [r[0], r[1], r[2]])).toEqual([
      [1, 'A1', 2],
      [2, 'A1', 1],
    ]);
    expect(t.rows[0]?.[10]).toBe('לא פורסם');
    expect(t.rows[0]?.[11]).toBe('');
    expect(t.rows[1]?.[11]).toBe(12000);
  });
});

describe('toCsv', () => {
  it('quotes every cell, escapes quotes and starts with a BOM', () => {
    const csv = toCsv({ head: ['a', 'b'], rows: [[1, 'x "y", z']] });
    expect(csv).toBe('﻿"a","b"\n"1","x ""y"", z"');
  });
});

describe('toXlsxBlob', () => {
  it('writes an RTL workbook with column widths and number formats', async () => {
    const blob = toXlsxBlob(XLSX, buildExportTable(entries, d));
    expect(blob.type).toBe(XLSX_MIME);
    const wb = XLSX.read(await blob.arrayBuffer(), {
      type: 'array',
      cellNF: true,
      cellStyles: true,
    });
    expect(wb.SheetNames).toEqual(['הרשימה שלי']);
    expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);
    const ws = wb.Sheets['הרשימה שלי']!;
    expect(ws['!cols']?.map((c) => c.wch)).toEqual([...Array(18).fill(14), 40]);
    expect(ws.K3?.z).toBe('#,##0'); // price of the 2nd row
    expect(ws.M3?.z).toBe('0.0%'); // delta
    expect(ws.K2?.v).toBe('לא פורסם');
    expect(ws.S2?.v).toBe('שאלה "חשובה", עם פסיק');
  });
});

describe('exportMyList', () => {
  it('returns null for an empty list', async () => {
    expect(await exportMyList([], d, () => Promise.resolve(XLSX))).toBeNull();
  });

  it('exports xlsx when SheetJS loads', async () => {
    const f = await exportMyList(entries, d, () => Promise.resolve(XLSX));
    expect(f?.name).toBe('almogim-priorities.xlsx');
  });

  it('falls back to CSV when SheetJS cannot be loaded', async () => {
    const f = await exportMyList(entries, d, () => Promise.reject(new Error('offline')));
    expect(f?.name).toBe('almogim-priorities.csv');
    expect(f?.blob.type).toBe('text/csv;charset=utf-8');
    expect(await f?.blob.text()).toContain('"עדיפות"');
  });
});
