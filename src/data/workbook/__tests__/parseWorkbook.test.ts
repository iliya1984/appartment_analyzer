import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  coerceRow,
  parseWorkbook,
  rowsFromMatrix,
  WorkbookError,
} from '@/data/workbook/parseWorkbook';

const HEADER = [
  'מספר/שם מבנה',
  'מגרש',
  'מספר דירה',
  'טיפוס',
  'סוג מכר',
  'קומה',
  'חדרים',
  'שטח',
  'מרפסת',
  'מחסן',
  'חניות',
  'מחיר מטרה',
  'מחיר',
  'מס מחסן',
  'קומת מחסן',
];
const GOOD = [
  'A1',
  211,
  1,
  'T-T5A',
  'A',
  1,
  5,
  125.89,
  29.5,
  5.8,
  2,
  'כן',
  1791623,
  '14',
  'קרקע עליון',
];

function workbook(rows: unknown[][], sheetName = 'דירות'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

describe('coerceRow', () => {
  it('converts a well-formed row', () => {
    expect(coerceRow(GOOD)).toEqual(GOOD.map((v) => (v === 'כן' ? 1 : v)));
  });

  it('parses formatted numbers and defaults optional fields', () => {
    const r = coerceRow([
      'B2 ',
      '212',
      '3',
      'T-G4A',
      'B',
      '0',
      '4',
      '100.5',
      '',
      null,
      'x',
      'לא',
      '1,500,000 ₪',
      7,
      null,
    ]);
    expect(r).toEqual(['B2', 212, 3, 'T-G4A', 'B', 0, 4, 100.5, 0, 0, 0, 0, 1500000, '7', 'קרקע']);
  });

  it('treats an empty or invalid price as "not published"', () => {
    expect(coerceRow([...GOOD.slice(0, 12), '', '14', '-1'])?.[12]).toBeNull();
    expect(coerceRow([...GOOD.slice(0, 12), 'טרם', '14', '-1'])?.[12]).toBeNull();
  });

  it('rejects rows with missing required fields', () => {
    expect(coerceRow(['A1', 'x', ...GOOD.slice(2)])).toBeNull(); // plot
    expect(coerceRow([...GOOD.slice(0, 3), 'T5', ...GOOD.slice(4)])).toBeNull(); // plan too short
    expect(coerceRow([...GOOD.slice(0, 7), 0, ...GOOD.slice(8)])).toBeNull(); // area 0
  });
});

describe('rowsFromMatrix', () => {
  it('rejects an unexpected header', () => {
    expect(() => rowsFromMatrix([['שם', 'x']])).toThrow(WorkbookError);
    expect(() => rowsFromMatrix([])).toThrow(/מבנה העמודות/);
  });

  it('skips blank lines and reports bad rows by spreadsheet row number', () => {
    const r = rowsFromMatrix([HEADER, GOOD, [null], ['A1', 'bad'], GOOD]);
    expect(r.rows).toHaveLength(2);
    expect(r.badRows).toEqual([4]);
  });

  it('fails when no row is valid', () => {
    expect(() => rowsFromMatrix([HEADER, ['A1', 'bad']])).toThrow(/לא נמצאו שורות תקינות/);
  });
});

describe('parseWorkbook', () => {
  it('reads the "דירות" sheet of a real xlsx', () => {
    const r = parseWorkbook(
      XLSX,
      workbook([
        HEADER,
        GOOD,
        ['B2', 212, 4, 'T-T4A', 'B', 2, 4, 100, 10, 5, 1, 'לא', null, '3', '-2'],
      ]),
    );
    expect(r.badRows).toEqual([]);
    expect(r.rows.map((x) => x[0])).toEqual(['A1', 'B2']);
    expect(r.rows[1]?.[12]).toBeNull();
  });

  it('falls back to the first sheet', () => {
    expect(parseWorkbook(XLSX, workbook([HEADER, GOOD], 'Sheet1')).rows).toHaveLength(1);
  });

  it('reports unreadable files as WorkbookError', () => {
    const fakeXlsx = {
      ...XLSX,
      read: () => {
        throw new Error('corrupt');
      },
    } as typeof XLSX;
    expect(() => parseWorkbook(fakeXlsx, new ArrayBuffer(8))).toThrow('לא ניתן לקרוא את הקובץ.');
  });
});
