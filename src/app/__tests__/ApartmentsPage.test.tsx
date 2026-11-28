import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFiltersStore } from '@/store/filtersStore';
import { useMyListStore } from '@/store/myListStore';
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
    await user.selectOptions(screen.getByRole('combobox', { name: 'מיון' }), 'id');
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
