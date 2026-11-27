import { floorLabel, fmt, m2, money, pct } from '@/domain/format';
import type { Apartment } from '@/domain/types';
import { ApartmentLink } from '@/features/apartment-detail';
import { he } from '@/i18n/he';
import { controlClasses } from '@/shared/ui/Button';
import styles from './MyList.module.css';

const T = he.myList;

export interface MyListItemProps {
  rank: number;
  total: number;
  apartment: Apartment;
  note: string;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
}

export function MyListItem({
  rank,
  total,
  apartment: a,
  note,
  onMove,
  onRemove,
  onNoteChange,
}: MyListItemProps) {
  const detail =
    a.price != null && a.pricePerSqm != null && a.comparison
      ? T.itemPriced(
          a.rooms,
          m2(a.area),
          money(a.price),
          fmt(a.pricePerSqm),
          pct(a.comparison.delta),
        )
      : T.itemFree(a.rooms, m2(a.area));
  return (
    <li className={styles.item}>
      <div className={styles.top}>
        <div className={`${styles.rank} num`}>{rank}</div>
        <ApartmentLink apartmentId={a.id} className={styles.main}>
          <b>{T.itemHeading(a.building, a.number, floorLabel(a.floor))}</b>
          <span className="muted num">{detail}</span>
        </ApartmentLink>
        <div className={styles.buttons}>
          <button
            type="button"
            aria-label={T.moveUp}
            disabled={rank === 1}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={T.moveDown}
            disabled={rank === total}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
          <button type="button" aria-label={T.remove} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>
      <textarea
        className={controlClasses.input}
        placeholder={T.notePlaceholder}
        aria-label={T.noteLabel(a.number, a.building)}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </li>
  );
}
