import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { useDatasetStore } from '@/store/datasetStore';
import { renderApp } from '@/test/renderApp';

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

function xlsxFile(rows: unknown[][], name = 'prices-v2.xlsx'): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'דירות');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const file = new File([buf], name);
  // jsdom's File lacks arrayBuffer() in some versions.
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(buf) });
  return file;
}

const upload = (file: File) =>
  fireEvent.change(screen.getByTestId('workbook-input'), { target: { files: [file] } });

describe('project data page', () => {
  it('shows the built-in source and the per-building summary', () => {
    renderApp('/data');
    expect(screen.getByText(/קובץ מובנה: Almogim_Prices_rev1_1.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/מחיר בסיס למ״ר כולל מע״מ, ללא הנחה: 15,460 ₪/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(16); // header + 15 buildings
  });

  it('loads an uploaded workbook, reports skipped rows, then resets to the built-in data', async () => {
    const { user } = renderApp('/data');
    upload(
      xlsxFile([
        HEADER,
        ['A1', 211, 1, 'T-T5A', 'A', 1, 5, 125.89, 29.5, 5.8, 2, 'כן', 1800000, '14', 'קרקע'],
        ['A1', 211, 2, 'T-T3C', 'C', 1, 3, 84.97, 23.46, 8.64, 2, 'לא', null, '15', '-2'],
        ['A1', 'bad'],
      ]),
    );
    expect(
      await screen.findByText('נטענו 2 דירות. דולגו 1 שורות לא תקינות (למשל שורה 4).'),
    ).toBeInTheDocument();
    expect(screen.getByText('נטען קובץ: prices-v2.xlsx. 2 דירות.')).toBeInTheDocument();
    expect(useDatasetStore.getState().dataset.apartments).toHaveLength(2);
    expect(screen.getByText(/הגרלה 2181 · 2 דירות · 1 בניינים/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'חזרה לקובץ המובנה' }));
    expect(useDatasetStore.getState().dataset.apartments).toHaveLength(406);
    expect(screen.getByText(/קובץ מובנה/)).toBeInTheDocument();
  });

  it('reports a workbook with the wrong columns', async () => {
    renderApp('/data');
    upload(xlsxFile([['שם', 'עמודה']]));
    expect(await screen.findByText(/שגיאה: מבנה העמודות לא תואם/)).toBeInTheDocument();
    expect(useDatasetStore.getState().dataset.apartments).toHaveLength(406);
  });

  it('reports an unreadable file', async () => {
    renderApp('/data');
    const file = new File(['x'], 'broken.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(new Error('io')) });
    upload(file);
    await waitFor(() =>
      expect(screen.getByText('שגיאה: לא ניתן לקרוא את הקובץ.')).toBeInTheDocument(),
    );
  });

  it('the upload button opens the file picker', async () => {
    const { user } = renderApp('/data');
    const input = screen.getByTestId<HTMLInputElement>('workbook-input');
    let clicked = false;
    input.addEventListener('click', () => (clicked = true));
    await user.click(screen.getByRole('button', { name: 'טעינת קובץ מחירים מעודכן' }));
    expect(clicked).toBe(true);
  });
});
