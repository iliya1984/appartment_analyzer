# Migration plan: Almogim apartment picker → React + TypeScript

Status: proposed · Date: 2026-11-27 · Scope: full functional parity with the current `template.html`, rebuilt as a modular, typed, tested React application.

---

## 1. Goals and non-goals

**Goals**
- Same features and the same look as today's site. Parity comes first and new features come after (see §10).
- A codebase that is easy to extend: each feature has its own folder, the domain logic is pure and typed, and the UI is made of small components.
- Industry-standard tooling: strict TypeScript, linting, formatting, unit and end-to-end tests, CI, and reproducible builds.
- All libraries come from npm and are bundled, so the site works fully offline. Today, 3D and Excel need cdnjs.

**Non-goals (for this migration)**
- No backend and no new storage. Apartment data still comes from `data.js`, now as a typed module. The personal list stays in the browser's `localStorage`.
- No redesign and no new features.
- No integration with the Claude artifact runtime (`window.claude` `db` / `downloads`). See §8, decision D4.

---

## 2. Current state (what we are migrating)

| Area | Today | Location in `template.html` |
|---|---|---|
| Data | `RAW` tuple rows plus `META`, inlined by `build.py` | `data.js`, `derive()` / `mkUnit()` |
| Domain logic | group comparison (`delta`, `gRank`, …), building stats, solar math, schematic layout | `derive`, `solar`, `sunHours`, `layoutFor`, `LAYOUT` |
| Filters / sort | global mutable `F` object with Sets, `match()`, `SORTS` | lines ~394–415, 517–555 |
| Views | 3 `<main>` blocks toggled by `hidden` (Apartments, My list, Data) | `setView()` |
| Site map | image plus SVG hotspots (`SITE_PTS`) with match counts | `siteHTML`, `renderSite` |
| Elevation | floor-by-floor tiles when exactly one building is selected | `renderElev` |
| Cards | paginated list (40 at a time) | `cardHTML`, `renderCards` |
| Detail sheet | modal with 3 tabs: Insights, Building & floor, 3D schematic | `openDetail`, `renderIns`, `renderBld`, `render3D` |
| 3D viewer | imperative three.js r128 (global `THREE`), sun simulation | `makeViewer` |
| My list | ordered favourites with notes, orientation per apartment (`AZ`), Excel/CSV export | `PRIO`, `AZ`, `persist`, `exportXlsx` |
| Data view | source info, per-building table, upload of an updated workbook | `renderData`, `parseWorkbook`, `wireData` |
| Persistence | `localStorage['almogim2181.v2'] = { prio: [{id, note}], az: {[id]: deg} }`, plus optional Claude `db` | `initStore`, `persist` |
| Styling | ~200 lines of global CSS, CSS custom properties (`--bg --ink --muted --line --surface --surface2 --sea --sun --good --bad --warn`), 4 media queries, RTL | `<style>` |

Main problems: global mutable state, HTML built as strings with `innerHTML` (escaping is done by hand), event delegation tied to DOM ids, no types and no tests.

---

