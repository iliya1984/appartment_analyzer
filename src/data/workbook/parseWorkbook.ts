import { z } from 'zod';
import type { RawRow } from '@/domain/types';
import { he } from '@/i18n/he';
import type { XlsxModule } from './xlsx';

/** The sheet with one row per apartment. */
export const APARTMENTS_SHEET = 'דירות';

export class WorkbookError extends Error {
  override name = 'WorkbookError';
}

export interface ParsedWorkbook {
  rows: RawRow[];
  /** 1-based spreadsheet row numbers that were skipped as invalid. */
  badRows: number[];
}

/** Zod 4 numbers already reject NaN and ±Infinity. */
const finite = z.number();

/** Final shape check for a coerced row. */
export const rawRowSchema = z.tuple([
  z.string().min(1),
  finite,
  finite,
  z.string().min(3),
  z.string(),
  finite,
  finite.positive(),
  finite.positive(),
  finite,
  finite,
  finite,
  z.union([z.literal(0), z.literal(1)]),
  finite.nullable(),
  z.string(),
  z.string(),
]);

/** "1,234 ₪" → 1234; anything unparsable → NaN. */
const num = (v: unknown): number => {
  const x = parseFloat(String(v).replace(/[,₪\s]/g, ''));
  return Number.isNaN(x) ? NaN : x;
};
const zeroIfNaN = (x: number): number => (Number.isNaN(x) ? 0 : x);
const str = (v: unknown): string =>
  (typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : ''
  ).trim();

/**
 * Coerces one spreadsheet row (array of cell values) to a RawRow, or returns null when a
 * required field (plot, unit, floor, rooms, area, plan type) is missing or invalid.
 * Optional numeric fields (outdoor, storage area, parking) default to 0; a missing or invalid
 * price means "not published" (null).
 */
export function coerceRow(cells: readonly unknown[]): RawRow | null {
  const [b, plot, n, tp, ts, f, rooms, area, outd, sa, park, tgt, price, sno, sfl] = cells;
  const priceNum = price == null || price === '' ? null : Math.round(num(price));
  const candidate = [
    str(b),
    num(plot),
    num(n),
    str(tp),
    str(ts),
    num(f),
    num(rooms),
    num(area),
    zeroIfNaN(num(outd)),
    zeroIfNaN(num(sa)),
    zeroIfNaN(num(park)),
    str(tgt) === 'כן' ? 1 : 0,
    priceNum == null || Number.isNaN(priceNum) ? null : priceNum,
    str(sno),
    sfl == null ? 'קרקע' : str(sfl),
  ];
  const parsed = rawRowSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Validates the header row and converts the data rows of the apartments sheet. */
export function rowsFromMatrix(matrix: readonly (readonly unknown[])[]): ParsedWorkbook {
  const header = matrix[0];
  if (!header || header.length < 13 || !str(header[0]).includes('מבנה')) {
    throw new WorkbookError(he.workbook.badHeader);
  }
  const rows: RawRow[] = [];
  const badRows: number[] = [];
  matrix.slice(1).forEach((cells, i) => {
    if (cells[0] == null || cells[0] === '') return; // blank line
    const row = coerceRow(cells);
    if (row) rows.push(row);
    else badRows.push(i + 2);
  });
  if (!rows.length) throw new WorkbookError(he.workbook.noRows);
  return { rows, badRows };
}

/** Reads an uploaded price workbook (.xlsx / .xls). Throws WorkbookError on bad input. */
export function parseWorkbook(XLSX: XlsxModule, data: ArrayBuffer): ParsedWorkbook {
  let matrix: unknown[][];
  try {
    const wb = XLSX.read(data, { type: 'array' });
    const name = wb.SheetNames.includes(APARTMENTS_SHEET) ? APARTMENTS_SHEET : wb.SheetNames[0];
    const ws = name != null ? wb.Sheets[name] : undefined;
    if (!ws) throw new WorkbookError(he.workbook.badHeader);
    matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  } catch (e) {
    if (e instanceof WorkbookError) throw e;
    throw new WorkbookError(he.workbook.unreadable);
  }
  return rowsFromMatrix(matrix);
}
