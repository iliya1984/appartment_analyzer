import { kindLabel, categoryLabel } from '@/domain/format';
import type { Dataset } from '@/domain/types';
import { he } from '@/i18n/he';
import type { XlsxModule } from './xlsx';

export type Cell = string | number;

export interface ExportTable {
  head: readonly string[];
  rows: Cell[][];
}

export interface ListEntry {
  id: string;
  note: string;
}

/** Column indexes that get number formats in the xlsx. */
const COL_PRICE = 10;
const COL_DELTA = 12;
const COL_NOTES = 18;

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One row per list entry, in priority order. Entries whose apartment no longer exists are skipped. */
export function buildExportTable(entries: readonly ListEntry[], dataset: Dataset): ExportTable {
  const rows: Cell[][] = [];
  entries.forEach((e) => {
    const a = dataset.byId.get(e.id);
    if (!a) return;
    rows.push([
      rows.length + 1,
      a.building,
      a.number,
      a.floor,
      a.rooms,
      a.area,
      a.outdoor,
      kindLabel(a.kind),
      a.planType,
      a.saleType,
      a.price ?? he.common.notPublished,
      a.pricePerSqm != null ? Math.round(a.pricePerSqm) : '',
      a.comparison ? +a.comparison.delta.toFixed(4) : '',
      categoryLabel(a.category),
      a.storage.no,
      a.storage.floor,
      a.storage.area,
      a.parking,
      e.note,
    ]);
  });
  return { head: he.exportSheet.head, rows };
}

/** UTF-8 CSV with BOM (so Excel detects Hebrew correctly); every cell quoted. */
export function toCsv({ head, rows }: ExportTable): string {
  const quote = (c: Cell) => `"${String(c).replace(/"/g, '""')}"`;
  return '﻿' + [head, ...rows].map((r) => r.map(quote).join(',')).join('\n');
}

/** Right-to-left workbook with column widths and number formats, as in the legacy export. */
export function toXlsxBlob(XLSX: XlsxModule, { head, rows }: ExportTable): Blob {
  const ws = XLSX.utils.aoa_to_sheet([head as Cell[], ...rows]);
  ws['!cols'] = head.map((_, i) => ({ wch: i === COL_NOTES ? 40 : 14 }));
  rows.forEach((_, i) => {
    const delta = ws[XLSX.utils.encode_cell({ r: i + 1, c: COL_DELTA })] as
      { t?: string; z?: string } | undefined;
    if (delta?.t === 'n') delta.z = '0.0%';
    const price = ws[XLSX.utils.encode_cell({ r: i + 1, c: COL_PRICE })] as
      { t?: string; z?: string } | undefined;
    if (price?.t === 'n') price.z = '#,##0';
  });
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, he.exportSheet.sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([buf], { type: XLSX_MIME });
}

export interface ExportedFile {
  name: string;
  blob: Blob;
}

/**
 * Builds the export file: xlsx when SheetJS loads, otherwise a CSV fallback.
 * Returns null for an empty list.
 */
export async function exportMyList(
  entries: readonly ListEntry[],
  dataset: Dataset,
  loadXlsx: () => Promise<XlsxModule>,
): Promise<ExportedFile | null> {
  const table = buildExportTable(entries, dataset);
  if (!table.rows.length) return null;
  try {
    const XLSX = await loadXlsx();
    return { name: `${he.exportSheet.fileBase}.xlsx`, blob: toXlsxBlob(XLSX, table) };
  } catch {
    return {
      name: `${he.exportSheet.fileBase}.csv`,
      blob: new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }),
    };
  }
}