## 3. High-level technology spec

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript 5.x**, `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Catches the nullable price, ppsqm and delta cases at compile time |
| UI library | **React 19** | Standard choice with a large ecosystem |
| Build / dev server | **Vite** (React + TS template) | Fast, needs little configuration, outputs a static build |
| Package manager | **npm** with a committed `package-lock.json`; Node **LTS** pinned in `.nvmrc` and `engines` | Reproducible installs |
| Routing | **React Router** (library / "declarative" mode) | Deep links to views and to an apartment |
| State | **Zustand** (small stores) plus `useMemo` selectors; `persist` middleware for the personal list | Little boilerplate, works outside React (export, tests), no prop drilling |
| Accessible primitives | **Radix UI** primitives (`Dialog`, `Tabs`, `ToggleGroup`, `DirectionProvider`) | Focus trapping, keyboard support and RTL handled by the library instead of hand-written |
| Styling | **CSS Modules** plus one global `tokens.css` (the existing custom properties) and `global.css` | Reuses the current CSS almost verbatim, with styles scoped per component |
| 3D | **three** (npm, current release) plus `@types/three`, wrapped in a React component, lazy-loaded | Bundled and offline; kept out of the main bundle |
| Excel | **SheetJS `xlsx` 0.20.x from the official SheetJS CDN tarball** (`npm i https://cdn.sheetjs.com/xlsx-0.20.x/xlsx-0.20.x.tgz`), lazy-loaded | The npm-registry 0.18.5 is unmaintained and has known CVEs (prototype pollution, ReDoS) |
| Runtime validation | **Zod** | Validates uploaded workbooks and data loaded from `localStorage` |
| Text | All Hebrew UI strings in `src/i18n/he.ts` (typed object) | One place to edit wording; a later move to `react-i18next` is mechanical |
| Unit / component tests | **Vitest** plus **React Testing Library** plus `@testing-library/user-event`, jsdom | Shares configuration with Vite |
| End-to-end tests | **Playwright** (Chromium, plus a mobile viewport) | Smoke tests of the main flows, and parity checks |
| Lint / format | **ESLint** flat config: `typescript-eslint` (strict-type-checked), `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`; **Prettier** | Consistency and accessibility checks |
| Git hooks | **husky** plus **lint-staged** (lint and format staged files) | Keeps `main` clean |
| CI | **GitHub Actions**: install → typecheck → lint → unit tests → build → Playwright | Every PR is verified |
| Hosting | Any static host (GitHub Pages / Netlify / Cloudflare Pages). `dist/` is the artifact | No server needed |

Browser support: the last 2 versions of evergreen browsers, plus iOS Safari 16+ (the site is used on phones).
---

## 4. Target architecture

### 4.1 Layers (dependencies point downward only)

```
 app/        routing, layout, providers (composition only)
   │
 features/   one folder per user-facing feature (UI + feature hooks)
   │
 store/      Zustand stores: dataset, filters, my-list, ui
   │
 domain/     pure TypeScript: types, derive, filters, sort, insights, solar, layout, format
   │
 data/       raw data module, workbook import/export adapters
```

Rules:
- `domain/` has **no React and no DOM**: plain functions that are fully unit-tested. This is where most future logic goes.
- A feature may import from `shared/`, `store/` and `domain/`, but **not from another feature's internals**. Each feature exposes its public parts through its `index.ts`.
- Side-effecting adapters (localStorage, file download, xlsx, three.js) sit behind small interfaces so they can be replaced later (for example by a backend).

### 4.2 Folder structure

