import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cardTags } from '@/features/apartment-list/cardTags';
import { downloadBlob } from '@/shared/lib/download';
import { ChipGroup, ToggleChip } from '@/shared/ui/ChipGroup';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { dataset, row } from '@/test/factories';

describe('ChipGroup', () => {
  it('multi mode toggles values on and off', async () => {
    const onToggle = vi.fn();
    render(
      <ChipGroup
        mode="multi"
        label="g"
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        selected={['a']}
        onToggle={onToggle}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'B' }));
    await user.click(screen.getByRole('button', { name: 'A' }));
    expect(onToggle.mock.calls).toEqual([['b'], ['a']]);
  });

  it('single mode always keeps one value selected', async () => {
    function Single() {
      const [v, setV] = useState<'x' | 'y'>('x');
      return (
        <ChipGroup
          mode="single"
          label="g"
          items={[
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ]}
          selected={v}
          onSelect={setV}
        />
      );
    }
    render(<Single />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'X' })); // clicking the selected one keeps it
    expect(screen.getByRole('radio', { name: 'X' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Y' }));
    expect(screen.getByRole('radio', { name: 'Y' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ToggleChip exposes aria-pressed', async () => {
    const onChange = vi.fn();
    render(
      <ToggleChip pressed={false} onPressedChange={onChange}>
        T
      </ToggleChip>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'T' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('ErrorBoundary', () => {
  it('renders the fallback when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = () => {
      throw new Error('boom');
    };
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });
});

describe('downloadBlob', () => {
  it('clicks a temporary download link', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadBlob(new Blob(['x']), 'f.csv');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('cardTags', () => {
  it('colours the peer comparison at ±3 % and flags missing prices', () => {
    const d = dataset([
      row({ unit: 1, price: 900_000 }),
      row({ unit: 2, price: 1_000_000 }),
      row({ unit: 3, price: 1_000_000 }),
      row({ unit: 4, price: 1_100_000 }),
      row({ unit: 5, price: null, plan: 'T-G4A', storageFloor: 'קרקע' }),
    ]);
    const tone = (id: string) => cardTags(d.byId.get(id)!).find((t) => t.key === 'delta')?.tone;
    expect(tone('A1-1')).toBe('good');
    expect(tone('A1-2')).toBe('default');
    expect(tone('A1-4')).toBe('bad');
    expect(tone('A1-5')).toBe('warn');
    expect(cardTags(d.byId.get('A1-5')!).map((t) => t.text)).toEqual([
      'מחיר מטרה',
      'דירת גן',
      'גינה 12 מ״ר',
      'מחסן בקרקע',
      'מחיר טרם פורסם',
    ]);
  });
});
