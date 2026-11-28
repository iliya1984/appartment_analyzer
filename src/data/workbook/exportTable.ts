import type { XlsxModule } from './xlsx';

export type Cell = string | number;
export type NumberFormat = '#,##0' | '0.0%';

/** One output column: header text, cell value, and optional width / number format. */
export interface ExportColumn<R> {
  head: string;
  value: (row: R, index: number) => Cell;
  /** Column width in characters (default 14). */
  width?: number;
  /** Applied to numeric cells only. */
  format?: NumberFormat;
}

export interface ExportTable {
  head: readonly string[];
  rows: Cell[][];
  /** Per-column widths in characters; missing → 14. */
  widths?: readonly (number | undefined)[];
  /** Per-column number formats for numeric cells. */
  formats?: readonly (NumberFormat | undefined)[];
  /** Adds an Excel autofilter over the header and all rows. */
  autofilter?: boolean;
}

export interface ExportSheet {
  name: string;
  table: ExportTable;
}

export interface ExportedFile {
  name: string;
  blob: Blob;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const DEFAULT_WIDTH = 14;

export function buildTable<R>(
  columns: readonly ExportColumn<R>[],
  rows: readonly R[],
  options: { autofilter?: boolean } = {},
): ExportTable {
  return {
    head: columns.map((c) => c.head),
    rows: rows.map((r, i) => columns.map((c) => c.value(r, i))),
    widths: columns.map((c) => c.width),
    formats: columns.map((c) => c.format),
    autofilter: options.autofilter ?? false,
  };
}

/** UTF-8 CSV with BOM (so Excel detects Hebrew correctly); every cell quoted. */
export function toCsv({ head, rows }: ExportTable): string {
  const quote = (c: Cell) => `"${String(c).replace(/"/g, '""')}"`;
  return '﻿' + [head, ...rows].map((r) => r.map(quote).join(',')).join('\n');
}

type CellObject = { t?: string; z?: string } | undefined;

function toWorksheet(XLSX: XlsxModule, table: ExportTable) {
  const { head, rows, widths = [], formats = [] } = table;
  const ws = XLSX.utils.aoa_to_sheet([head as Cell[], ...rows]);
  ws['!cols'] = head.map((_, i) => ({ wch: widths[i] ?? DEFAULT_WIDTH }));
  formats.forEach((z, c) => {
    if (!z) return;
    rows.forEach((_, r) => {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })] as CellObject;
      if (cell?.t === 'n') cell.z = z;
    });
  });
  if (table.autofilter && head.length) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: head.length - 1 },
      }),
    };
  }
  return ws;
}

/** Right-to-left workbook with one worksheet per sheet. */
export function toWorkbookBlob(XLSX: XlsxModule, sheets: readonly ExportSheet[]): Blob {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, toWorksheet(XLSX, s.table), s.name);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([buf], { type: XLSX_MIME });
}

/**
 * xlsx when SheetJS loads, otherwise a CSV of the first sheet.
 * `fileBase` gets the matching extension.
 */
export async function exportWorkbook(
  sheets: readonly ExportSheet[],
  fileBase: string,
  loadXlsx: () => Promise<XlsxModule>,
): Promise<ExportedFile> {
  try {
    const XLSX = await loadXlsx();
    return { name: `${fileBase}.xlsx`, blob: toWorkbookBlob(XLSX, sheets) };
  } catch {
    const first = sheets[0];
    return {
      name: `${fileBase}.csv`,
      blob: new Blob([first ? toCsv(first.table) : ''], { type: 'text/csv;charset=utf-8' }),
    };
  }
}
