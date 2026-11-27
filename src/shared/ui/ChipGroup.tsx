import * as Toggle from '@radix-ui/react-toggle';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './controls.module.css';

export interface ChipItem<K extends string> {
  value: K;
  label: ReactNode;
}

interface CommonProps<K extends string> {
  items: readonly ChipItem<K>[];
  /** Accessible name of the group (or use labelledBy). */
  label?: string;
  labelledBy?: string;
  /** Chips share the row equally. */
  segmented?: boolean;
  className?: string | undefined;
}

export type ChipGroupProps<K extends string> = CommonProps<K> &
  (
    | { mode: 'multi'; selected: readonly K[]; onToggle: (value: K) => void }
    | { mode: 'single'; selected: K | null; onSelect: (value: K) => void }
  );

/**
 * A row of pill-shaped toggle buttons (Radix ToggleGroup: arrow-key navigation, RTL aware).
 * Multi mode toggles values; single mode always keeps one value selected.
 */
export function ChipGroup<K extends string>(props: ChipGroupProps<K>) {
  const { items, label, labelledBy, segmented, className } = props;
  const rootClass = cx(styles.chips, segmented && styles.segmented, className);
  const chips = items.map((it) => (
    <ToggleGroup.Item key={it.value} value={it.value} className={styles.chip}>
      {it.label}
    </ToggleGroup.Item>
  ));
  const a11y = { 'aria-label': label, 'aria-labelledby': labelledBy };

  if (props.mode === 'multi') {
    const { selected, onToggle } = props;
    return (
      <ToggleGroup.Root
        type="multiple"
        className={rootClass}
        value={[...selected]}
        onValueChange={(next) => {
          const added = next.find((v) => !selected.includes(v as K));
          const removed = selected.find((v) => !next.includes(v));
          const changed = (added ?? removed) as K | undefined;
          if (changed !== undefined) onToggle(changed);
        }}
        {...a11y}
      >
        {chips}
      </ToggleGroup.Root>
    );
  }
  const { selected, onSelect } = props;
  return (
    <ToggleGroup.Root
      type="single"
      className={rootClass}
      value={selected ?? ''}
      onValueChange={(v) => {
        if (v) onSelect(v as K); // ignore "deselect": one option stays selected
      }}
      {...a11y}
    >
      {chips}
    </ToggleGroup.Root>
  );
}

export interface ToggleChipProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}

/** A single on/off chip (Radix Toggle, exposes aria-pressed). */
export function ToggleChip({ pressed, onPressedChange, children }: ToggleChipProps) {
  return (
    <Toggle.Root className={styles.chip} pressed={pressed} onPressedChange={onPressedChange}>
      {children}
    </Toggle.Root>
  );
}

export const chipClasses = { chips: styles.chips, segmented: styles.segmented, chip: styles.chip };
