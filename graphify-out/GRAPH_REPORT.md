# Graph Report - appartment_analyzer  (2026-11-28)

## Corpus Check
- 188 files · ~95,054 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 7)

## Summary
- 1082 nodes · 3146 edges · 46 communities (44 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eaedffe7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- he.ts
- Floor-plan sheets: manifest, browser, pan/zoom
- Workbook import/export (xlsx table, parse, My List)
- TypeScript config
- 3D viewer: plan-model meshes & schematic fallback
- Plan-model schema (Zod) & model registry tests
- ApartmentList.tsx
- Apartment detail navigation & sheet
- golden.test.ts
- sort.ts
- App-level component tests (renderApp)
- Domain types, dataset & comparison
- SchematicTab.tsx
- CI workflow
- Runtime dependencies
- Dev dependencies (tooling, testing, PDF)
- parseWorkbook.ts
- Zustand stores & actions (ui, dataset)
- package.json metadata, types, lint-staged
- npm scripts
- insights.ts
- Vector plan tracing: PDF parse & debug
- Plan-model extraction from PDF
- Plan build script
- Measured plan build & bundle-size check
- 3D scene: renderer, cameras, viewer component
- ESLint config & layer rules
- panZoom.test.ts
- Legacy golden-fixture generator
- Vector plan extraction entry
- Screenshot capture & Vite/Vitest config
- Automatic furniture placement
- Apartment
- ApartmentCard.tsx
- App shell: layout, header, chrome
- viewer3d.test.tsx
- apartmentModel.ts
- Legacy Python data export
- Plan-model registry (index.ts)
- capture-screenshots.mjs
- Content.tsx
- Prettier config
- Root tsconfig
- format.ts
- ProjectDataPage.tsx
- StarButton.tsx

## God Nodes (most connected - your core abstractions)
1. `he` - 50 edges
2. `Apartment` - 40 edges
3. `vitest` - 34 edges
4. `react` - 33 edges
5. `useFiltersStore` - 33 edges
6. `useDataset()` - 30 edges
7. `cx()` - 29 edges
8. `m2()` - 25 edges
9. `scripts` - 23 edges
10. `useUiStore` - 23 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `checkSpec()`  [EXTRACTED]
  scripts/plans/extract-vector.mjs → scripts/plans/build-measured.mjs
- `main()` --calls--> `buildModel()`  [EXTRACTED]
  scripts/plans/extract-vector.mjs → scripts/plans/build-measured.mjs
- `extractVector()` --calls--> `label()`  [EXTRACTED]
  scripts/plans/extract-vector.mjs → scripts/plans/extract-model.mjs
- `extractVector()` --calls--> `distance()`  [EXTRACTED]
  scripts/plans/extract-vector.mjs → scripts/plans/extract-model.mjs
- `extractVector()` --calls--> `furnish()`  [EXTRACTED]
  scripts/plans/extract-vector.mjs → scripts/plans/vector/furnish.mjs

## Import Cycles
- None detected.

## Communities (46 total, 2 thin omitted)

### Community 0 - "he.ts"
Cohesion: 0.07
Nodes (55): react-router, App(), ApartmentsPage(), BuildingPlansPage(), NotFoundPage(), Providers(), AppRoutes(), floorPlanManifest (+47 more)

### Community 1 - "Floor-plan sheets: manifest, browser, pan/zoom"
Cohesion: 0.09
Nodes (38): buildManifest(), generatedSchema, GeneratedSheets, pageSchema, point, SheetMap, sheetMapSchema, adjacentSheet() (+30 more)

### Community 2 - "Workbook import/export (xlsx table, parse, My List)"
Cohesion: 0.10
Nodes (36): buildResultsTable(), buildSummaryTable(), exportApartments(), isoDate(), apartmentColumns(), ApartmentValue, VALUES, buildExportTable() (+28 more)

### Community 3 - "TypeScript config"
Cohesion: 0.04
Nodes (43): compilerOptions, composite, lib, tsBuildInfoFile, types, exclude, extends, include (+35 more)

### Community 4 - "3D viewer: plan-model meshes & schematic fallback"
Cohesion: 0.13
Nodes (24): three@^0.187.0, three, PlanFurniture, PlanSide, apt(), addSplit(), boxGeo(), Bucket (+16 more)

### Community 5 - "Plan-model schema (Zod) & model registry tests"
Cohesion: 0.12
Nodes (24): COUNTED_TYPES, COUNTED, countedRooms(), dimsDeviation(), FurnitureKind, MIRROR_SIDE, ModelIssue, ModelMethod (+16 more)

### Community 6 - "ApartmentList.tsx"
Cohesion: 0.28
Nodes (9): xlsx, loadXlsx(), XlsxModule, ApartmentListProps, ExportButtonProps, downloadBlob(), ExportButton(), ExportButtonProps (+1 more)

### Community 7 - "Apartment detail navigation & sheet"
Cohesion: 0.16
Nodes (19): floorName(), ApartmentSheet(), SheetHeader(), ApartmentLinkProps, APT_PARAM, dropPlanParams(), PLAN_PARAMS, readSheetParams() (+11 more)

### Community 8 - "golden.test.ts"
Cohesion: 0.24
Nodes (5): dataset, legacy, LegacyFixture, legacyFixture(), LegacyUnit

### Community 9 - "sort.ts"
Cohesion: 0.06
Nodes (76): react, applyFilters(), CATEGORY_FILTERS, CategoryFilter, countByBuilding(), DEFAULT_FILTERS, Filters, FLAG_FILTERS (+68 more)

### Community 10 - "App-level component tests (renderApp)"
Cohesion: 0.19
Nodes (12): @testing-library/react, vitest, renderWithList(), useMyListStore, Toast, UiState, useUiStore, currentLocation (+4 more)

### Community 11 - "Domain types, dataset & comparison"
Cohesion: 0.12
Nodes (27): @testing-library/user-event, ComparableUnit, computePeerComparisons(), MIN_PLAN_GROUP, BaseUnit, buildDataset(), compareBuildingIds(), computeBuildingStats() (+19 more)

### Community 12 - "SchematicTab.tsx"
Cohesion: 0.06
Nodes (61): zustand, hasPlanModel(), loadPlanModel(), mod(), dirName(), DIRS, isOrientation(), Orientation (+53 more)

### Community 13 - "CI workflow"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, jobs, verify, name, on, pull_request (+15 more)

### Community 14 - "Runtime dependencies"
Cohesion: 0.09
Nodes (22): dependencies, @fontsource/assistant@^5.3.0, @fontsource/frank-ruhl-libre@^5.3.0, @radix-ui/react-dialog@^1.3.1, @radix-ui/react-direction@^1.2.0, @radix-ui/react-tabs@^1.2.1, @radix-ui/react-toggle@^1.2.1, @radix-ui/react-toggle-group@^1.2.1 (+14 more)

### Community 15 - "Dev dependencies (tooling, testing, PDF)"
Cohesion: 0.08
Nodes (24): devDependencies, eslint-import-resolver-typescript@^4.4.5, jsdom@^31.0.1, @napi-rs/canvas@^1.2.1, pdfjs-dist@^6.5.438, prettier@^3.10.1, @testing-library/dom@^10.4.2, @testing-library/react@^16.3.3 (+16 more)

### Community 16 - "parseWorkbook.ts"
Cohesion: 0.17
Nodes (15): zod@^4.6.7, zod, APARTMENTS_SHEET, coerceRow(), finite, num(), ParsedWorkbook, parseWorkbook() (+7 more)

### Community 17 - "Zustand stores & actions (ui, dataset)"
Cohesion: 0.18
Nodes (13): builtInDataset, InsightContext, BuildingStats, Dataset, HEADER, WorkbookUpload(), activate(), loadWorkbookRows() (+5 more)

### Community 18 - "package.json metadata, types, lint-staged"
Cohesion: 0.10
Nodes (20): description, eslint@^9.39.5, husky@^9.1.7, lint-staged@^17.6.2, @testing-library/jest-dom@^8.0.0, @types/react@^19.3.3, engines, node (+12 more)

### Community 19 - "npm scripts"
Cohesion: 0.09
Nodes (23): scripts, build, data:export, dev, e2e, fixtures:legacy, format, format:check (+15 more)

### Community 20 - "insights.ts"
Cohesion: 0.16
Nodes (15): bottomFloorRule(), DELTA_THRESHOLD, Insight, INSIGHT_RULES, InsightRule, InsightTone, LARGE_OUTDOOR_RATIO, outdoorRule() (+7 more)

### Community 21 - "Vector plan tracing: PDF parse & debug"
Cohesion: 0.19
Nodes (16): pdfjs-dist, debugType(), drawGrid(), renderBackground(), ROOT, anchorOf(), cache, CLASS (+8 more)

### Community 22 - "Plan-model extraction from PDF"
Cohesion: 0.20
Nodes (12): @napi-rs/canvas, distance(), extract(), Grid, label(), main(), renderMask(), ROOT (+4 more)

### Community 23 - "Plan build script"
Cohesion: 0.14
Nodes (14): CROP, GENERATED, main(), MAP_FILE, OUT_DIR, PDF_DIR, pdfFor(), pickAnchors() (+6 more)

### Community 24 - "Measured plan build & bundle-size check"
Cohesion: 0.15
Nodes (12): dist, html, initial, area(), buildModel(), checkSpec(), labelPoint(), main() (+4 more)

### Community 25 - "3D scene: renderer, cameras, viewer component"
Cohesion: 0.20
Nodes (13): PlanModel, ApartmentModel, ApartmentViewerProps, SceneHandle, SceneOptions, ViewMode, ApartmentViewer(), LazyViewer (+5 more)

### Community 26 - "ESLint config & layer rules"
Cohesion: 0.12
Nodes (14): @eslint/js@^9.39.5, eslint-plugin-import@^2.32.0, eslint-plugin-jsx-a11y@^6.10.2, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.8, globals@^17.14.0, typescript-eslint@^8.74.0, @eslint/js (+6 more)

### Community 27 - "panZoom.test.ts"
Cohesion: 0.31
Nodes (15): clampView(), fitScale(), fitView(), focusView(), MAX_ZOOM, panBy(), relativeZoom(), Size (+7 more)

### Community 28 - "Legacy golden-fixture generator"
Cohesion: 0.14
Nodes (11): app, bootAt, context, data, dest, elements, harness, html (+3 more)

### Community 29 - "Vector plan extraction entry"
Cohesion: 0.21
Nodes (13): rectangles(), checkImage(), DEBUG_DIR, extractVector(), HEIGHTS, main(), nb4(), OUT_DIR (+5 more)

### Community 30 - "Screenshot capture & Vite/Vitest config"
Cohesion: 0.29
Nodes (4): vite@^8.4.0, @vitejs/plugin-react@^6.3.0, vite, @vitejs/plugin-react

### Community 31 - "Automatic furniture placement"
Cohesion: 0.27
Nodes (12): along(), bboxOf(), behind(), furnish(), grow(), insideUnion(), largest(), OPP (+4 more)

### Community 32 - "Apartment"
Cohesion: 0.25
Nodes (7): ExportApartmentsInput, ListRow, Apartment, UnitsTableProps, ApartmentCardProps, UnitTileProps, MyListItemProps

### Community 33 - "ApartmentCard.tsx"
Cohesion: 0.33
Nodes (9): floorLabel(), m2(), ApartmentLink(), PlanLink(), ApartmentCard, MyListItem(), PlanIcon(), Tag() (+1 more)

### Community 34 - "App shell: layout, header, chrome"
Cohesion: 0.36
Nodes (8): AppLayout(), ScrollToTop(), Footer(), Notice(), Toaster(), Header(), countTarget(), useMyListCount()

### Community 35 - "viewer3d.test.tsx"
Cohesion: 0.18
Nodes (12): hitsWall(), startPoint(), applySun(), disposeModel(), LIGHT_SCALE, sunLighting(), ApartmentViewer(), isWebGLAvailable() (+4 more)

### Community 36 - "apartmentModel.ts"
Cohesion: 0.15
Nodes (19): r1(), ApartmentLayout, ASPECT, LAYOUT, LayoutCell, layoutFor(), layoutKey(), LayoutRoom (+11 more)

### Community 38 - "Plan-model registry (index.ts)"
Cohesion: 0.17
Nodes (10): files, MIRRORED, MODELLED, modelledPlanTypes(), planModelSchema, pt, rect, room (+2 more)

### Community 39 - "capture-screenshots.mjs"
Cohesion: 0.12
Nodes (8): HEADER, @axe-core/playwright@^4.14.1, @playwright/test@^1.65.1, @axe-core/playwright, @playwright/test, outDir, root, viewports

### Community 40 - "Content.tsx"
Cohesion: 0.31
Nodes (10): gaugePosition(), getInsights(), outdoorName(), InsightsTab(), PriceGauge(), Fact(), Facts(), Kpi() (+2 more)

### Community 41 - "Prettier config"
Cohesion: 0.40
Nodes (4): endOfLine, printWidth, singleQuote, trailingComma

### Community 43 - "format.ts"
Cohesion: 0.47
Nodes (8): categoryLabel(), kindLabel(), outdoorLabel(), pct(), storageLevelLabel(), CardTag, cardTags(), TagTone

### Community 44 - "ProjectDataPage.tsx"
Cohesion: 0.36
Nodes (8): fmt(), money(), getGaugeLabels(), getKpis(), BuildingsTable(), ProjectDataPage(), SourceInfo(), TableScroll()

### Community 45 - "StarButton.tsx"
Cohesion: 0.47
Nodes (3): StarIcon(), StarButton(), StarButtonProps

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `App-level component tests (renderApp)` to `Floor-plan sheets: manifest, browser, pan/zoom`, `Workbook import/export (xlsx table, parse, My List)`, `viewer3d.test.tsx`, `3D viewer: plan-model meshes & schematic fallback`, `Plan-model schema (Zod) & model registry tests`, `golden.test.ts`, `sort.ts`, `Domain types, dataset & comparison`, `format.ts`, `SchematicTab.tsx`, `Dev dependencies (tooling, testing, PDF)`, `parseWorkbook.ts`, `Zustand stores & actions (ui, dataset)`, `package.json metadata, types, lint-staged`, `insights.ts`, `panZoom.test.ts`, `Screenshot capture & Vite/Vitest config`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Should `he.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06798623063683305 - nodes in this community are weakly interconnected._
- **Why does `react` connect `sort.ts` to `he.ts`, `ApartmentCard.tsx`, `App shell: layout, header, chrome`, `Floor-plan sheets: manifest, browser, pan/zoom`, `ApartmentList.tsx`, `Apartment detail navigation & sheet`, `Content.tsx`, `App-level component tests (renderApp)`, `Domain types, dataset & comparison`, `SchematicTab.tsx`, `Runtime dependencies`, `Zustand stores & actions (ui, dataset)`, `package.json metadata, types, lint-staged`, `3D scene: renderer, cameras, viewer component`, `panZoom.test.ts`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `Floor-plan sheets: manifest, browser, pan/zoom` be split into smaller, more focused modules?**
  _Cohesion score 0.09438775510204081 - nodes in this community are weakly interconnected._
- **Why does `@napi-rs/canvas` connect `Plan-model extraction from PDF` to `Dev dependencies (tooling, testing, PDF)`, `package.json metadata, types, lint-staged`, `Vector plan tracing: PDF parse & debug`, `Plan build script`, `Vector plan extraction entry`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Workbook import/export (xlsx table, parse, My List)` be split into smaller, more focused modules?**
  _Cohesion score 0.09936575052854123 - nodes in this community are weakly interconnected._
- **Should `TypeScript config` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._