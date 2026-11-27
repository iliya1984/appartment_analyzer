import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';

const HEADER = [
  'מספר/שם מבנה',
  'מגרש',
  'דירה',
  'טיפוס',
  'סוג',
  'קומה',
  'חדרים',
  'שטח',
  'מרפסת',
  'מחסן',
  'חניה',
  'מטרה',
  'מחיר',
  'מס',
  'קומת מחסן',
];

function workbook(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'דירות');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

test('uploads an updated workbook and resets to the built-in data', async ({ page }) => {
  await page.goto('/data');
  await page.getByTestId('workbook-input').setInputFiles({
    name: 'updated.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook([
      HEADER,
      ['A1', 211, 1, 'T-T5A', 'A', 1, 5, 125.89, 29.5, 5.8, 2, 'כן', 1800000, '14', 'קרקע'],
      ['B2', 212, 7, 'T-T4A', 'B', 3, 4, 101, 12, 6, 1, 'לא', 2100000, '3', '-1'],
      ['oops'],
    ]),
  });
  await expect(
    page.getByText('נטענו 2 דירות. דולגו 1 שורות לא תקינות (למשל שורה 4).'),
  ).toBeVisible();
  await expect(page.getByText('הגרלה 2181 · 2 דירות · 2 בניינים · 1 במחיר מטרה')).toBeVisible();
  await page.getByRole('button', { name: 'חזרה לקובץ המובנה' }).click();
  await expect(page.getByText(/406 דירות/).first()).toBeVisible();
});

test('rejects a workbook with the wrong columns', async ({ page }) => {
  await page.goto('/data');
  await page.getByTestId('workbook-input').setInputFiles({
    name: 'wrong.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook([['שם'], ['x']]),
  });
  await expect(page.getByText(/שגיאה: מבנה העמודות לא תואם/)).toBeVisible();
});
