import type { KeyboardEvent } from 'react';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import styles from './SiteMap.module.css';

export interface BuildingHotspotProps {
  building: string;
  x: number;
  y: number;
  /** Apartments of this building that match the filters. */
  count: number;
  selected: boolean;
  onPick: (building: string) => void;
}

/** A focusable building marker with a match-count badge; dimmed when nothing matches. */
export function BuildingHotspot({ building, x, y, count, selected, onPick }: BuildingHotspotProps) {
  const wide = count > 99;
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(building);
    }
  };
  return (
    <g
      className={cx(styles.hotspot, selected && styles.selected)}
      role="button"
      tabIndex={0}
      aria-label={he.map.hotspot(building, count)}
      aria-pressed={selected}
      data-building={building}
      onClick={() => onPick(building)}
      onKeyDown={onKeyDown}
    >
      {count === 0 && <circle className={styles.dim} r={30} cx={x} cy={y} />}
      <circle className={styles.ring} r={32} cx={x} cy={y} />
      <g className={styles.badge}>
        <rect x={x + 14} y={y - 44} width={wide ? 44 : 36} height={26} rx={13} />
        <text x={x + 14 + (wide ? 22 : 18)} y={y - 25.5}>
          {count}
        </text>
      </g>
    </g>
  );
}
