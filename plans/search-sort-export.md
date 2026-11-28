# Plan: Plan-type search, multi-level sort, Excel export of results

Status: **implemented** (phases 1–5; see "Implementation status" below) · Date: 2026-11-28 · Scope: three additions to the apartments page (`/`):

1. A **free-text search** by apartment type (plan type such as `T-T5A`, and sale type such as `AM`).
2. **Multi-level sorting**, for example "rooms, then floor from high to low".
3. **Export to Excel** of the current results: the filtered apartments, in the selected sort order.

---

## Implementation status (2026-11-28)

**Built** (phases 1–5)

- Sort engine: `src/domain/sort.ts` (`SortSpec`, `SORT_PRESETS`, `comparePlanType`, pure builder edits). The golden scenarios pass through `SORT_PRESETS` with unchanged expected ids.
- Search: `src/domain/search.ts`, and `Filters.typeQuery`, `setTypeQuery` and `typeQueryText` in the store.
- UI: `features/filters/SortBuilder.tsx`, `features/filters/TypeSearchInput.tsx`, and the sort summary plus the export button in `ApartmentList`.
- Export: `data/workbook/exportTable.ts` (engine), `exportColumns.ts` (shared columns), `exportApartments.ts` (results and "סינון" sheets), the generic `shared/ui/ExportButton.tsx`, and `domain/filterSummary.ts`. `exportMyList.ts` is now a thin wrapper and its tests pass unchanged.
- Tests: `search.test.ts`, `filterSummary.test.ts`, `exportTable.test.ts` and `exportApartments.test.ts` are new. `sort.test.ts`, `filters.test.ts`, `stores.test.ts` and `ApartmentsPage.test.tsx` are extended. A new e2e block in `e2e/app.spec.ts` covers search, sort, export and axe.

**Differences from the plan**

- The search input has a `<datalist>`, so its accessible role is **combobox**, not searchbox.
- Areas get **no** `0.00` format. That would have changed the My List file, which had to stay byte-for-byte the same.
- No bold header and no frozen panes: SheetJS Community Edition does not write cell styles or pane views. The autofilter is written.
- Phase 6 (click a plan-type tag to search, refresh the screenshots) was not done.

---

## 0. Current state (what we build on)

| Area | Where | Today |
|---|---|---|
| Filter model | `src/domain/filters.ts` | `Filters` has budget, rooms, floor, buildings, category, flags, storage, and a single `sort: SortKey`. `matches()` is a pure predicate. `applyFilters()` filters and then sorts. |
| Sort | `src/domain/sort.ts` | 7 fixed keys (`ppsqm`, `delta`, `priceA`, `priceD`, `area`, `floor`, `id`), each with a hard-coded direction. One comparator, stable `Array.sort`. |
| Store | `src/store/filtersStore.ts` | Zustand. Keeps `filters` plus the raw `inputs` text for the number fields. Not persisted, not in the URL. Every change resets paging (`visibleCount`). |
| UI | `src/features/filters/FiltersPanel.tsx` | A `<details>` grid of fields. Sort is a single `<select>`. |
| Consumers of `Filters` | `selectors.ts` (`useFilteredApartments`, `useMatchCountsByBuilding`), the site map, the elevation, the plan browser | Everything goes through `matches()`/`applyFilters()`, so a new filter field reaches the map counts and the elevation highlights automatically. |
| Export | `src/data/workbook/exportMyList.ts`, `src/features/my-list/ExportButton.tsx` | My List only. `buildExportTable` → `toXlsxBlob` (RTL, column widths, number formats) with a CSV fallback. SheetJS is loaded lazily (`loadXlsx`). |
| Golden tests | `src/domain/__tests__/golden.test.ts` + `fixtures/legacy-derived.json` | Filter scenarios use the legacy `sort` key names. **These must keep passing unchanged.** |

Data facts that shape the design (406 apartments):
- 32 distinct plan types, `T-<kind><rooms><letter>`: `T-T5.5F` (44), `T-T3H` (43), `T-T5G` (40) … `T-P6F` (1). Third letter: T regular, G garden, P penthouse.
- 13 sale types: `A`, `A*`, `AG`, `AM`, `B`, `BG`, `C`, `C*`, `C1`, `CG`, `D`, `P1`, `P2`.
- `rooms` holds half rooms (4.5, 5.5). `roomsBucket` is the coarse filter value.

---

## 1. Feature A: free-text search by apartment type

