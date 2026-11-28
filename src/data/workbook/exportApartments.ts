import type { Filters } from '@/domain/filters';
import { describeFilters } from '@/domain/filterSummary';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { apartmentColumns } from './exportColumns';
import {
  buildTable,
  type ExportColumn,
  type ExportedFile,
  type ExportSheet,
  type ExportTable,
  exportWorkbook,
} from './exportTable';
import type { XlsxModule } from './xlsx';

const R = he.resultsSheet;

/** `YYYY-MM-DD` in local time. */
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Results sheet: row number, the shared apartment columns, and an "in my list" mark. */
export function buildResultsTable(
  list: readonly Apartment[],
  myListIds: ReadonlySet<string>,
): ExportTable {
  const columns: ExportColumn<Apartment>[] = [
    { head: R.rowNo, value: (_, i) => i + 1, width: 6 },
    ...apartmentColumns<Apartment>((a) => a),
    { head: R.inMyList, value: (a) => (myListIds.has(a.id) ? '✓' : ''), width: 12 },
  ];
  return buildTable(columns, list, { autofilter: true });
}

/** Summary sheet: when the file was made, from which filters and sort, and how many rows. */
export function buildSummaryTable(filters: Filters, rowCount: number, now: Date): ExportTable {
  return {
    head: R.summaryHead,
    rows: [[R.exportedAt, isoDate(now)], [R.rowCount, rowCount], ...describeFilters(filters)],
    widths: [24, 60],
  };
}

export interface ExportApartmentsInput {
  /** Matching apartments, already in display order. */
  list: readonly Apartment[];
  filters: Filters;
  myListIds: ReadonlySet<string>;
  now?: Date;
}

/**
 * The current results as `almogim-apartments-YYYY-MM-DD.xlsx` (sheets "דירות" and "סינון"),
 * or a CSV of the results when SheetJS cannot load. Returns null when nothing matches.
 */
export async function exportApartments(
  { list, filters, myListIds, now = new Date() }: ExportApartmentsInput,
  loadXlsx: () => Promise<XlsxModule>,
): Promise<ExportedFile | null> {
  if (!list.length) return null;
  const sheets: ExportSheet[] = [
    { name: R.sheetName, table: buildResultsTable(list, myListIds) },
    { name: R.summarySheetName, table: buildSummaryTable(filters, list.length, now) },
  ];
  return exportWorkbook(sheets, `${R.fileBase}-${isoDate(now)}`, loadXlsx);
}
