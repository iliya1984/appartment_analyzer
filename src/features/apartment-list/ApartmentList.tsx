import { he } from '@/i18n/he';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ListHead } from '@/shared/ui/Content';
import { useFiltersStore } from '@/store/filtersStore';
import { useMyListStore } from '@/store/myListStore';
import { useFilteredApartments, useMyListIds } from '@/store/selectors';
import { ApartmentCard } from './ApartmentCard';
import styles from './ApartmentCard.module.css';

/** Matching apartments as cards, 40 at a time. */
export function ApartmentList() {
  const list = useFilteredApartments();
  const visible = useFiltersStore((s) => s.visibleCount);
  const showMore = useFiltersStore((s) => s.showMore);
  const myList = useMyListIds();
  const toggle = useMyListStore((s) => s.toggle);
  const shown = list.slice(0, visible);

  return (
    <section aria-labelledby="apartments-heading">
      <ListHead>
        <h2 id="apartments-heading">
          {he.list.title} <span className="muted num">({list.length})</span>
        </h2>
      </ListHead>
      {shown.length ? (
        <div className={styles.cards}>
          {shown.map((a) => (
            <ApartmentCard
              key={a.id}
              apartment={a}
              inMyList={myList.has(a.id)}
              onToggleMyList={toggle}
            />
          ))}
        </div>
      ) : (
        <EmptyState>{he.list.empty}</EmptyState>
      )}
      {list.length > visible && (
        <Button className={styles.more} onClick={showMore}>
          {he.list.more(list.length - visible)}
        </Button>
      )}
    </section>
  );
}
