import { StarIcon } from '@/shared/icons/StarIcon';
import { cx } from '@/shared/lib/cx';
import styles from './StarButton.module.css';

export interface StarButtonProps {
  pressed: boolean;
  onToggle: () => void;
  label: string;
  framed?: boolean;
  className?: string | undefined;
}

/** Star toggle for "in my list". */
export function StarButton({ pressed, onToggle, label, framed, className }: StarButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.star, framed && styles.framed, className)}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onToggle}
    >
      <StarIcon />
    </button>
  );
}
