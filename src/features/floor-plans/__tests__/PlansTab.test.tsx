import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFiltersStore } from '@/store/filtersStore';
import { useUiStore } from '@/store/uiStore';
import { currentLocation, renderApp } from '@/test/renderApp';

// The 3D viewer needs WebGL; its own tests cover it.
vi.mock('@/features/viewer3d', () => ({
  VIEW_MODES: ['dollhouse', 'top', 'walk'],
  ApartmentViewer: () => <div data-testid="viewer" />,
}));

// Warm the lazy viewer chunk so the first test does not race the Suspense fallback.
beforeAll(async () => {
  await import('@/features/floor-plans/PlanBrowser');
});
beforeEach(() => useUiStore.setState({ lastSheetTab: 'insights' }));

/** Caption text, which wraps the floor range in a <bdi> (so getByText cannot see it whole). */
const caption = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'B' && el.textContent === text;
const params = () => new URLSearchParams(currentLocation.search);
const hotspots = () =>
  within(screen.getByRole('application', { name: /תוכנית הקומה/ })).getAllByRole('button', {
    name: /^דירה \d+/,
  });

describe('plans tab (apartment sheet)', () => {
  it('opens on the apartment, highlighted on its floor sheet', async () => {
    renderApp('/?apt=A1-1&tab=plans');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: 'תוכנית' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await within(dialog).findByRole('radio', { name: 'הדירה' })).toBeChecked();
    expect(within(dialog).getByText(caption('קומה 1'))).toBeInTheDocument();
    // zoomed in on the unit, so the sharper 3200 px image is used
    const img = within(dialog).getByRole('img', { name: /בניין A1\. הדירה מסומנת: T-T5A/ });
    expect(img.getAttribute('src')).toMatch(/A1-p1@2x\.webp$/);
    expect(screen.getByTestId('unit-highlight')).toBeInTheDocument();
    // four units on floor 1 of A1; the current one is marked
    expect(hotspots().map((b) => b.textContent)).toEqual(['1הדירה', '2', '3', '4']);
    expect(hotspots()[0]).toHaveAttribute('aria-current', 'true');
    expect(hotspots()[0]).toHaveAccessibleName(/^דירה 1 · T-T5A · 5 חד׳ · 125\.9 מ״ר · /);
    expect(within(dialog).getByText(/תוכניות מכר להמחשה בלבד/)).toBeInTheDocument();
  });

  it('a hotspot opens the neighbour on the same plan (floor mode)', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=plans');
    await screen.findByRole('radio', { name: 'הדירה' });
    await user.click(hotspots()[2]!);
    expect(params().get('apt')).toBe('A1-3');
    expect(params().get('tab')).toBe('plans');
    expect(params().get('pmode')).toBe('floor');
    expect(
      await screen.findByRole('heading', { name: 'בניין A1 · דירה 3 · קומה 1' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'הקומה' })).toBeChecked();
    expect(hotspots()[2]).toHaveAttribute('aria-current', 'true');
  });

  it('building mode lists every sheet; picking one shows that floor range', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=plans');
    await user.click(await screen.findByRole('radio', { name: 'כל הבניין' }));
    expect(params().get('pmode')).toBe('building');
    const thumbs = screen.getAllByRole('button', { name: /דירות בקומה|ללא דירות|דירה אחת/ });
    expect(thumbs).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: /^קומה.*8–16/ }));
    expect(params().get('psheet')).toBe('A1-p8');
    expect(params().get('pfloor')).toBe('8');
    expect(screen.getByRole('radio', { name: 'הקומה' })).toBeChecked();
    expect(hotspots().map((b) => b.textContent)).toEqual(['35', '36', '37', '38', '39']);

    // the range stepper changes the unit numbers, not the drawing
    await user.click(screen.getByRole('button', { name: 'קומה גבוהה יותר בטווח' }));
    expect(params().get('pfloor')).toBe('9');
    expect(hotspots().map((b) => b.textContent)).toEqual(['40', '41', '42', '43', '44']);
    expect(screen.getByText(/השרטוט זהה לכל הקומות .?8–16/)).toBeInTheDocument();
  });

  it('the floor rail and the above / below buttons move between sheets', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=plans&pmode=floor');
    const rail = await screen.findByRole('navigation', { name: 'גיליונות הבניין' });
    expect(within(rail).getAllByRole('button')).toHaveLength(8);
    expect(within(rail).getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'true');
    await user.click(within(rail).getByRole('button', { name: 'גג' }));
    expect(params().get('psheet')).toBe('A1-p4');
    expect(screen.queryAllByRole('button', { name: /^דירה \d+/ })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'קומה מתחת' }));
    expect(params().get('psheet')).toBe('A1-p5'); // penthouse 17
    expect(screen.getByRole('button', { name: 'קומה מעל' })).toBeEnabled();
  });

  it('zoom buttons and keyboard change the view; the unit radio is not offered on other sheets', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=plans&pmode=floor&psheet=A1-p6');
    const content = await screen.findByTestId('plan-content');
    const before = content.style.transform;
    await user.click(screen.getByRole('button', { name: 'הגדלה' }));
    expect(content.style.transform).not.toBe(before);
    await user.click(screen.getByRole('button', { name: 'התאמה למסך' }));
    expect(content.style.transform).toBe(before);
    const stage = screen.getByRole('application', { name: /תוכנית הקומה/ });
    act(() => stage.focus());
    fireEvent.keyDown(stage, { key: '+' });
    expect(content.style.transform).not.toBe(before);
    fireEvent.keyDown(stage, { key: '0' });
    expect(content.style.transform).toBe(before);
    fireEvent.keyDown(stage, { key: 'PageUp' });
    expect(params().get('psheet')).toBe('A1-p7');
    // A1-1 is not on this sheet: "הדירה" falls back to the floor view
    expect(screen.getByRole('radio', { name: 'הקומה' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'הדירה' }));
    expect(params().get('psheet')).toBe('A1-p1');
    await user.click(screen.getByRole('button', { name: 'מסך מלא' }));
  });

  it('shows a notice (never a wrong sheet) for apartments without a plan', async () => {
    const { user } = renderApp('/?apt=D15-1&tab=plans');
    expect(await screen.findByText('תוכנית לדירה זו טרם נוספה')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'הצגת גיליונות הבניין' }));
    expect(params().get('pmode')).toBe('building');
    expect(await screen.findAllByRole('button', { name: /תוכנית דירה 1:50/ })).not.toHaveLength(0);
  });

  it('the 3D button switches tabs', async () => {
    const { user } = renderApp('/?apt=B2-3&tab=plans');
    await user.click(await screen.findByRole('button', { name: 'תלת־ממד' }));
    expect(params().get('tab')).toBe('schematic');
  });
});

