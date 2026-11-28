import { exportApartments } from '@/data/workbook/exportApartments';
import { loadXlsx, type XlsxModule } from '@/data/workbook/xlsx';
import { describeSort } from '@/domain/filterSummary';
import { he } from '@/i18n/he';
import { downloadBlob } from '@/shared/lib/download';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ListHead } from '@/shared/ui/Content';
import { ExportButton } from '@/shared/ui/ExportButton';
import { useFiltersStore } from '@/store/filtersStore';
import { useMyListStore } from '@/store/myListStore';
import { useFilteredApartments, useMyListIds } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import { ApartmentCard } from './ApartmentCard';
import styles from './ApartmentCard.module.css';

export interface ApartmentListProps {
  /** For tests. */
  load?: () => Promise<XlsxModule>;
  download?: (blob: Blob, name: string) => void;
}

/** Matching apartments as cards, 40 at a time, with the active sort and an Excel export. */
export function ApartmentList({ load = loadXlsx, download = downloadBlob }: ApartmentListProps) {
  const list = useFilteredApartments();
  const filters = useFiltersStore((s) => s.filters);
  const visible = useFiltersStore((s) => s.visibleCount);
  const showMore = useFiltersStore((s) => s.showMore);
  const myList = useMyListIds();
  const toggle = useMyListStore((s) => s.toggle);
  const showToast = useUiStore((s) => s.showToast);
  const shown = list.slice(0, visible);

  return (
    <section aria-labelledby="apartments-heading">
      <ListHead>
        <div>
          <h2 id="apartments-heading">
            {he.list.title} <span className="muted num">({list.length})</span>
          </h2>
          <p className={`muted ${styles.sortSummary}`} data-testid="sort-summary">
            {he.filters.sortSummary(describeSort(filters.sort))}
          </p>
        </div>
        <ExportButton
          variant="default"
          disabled={!list.length}
          aria-label={he.list.exportAria(list.length)}
          build={() => exportApartments({ list, filters, myListIds: myList }, load)}
          onEmpty={() => showToast(he.list.exportEmpty)}
          onDone={() => showToast(he.list.exportedToast(list.length))}
          onError={() => showToast(he.list.exportFailed)}
          download={download}
        >
          {he.list.export}
        </ExportButton>
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