```
/
├─ legacy/                      # current site, kept until parity sign-off (moved, unchanged)
│  ├─ template.html  index.html  data.js  build.py  site.jpg
├─ scripts/
│  └─ export_data.py            # updated to emit src/data/apartments.data.ts (see §5.1)
├─ public/
│  └─ site.jpg
├─ src/
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx                # providers + router
│  │  ├─ routes.tsx
│  │  ├─ AppLayout.tsx          # header, tabs, notice, footer, <Outlet/>, detail sheet host
│  │  └─ providers.tsx          # Radix DirectionProvider(rtl), Toast provider
│  ├─ data/
│  │  ├─ apartments.data.ts     # RAW + META (was data.js), typed
│  │  ├─ workbook/
│  │  │  ├─ parseWorkbook.ts    # xlsx → RawRow[] (+ Zod validation, bad-row report)
│  │  │  └─ exportMyList.ts     # my list → xlsx Blob (CSV fallback)
│  │  └─ site-map.config.ts     # SITE_PTS, SITE_W, SITE_H
│  ├─ domain/
│  │  ├─ types.ts               # RawRow, Apartment, BuildingStats, Dataset, Filters, …
│  │  ├─ dataset.ts             # buildDataset(rows, meta): Dataset   (was derive/mkUnit)
│  │  ├─ comparison.ts          # peer-group stats (gKey, delta, gRank…)
│  │  ├─ filters.ts             # matches(unit, filters, dataset), defaultFilters
│  │  ├─ sort.ts                # SORTERS, SortKey
│  │  ├─ insights.ts            # getInsights(unit, dataset): Insight[]   (was inside renderIns)
│  │  ├─ solar.ts               # solarPosition, sunHours, SEASONS
│  │  ├─ schematic.ts           # LAYOUT, ROOM_COLOR, layoutFor
│  │  ├─ orientation.ts         # DIRS, dirName
│  │  ├─ format.ts              # fmt, money, pct, m2, floorLabel
│  │  └─ __tests__/…
│  ├─ store/
│  │  ├─ datasetStore.ts        # current Dataset, source ('built-in' | filename), load/reset
│  │  ├─ filtersStore.ts        # Filters + actions (toggleRoom, pickBuilding, reset…)
│  │  ├─ myListStore.ts         # entries [{id, note}], orientation {id: deg}; persisted
│  │  └─ selectors.ts           # useFilteredApartments, useMatchCountsByBuilding, …
│  ├─ features/
│  │  ├─ site-map/              # SiteMap.tsx, BuildingHotspot.tsx, SiteMap.module.css
│  │  ├─ elevation/             # BuildingElevation.tsx, UnitTile.tsx
│  │  ├─ filters/               # FiltersPanel.tsx, BudgetRange.tsx, FloorRange.tsx, SortSelect.tsx
│  │  ├─ apartment-list/        # ApartmentList.tsx, ApartmentCard.tsx, useLoadMore.ts
│  │  ├─ apartment-detail/
│  │  │  ├─ ApartmentSheet.tsx  # Radix Dialog, driven by ?apt=&tab=
│  │  │  ├─ InsightsTab.tsx  PriceGauge.tsx  FactsGrid.tsx
│  │  │  ├─ BuildingTab.tsx  UnitsTable.tsx
│  │  │  └─ SchematicTab.tsx  SunControls.tsx  RoomsTable.tsx
│  │  ├─ viewer3d/
│  │  │  ├─ createApartmentScene.ts   # imperative three.js (ported makeViewer), typed
│  │  │  ├─ ApartmentViewer.tsx       # React wrapper: ref + useEffect lifecycle
│  │  │  └─ index.ts                  # lazy export
│  │  ├─ my-list/               # MyListPage.tsx, MyListItem.tsx, ExportButton.tsx
│  │  └─ project-data/          # ProjectDataPage.tsx, SourceInfo.tsx, WorkbookUpload.tsx, BuildingsTable.tsx
│  ├─ shared/
│  │  ├─ ui/                    # Chip, ChipGroup, Button, IconButton, StarButton, Tag, Table, Kpi, Notice, EmptyState
│  │  ├─ hooks/                 # useDebouncedValue, useMediaQuery
│  │  ├─ lib/                   # download.ts (Blob → file), storage.ts (safe localStorage)
│  │  └─ icons/                 # StarIcon.tsx
│  ├─ i18n/he.ts
│  └─ styles/
│     ├─ tokens.css             # :root custom properties (copied from the current CSS)
│     └─ global.css             # reset, body, typography, .num, RTL defaults
├─ e2e/                         # Playwright specs
├─ index.html                   # <html lang="he" dir="rtl">
├─ vite.config.ts  vitest.config.ts  playwright.config.ts
├─ tsconfig.json  tsconfig.app.json  tsconfig.node.json
├─ eslint.config.js  .prettierrc  .editorconfig  .nvmrc
└─ .github/workflows/ci.yml
```

### 4.3 Routing (URL is the source of truth for navigation)

| URL | View |
|---|---|
| `/` | Apartments: map, elevation, filters, list |
| `/my-list` | My list |
| `/data` | Project data |
| any of the above `?apt=A1-3&tab=insights\|building\|schematic` | Apartment sheet opened over the current view |

- The sheet is driven by search params. Back closes it, and a link to an apartment can be shared.
- Filters stay in a store for now. Syncing them to the URL is listed as a future extension in §10. They are kept out of the URL now so it stays readable while the filter model is still changing.
- Static hosting needs an SPA fallback (`404.html` copy on GitHub Pages, `_redirects` on Netlify). If that is not possible, use `createHashRouter`. This is a one-line switch.

---

## 5. Domain model and state

### 5.1 Data module (keeps `data.js` as the source, no new storage)

`data.js` becomes `src/data/apartments.data.ts`:

```ts
import type { RawRow, ProjectMeta } from '@/domain/types';
export const RAW: readonly RawRow[] = [ /* unchanged rows */ ];
export const META: ProjectMeta = { dev: '…', lottery: 2181, base: …, file: '…' };
```

