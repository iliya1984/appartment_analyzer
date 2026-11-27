import { he } from '@/i18n/he';
import { EmptyState, ListHead } from '@/shared/ui/Content';
import { useMyListStore } from '@/store/myListStore';
import { useDataset } from '@/store/selectors';
import { ExportButton } from './ExportButton';
import styles from './MyList.module.css';
import { MyListItem } from './MyListItem';

/** The personal list, ordered by priority, with notes and Excel export. */
export function MyListPage() {
  const dataset = useDataset();
  const entries = useMyListStore((s) => s.entries);
  const { move, remove, setNote } = useMyListStore.getState();
  const items = entries.flatMap((e) => {
    const a = dataset.byId.get(e.id);
    return a ? [{ entry: e, apartment: a }] : [];
  });

  return (
    <main>
      <ListHead>
        <h2>{he.myList.title}</h2>
        <ExportButton />
      </ListHead>
      <p className={styles.saveState}>{he.myList.saved}</p>
      {items.length ? (
        <ol className={styles.list}>
          {items.map(({ entry, apartment }, i) => (
            <MyListItem
              key={entry.id}
              rank={i + 1}
              total={items.length}
              apartment={apartment}
              note={entry.note}
              onMove={(delta) => move(entries.indexOf(entry), delta)}
              onRemove={() => remove(entry.id)}
              onNoteChange={(note) => setNote(entry.id, note)}
            />
          ))}
        </ol>
      ) : (
        <EmptyState>{he.myList.empty}</EmptyState>
      )}
    </main>
  );
}
