# CLAUDE.md

Hebrew, right-to-left single-page app for choosing an apartment in the **Almogim Haifa** project
(lottery 2181, 406 apartments, 15 buildings). Static site with no backend: React 19 + TypeScript
(strict), Vite 8, Zustand, React Router, Radix UI, three.js (3D), SheetJS (xlsx). User-facing
docs are in [README.md](README.md); decisions are in [docs/adr](docs/adr); feature plans are in
[plans/](plans).

## Environment (this machine)

- Node is portable and **not on PATH**: prefix commands with
  `export PATH="/c/Users/pc/AppData/Local/nodejs-portable:$PATH";` (Git Bash), then use `npm` / `npx`.
- There is no Python, so `npm run data:export` does not work here. Write files with the editor tools
  instead of Python scripts.
- The user writes in Hebrew. Answer in the language they use, and keep code, comments and commits
  in English.

## Commands

| Task                                 | Command                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| Dev server (hot reload)              | `npm run dev` → http://localhost:5173                        |
| Build + serve the production build   | `npm run build && npx vite preview --port 4173 --strictPort` |
| Typecheck                            | `npm run typecheck`                                          |
| Lint / format                        | `npm run lint`, `npx prettier --check .`                     |
| Unit and component tests             | `npx vitest run` (or `npx vitest run path/to/file`)          |
| E2E (desktop + mobile Chromium, axe) | `npx playwright test` (reuses a server already on 4173)      |
| Bundle budget (after a build)        | `npm run size` (≤ 200 kB gzip initial JS)                    |
| Plan-model extraction from a PDF     | `npm run plans:model -- <planType>`                          |
| Build hand-measured plan models      | `npm run plans:measured [-- <planType>]`                     |
| Build plan models from 1:100 sheets  | `npm run plans:vector [-- <planType>]` (`--debug <type>`)    |

Before calling work done, run typecheck, lint, prettier, vitest and build, plus the relevant
Playwright specs. The full vitest run takes about 30 s (it is slower when the machine is loaded).
Mobile e2e can flake under parallel load; re-run the failures with `--workers=1` before treating
them as real.

## Architecture (ESLint enforces the layers)

```
app/        routing, layout, pages (ApartmentsPage, BuildingPlansPage)
features/   one folder per feature; other features import it only via its index.ts(x)
store/      Zustand: datasetStore, filtersStore, myListStore, uiStore; selectors.ts
domain/     pure TS, no React/DOM/three/xlsx and no imports from upper layers
data/       built-in data (apartments.data.ts, generated, do not edit by hand), workbook
            import/export (data/workbook), floor-plan manifest, plan models (data/plan-models)
shared/     UI primitives (Button, ExportButton, ChipGroup…), small libs (download, storage)
i18n/he.ts  ALL Hebrew text; it imports nothing
```

Rules that bite:

- No `!` non-null assertions outside tests. Use `?.` / `??`, regex named groups, or guards.
- `domain/` may not import `@/store|features|app|shared|data` or react/three/xlsx.
- Features import other features only through their index: `@/features/x`, not `@/features/x/y`.
- three.js and SheetJS are **lazy-loaded** (`features/viewer3d` chunk, `data/workbook/xlsx.ts`
  `loadXlsx`). Do not import them statically from the initial bundle.
- Every Hebrew string goes in `src/i18n/he.ts`.

## Key modules

- **Filters and sort:** `domain/filters.ts` (`Filters`, `matches`, `applyFilters`),
  `domain/sort.ts` (multi-level `SortSpec`, `SORT_PRESETS`, nulls always last),
  `domain/search.ts` (apartment-type search), `store/filtersStore.ts`.
  `useFilteredApartments()` in `store/selectors.ts` gives the matching apartments in display order.
  The site map's building click sets `filters.buildings`.
- **Excel export:**
  - `data/workbook/exportTable.ts`: the generic table → xlsx (RTL, widths, formats, autofilter),
    with a CSV fallback.
  - `exportColumns.ts`: the shared apartment columns.
  - `exportMyList.ts`: the My List file (its output must stay byte-identical to the legacy one).
  - `exportApartments.ts`: the results file with a "סינון" summary sheet.
  - The button is `shared/ui/ExportButton.tsx`.
- **3D viewer** (`features/viewer3d`, lazy):
  - `createApartmentScene.ts`: renderer, cameras, dollhouse / top / walk views.
  - `planModelScene.ts`: builds meshes from a `PlanModel`.
  - `apartmentModel.ts`: the schematic fallback when a plan type has no model.
  - Plan models are JSON in `src/data/plan-models/<planType>.json`, registered in
    `src/data/plan-models/index.ts`, and validated by the Zod schema in `domain/planModel.ts`.
  - Coordinates are in cm: +x is sheet right, +y is sheet down; walls and rooms are unions of
    `[x, y, w, h]` rectangles.
  - The tab UI is `features/apartment-detail/SchematicTab.tsx`.
