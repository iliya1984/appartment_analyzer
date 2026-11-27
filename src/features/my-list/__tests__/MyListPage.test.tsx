import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as download from '@/shared/lib/download';
import { useMyListStore } from '@/store/myListStore';
import { useUiStore } from '@/store/uiStore';
import { currentLocation, renderApp } from '@/test/renderApp';

function renderWithList(ids: string[]) {
  const r = renderApp('/my-list');
  act(() => ids.forEach((id) => useMyListStore.getState().toggle(id)));
  return r;
}

describe('my list page', () => {
  it('shows an empty state', () => {
    renderApp('/my-list');
    expect(screen.getByText(/הרשימה ריקה/)).toBeInTheDocument();
    expect(screen.getByText('נשמר במכשיר הזה')).toBeInTheDocument();
  });

  it('ranks, reorders and removes entries', async () => {
    const { user } = renderWithList(['A1-1', 'A1-2', 'C14-13']);
    const items = () => screen.getAllByRole('listitem');
    expect(items()).toHaveLength(3);
    expect(within(items()[0]!).getByRole('button', { name: 'העלאה בעדיפות' })).toBeDisabled();
    expect(within(items()[2]!).getByRole('button', { name: 'הורדה בעדיפות' })).toBeDisabled();
    expect(within(items()[2]!).getByText(/שוק חופשי, מחיר לא פורסם/)).toBeInTheDocument();

    await user.click(within(items()[2]!).getByRole('button', { name: 'העלאה בעדיפות' }));
    expect(useMyListStore.getState().entries.map((e) => e.id)).toEqual(['A1-1', 'C14-13', 'A1-2']);
    await user.click(within(items()[0]!).getByRole('button', { name: 'הורדה בעדיפות' }));
    expect(useMyListStore.getState().entries.map((e) => e.id)).toEqual(['C14-13', 'A1-1', 'A1-2']);

    await user.click(within(items()[1]!).getByRole('button', { name: 'הסרה מהרשימה' }));
    expect(useMyListStore.getState().entries.map((e) => e.id)).toEqual(['C14-13', 'A1-2']);
  });

  it('saves notes as you type', async () => {
    const { user } = renderWithList(['A1-1']);
    await user.type(screen.getByRole('textbox', { name: 'הערות לדירה 1 בבניין A1' }), 'קרוב לים');
    expect(useMyListStore.getState().entries[0]?.note).toBe('קרוב לים');
  });

  it('opens an apartment from the list', async () => {
    const { user } = renderWithList(['A1-1']);
    await user.click(screen.getByRole('link', { name: /בניין A1 · דירה 1/ }));
    expect(currentLocation.search).toContain('apt=A1-1');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('exports to xlsx and confirms with a toast', async () => {
    const spy = vi.spyOn(download, 'downloadBlob').mockImplementation(() => undefined);
    const { user } = renderWithList(['A1-1', 'A1-2']);
    await user.click(screen.getByRole('button', { name: 'ייצוא לאקסל' }));
    await waitFor(() => expect(spy).toHaveBeenCalledOnce());
    const [blob, name] = spy.mock.calls[0]!;
    expect(name).toBe('almogim-priorities.xlsx');
    expect(blob.size).toBeGreaterThan(1000);
    expect(useUiStore.getState().toast?.message).toBe('הקובץ נשמר');
  });

  it('warns instead of exporting an empty list', async () => {
    const spy = vi.spyOn(download, 'downloadBlob');
    const { user } = renderApp('/my-list');
    await user.click(screen.getByRole('button', { name: 'ייצוא לאקסל' }));
    expect(spy).not.toHaveBeenCalled();
    expect(await screen.findByText('הרשימה ריקה', { selector: 'div' })).toBeInTheDocument();
  });
});
