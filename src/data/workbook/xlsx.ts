import type * as XLSXNamespace from 'xlsx';

export type XlsxModule = typeof XLSXNamespace;

/** SheetJS is ~400 kB; load it only when a workbook is imported or exported. */
export const loadXlsx = (): Promise<XlsxModule> => import('xlsx');
