import { useId, useMemo } from 'react';
import { typeSuggestions } from '@/domain/search';
import { he } from '@/i18n/he';
import { controlClasses } from '@/shared/ui/Button';
import { useFiltersStore } from '@/store/filtersStore';
import { useDataset } from '@/store/selectors';
import styles from './FiltersPanel.module.css';

const T = he.filters;

/** Free-text search by plan type / sale type, with autocomplete from the dataset. */
export function TypeSearchInput() {
  const id = useId();
  const hintId = useId();
  const listId = useId();
  const dataset = useDataset();
  const text = useFiltersStore((s) => s.typeQueryText);
  const setTypeQuery = useFiltersStore((s) => s.setTypeQuery);
  const { planTypes, saleTypes } = useMemo(() => typeSuggestions(dataset.apartments), [dataset]);

  return (
    <div className={styles.search}>
      <label className={styles.label} htmlFor={id}>
        {T.search}
      </label>
      <div className={styles.searchRow}>
        <input
          id={id}
          className={controlClasses.input}
          type="search"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          list={listId}
          placeholder={T.searchPlaceholder}
          aria-describedby={hintId}
          value={text}
          onChange={(e) => setTypeQuery(e.target.value)}
          // A search field clears itself on Escape (browser default). People press Escape to
          // close the suggestion list, which silently dropped the filter (and so the export
          // took every apartment). Clearing is done with the ✕ button instead.
          onKeyDown={(e) => {
            if (e.key === 'Escape' && text !== '') e.preventDefault();
          }}
        />
        {text !== '' && (
          <button
            type="button"
            className={controlClasses.btn}
            aria-label={T.searchClear}
            onClick={() => setTypeQuery('')}
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      <datalist id={listId}>
        {[...planTypes, ...saleTypes].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <small className={styles.hint} id={hintId}>
        {T.searchHint}
      </small>
    </div>
  );
}
