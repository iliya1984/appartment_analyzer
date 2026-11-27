import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMyListStore } from '@/store/myListStore';
import { currentLocation, renderApp } from '@/test/renderApp';

describe('app shell', () => {
  it('shows the header stats from the dataset', () => {
    renderApp();
    expect(
      screen.getByText('הגרלה 2181 · 406 דירות · 15 בניינים · 325 במחיר מטרה'),
    ).toBeInTheDocument();
  });

  it('navigates between the three views and marks the current tab', async () => {
    const { user } = renderApp();
    const nav = screen.getByRole('navigation', { name: 'תצוגות' });
    expect(within(nav).getByRole('link', { name: 'דירות' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(nav).getByRole('link', { name: /הרשימה שלי/ }));
    expect(currentLocation.pathname).toBe('/my-list');
    expect(screen.getByRole('heading', { name: 'הרשימה שלי לפי עדיפות' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'נתונים' }));
    expect(screen.getByRole('heading', { name: 'נתוני הפרויקט' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'נתונים' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the my-list count badge', async () => {
    renderApp();
    expect(screen.getByTestId('my-list-count')).toHaveTextContent('0');
    useMyListStore.getState().toggle('A1-1');
    expect(
      await screen.findByText('1', { selector: '[data-testid="my-list-count"]' }),
    ).toBeInTheDocument();
  });

  it('dismisses the info notice', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'סגירת ההודעה' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('renders a not-found page for unknown paths', () => {
    renderApp('/nope');
    expect(screen.getByText('העמוד לא נמצא.')).toBeInTheDocument();
  });

  it('ignores an unknown apartment id in the URL', () => {
    renderApp('/?apt=ZZ-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
