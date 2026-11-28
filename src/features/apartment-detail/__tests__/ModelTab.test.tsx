import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/store/uiStore';
import { useDatasetStore } from '@/store/datasetStore';
import { currentLocation, renderApp } from '@/test/renderApp';
import { dataset, row } from '@/test/factories';

/** Every built-in plan type has a plan model now; the schematic is for imported unknown types. */
function switchToUnmodelledApartment() {
  act(() =>
    useDatasetStore
      .getState()
      .setDataset(dataset([row({ unit: 1, plan: 'T-X5Z', rooms: 5, area: 125 })]), {
        kind: 'file',
        fileName: 'imported.xlsx',
      }),
  );
}

const walk = vi.fn();
const reset = vi.fn();

// The real viewer needs WebGL; record the props it gets instead.
vi.mock('@/features/viewer3d', () => ({
  VIEW_MODES: ['dollhouse', 'top', 'walk'],
  ApartmentViewer: (p: {
    plan?: { planType: string } | null;
    view?: string;
    wallsCut?: boolean;
    labels: boolean;
    sun: unknown;
    onHandle?: (h: unknown) => void;
  }) => {
    p.onHandle?.({ walk, reset });
    return (
      <div
        data-testid="viewer"
        data-plan={p.plan?.planType ?? 'none'}
        data-view={p.view ?? ''}
        data-walls-cut={String(p.wallsCut)}
        data-labels={String(p.labels)}
        data-sun={JSON.stringify(p.sun)}
      />
    );
  },
}));

beforeEach(() => {
  useUiStore.setState({ lastSheetTab: 'insights' });
  walk.mockClear();
  reset.mockClear();
});

describe('3D tab with a plan-based model', () => {
  it('shows the plan model with its badge, real rooms and sun from the plan', async () => {
    renderApp('/?apt=D15-5&tab=schematic');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: 'הדמיה תלת־ממדית' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const viewer = await screen.findByTestId('viewer');
    expect(viewer).toHaveAttribute('data-plan', 'T-T5C');
    expect(viewer).toHaveAttribute('data-view', 'dollhouse');
    expect(viewer).toHaveAttribute('data-walls-cut', 'true');
    expect(viewer.dataset.sun).toBe(JSON.stringify({ hour: 9, dayOfYear: 355 }));
    expect(within(dialog).getByText('מבוסס תוכנית ✓')).toBeInTheDocument();
    expect(within(dialog).getByText(/נמדדו מתוכנית T-T5C/)).toBeInTheDocument();
    expect(within(dialog).getByText('אוטומטי (לפי התוכנית): הסלון פונה למזרח')).toBeInTheDocument();
    expect(within(dialog).getByText('שטח הדירה הרשמי: 128.2 מ״ר (כולל קירות)')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('rowheader', { name: 'סה״כ נטו (ללא קירות)' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('cell', { name: /^סלון/ })).toBeInTheDocument();
    // no manual orientation picker: north comes from the plan
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('switches views, walls and labels; walk mode shows the walk pad', async () => {
    const { user } = renderApp('/?apt=D13-6&tab=schematic');
    const viewer = await screen.findByTestId('viewer');
    await user.click(screen.getByRole('radio', { name: 'מבט על' }));
    expect(viewer).toHaveAttribute('data-view', 'top');
    await user.click(screen.getByRole('button', { name: 'קירות נמוכים' }));
    expect(viewer).toHaveAttribute('data-walls-cut', 'false');
    await user.click(screen.getByRole('button', { name: 'תוויות' }));
    expect(viewer).toHaveAttribute('data-labels', 'false');

    await user.click(screen.getByRole('radio', { name: 'סיור' }));
    expect(viewer).toHaveAttribute('data-view', 'walk');
    const pad = screen.getByRole('group', { name: 'הליכה בדירה' });
    await user.click(within(pad).getByRole('button', { name: 'קדימה' }));
    expect(walk).toHaveBeenLastCalledWith(0.5, 0, 0);
    await user.click(within(pad).getByRole('button', { name: 'פנייה שמאלה' }));
    expect(walk).toHaveBeenLastCalledWith(0, 0, -Math.PI / 8);
    await user.click(within(pad).getByRole('button', { name: 'פנייה ימינה' }));
    await user.click(within(pad).getByRole('button', { name: 'אחורה' }));
    expect(walk).toHaveBeenLastCalledWith(-0.5, 0, 0);
    await user.click(screen.getByRole('button', { name: 'חזרה לכניסה' }));
    await user.click(screen.getByRole('button', { name: 'חזרה לתצוגת הפתיחה' }));
    expect(reset).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'מסך מלא' }));
    expect(screen.getByRole('button', { name: 'יציאה ממסך מלא' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('radio', { name: 'צהריים 12:00' }));
    expect(viewer.dataset.sun).toBe(JSON.stringify({ hour: 12, dayOfYear: 355 }));
  });

  it('links to the apartment on the plan', async () => {
    const { user } = renderApp('/?apt=D15-5&tab=schematic');
    await user.click(await screen.findByRole('button', { name: 'הצג בתוכנית' }));
    const p = new URLSearchParams(currentLocation.search);
    expect(p.get('tab')).toBe('plans');
    expect(p.get('pmode')).toBe('unit');
  });

  it('apartments of a plan type without a model (imported file) keep the schematic, marked as such', async () => {
    renderApp('/?apt=A1-1&tab=schematic');
    switchToUnmodelledApartment();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('סכמטי')).toHaveAttribute(
      'title',
      expect.stringMatching(/אין עדיין מודל/),
    );
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-plan', 'none');
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument();
  });
});
