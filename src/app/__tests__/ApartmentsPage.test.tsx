import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { applyFilters } from '@/domain/filters';
import { sortApartments } from '@/domain/sort';
import * as download from '@/shared/lib/download';
import { useFiltersStore } from '@/store/filtersStore';
import { useMyListStore } from '@/store/myListStore';
import { useUiStore } from '@/store/uiStore';
import { currentLocation, renderApp } from '@/test/renderApp';

const listHeading = () => screen.getByRole('heading', { level: 2, name: /^דירות/ });
const cards = () => screen.getAllByRole('article');

describe('apartments view', () => {
  it('lists 40 cards first, then 40 more per click', async () => {
    const { user } = renderApp();
    expect(listHeading()).toHaveTextContent('(406)');
    expect(cards()).toHaveLength(40);
    await user.click(screen.getByRole('button', { name: 'הצג עוד (366)' }));
    expect(cards()).toHaveLength(80);
  });

  it('filters by rooms and category, with live counts, and resets', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(listHeading()).toHaveTextContent('(101)');
    expect(screen.getByText('101 מתוך 406 דירות תואמות')).toBeInTheDocument();
    expect(screen.getAllByText('101 דירות תואמות')[0]).toBeInTheDocument();

    const category = screen.getByRole('radiogroup', { name: 'סוג' });
    await user.click(within(category).getByRole('radio', { name: 'שוק חופשי' }));
    expect(useFiltersStore.getState().filters.category).toBe('free');

    await user.click(screen.getByRole('button', { name: 'ניקוי סינון' }));
    expect(listHeading()).toHaveTextContent('(406)');
  });

  it('filters by budget and shows the empty state when nothing matches', async () => {
    const { user } = renderApp();
    await user.type(screen.getByRole('spinbutton', { name: 'תקציב מינימלי באלפי שקלים' }), '99999');
    expect(screen.getByText(/אין דירות שמתאימות לסינון/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /הצג עוד/ })).not.toBeInTheDocument();
  });

  it('changes the sort order', async () => {
    const { user } = renderApp();
    await user.selectOptions(screen.getByRole('combobox', { name: 'מיון מהיר' }), 'id');
    expect(within(cards()[0]!).getByRole('link', { name: /^בניין/ })).toHaveTextContent(
      'בניין A1 · דירה 1 · קומה 1',
    );
  });

  it('selects a building on the map, shows its floors, and toggles it off again', async () => {
    const { user } = renderApp();
    const hotspot = screen.getByRole('button', { name: 'בניין B4, 20 דירות תואמות' });
    await user.click(hotspot);
    expect(hotspot).toHaveAttribute('aria-pressed', 'true');
    const elevation = screen.getByTestId('elevation');
    expect(within(elevation).getByRole('heading', { name: 'בניין B4' })).toBeInTheDocument();
    expect(within(elevation).getAllByRole('button')).toHaveLength(20);

    // keyboard toggles it off
    hotspot.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByTestId('elevation')).not.toBeInTheDocument();
  });

  it('opens an apartment from an elevation tile', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /^בניין B4,/ }));
    await user.click(within(screen.getByTestId('elevation')).getAllByRole('button')[0]!);
    expect(currentLocation.search).toMatch(/apt=B4-/);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('stars an apartment from its card without opening it', async () => {
    const { user } = renderApp();
    const first = cards()[0]!;
    const star = within(first).getByRole('button', { name: 'הוספה לרשימה שלי' });
    await user.click(star);
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(useMyListStore.getState().entries).toHaveLength(1);
    expect(currentLocation.search).toBe('');
  });

  it('searches by plan type and sale type, with live counts and a clear button', async () => {
    const { user } = renderApp();
    const search = screen.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' });
    await user.type(search, 't6d');
    expect(listHeading()).toHaveTextContent('(31)');
    const matched = applyFilters(builtInDataset, useFiltersStore.getState().filters);
    expect(new Set(matched.map((a) => a.planType))).toEqual(new Set(['T-T6D']));
    expect(
      screen.getByRole('button', { name: /^בניין A1, \d+ דירות תואמות$/ }),
    ).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'T6D, P1');
    expect(listHeading()).toHaveTextContent('(46)');

    await user.click(screen.getByRole('button', { name: 'ניקוי החיפוש' }));
    expect(search).toHaveValue('');
    expect(listHeading()).toHaveTextContent('(406)');
  });

  it('builds a multi-level sort: rooms, then floor from high to low', async () => {
    const { user } = renderApp();
    await user.selectOptions(screen.getByRole('combobox', { name: 'שדה מיון 1' }), 'rooms');
    await user.click(screen.getByRole('button', { name: 'הוספת רמת מיון' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'שדה מיון 2' }), 'floor');
    await user.click(screen.getByRole('button', { name: /^כיוון מיון 2: מהנמוכה לגבוהה/ }));

    const spec = [
      { field: 'rooms', dir: 'asc' },
      { field: 'floor', dir: 'desc' },
    ] as const;
    expect(useFiltersStore.getState().filters.sort).toEqual(spec);
    expect(screen.getByRole('combobox', { name: 'מיון מהיר' })).toHaveValue('custom');
    expect(screen.getByTestId('sort-summary')).toHaveTextContent(
      'מיון: חדרים (מהמעט להרבה), ואז קומה (מהגבוהה לנמוכה)',
    );
    const expected = sortApartments(builtInDataset.apartments, spec, builtInDataset.buildings);
    cards()
      .slice(0, 5)
      .forEach((card, i) => {
        const a = expected[i]!;
        expect(within(card).getByRole('link', { name: /^בניין/ })).toHaveTextContent(
          `בניין ${a.building} · דירה ${a.number} ·`,
        );
      });

    // reorder, remove, and go back to a preset
    await user.click(screen.getByRole('button', { name: 'העברת רמת מיון 2 למעלה' }));
    expect(useFiltersStore.getState().filters.sort.map((l) => l.field)).toEqual(['floor', 'rooms']);
    await user.click(screen.getByRole('button', { name: 'הסרת רמת מיון 2' }));
    expect(screen.getByRole('button', { name: 'הסרת רמת מיון 1' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'מיון מהיר' }), 'ppsqm');
    expect(screen.getByRole('combobox', { name: 'מיון מהיר' })).toHaveValue('ppsqm');
  });

  it('exports the filtered results to xlsx with a toast', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: 'ייצוא 101 דירות לאקסל' }));
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    const [blob, name] = spy.mock.calls[0]!;
    expect(name).toMatch(/^almogim-apartments-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets['דירות']!)).toHaveLength(101);
    expect(useUiStore.getState().toast?.message).toBe('הקובץ נשמר: 101 דירות');
  });

  it('exports only the type-search matches, also after Escape in the search field', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderApp();
    const search = screen.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' });
    await user.type(search, 'T6D{Escape}');
    expect(search).toHaveValue('T6D');
    await user.click(screen.getByRole('button', { name: 'ייצוא 31 דירות לאקסל' }));
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    const wb = XLSX.read(await spy.mock.calls[0]![0].arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['דירות']!);
    expect(rows).toHaveLength(31);
    expect(new Set(rows.map((r) => r['תוכנית']))).toEqual(new Set(['T-T6D']));
  });

  it('cancels the browser default of Escape in a non-empty search field only', () => {
    renderApp();
    const search = screen.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' });
    expect(fireEvent.keyDown(search, { key: 'Escape' })).toBe(true); // empty: default kept
    fireEvent.change(search, { target: { value: 'T5' } });
    expect(fireEvent.keyDown(search, { key: 'Escape' })).toBe(false); // prevented
    expect(search).toHaveValue('T5');
  });

  it('disables the export when nothing matches', async () => {
    const { user } = renderApp();
    await user.type(screen.getByRole('combobox', { name: 'חיפוש לפי טיפוס דירה' }), 'ZZZ');
    expect(screen.getByRole('button', { name: 'ייצוא 0 דירות לאקסל' })).toBeDisabled();
  });

  it('shows card tags for price comparison and unpublished prices', async () => {
    const { user } = renderApp();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'סוג' })).getByRole('radio', {
        name: 'שוק חופשי',
      }),
    );
    expect(within(cards()[0]!).getByText('מחיר טרם פורסם')).toBeInTheDocument();
  });
});