- The first conversion is mechanical: add the imports, the `export` keyword and the type annotations.
- `export_data.py` is updated to write this file instead of `data.js`, using the same tuple format so the diff stays minimal. A CI check runs `tsc`, which rejects malformed rows.

### 5.2 Core types (`domain/types.ts`)

```ts
/** [building, plot, unitNo, planType, saleType, floor, rooms, area, outdoor, storageArea,
 *  parking, isTarget(1|0), price|null, storageNo, storageFloor] */
export type RawRow = readonly [string, number, number, string, string, number, number, number,
  number, number, number, 0 | 1, number | null, string, string];

export type ApartmentKind = 'T' | 'G' | 'P';            // regular | garden | penthouse
export type PriceCategory = 'target' | 'free';
export type StorageFloor = 'קרקע' | `${number}`;

export interface Storage { no: string; area: number; floor: StorageFloor; sub: '' | 'עליון' | 'תחתון' }

export interface PeerComparison {          // only for priced units
  key: string; label: string; mean: number; delta: number;
  rank: number; size: number; min: number; max: number; meanOutdoor: number;
}

export interface Apartment {
  id: string; building: string; plot: number; number: number; planType: string; saleType: string;
  floor: number; rooms: number; roomsBucket: 3 | 4 | 5 | 6; area: number; outdoor: number;
  kind: ApartmentKind; parking: number; category: PriceCategory;
  price: number | null; pricePerSqm: number | null;
  storage: Storage; isTopFloor: boolean; isBottomFloor: boolean;
  comparison: PeerComparison | null;
}

export interface BuildingStats { id: string; units: number; plot: number; floorMin: number; floorMax: number;
  targetUnits: number; avgArea: number; priceMin: number | null; priceMax: number | null; avgStorageArea: number }

export interface Dataset {
  meta: ProjectMeta; apartments: readonly Apartment[];
  byId: ReadonlyMap<string, Apartment>; buildings: readonly string[];
  buildingStats: ReadonlyMap<string, BuildingStats>;
}
```

Notes:
- The cryptic field names (`b`, `f`, `rk`, `gN`) get descriptive names. The peer-group fields are grouped into one `comparison` object that is `null` when the apartment has no price. This replaces today's implicit `undefined`.
- `buildDataset()` is **pure and immutable**. Today's `derive()` mutates units in place.

### 5.3 Stores

| Store | State | Persisted | Notes |
|---|---|---|---|
| `datasetStore` | `dataset`, `source: 'built-in' \| { fileName }` | no | `loadRows(rows, source)`, `resetToBuiltIn()`. On load, it clears filters and drops list entries whose id no longer exists. |
| `filtersStore` | `Filters` (budget min/max, rooms[], floor min/max, buildings[], category, flags[], storageFloors[], sort), `visibleCount` | no | Arrays instead of Sets, so state updates stay immutable. Any filter change resets `visibleCount` to 40. `pickBuilding` toggles a single selection, as today. |
| `myListStore` | `entries: {id, note}[]`, `orientation: Record<id, 0\|45\|…\|315>` | **yes**, `localStorage` | Actions: toggle, move(i, ±1), remove, setNote, setOrientation. |
| `uiStore` (optional) | notice dismissed, toast queue | notice only | — |

**Persistence compatibility:** existing users have data under `almogim2181.v2` in the shape `{prio, az}`. Use Zustand `persist` with a **custom `storage` adapter** that reads and writes exactly that shape under the same key, validated with Zod. Invalid content is ignored, not thrown. Writes are debounced (500 ms), as today. All storage access goes through a `MyListRepository` interface:

```ts
export interface MyListRepository { load(): Promise<MyListSnapshot | null>; save(s: MyListSnapshot): Promise<void> }
```

The only implementation now is `LocalStorageMyListRepository`. A server implementation can be added later without touching the UI.

**Derived data:** selectors such as `useFilteredApartments()`, `useMatchCountsByBuilding()` and `useIsInMyList(id)` compute results with `useMemo` and `useShallow`. With 406 rows no virtualization is needed.

---

## 6. Component design highlights

- **Component tree**
  - `AppLayout`
    - `Header` (stats and tabs, with the my-list count badge)
    - `Notice`
    - `<Outlet/>`
    - `Footer`
    - `ApartmentSheet` (mounted once and opened from the URL)
    - `Toaster`