### 1.1 Behaviour
- One text field at the top of the filters panel, labelled "חיפוש לפי טיפוס דירה". Placeholder example: `T5A, P6, AM`.
- Matching is **case-insensitive** and **ignores `-`, spaces and dots in the code**, so `t5a`, `T-T5A` and `tt5a` all find `T-T5A`.
- **Plan type: substring match** on the normalised code. `T5` finds every regular 5-room type (`T-T5A`, `T-T5G`, `T-T5.5F` …). `P` alone finds all penthouses. `5.5` finds `T-T5.5F`, `T-G5.5J` and the others (dots are kept when the token contains a digit on both sides, see §1.2).
- **Sale type: exact match** (`AM` finds only `AM`, not `A`). A substring match would make `A` match `AM`, `AG` and `A*`, which is noise.
- **Several tokens**, separated by commas or spaces, are **OR**ed: `T5A, T6D` shows both types. The search is ANDed with all the other filters, as usual.
- Empty field = no restriction.
- Autocomplete: a `<datalist>` with the 32 plan types and 13 sale types, built from the dataset (so an uploaded workbook brings its own types).
- The live count in the summary, the map counts and the elevation all update as you type. With 406 rows no debounce is needed.

### 1.2 Domain (`src/domain/search.ts`, new)
```ts
export function normalizeCode(s: string): string;          // upper-case, drop '-', spaces; keep '.' only between digits
export function parseTypeQuery(text: string): string[];    // split on , ; whitespace → normalised, de-duplicated tokens
export function matchesTypeQuery(a: Apartment, tokens: readonly string[]): boolean;
export function typeSuggestions(apartments: readonly Apartment[]): { planTypes: string[]; saleTypes: string[] };
```
- `Filters` gains `typeQuery: readonly string[]` (parsed tokens, default `[]`). `matches()` gets one more line: `if (f.typeQuery.length && !matchesTypeQuery(a, f.typeQuery)) return false;`
- Normalised plan codes are computed once per apartment. Either cache them in a `WeakMap<Apartment, string>`, or add a `planCode` field in `dataset.ts`. Prefer the `WeakMap`, so `Apartment` and the golden fixtures stay unchanged.

### 1.3 Store and UI
- `FilterInputs` gains `typeQuery: string` (the raw text, so the field keeps exactly what was typed). Add a `setTypeQuery(text)` action that stores the text and the parsed tokens, and resets paging.
- `FiltersPanel`: a new `TypeSearchInput` (`type="search"`, `dir="ltr"` because the codes are Latin, with a clear button and `aria-describedby` pointing to a short hint).
- `reset()` also clears the search.
- Optional: clicking the plan-type tag on an `ApartmentCard` fills the search with that type ("show all of this type"). Nice to have, phase 4.

---

## 2. Feature B: multi-level sorting

### 2.1 Model
Replace the single key with an ordered list of levels:
```ts
// src/domain/sort.ts
export const SORT_FIELDS = ['pricePerSqm', 'delta', 'price', 'rooms', 'floor', 'area', 'outdoor',
                            'storageArea', 'building', 'number', 'planType'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDir = 'asc' | 'desc';
export interface SortLevel { field: SortField; dir: SortDir }
export type SortSpec = readonly SortLevel[];   // 1..MAX_SORT_LEVELS (4)
```
- `Filters.sort` becomes `SortSpec`. Default: `[{ field: 'pricePerSqm', dir: 'asc' }]`, which is the same as today's `ppsqm`.
- `comparatorFor(spec, buildingOrder)` chains the level comparators (`c1(a,b) || c2(a,b) || …`). `Array.sort` stays stable, so full ties keep workbook order, as today.
- **Nulls always go last, in both directions.** An unpriced apartment must not jump to the top when price is sorted descending. Implement with a `compareNullable(x, y, dir)` helper, instead of the current `nz(v, 1e9)` sentinels.
- `building` sorts by the dataset's display order (`dataset.buildings`), not alphabetically. `planType` sorts by the natural order of the code (kind, then rooms as a number, then letter).
- **Presets** keep the old quick choices and the golden tests:
  ```ts
  export const SORT_PRESETS: Record<SortKey, SortSpec> = {
    ppsqm:  [{ field: 'pricePerSqm', dir: 'asc' }],
    delta:  [{ field: 'delta', dir: 'asc' }],
    priceA: [{ field: 'price', dir: 'asc' }],
    priceD: [{ field: 'price', dir: 'desc' }],
    area:   [{ field: 'area', dir: 'desc' }],
    floor:  [{ field: 'floor', dir: 'desc' }],
    id:     [{ field: 'building', dir: 'asc' }, { field: 'number', dir: 'asc' }],
  };
  ```
  `golden.test.ts` changes only in `toFilters`: `sort: SORT_PRESETS[s.sort ?? 'ppsqm']`. The expected ids stay byte-for-byte the same. This is the acceptance test that the new engine is a superset of the old one.
