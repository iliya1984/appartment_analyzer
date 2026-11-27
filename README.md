# Almogim Haifa apartment picker (lottery 2181)

A Hebrew, right-to-left web app for choosing an apartment in the Almogim Haifa project: a clickable
site map, filters, price comparison with similar apartments, a schematic 3D view with a sun
simulation, and a personal priority list with Excel export.

Built with React 19, TypeScript (strict), Vite, Zustand, React Router and Radix UI. It is a static
site with no backend and works offline after the first load.

## Getting started

Requires Node.js 24+ (see `.nvmrc`).

```sh
npm install
npm run dev        # http://localhost:5173
```

| Script                               | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`                        | Dev server with hot reload                                            |
| `npm run build`                      | Typecheck + production build into `dist/`                             |
| `npm run preview`                    | Serve `dist/` on http://localhost:4173                                |
| `npm run typecheck`                  | TypeScript project check                                              |
| `npm run lint` / `lint:fix`          | ESLint (type-aware, accessibility, layer rules)                       |
| `npm run format` / `format:check`    | Prettier                                                              |
| `npm test` / `test:watch`            | Unit and component tests (Vitest, React Testing Library)              |
| `npm run test:coverage`              | Tests with coverage thresholds (85 % overall, 90 % for `domain/`)     |
| `npm run e2e`                        | Playwright end-to-end and axe tests (desktop and mobile Chromium)     |
| `npm run size`                       | Initial-JS budget check (≤ 200 kB gzip), after a build                |
| `npm run data:export -- <file.xlsx>` | Regenerate `src/data/apartments.data.ts` from the contractor workbook |
| `npm run fixtures:legacy`            | Regenerate the golden-master fixture from `legacy/`                   |

First-time Playwright setup: `npx playwright install chromium`.

## Architecture

Dependencies point downward only. ESLint's `no-restricted-imports` rule enforces this.

```
app/        routing, layout, providers, page composition
features/   one folder per feature; other features import only via its index.ts
store/      Zustand stores (dataset, filters, my list, ui) + selectors
domain/     pure TypeScript: types, dataset building, peer comparison, filters, sort,
            insights rules, solar math, schematic layout, formatting — no React, no DOM
data/       built-in data (apartments.data.ts), workbook import/export adapters
shared/     UI primitives, small libs; i18n/he.ts holds all Hebrew text
```

- **The URL holds the navigation state.** The views are `/`, `/my-list` and `/data`. Adding
  `?apt=A1-3&tab=insights|building|schematic` to any of them opens the apartment sheet, so links
  can be shared and Back closes the sheet.
- **The personal list is stored in `localStorage`** under the legacy key `almogim2181.v2`, in the
  legacy shape `{prio:[{id,note}], az:{id:deg}}`, so lists saved by the old site still load.
  Storage goes through a `MyListRepository` interface (`src/store/persistence`), so a server can
  be added later.
- **three.js and SheetJS are lazy-loaded:** they download only when the 3D tab opens or a workbook
  is imported or exported.
- **Insights** are small rule functions in `src/domain/insights.ts`. To add an insight, add a rule
  to `INSIGHT_RULES`.

Decisions are recorded in [`docs/adr`](docs/adr). The migration plan is in
[`plans/react-typescript-migration.md`](plans/react-typescript-migration.md).

## Updating the data

1. `pip install pandas openpyxl`
2. `npm run data:export -- path/to/Almogim_Prices.xlsx` rewrites `src/data/apartments.data.ts`.
   The row layout is unchanged, and `tsc` rejects malformed rows.
3. `npm test && npm run build`

Users can also load an updated workbook at runtime from the **נתונים** tab. It is kept in memory
only.

## Testing strategy

- **Golden master:** `scripts/generate-legacy-fixtures.mjs` runs the legacy site's own JavaScript
  and saves its output to `fixtures/legacy-derived.json`. Tests check that the new code reproduces
  every derived number, insight sentence, filter and sort result, layout and export row exactly.
- **Unit and component tests** cover every module and feature (`src/**/__tests__`).
- **End-to-end tests** (`e2e/`) cover:
  - navigation and filters
  - closing the sheet with Esc, Back or an outside click
  - opening and closing the 3D view 20 times without WebGL leaks
  - persistence across reloads, and pickup of a list saved by the legacy site
  - xlsx export and workbook upload
  - axe accessibility scans, the 360 px layout, and no requests to external hosts

## Hosting

`dist/` is a static site. Routes use the history API, so the host needs an SPA fallback to
`index.html`: on Netlify use `_redirects`, and on GitHub Pages copy `index.html` to `404.html`. To
build for a sub-path, set `BASE_PATH`, for example `BASE_PATH=/appartment_analyzer/ npm run build`.

## Legacy site

The original single-file site is kept in [`legacy/`](legacy) for side-by-side comparison until
sign-off. Open `legacy/index.html`; it needs internet access for its CDN libraries.

## Known gaps (unchanged from the original)

- 81 free-market apartments have no price in the workbook.
- There is no orientation or position-in-floor data, so the 3D layout is schematic and the
  orientation is chosen manually per apartment.