- **SiteMap**: `<img>` plus an SVG overlay. Each `BuildingHotspot` is a focusable `<g role="button">` with Enter/Space handling and an `aria-label` that includes the match count. The initial horizontal centering on narrow screens moves into a `useLayoutEffect`.
- **ChipGroup**: one generic component, `ChipGroup<K extends string | number>({ items, selected, onToggle, mode: 'single' | 'multi' })`, built on Radix `ToggleGroup`. It replaces the 5 hand-wired chip groups.
- **ApartmentCard**: a semantic `<article>`. The whole card is clickable through a stretched link (`<Link to="?apt=…">`), and the star button sits on top of it. This removes the `stopPropagation` workarounds.
- **ApartmentSheet**: a Radix `Dialog` provides the focus trap, Esc to close, scroll lock and outside-click handling, replacing the hand-written versions. A Radix `Tabs` drives the `tab` search param.
- **InsightsTab**: renders the result of the pure `getInsights()`. The rule logic (cheaper or more expensive than peers, lowest floor of the plan, storage below average, top floor, …) becomes a list of small, individually tested rule functions. New insights are added there without touching JSX.
- **SchematicTab / ApartmentViewer**:
  - Port `makeViewer` into `createApartmentScene(host, apartment, orientation)`. It returns a typed handle `{ setSun, setAutoRotate, setLabels, dispose }`.
  - `ApartmentViewer` creates the scene in `useEffect` and calls `dispose` in the cleanup. This also covers React StrictMode's double mount in development.
  - Sun controls (season, hour, presets) are React state and call `handle.setSun` in an effect.
  - Loaded with `React.lazy` plus `Suspense`, so three.js is downloaded only when the tab opens.
  - Keep the "WebGL unavailable" fallback.
- **MyListPage**: reorder with ▲/▼ buttons, as today. Accessible drag and drop (`@dnd-kit`) is a future option. The notes `<textarea>` is controlled locally and saved with a debounce.
- **Export / Upload**: `xlsx` is loaded with `await import('xlsx')`. `download.ts` saves the Blob with `URL.createObjectURL` and an `<a download>`, replacing the `window.claude.downloads` and clipboard fallbacks.
- **Text and RTL**: `<html dir="rtl" lang="he">`. Styles use CSS logical properties (`margin-inline-start`, `inset-inline-start`); today's code already uses some. The current Unicode isolation marks in `pct()` and `floorLabel()` are kept.

---

## 7. Engineering standards

- **TypeScript**: strict, no `any` (lint error), and `import type` for type-only imports. Path alias `@/` → `src/`.
- **Components**: function components, named exports, one component per file, props typed with `interface`. A component's CSS module, test and (optionally) story sit next to it.
- **Hooks**: rules-of-hooks enforced by lint. No data fetching in components; components read state through stores and selectors.
- **No `dangerouslySetInnerHTML`**. All text is rendered as React text, so `esc()` is no longer needed.
- **Accessibility**: `jsx-a11y` lint; every interactive element can be reached and operated with the keyboard; visible focus; Playwright runs `@axe-core/playwright` on each view.
- **Testing targets**: `domain/` ≥ 90 % line coverage. Every feature has at least one RTL test of its main interaction. E2E covers the flows in §9.
- **Commits / PRs**: one PR per phase (or per feature within phase 3), small and reviewable, and CI must be green before merging.
- **Docs**: `README.md` rewritten (setup, scripts, architecture summary, data update procedure). Architecture decisions recorded as short ADRs in `docs/adr/`.

npm scripts:

```
dev | build | preview | typecheck | lint | lint:fix | format | test | test:watch | test:coverage | e2e | data:export
```

---

## 8. Decisions and risks

