import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';
import styles from './content.module.css';

export function Section({
  title,
  children,
  className,
  ...rest
}: { title?: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx(styles.section, className)} {...rest}>
      {title != null && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export type TagTone = 'default' | 'good' | 'bad' | 'warn';

export function Tag({ tone = 'default', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={cx(styles.tag, tone !== 'default' && styles[tone])}>{children}</span>;
}

export function Tags({ children }: { children: ReactNode }) {
  return <div className={styles.tags}>{children}</div>;
}

export function Kpis({ children }: { children: ReactNode }) {
  return <div className={styles.kpis}>{children}</div>;
}

export function Kpi({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className={styles.kpi}>
      <small>{label}</small>
      <strong className="num">{value}</strong>
    </div>
  );
}

export function Facts({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={styles.facts} style={style}>
      {children}
    </div>
  );
}

export function Fact({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className={styles.fact}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className={styles.legend}>{children}</div>;
}

export function Swatch({ color, border }: { color: string; border?: string }) {
  return (
    <i
      aria-hidden="true"
      className={styles.swatch}
      style={{ background: color, ...(border ? { border } : {}) }}
    />
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <div className={styles.banner} role="note">
      {children}
    </div>
  );
}

export function TwoColumns({ children }: { children: ReactNode }) {
  return <div className={styles.twoCol}>{children}</div>;
}

export function ListHead({ children }: { children: ReactNode }) {
  return <div className={styles.listHead}>{children}</div>;
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className={styles.scroll}>{children}</div>;
}

/** Class names for tables: table, n (numeric cell), current (highlighted row), clickable. */
export const tableClasses = {
  table: styles.table,
  n: styles.n,
  current: styles.current,
  clickable: styles.clickable,
};
