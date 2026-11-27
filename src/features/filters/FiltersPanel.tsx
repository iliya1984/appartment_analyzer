import { type ReactNode, useId } from 'react';
import { CATEGORY_FILTERS, FLAG_FILTERS, ROOM_FILTERS, type RoomsFilter } from '@/domain/filters';
import { isSortKey, SORT_KEYS } from '@/domain/sort';
import { he } from '@/i18n/he';
import { Button, controlClasses } from '@/shared/ui/Button';
import { ChipGroup, type ChipItem } from '@/shared/ui/ChipGroup';
import { type FilterInputs, useFiltersStore } from '@/store/filtersStore';
import { useDataset, useFilteredApartments } from '@/store/selectors';
import styles from './FiltersPanel.module.css';

const T = he.filters;

const ROOM_ITEMS: ChipItem<`${RoomsFilter}`>[] = ROOM_FILTERS.map((r) => ({
  value: `${r}`,
  label: T.roomOptions[r],
}));
const CATEGORY_ITEMS = CATEGORY_FILTERS.map((c) => ({
  value: c,
  label: c === 'all' ? T.categoryAll : c === 'target' ? he.common.target : he.common.free,
}));
const FLAG_ITEMS = FLAG_FILTERS.map((f) => ({ value: f, label: T.flagOptions[f] }));
const STORAGE_ITEMS: ChipItem<string>[] = [
  { value: 'קרקע', label: T.storageOptions.ground },
  { value: '-1', label: T.storageOptions.minus1 },
  { value: '-2', label: T.storageOptions.minus2 },
];

function Field({
  label,
  children,
}: {
  label: (id: string) => ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      {label(id)}
      {children(id)}
    </div>
  );
}

function NumberInput({
  field,
  placeholder,
  ariaLabel,
  min,
  step,
}: {
  field: keyof FilterInputs;
  placeholder: string;
  ariaLabel: string;
  min?: number;
  step?: number;
}) {
  const value = useFiltersStore((s) => s.inputs[field]);
  const setInput = useFiltersStore((s) => s.setInput);
  return (
    <input
      className={`${controlClasses.input} num`}
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      min={min}
      step={step}
      onChange={(e) => setInput(field, e.target.value)}
    />
  );
}

/** All filter fields, the sort order and reset; the summary shows the live match count. */
export function FiltersPanel() {
  const count = useFilteredApartments().length;
  const dataset = useDataset();
  const f = useFiltersStore((s) => s.filters);
  const actions = useFiltersStore.getState();
  const buildingItems = dataset.buildings.map((b) => ({ value: b, label: b }));
  const chipLabel = (text: string) => (id: string) => (
    <span className={styles.label} id={id}>
      {text}
    </span>
  );

  return (
    <details className={styles.filters} open>
      <summary>
        <span>{T.title}</span>
        <span className={`${styles.count} num`}>{T.count(count)}</span>
      </summary>
      <div className={styles.grid}>
        <div>
          <span className={styles.label}>{T.budget}</span>
          <div className={styles.pair}>
            <NumberInput
              field="budgetMin"
              placeholder={T.budgetMin}
              ariaLabel={T.budgetMinAria}
              min={0}
              step={50}
            />
            <NumberInput
              field="budgetMax"
              placeholder={T.budgetMax}
              ariaLabel={T.budgetMaxAria}
              min={0}
              step={50}
            />
          </div>
        </div>
        <Field label={chipLabel(T.rooms)}>
          {(id) => (
            <ChipGroup
              mode="multi"
              labelledBy={id}
              items={ROOM_ITEMS}
              selected={f.rooms.map((r) => `${r}` as const)}
              onToggle={(v) => actions.toggleRoom(Number(v) as RoomsFilter)}
            />
          )}
        </Field>
        <div>
          <span className={styles.label}>{T.floor}</span>
          <div className={styles.pair}>
            <NumberInput field="floorMin" placeholder={T.floorMin} ariaLabel={T.floorMin} />
            <NumberInput field="floorMax" placeholder={T.floorMax} ariaLabel={T.floorMax} />
          </div>
        </div>
        <Field label={chipLabel(T.building)}>
          {(id) => (
            <ChipGroup
              mode="multi"
              labelledBy={id}
              items={buildingItems}
              selected={f.buildings}
              onToggle={actions.toggleBuilding}
            />
          )}
        </Field>
        <Field label={chipLabel(T.category)}>
          {(id) => (
            <ChipGroup
              mode="single"
              labelledBy={id}
              items={CATEGORY_ITEMS}
              selected={f.category}
              onSelect={actions.setCategory}
            />
          )}
        </Field>
        <Field label={chipLabel(T.flags)}>
          {(id) => (
            <ChipGroup
              mode="multi"
              labelledBy={id}
              items={FLAG_ITEMS}
              selected={f.flags}
              onToggle={actions.toggleFlag}
            />
          )}
        </Field>
        <Field label={chipLabel(T.storage)}>
          {(id) => (
            <ChipGroup
              mode="multi"
              labelledBy={id}
              items={STORAGE_ITEMS}
              selected={f.storageFloors}
              onToggle={actions.toggleStorageFloor}
            />
          )}
        </Field>
        <Field
          label={(id) => (
            <label className={styles.label} htmlFor={id}>
              {T.sort}
            </label>
          )}
        >
          {(id) => (
            <select
              id={id}
              className={controlClasses.input}
              value={f.sort}
              onChange={(e) => {
                if (isSortKey(e.target.value)) actions.setSort(e.target.value);
              }}
            >
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {T.sortOptions[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className={styles.actions}>
        <Button onClick={actions.reset}>{T.reset}</Button>
      </div>
    </details>
  );
}