| # | Decision / risk | Resolution |
|---|---|---|
| D1 | Where the new app lives | Vite app at the repo root; the old site moves to `legacy/` and stays runnable (`legacy/index.html`) for side-by-side comparison, then is deleted after sign-off. |
| D2 | Data source | `data.js` → typed `apartments.data.ts`, same tuple format. No database or API. Runtime workbook upload keeps working (in memory only, as today). |
| D3 | Personal list storage | `localStorage`, same key and shape (`almogim2181.v2`), so existing users keep their list. |
| D4 | Claude artifact `db` / `downloads` integration | **Dropped.** The React app is hosted as a normal static site. The repository interface (§5.3) leaves room to add server-side sync later. |
| D5 | three.js upgrade r128 → current | Risk: light intensity defaults, colour management and shadow defaults changed (notably r152 and r155). Plan: port the scene, then tune intensities and `renderer.outputColorSpace` until screenshots match legacy. Fallback: pin `three@0.128` temporarily and upgrade in a follow-up PR. |
| D6 | SheetJS source | Install from `cdn.sheetjs.com` (vendor's supported channel), pinned version, lockfile integrity hash. Do **not** use registry 0.18.5. |
| D7 | Filter state in URL | Deferred (see §10). Store-only for now. |
| R1 | Visual drift during CSS split | Copy the CSS verbatim first (one global file), then move rules into modules feature by feature, with Playwright screenshot comparisons against legacy. |
| R2 | Subtle logic regressions in `derive` / insights | Golden tests: before porting, capture the legacy outputs (every apartment's `delta`, `gRank`, `gLabel`, insights text) as a JSON fixture. The new `buildDataset` / `getInsights` must match it exactly. |
| R3 | Bundle size | Lazy-load `three` and `xlsx`. Budget: initial JS ≤ 200 kB gzip, enforced in CI with a size check. |

---

## 9. Phased execution plan

Each phase ends with a merged PR and green CI. Estimates are focused working time.

### Phase 0: Baseline and safety net (½ day)
1. Create the branch `feat/react-migration`. Move the current site into `legacy/` (`git mv`, so history is kept).
2. Write a small Node script that runs the legacy `derive()` and insight logic on `RAW` and saves `fixtures/legacy-derived.json` (per-apartment computed fields and insight titles). This becomes the golden master (R2).
3. Take Playwright screenshots of legacy: the 3 views, an open sheet on each tab, and mobile and desktop widths.

**Done when:** the legacy site is still runnable from `legacy/`, and the fixtures and screenshots are committed.

### Phase 1: Project scaffold and tooling (½ day)
1. `npm create vite@latest` (react-ts). Add the TS strict settings, the `@/` alias, ESLint, Prettier, husky, lint-staged, Vitest, RTL, Playwright, `.nvmrc` and `.editorconfig`.
2. Add the GitHub Actions CI workflow (typecheck, lint, test, build, e2e).
3. `index.html` with `lang="he" dir="rtl"`, the fonts and meta viewport from the legacy page. Copy `site.jpg` into `public/`.
4. Copy the legacy CSS verbatim into `styles/tokens.css` and `styles/global.css`.

**Done when:** `npm run dev` shows an empty RTL shell, and CI passes on the PR.

### Phase 2: Domain layer, test-first (1 day)
1. `domain/types.ts` and `data/apartments.data.ts` (converted from `data.js`). Update `scripts/export_data.py` to emit the TS module.
2. Port these files to pure typed functions:
   - `format.ts`, `orientation.ts`, `solar.ts`, `schematic.ts`
   - `dataset.ts` and `comparison.ts`
   - `filters.ts`, `sort.ts`
   - `insights.ts`
3. Unit tests for each file, plus the golden-master test against `fixtures/legacy-derived.json`.
4. `data/workbook/parseWorkbook.ts` with Zod validation, tested with a small sample `.xlsx` fixture (valid, invalid header, and rows with errors).

**Done when:** domain coverage is ≥ 90 % and the golden master matches exactly.

### Phase 3: State and application shell (½ day)
1. `datasetStore`, `filtersStore`, `myListStore` (with the legacy-compatible persistence adapter and Zod), and the selectors.
2. Router, `AppLayout`, `Header` with tabs and the list badge, `Notice`, `Footer`, `Toaster`.
3. Shared UI primitives: `Button`, `Chip`, `ChipGroup`, `Tag`, `Table`, `Kpi`, `EmptyState`, `StarButton`.

**Done when:** you can move between the three routes, and a list saved by the legacy site in the same browser loads correctly (tested).

### Phase 4: Apartments view (1 day)
1. `FiltersPanel` with all filter fields and sort, plus reset.
2. `SiteMap`, including match counts, the single-building toggle and keyboard support.
3. `BuildingElevation` (tiles, matched and favourite states, legend).
4. `ApartmentList` and `ApartmentCard` with "show more" in steps of 40.

**Done when:** for a set of filter combinations, the counts and order match legacy (an e2e test that compares against the legacy page).

### Phase 5: Apartment sheet (1 day)
1. `ApartmentSheet`: the Dialog, URL-driven open and tab, and the star toggle.
2. `InsightsTab` (KPIs, gauge, insights, facts).
3. `BuildingTab` (highlighted map, building facts, the same-floor and same-plan tables, rows that navigate to another apartment).
4. `SchematicTab` and `viewer3d`: the scene port, the React wrapper, the orientation select (saved to `myListStore`), sun controls, the auto-rotate and labels toggles, the rooms table, and the lazy loading.

**Done when:** all three tabs reach visual parity, there is no WebGL context leak after opening and closing the sheet 20 times (checked in an e2e test through `renderer.info`/memory), and Esc, Back and outside-click all close the sheet.

### Phase 6: My list and Project data (½ day)
1. `MyListPage`: rank, move, remove, notes, open apartment, and an empty state.
2. `exportMyList` (xlsx with RTL sheet, column widths, number formats, and CSV fallback) and `download.ts`.
3. `ProjectDataPage`: source info, buildings table, and workbook upload and reset with result messages.

**Done when:** the exported file opens in Excel with the same columns and formats as legacy, and upload and reset behave as in legacy.

### Phase 7: Hardening and cut-over (½–1 day)
1. Accessibility pass: axe in e2e on all views, plus a manual keyboard-only run-through.
2. Visual comparison against the Phase 0 screenshots, then fix the differences.
3. Performance: check the bundle budget, and Lighthouse (mobile) ≥ 90 for Performance and Accessibility.
4. Rewrite the README and add the ADRs (D1–D6). Set up deployment to the chosen static host.
5. After sign-off: delete `legacy/` and `fixtures/legacy-*` (or keep the fixtures as regression data).

**Total estimate: about 5–6 working days.**

### Parity checklist (used for sign-off)
- [ ] Header stats: lottery, number of apartments, number of buildings, number at target price
- [ ] Dismissible info notice
- [ ] Map hotspots: count badge, dimmed state, selection, single-building toggle, keyboard
- [ ] Elevation grid appears only when exactly one building is selected
- [ ] All 8 filter fields, 7 sort orders, reset, live count, "show more"
- [ ] Card: tags (category, kind, outdoor, storage, delta coloured at ±3 %, or "price not published")
- [ ] Sheet: title and subtitle, star, three tabs, Esc and outside-click close
- [ ] Insights: KPIs, gauge position, every insight rule, facts grid
- [ ] Building tab: highlighted map, facts, both tables, row click navigates
- [ ] Schematic tab: disclaimer, orientation persisted per apartment, sun presets, slider, seasons, readout, sun-hours estimate, auto-rotate, labels, rooms table, WebGL fallback
- [ ] My list: badge count, reorder, remove, notes persisted, open apartment, empty state
- [ ] Export to xlsx (RTL, formats); CSV fallback
- [ ] Data view: source text, buildings table, upload with skipped-rows report, reset to built-in
- [ ] Existing `localStorage` list is picked up
- [ ] Works offline after first load (no CDN dependencies)
- [ ] Mobile layout at 360 px width

---

## 10. Future extensions this structure enables

- **Filters in the URL** (shareable searches): serialize `Filters` with a Zod schema to search params.
- **Server-side sync / accounts**: a new `MyListRepository` implementation, with no UI changes.
- **Real floor plans and orientation data**: extend `RawRow` / `Apartment` and add a `floor-plans` feature. `schematic.ts` stays as the fallback.
- **Multiple projects or lotteries**: `Dataset` already bundles its `meta`, so a project selector only needs to switch which dataset is loaded.
- **Comparison view** (2–4 apartments side by side): a new feature that reuses the domain selectors.
- **Localization** (English, Russian, Arabic): move `he.ts` to `react-i18next` resources.
- **PWA / installable offline app**: add `vite-plugin-pwa`.
