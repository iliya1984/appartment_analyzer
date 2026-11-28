import { useId } from 'react';
import { describeSort } from '@/domain/filterSummary';
import {
  isSortField,
  isSortKey,
  MAX_SORT_LEVELS,
  presetOf,
  SORT_FIELDS,
  SORT_KEYS,
} from '@/domain/sort';
import { he } from '@/i18n/he';
import { Button, controlClasses } from '@/shared/ui/Button';
import { useFiltersStore } from '@/store/filtersStore';
import styles from './SortBuilder.module.css';

const T = he.filters;
const CUSTOM = 'custom';

/**
 * Multi-level sort: a quick-sort preset dropdown plus an ordered list of levels, each with a
 * field, a direction toggle, move up/down and remove.
 */
export function SortBuilder() {
  const spec = useFiltersStore((s) => s.filters.sort);
  const actions = useFiltersStore.getState();
  const headingId = useId();
  const quickId = useId();
  const preset = presetOf(spec);
  const summary = T.sortSummary(describeSort(spec));

  return (
    <div className={styles.builder} role="group" aria-labelledby={headingId}>
      <div className={styles.head}>
        <span className={styles.label} id={headingId}>
          {T.sort}
        </span>
        <div className={styles.quick}>
          <span className={styles.quickLabel} id={quickId}>
            {T.sortQuick}
          </span>
          <select
            aria-labelledby={quickId}
            className={controlClasses.input}
            value={preset ?? CUSTOM}
            onChange={(e) => {
              if (isSortKey(e.target.value)) actions.setSortPreset(e.target.value);
            }}
          >
            {preset == null && (
              <option value={CUSTOM} disabled>
                {T.sortCustom}
              </option>
            )}
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {T.sortOptions[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ol className={styles.levels} aria-label={T.sortLevels}>
        {spec.map((level, i) => {
          const n = i + 1;
          const dirText = T.sortDirs[level.field][level.dir];
          return (
            <li key={i} className={styles.level}>
              <span className={`${styles.index} num`} aria-hidden="true">
                {n}.
              </span>
              <select
                aria-label={T.sortFieldLabel(n)}
                className={`${controlClasses.input} ${styles.field}`}
                value={level.field}
                onChange={(e) => {
                  if (isSortField(e.target.value)) actions.setSortField(i, e.target.value);
                }}
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {T.sortFields[f]}
                  </option>
                ))}
              </select>
              <Button
                className={styles.dir}
                aria-label={T.sortDirLabel(n, dirText)}
                onClick={() => actions.toggleSortDir(i)}
              >
                <span aria-hidden="true">{level.dir === 'asc' ? '↑' : '↓'}</span> {dirText}
              </Button>
              <span className={styles.tools}>
                <Button
                  className={styles.icon}
                  aria-label={T.sortMoveUp(n)}
                  disabled={i === 0}
                  onClick={() => actions.moveSortLevel(i, -1)}
                >
                  <span aria-hidden="true">▲</span>
                </Button>
                <Button
                  className={styles.icon}
                  aria-label={T.sortMoveDown(n)}
                  disabled={i === spec.length - 1}
                  onClick={() => actions.moveSortLevel(i, 1)}
                >
                  <span aria-hidden="true">▼</span>
                </Button>
                <Button
                  className={styles.icon}
                  aria-label={T.sortRemove(n)}
                  disabled={spec.length <= 1}
                  onClick={() => actions.removeSortLevel(i)}
                >
                  <span aria-hidden="true">✕</span>
                </Button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className={styles.foot}>
        <Button disabled={spec.length >= MAX_SORT_LEVELS} onClick={actions.addSortLevel}>
          <span aria-hidden="true">+</span> {T.sortAdd}
        </Button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
