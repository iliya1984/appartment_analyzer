import type { Apartment, Dataset } from '@/domain/types';
import { he } from '@/i18n/he';
import { apartmentColumns } from './exportColumns';
import {
  buildTable,
  type ExportColumn,
  type ExportedFile,
  type ExportTable,
  exportWorkbook,
  toWorkbookBlob,
} from './exportTable';
import type { XlsxModule } from './xlsx';

export { toCsv, XLSX_MIME, type Cell, type ExportedFile, type ExportTable } from './exportTable';

export interface ListEntry {
  id: string;
  note: string;
}

interface ListRow {
  apartment: Apartment;
  note: string;
}

const COLUMNS: readonly ExportColumn<ListRow>[] = [
  { head: he.exportSheet.priority, value: (_, i) => i + 1 },
  ...apartmentColumns<ListRow>((r) => r.apartment),
  { head: he.exportSheet.notes, value: (r) => r.note, width: 40 },
];

/** One row per list entry, in priority order. Entries whose apartment no longer exists are skipped. */
export function buildExportTable(entries: readonly ListEntry[], dataset: Dataset): ExportTable {
  const rows: ListRow[] = [];
  for (const e of entries) {
    const apartment = dataset.byId.get(e.id);
    if (apartment) rows.push({ apartment, note: e.note });
  }
  return buildTable(COLUMNS, rows);
}

/** Right-to-left workbook with column widths and number formats, as in the legacy export. */
export function toXlsxBlob(XLSX: XlsxModule, table: ExportTable): Blob {
  return toWorkbookBlob(XLSX, [{ name: he.exportSheet.sheetName, table }]);
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
  return exportWorkbook(
    [{ name: he.exportSheet.sheetName, table }],
    he.exportSheet.fileBase,
    loadXlsx,
  );
}