- The user's example, "rooms, then floor from high to low", is `[{ field: 'rooms', dir: 'asc' }, { field: 'floor', dir: 'desc' }]`.

### 2.2 Store actions
`setSortPreset(key)`, `addSortLevel()` (adds the first field not already used, up to 4), `removeSortLevel(i)` (at least one level always stays), `setSortField(i, field)`, `toggleSortDir(i)`, `moveSortLevel(i, -1 | 1)`. Each one resets paging. A field can appear only once; choosing a field that is already used swaps the two levels.

### 2.3 UI: sort builder in the filters panel
```
מיון                                   [ מיון מהיר ▾ ]
 1. [ חדרים        ▾ ]  [ ↑ מהקטן לגדול ]   [▲][▼][✕]
 2. [ קומה         ▾ ]  [ ↓ מהגבוה לנמוך ]  [▲][▼][✕]
 [ + הוספת רמת מיון ]
```
- Each level is a row: field `<select>`, a direction toggle button whose label is spelled out per field (price "מהזול ליקר / מהיקר לזול", floor "מהנמוכה לגבוהה / מהגבוהה לנמוכה", generic "עולה / יורד"), move up/down, remove.
- "מיון מהיר" keeps the old presets. Picking one replaces all levels. When the current levels equal a preset, the dropdown shows it; otherwise it shows "מותאם אישית".
- The panel grid gives the sort builder a full-width row (`grid-column: 1 / -1`), because it is taller than the other fields.
- Accessibility: the rows form a list (`<ol>`); each button has an `aria-label` such as "העברת רמת מיון 2 למעלה"; a polite live region announces changes ("מיון: חדרים עולה, ואז קומה יורד"). The arrow icons are mirrored correctly in RTL (the up/down meaning does not mirror).
- On mobile the row wraps: the field select on the first line, the buttons on the second.
- The list header (`ApartmentList`) shows a short summary of the active sort under the title, so the order stays visible when the filters panel is collapsed.

### 2.4 Out of scope
- No click-to-sort on table headers: the list is cards, not a table.
- Persisting the sort (localStorage or URL) is not part of this plan; see §6.

---

## 3. Feature C: export results to Excel

### 3.1 Behaviour
- An "ייצוא לאקסל" button in the apartments list header, next to the count. It is disabled when there are 0 results.
- It exports **all matching apartments** (not only the 40 cards shown), in **the current sort order**.
- The file is `almogim-apartments-YYYY-MM-DD.xlsx`, as an RTL workbook:
  - Sheet "דירות": a row number column plus the same columns as the My List export (building, unit, floor, rooms, area, outdoor, kind, plan type, sale type, price, price per m², delta vs peers, category, storage no., storage floor, storage area, parking), and an extra "ברשימה שלי" column (✓ / empty). Header row bold, with an **autofilter** over the whole range, so the file can be filtered again in Excel. Number formats: price `#,##0`, delta `0.0%`, areas `0.00`.
  - Sheet "סינון": what produced this file (date, search text, every active filter in words, the sort levels, row count). That way a file shared later explains itself.
- If SheetJS fails to load, fall back to CSV, as My List does (the CSV holds only the main sheet).
- A toast confirms the download ("הקובץ נשמר: N דירות").

### 3.2 Refactor: one export engine for both exports
`exportMyList.ts` hard-codes column indexes (`COL_PRICE = 10`, …). Generalise it before adding a second export:

- `src/data/workbook/exportColumns.ts` (new): a column definition list:
  ```ts
  interface ExportColumn<R> { head: string; value: (row: R) => Cell; width?: number; format?: '#,##0' | '0.0%' | '0.00' }
  ```
  with the shared apartment columns defined once.
- `src/data/workbook/exportTable.ts` (new, taken from `exportMyList.ts`): `buildTable(columns, rows)`, `toCsv(table)`, `toXlsxBlob(XLSX, sheets[])`. It applies widths and formats from the column definitions, adds the autofilter (`ws['!autofilter'] = { ref }`) and supports several sheets.
- `exportMyList.ts` becomes a thin wrapper: priority column + shared columns + notes column. **Its output must not change.** The existing `exportMyList.test.ts` is the safety net.
- `src/data/workbook/exportApartments.ts` (new): `exportApartments(list, filters, myListIds, dataset, loadXlsx)` → `ExportedFile`. It also builds the "סינון" sheet from a pure `describeFilters(filters, dataset)` in `src/domain/filterSummary.ts` (also used by the sort summary in §2.3).
- `src/shared/ui/ExportButton` (moved from `features/my-list`, made generic): takes `build: () => Promise<ExportedFile | null>` and the toast texts. My List and the apartments list both use it.