- **Floor-plan sheets:** `resources/plans_rendered/<building>/*.webp` (rendered PDFs),
  `src/data/floor-plans/manifest.ts`. The source PDFs are in `resources/building_plans/`. Only
  `T-T5C` has a 1:50 unit sheet (D15); the others are 1:100 floor sheets.
- **Plan models:** every plan type of the dataset has one (a test enforces it).
  - `T-T5C` is hand-measured from its 1:50 sheet: `scripts/plans/measured/T-T5C.json` →
    `npm run plans:measured` (rooms carry the sheet's `dims` labels, ±3 cm).
  - All other types are traced from the 1:100 building sheets: `scripts/plans/vector-specs.json`
    → `npm run plans:vector` (`scripts/plans/extract-vector.mjs` + `scripts/plans/vector/`).
    The sheets have no layers and no text; walls are the black 1.8 / 1.44 pt strokes, traced at
    1 cm/px. A spec gives the sheet, one seed per room `[x, y, type, name]` in sheet pt, split
    lines between open-plan spaces, outdoor seeds (with an optional clip box and `'fill'` mode),
    and optional `entrance` / `cut` for doors drawn inside a wall line.
  - Workflow for a type: `npm run plans:vector -- --debug <type> [building page]` writes a
    region map with a pt grid and a table of regions (area, centre, box) to
    `node_modules/.cache/plans-debug/`; write the seeds; build; check `<type>-model.png` there.
    Identical layouts on other sheets are the same seeds shifted (or flipped).
  - Room sizes are calibrated: `T-T5C@D13` (a fixture, not shipped) traces the 1:50 plan on its
    1:100 sheet, and `models.test.ts` checks it against the 1:50 labels (±5 cm).
  - Furniture is placed automatically (`scripts/plans/vector/furnish.mjs`), for illustration.
  - A mamad is not always labelled as one: look for the thick concrete walls.

## graphify (code knowledge graph)

`graphify-out/` holds a [graphify](https://pypi.org/project/graphifyy/) graph of the code:
`graph.json` (≈1.1k symbols/files, ≈3.1k import/call/contains edges, grouped into communities),
`GRAPH_REPORT.md` (communities, god nodes, surprising links, suggested questions) and `graph.html`
(open in a browser). It is AST-only (`--code-only`): no LLM, no API key, nothing leaves the machine.
`.graphifyignore` keeps out `resources/`, `legacy/`, `fixtures/`, `public/` and generated data.
graphify is not installed globally; `npm run graph -- <cmd>` runs it via `uvx` (Python 3.12, pinned
version; Python 3.15 has no tree-sitter wheels).

Use it before grepping:

- For "where / how / what depends on" questions, first run
  `npm run graph -- query "<question>"` (add `--budget 1500` for more nodes), or
  `npm run graph -- explain "<symbol>"`, `npm run graph -- path "<A>" "<B>"`,
  `npm run graph -- affected "<symbol>"` (reverse dependencies, i.e. the blast radius of a change).
  These return a small scoped subgraph with file paths and line numbers; then open just those files.
- Read `graphify-out/GRAPH_REPORT.md` only for a broad architecture overview.
- The graph can be stale: it records the commit it was built from (see "Graph Freshness" in the
  report). After changing code, run `npm run graph:update` (incremental, seconds, no API cost) and
  include the updated `graphify-out/` files in the same commit.
- Full rebuild (e.g. after editing `.graphifyignore`):
  `npm run graph -- extract . --code-only --force && npm run graph -- cluster-only .`.
  Community names come from `graphify-out/.graphify_labels.json` (hand-written; communities
  that changed since are named after their hub file).

## Testing conventions

- Tests sit next to the code in `__tests__/`. Factories are in `src/test/factories.ts` (`row`,
  `dataset`); `src/test/renderApp.tsx` renders the whole app with a memory router.
- **Golden master:** `fixtures/legacy-derived.json` holds the legacy site's derived numbers and
  sort orders. `domain/__tests__/golden.test.ts` must keep passing, so do not change preset sort
  semantics.
- In jsdom an `<input list>` has the role `combobox`, and `Blob.text()` drops a UTF-8 BOM.
- E2E specs are in `e2e/app.spec.ts`. The Playwright webServer builds and serves on port 4173.

## Git

- The working branch is `react_migration`; `main` is the PR base. Commit only when asked.