describe('plan entry points', () => {
  it('building tab links to the building plans page and to the floor plan', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=building');
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('link', { name: 'תוכניות הבניין (8 גיליונות)' }),
    ).toHaveAttribute('href', '/buildings/A1/plans?floor=1');
    await user.click(within(dialog).getByRole('button', { name: 'תוכנית הקומה' }));
    expect(params().get('tab')).toBe('plans');
    expect(params().get('pmode')).toBe('floor');
  });

  it('cards link to the plans tab; apartments without a plan get no icon', async () => {
    renderApp('/');
    const card = (await screen.findAllByRole('article'))[0]!;
    expect(within(card).getByRole('link', { name: 'תוכנית הדירה' }).getAttribute('href')).toMatch(
      /tab=plans/,
    );
  });

  it('the elevation offers the building plans and a plan per floor', async () => {
    renderApp('/');
    act(() => useFiltersStore.getState().pickBuilding('B4'));
    const elevation = await screen.findByTestId('elevation');
    expect(within(elevation).getByRole('link', { name: 'תוכניות קומה' })).toHaveAttribute(
      'href',
      '/buildings/B4/plans',
    );
    expect(within(elevation).getByRole('link', { name: 'תוכנית קומה 3' })).toHaveAttribute(
      'href',
      '/buildings/B4/plans?floor=3',
    );
  });

  it('opening another apartment drops the previous plan state', async () => {
    const { user } = renderApp('/?apt=A1-1&tab=plans&pmode=building&psheet=A1-p8&pfloor=9');
    await user.click(await screen.findByRole('tab', { name: 'הבניין והקומה' }));
    const rows = within(screen.getAllByRole('table')[0]!);
    await user.click(rows.getByRole('link', { name: 'מעבר לדירה 2 בבניין A1' }));
    expect(params().get('apt')).toBe('A1-2');
    expect(params().has('psheet')).toBe(false);
    expect(params().has('pmode')).toBe(false);
  });
});

describe('building plans page', () => {
  it('shows the sheet of the requested floor and opens apartments from it', async () => {
    const { user } = renderApp('/buildings/A1/plans?floor=9');
    expect(screen.getByRole('heading', { name: 'תוכניות בניין A1' })).toBeInTheDocument();
    expect(screen.getByText(/מגרש 211 · 8 גיליונות/)).toBeInTheDocument();
    expect(await screen.findByText(caption('קומה 8–16'))).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'הדירה' })).not.toBeInTheDocument();
    expect(hotspots().map((b) => b.textContent)).toEqual(['40', '41', '42', '43', '44']);
    await user.click(screen.getByRole('button', { name: 'קומה נמוכה יותר בטווח' }));
    expect(params().get('floor')).toBe('8');
    await user.click(hotspots()[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'בניין A1 · דירה 35 · קומה 8' }),
    ).toBeInTheDocument();
    expect(params().get('tab')).toBe('plans');
    expect(currentLocation.pathname).toBe('/buildings/A1/plans');
  });

  it('handles unknown buildings', () => {
    renderApp('/buildings/Z9/plans');
    expect(screen.getByText('הבניין לא נמצא.')).toBeInTheDocument();
  });
});
