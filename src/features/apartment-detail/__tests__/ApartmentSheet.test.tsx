import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInDataset } from '@/data/builtIn';
import { getKpis, getGaugeLabels } from '@/features/apartment-detail/kpis';
import { useMyListStore } from '@/store/myListStore';
import { useUiStore } from '@/store/uiStore';
import { legacyFixture } from '@/test/legacyFixture';
import { currentLocation, renderApp } from '@/test/renderApp';

// The real viewer needs WebGL; its own tests cover it.
vi.mock('@/features/viewer3d', () => ({
  ApartmentViewer: (p: { orientation: number | null; sun: unknown }) => (
    <div
      data-testid="viewer"
      data-orientation={String(p.orientation)}
      data-sun={JSON.stringify(p.sun)}
    />
  ),
}));

beforeEach(() => useUiStore.setState({ lastSheetTab: 'insights' }));

describe('apartment sheet', () => {
  it('opens from the URL with title, subtitle and the insights tab', async () => {
    renderApp('/?apt=A1-1&tab=insights');
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'בניין A1 · דירה 1 · קומה 1' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('5 חדרים · 125.9 מ״ר · 1,791,623 ₪ · מחיר מטרה'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'תובנות' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByText('מחיר למ״ר נמוך מדירות דומות')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'סגירה' })).toHaveFocus();
  });

  it('opens from a card link and closes with Escape (back to the list)', async () => {
    const { user } = renderApp('/');
    await user.click(within(screen.getAllByRole('article')[0]!).getByRole('link'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentLocation.search).toBe('');
  });

  it('closes with the close button when opened from a shared link', async () => {
    const { user } = renderApp('/my-list?apt=A1-1');
    await user.click(await screen.findByRole('button', { name: 'סגירה' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(currentLocation.pathname).toBe('/my-list');
  });

  it('switches tabs via the URL and remembers the last tab', async () => {
    const { user } = renderApp('/?apt=A1-1');
    await user.click(await screen.findByRole('tab', { name: 'הבניין והקומה' }));
    expect(currentLocation.search).toContain('tab=building');
    expect(useUiStore.getState().lastSheetTab).toBe('building');
    expect(screen.getByRole('heading', { name: 'בניין A1 במפה' })).toBeInTheDocument();
    expect(screen.getByTestId('highlight')).toBeInTheDocument();
  });

  it('stars the apartment from the header', async () => {
    const { user } = renderApp('/?apt=B2-3');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'הוספה לרשימה שלי' }));
    expect(useMyListStore.getState().entries.map((e) => e.id)).toEqual(['B2-3']);
  });

  it('building tab: lists the floor and plan, and rows navigate to other apartments', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=building');
    const dialog = await screen.findByRole('dialog');
    const rowsOnFloor = within(dialog).getAllByRole('table')[0]!;
    expect(within(rowsOnFloor).getAllByRole('row')).toHaveLength(5); // header + 4 units on floor 1
    expect(within(rowsOnFloor).getAllByRole('row')[1]).toHaveAttribute('aria-current', 'true');
    await user.click(within(rowsOnFloor).getByRole('link', { name: 'מעבר לדירה 2 בבניין A1' }));
    expect(currentLocation.search).toContain('apt=A1-2');
    expect(
      within(dialog).getByRole('heading', { name: 'בניין A1 · דירה 2 · קומה 1' }),
    ).toBeInTheDocument();
    // whole-row click works too
    await user.click(
      within(within(dialog).getAllByRole('table')[0]!)
        .getByText('C*', { exact: false })
        .closest('tr')!,
    );
    expect(currentLocation.search).toContain('tab=building');
  });

  it('schematic tab: orientation is saved per apartment and enables the sun simulation', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=schematic');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/בחרו כיוון כדי להפעיל/)).toBeInTheDocument();
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-sun', 'null');
    expect(within(dialog).getAllByRole('row')).toHaveLength(10); // rooms table: header + 9 (5-room layout)

    await user.selectOptions(within(dialog).getByRole('combobox'), 'דרום');
    expect(useMyListStore.getState().orientation).toEqual({ 'A1-1': 180 });
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-orientation', '180');
    expect(within(dialog).getByText(/שמש ישירה בסלון/)).toBeInTheDocument();
    expect(within(dialog).getByText('09:00')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('radio', { name: 'צהריים 12:00' }));
    expect(within(dialog).getByText('12:00')).toBeInTheDocument();
    expect(within(dialog).getByText(/השמש בכיוון/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'קיץ' }));
    expect(screen.getByTestId('viewer').dataset.sun).toBe(
      JSON.stringify({ hour: 12, dayOfYear: 172 }),
    );

    const auto = within(dialog).getByRole('button', { name: 'סיבוב 360° אוטומטי' });
    expect(auto).toHaveAttribute('aria-pressed', 'true');
    await user.click(auto);
    expect(auto).toHaveAttribute('aria-pressed', 'false');

    await user.selectOptions(within(dialog).getByRole('combobox'), 'לא ידוע');
    expect(useMyListStore.getState().orientation).toEqual({});
  });

  it('shows "not published" for free-market apartments', async () => {
    renderApp('/?apt=C14-13');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('לא פורסם')[0]).toBeInTheDocument();
    expect(within(dialog).getByText('מחיר שוק חופשי טרם פורסם')).toBeInTheDocument();
  });
});

describe('KPIs (golden master)', () => {
  it('match the legacy KPI and gauge strings for every apartment', () => {
    const legacy = legacyFixture();
    for (const a of builtInDataset.apartments) {
      const l = legacy.insights[a.id]!;
      expect(getKpis(a), a.id).toEqual(l.kpis);
      expect(getGaugeLabels(a), a.id).toEqual(l.gaugeLabels);
    }
  });
});
