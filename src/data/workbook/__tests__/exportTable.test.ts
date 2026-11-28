import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  buildTable,
  type ExportColumn,
  exportWorkbook,
  toWorkbookBlob,
  XLSX_MIME,
} from '@/data/workbook/exportTable';

interface Item {
  name: string;
  price: number | null;
  share: number;
}

const columns: ExportColumn<Item>[] = [
  { head: '#', value: (_, i) => i + 1, width: 5 },
  { head: 'name', value: (r) => r.name },
  { head: 'price', value: (r) => r.price ?? 'n/a', format: '#,##0' },
  { head: 'share', value: (r) => r.share, format: '0.0%' },
];
const items: Item[] = [
  { name: 'a', price: 1_000_000, share: 0.1 },
  { name: 'b', price: null, share: -0.05 },
];

const read = async (blob: Blob) =>
  XLSX.read(await blob.arrayBuffer(), { type: 'array', cellNF: true, cellStyles: true });

describe('buildTable', () => {
  it('maps columns over rows, with the row index', () => {
    const t = buildTable(columns, items, { autofilter: true });
    expect(t.head).toEqual(['#', 'name', 'price', 'share']);
    expect(t.rows).toEqual([
      [1, 'a', 1_000_000, 0.1],
      [2, 'b', 'n/a', -0.05],
    ]);
    expect(t.widths).toEqual([5, undefined, undefined, undefined]);
    expect(t.formats).toEqual([undefined, undefined, '#,##0', '0.0%']);
    expect(t.autofilter).toBe(true);
  });
});

describe('toWorkbookBlob', () => {
  it('writes several RTL sheets with widths, formats on numeric cells, and an autofilter', async () => {
    const wb = await read(
      toWorkbookBlob(XLSX, [
        { name: 'one', table: buildTable(columns, items, { autofilter: true }) },
        { name: 'two', table: { head: ['k', 'v'], rows: [['x', 1]] } },
      ]),
    );
    expect(wb.SheetNames).toEqual(['one', 'two']);
    expect(wb.Workbook?.Views?.[0]?.RTL).toBe(true);
    const ws = wb.Sheets.one!;
    expect(ws['!cols']?.map((c) => c.wch)).toEqual([5, 14, 14, 14]);
    expect(ws.C2?.z).toBe('#,##0');
    expect(ws.C3?.v).toBe('n/a');
    expect(ws.D3?.z).toBe('0.0%');
    expect(ws['!autofilter']?.ref).toBe('A1:D3');
    expect(wb.Sheets.two!['!autofilter']).toBeUndefined();
  });
});

describe('exportWorkbook', () => {
  const sheets = [{ name: 'one', table: buildTable(columns, items) }];

  it('names the xlsx after the file base', async () => {
    const f = await exportWorkbook(sheets, 'out', () => Promise.resolve(XLSX));
    expect(f.name).toBe('out.xlsx');
    expect(f.blob.type).toBe(XLSX_MIME);
  });

  it('falls back to a CSV of the first sheet', async () => {
    const f = await exportWorkbook(sheets, 'out', () => Promise.reject(new Error('offline')));
    expect(f.name).toBe('out.csv');
    expect(f.blob.type).toBe('text/csv;charset=utf-8');
    // Blob.text() decodes UTF-8 and drops the BOM; the BOM itself is covered by the toCsv test.
    expect(await f.blob.text()).toBe(
      '"#","name","price","share"\n"1","a","1000000","0.1"\n"2","b","n/a","-0.05"',
    );
  });
});