Notes:
- Frozen header panes (`!freeze`/views) are **not written by SheetJS Community Edition**. Check this in a spike; if it is not supported, rely on the autofilter and leave freezing out. Do not add a second xlsx library for it.
- The bundle does not grow: SheetJS stays in its lazy chunk. `npm run size` must stay green.

---

## 4. Implementation phases

Each phase ends green on `typecheck`, `lint`, `test` and `e2e`, and can be merged on its own.

| # | Phase | Main files | Done when |
|---|---|---|---|
| 1 | **Sort engine** (domain only) | `domain/sort.ts`, `domain/filters.ts`, `store/filtersStore.ts` (`setSortPreset` keeps the current `<select>` working), `golden.test.ts` (`SORT_PRESETS` mapping), `sort.test.ts` | Golden scenarios unchanged; new tests for chaining, both directions, nulls last, `building` display order, `planType` natural order |
| 2 | **Sort builder UI** | `features/filters/SortBuilder.tsx` (+ CSS module), `FiltersPanel.tsx`, `i18n/he.ts` (field names, direction labels, a11y texts), `domain/filterSummary.ts`, `ApartmentList.tsx` (summary line) | Component tests: add, remove, reorder, toggle direction, preset ↔ "מותאם אישית"; axe clean in e2e |
| 3 | **Type search** | `domain/search.ts`, `domain/filters.ts`, `filtersStore.ts`, `features/filters/TypeSearchInput.tsx`, `he.ts` | Unit tests for normalisation, substring vs exact, OR tokens, empty query; component test typing `t5a` narrows the count; map counts follow |
| 4 | **Export refactor** | `exportColumns.ts`, `exportTable.ts`, `exportMyList.ts`, generic `ExportButton` | `exportMyList.test.ts` passes unchanged (same head, rows, formats) |
| 5 | **Results export** | `exportApartments.ts`, `ApartmentList.tsx` (button), `he.ts` | Unit test: rows follow filter and sort order, "ברשימה שלי" column, "סינון" sheet content, CSV fallback; e2e: filter + sort, click export, read the downloaded file with SheetJS and check the first rows |
| 6 | Polish (optional) | `ApartmentCard.tsx`, screenshots | Click a plan-type tag to search for it; refresh `fixtures/screenshots` (`scripts/capture-screenshots.mjs`) |

Order: 1 → 2 → 3 → 4 → 5. Phase 3 does not depend on 1 and 2 and can be done first if search matters more.

---

## 5. Testing summary

- **Unit (Vitest)**: `search.test.ts`, extended `sort.test.ts` and `filters.test.ts`, `filterSummary.test.ts`, `exportTable.test.ts`, `exportApartments.test.ts`. The golden master stays unchanged apart from the preset mapping.
- **Component (Testing Library)**: `FiltersPanel` search and sort builder, `ApartmentList` export button (with an injected `load` and `download`, as `ExportButton` does today).
- **E2E (Playwright)**: `e2e/app.spec.ts`: type `T6D` → every card shows `T-T6D`; build "rooms ↑, floor ↓" → the first cards are in that order; export → `page.waitForEvent('download')`, parse the file, compare with the visible order. Run axe on the panel with three sort levels open.
- **Manual**: RTL layout on mobile width, keyboard-only use of the sort builder, open the exported file in Excel and LibreOffice (RTL, formats, autofilter).

---

## 6. Open questions and possible follow-ups

1. **What counts as "apartment type" for the search?** The plan assumes plan type (`T-T5A`) **and** sale type (`AM`). Should Hebrew words also work (`גן`, `פנטהאוז`, `5 חדרים`)? That is easy to add as aliases in `parseTypeQuery`, but it overlaps with the existing flag and room chips.
2. **Export scope**: results only (as planned), or also a "my list only" toggle in the same dialog? Today My List has its own button.
3. **Keep filters and sort between visits?** Today they reset on reload. Options: localStorage (like My List), or URL query parameters (shareable links, and the floor-plan viewer already keeps its state in the URL). Recommended follow-up: put search and sort in the URL.
4. **Saved sort orders** ("my sort"), if a custom order is used often.
