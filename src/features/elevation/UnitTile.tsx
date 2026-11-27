import { money } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { he } from '@/i18n/he';
import { cx } from '@/shared/lib/cx';
import styles from './BuildingElevation.module.css';

export interface UnitTileProps {
  apartment: Apartment;
  matched: boolean;
  inMyList: boolean;
  onOpen: (id: string) => void;
}

/** One apartment in the floor-by-floor grid: sale type and room count. */
export function UnitTile({ apartment: a, matched, inMyList, onOpen }: UnitTileProps) {
  const title = he.elevation.tileTitle(
    a.number,
    a.rooms,
    a.area,
    a.price != null ? money(a.price) : null,
  );
  return (
    <button
      type="button"
      className={cx(
        styles.tile,
        matched ? (a.category === 'target' ? styles.target : styles.free) : styles.unmatched,
        inMyList && styles.fav,
      )}
      title={title}
      aria-label={title}
      data-id={a.id}
      onClick={() => onOpen(a.id)}
    >
      <b>{a.saleType}</b>
      <span className="num">{a.rooms}</span>
    </button>
  );
}
