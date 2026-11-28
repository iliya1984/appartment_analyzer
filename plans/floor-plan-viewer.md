# Plan: Floor-plan and building-plan viewer

Status: **implemented** (phases 1–5; see §0) · Date: 2026-11-27, updated 2026-11-28 · Scope: show the contractor's real sales plans (תוכניות מכר) for every apartment, plus a browsable set of plans for each building. The 3D side is a separate plan: [apartment-3d-visualization.md](apartment-3d-visualization.md).

---

## 0. Implementation status (2026-11-28)

**Built**
- Pipeline: `npm run plans:build` (`scripts/plans/build.mjs`) renders all **93 sheets** to WebP (1600 px and 3200 px) and extracts the unit anchors. One child process runs per building, because pdf.js runs out of memory otherwise. Small labels (table headers) are ignored when a sheet has the large salon labels.
- Storage differs from §3.1: images go to **`resources/plans_rendered/<building>/<sheetId>@{1x,2x}.webp`** (34 MB), not `public/`. They are loaded with `import.meta.glob(…, { query: '?url' })` (`src/features/floor-plans/sheetImages.ts`), so Vite copies them into `dist/assets` with content hashes. The PDFs are never shipped.
- Manifest: the hand-maintained `src/data/floor-plans/sheet-map.json` (page → floors, read from the title blocks) plus the generated `sheets.generated.json` (sizes and anchors), merged and validated with Zod in `manifest.ts`. Sheet IDs are `<building>-p<page>`.
- Domain: `src/domain/floorPlans.ts` (`resolveSheet`, `sheetsForBuilding`, `apartmentsOnSheet`, `adjacentSheet`, `coverageReport` and others).
- UI: the "תוכנית" tab (2nd), with the three modes, floor rail, range stepper, hotspots, zoom, fullscreen and keyboard controls. There is also the `/buildings/:id/plans` page, and entry points on the card, my list, the building tab and the elevation (header plus each floor row). Plan state lives in the URL (`pmode`, `psheet`, `pfloor` in the sheet; `mode`, `sheet`, `floor` on the page).
- North: every sheet has its north arrow pointing straight up, so `northDeg = 0` everywhere.
- Tests: `manifest.test.ts` checks that every dataset floor is on exactly one sheet and that the labels on every sheet equal the plan types of its floors. All apartments are covered except the D15 types that have no sheet.

**Differences from the plan**
- Apartment mode zooms to the unit's anchor and marks it with a ring. The hand-drawn `region` outlines (dim mask) are supported by the schema and the viewer, but none are drawn yet, and the dev annotator (§3.2) was not built.
- Zoom and pan use our own small hook (`usePanZoom` and `panZoom.ts`, which has unit tests) instead of `react-zoom-pan-pinch`.
- The "PDF" button was dropped, because the PDFs are not hosted.

**Still open:** the region annotator and outlines, the D15 building set, and confirming the C3 alias (`T-P6F` vs `T-P6.5F`).

---

## 1. Goals and non-goals

**Goals**
- From any apartment, open its **real floor plan** with the apartment highlighted. Today the app has only a generated schematic.
- From any apartment or building, browse **all plan sheets of that building**: ground, garden floor, typical floors, penthouse and roof.
- Click an apartment drawn on a floor sheet to open that apartment's detail sheet.
- Works offline, loads fast on mobile, and keeps the app's RTL layout and accessibility standard.

**Non-goals**
- No editing or annotating of plans by users.
- Do not ship the original PDFs (about 70 MB in total) or render PDFs in the browser at runtime.
- No 3D in this plan. See the 3D plan.

---

## 2. Source material (analysis of `resources/building_plans`)

15 PDFs: 14 building sets (`…מכר-קומתי-מגרש-<plot>-בניין-<id>.pdf`) and 1 single-unit sheet (`…D15-2-3-4-5-T-T5C-50.pdf`).

| Finding | Detail | Consequence |
|---|---|---|
| One sheet = one floor **or a range of floors** | The title block says e.g. `קומה 1`, `2-4`, `5-16`, `17`, `קרקע עליונה`, `קרקע תחתונה`, `גג` | A sheet covers many apartments. Resolve a sheet by (building, floor). |
| Sheet types | Building sets have 6–8 pages: basement or lower-ground (parking, storage), upper ground (lobby, storage), garden floor (`T-G…` units), first or typical floors (`T-T…`), penthouse (`T-P…`), roof | Group sheets as *living floors* and *service floors* in the UI |
| **Page order is not consistent** | A1 p1 = floor 1, p2 = lower ground. D13 p1 = roof (A1 size), p2 = penthouse. C14 p1–p2 are A1 size and the rest A2 | Map each sheet by hand in a manifest. Never assume an order. |
| Page sizes | Mostly 1684 × 1191 pt (A2), a few 2384 × 1684 pt (A1). Scale 1:100. The D15 unit sheet is A2 at **1:50** | Render to a fixed pixel width and keep the scale in the manifest |
| Fixed left title block (~14% of the width) | Developer logo, project, key plan of the plot with the building highlighted, elevation thumbnail, **north arrow**, building, floor, unit types, scale | Crop it away in the viewer image. Read the north angle once into the manifest. |
| Plan-type labels are **real text** with coordinates | e.g. A1 p8: `T-T5A` at (934, 924), `T-T6D` at (662, 568). Every apartment label (circle) and every table header is extractable | Unit **anchors** (hotspot centres) can be generated automatically |
| Unit tables, room names and the title block are **vector outlines, not text** | The tables "קומה / מס' דירה / שטח / מרפסת" next to each unit cannot be read by text extraction | Floors and unit numbers come from our dataset (`RAW`), not from the PDF |
| Plan-type codes match the dataset | `planType` in `apartments.data.ts` (`T-T5A`, `T-G5.5F`, `T-P6D` …) equals the PDF labels. On a given floor of a building, each plan type appears once | (building, floor, planType) → exactly one apartment. This drives the hotspots. |
| Gaps | **D15**: no building set, only the `T-T5C` unit sheet (floors 2–5). **C3**: the data says `T-P6F`, the PDF says `T-P6.5F`. A1 floor 1 has 4 units and the other floors have 5. | The manifest needs an alias table, and the UI needs a "no plan" fallback (see §7) |

---

## 3. Architecture overview

```
resources/building_plans/*.pdf
        │  (offline, npm run plans:build)
        ▼
scripts/plans/render-sheets.mjs ──► public/plans/<building>/<sheetId>@{1x,2x}.webp
scripts/plans/extract-anchors.mjs ─► src/data/floor-plans/anchors.generated.json
                                           │
src/data/floor-plans/manifest.ts  (hand-maintained: sheet → floors, kind, north, unit crop boxes)
        │
        ▼
src/domain/floorPlans.ts   (pure: resolveSheet(apartment), sheetsForBuilding(id), unitsOnSheet(...))
        │
        ▼
src/features/floor-plans/  (PlanViewer, FloorRail, UnitHotspots, PlansTab, BuildingPlansPage)
```

### 3.1 Asset pipeline (build time, not runtime)
- New dev dependencies: `pdfjs-dist` and `@napi-rs/canvas`. Both are pure npm packages with no system poppler, and they work on Windows.
- `scripts/plans/render-sheets.mjs`:
  - Renders each manifest sheet with the title block **cropped off** (crop box in the manifest, default `x ≥ 0.15·W`).
  - Outputs WebP at **1600 px** (`@1x`, used for the list and mobile) and **3200 px** (`@2x`, used for zoom) on the long side, with quality ~80. Expected size is 150–400 KB per sheet: ~100 sheets × 2 ≈ 40–60 MB in `public/`. This is acceptable for a static site because every sheet is lazy-loaded. Revisit tiling (§9) if it becomes a problem.
  - Also writes one **unit crop** per (sheet, planType) at 1200 px for the fast "apartment" mode.
  - The output is deterministic: a file is re-rendered only when the PDF hash changes, and the hashes are kept in `public/plans/hashes.json`.
- `scripts/plans/extract-anchors.mjs`: uses `page.getTextContent()` to collect every `T-[TGP]…` label with its position, normalised to the cropped image (0..1). If a label appears twice (circle label and table header), keep the label **inside** the drawing bounds, i.e. not in a table.
- `package.json`: `"plans:build": "node scripts/plans/build.mjs"`. Generated images are committed (like `site.jpg`). CI does not run it.

### 3.2 Manifest (`src/data/floor-plans/manifest.ts`, typed and validated with Zod)
```ts
type SheetKind = 'typical' | 'first' | 'garden' | 'penthouse' | 'ground-upper' | 'ground-lower' | 'roof' | 'unit';

interface PlanSheet {
  id: string;                 // 'A1-05-16'
  building: string;           // 'A1'
  source: { file: string; page: number };
  kind: SheetKind;
  floors: number[];           // [5,6,…,16]; [] for service floors
  floorLabel: string;         // Hebrew label as in title block: '5-16', 'קרקע עליונה'
  scale: 50 | 100;
  northDeg: number;           // angle of the north arrow on the image (0 = up)
  units: Array<{
    planType: string;         // 'T-T5A'
    anchor: [number, number]; // normalised, from anchors.generated.json (overridable)
    region: [number, number][]; // polygon (normalised) for highlight / crop; hand-drawn
  }>;
}
interface BuildingPlans { building: string; plot: number; sheets: PlanSheet[] }
export const PLAN_TYPE_ALIASES: Record<string, string> = { 'C3:T-P6F': 'T-P6.5F' };
```
- `region` polygons are drawn once with a **dev-only annotator** (route `/dev/plan-annotator`, excluded from the production build): open a sheet, click the polygon corners around each unit, and copy the JSON. That is about 35 plan types × a few sheet variants, roughly half a day of work.

### 3.3 Domain functions (`src/domain/floorPlans.ts`, pure and unit-tested)
- `resolveSheet(a: Apartment): { sheet, unit } | null`: finds the sheet of `a.building` whose `floors` includes `a.floor` and whose `units` contains `a.planType` (after aliases). For D15 (unit sheet only) it falls back to a `kind:'unit'` sheet that matches `planType` and floor.
- `sheetsForBuilding(id)`: sheets sorted from top to bottom (roof → penthouse → typical ranges → first → garden → ground → basement), like the elevation.
- `apartmentsOnSheet(dataset, sheet, floor)`: (planType → Apartment) for the hotspots on a chosen floor.
- `coverageReport(dataset)`: every apartment without a sheet. Used by a **unit test that fails on new gaps**, with an explicit allow-list for D15 (only `T-T5C` has a plan).

---

## 4. UI design

### 4.1 Three display modes, one viewer component
`PlanViewer` takes the props `{ sheet, mode, floor, highlight?: planType }`.

| Mode | Hebrew label | What is shown | Default for |
|---|---|---|---|
| **Apartment** (`unit`) | "הדירה" | The unit crop (`region` bounding box + 8% margin). Areas outside the polygon are dimmed. The unit's facts (rooms, area, outdoor area, floor) are shown in a small card. | Opening from an apartment |
| **Floor** (`floor`) | "הקומה" | The whole sheet. This apartment is outlined in the accent colour (`--sea`) and the other units carry hotspot chips with their **unit number on the selected floor** | Clicking "הקומה" |
| **Building** (`building`) | "כל הבניין" | The floor rail (§4.3) is expanded and thumbnails of all sheets appear in a grid. Selecting one switches to Floor mode for that sheet | Entry from the building context |

- Highlight is an **SVG overlay** in normalised coordinates (`viewBox="0 0 1 1"`, `preserveAspectRatio="none"`) on top of the `<img>`. It holds a dim mask with a hole for the unit polygon, an outline, and hotspot buttons. No canvas is used, so it is easy to test and accessible.
- Zoom and pan: **`react-zoom-pan-pinch`** (small, touch-friendly). It supports pinch, wheel and double-tap, and the buttons are listed below. It loads `@2x` when the zoom is above 1.5.
- The north arrow is drawn in the corner and rotated by `northDeg`. A compass-direction legend (צפון/דרום/מזרח/מערב) is shown at the image edges.

### 4.2 Button placement

**Inside the viewer (toolbar at the top of the viewer, sticky, RTL order from the right):**
```
┌───────────────────────────────────────────────────────────────────────────┐
│ [ הדירה | הקומה | כל הבניין ]      קומה 5–16 · T-T5A        [−] [+] [⤢] [⛶] [PDF] │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Right (start):** mode segmented control (Radix `ToggleGroup`, single select). This is the primary control and comes first in reading order.
- **Centre:** context caption with the floor label and plan type, and a unit-number chip when one is selected.
- **Left (end):** zoom out `−`, zoom in `+`, fit `⤢`, full screen `⛶`, and "פתח PDF מקורי" (opens the original page at `#page=N` if the PDFs are hosted; hidden otherwise). Icon buttons have `aria-label` and a tooltip.
- **Previous/next floor:** `▲ קומה מעל` and `▼ קומה מתחת` are floating buttons on the viewer's **left edge, vertically centred** (above them sits the floor rail on desktop). Keyboard: `PageUp`/`PageDown`, `+`/`-`/`0` for zoom, `Esc` to leave full screen.

**Floor rail (Floor and Building modes):**
- Desktop (≥ 900 px): a narrow vertical column on the **left side** of the viewer (the inline end in RTL), styled like the existing `BuildingElevation`: roof at the top, basement at the bottom. Each row shows a floor label (`17`, `5–16`, `2–4`, `1`, `קרקע`). The current sheet is filled with `--sea`, and the selected apartment's floor carries a dot.
- Mobile (< 900 px): the rail becomes a **horizontal chip row** under the toolbar (scroll-snap). The prev/next buttons stay.
- For a range sheet (`5–16`), a small **floor stepper** (`‹ 7 ›`) appears in the caption. It changes which apartment numbers the hotspots show, because the drawing is the same for every floor in the range.

**Hotspots on the sheet:** a round chip at each `anchor` shows the unit number (e.g. `37`) for the selected floor. Hover or focus shows a tooltip: `T-T5A · 5 חד׳ · 125.9 מ״ר · ₪1.81M`. A click opens that apartment (`?apt=<id>&tab=plans&mode=floor`). The current apartment's chip is filled and the other chips are outlined. A chip whose apartment is filtered out stays visible but is muted.

### 4.3 Entry points (where the user finds plans)
| Place | Control | Opens |
|---|---|---|
| **Apartment detail sheet** | New tab **"תוכנית"** (plans), placed **2nd**: `תובנות · תוכנית · הבניין והקומה · הדמיה` | Apartment mode |
| Apartment card (list) | Small plan icon button next to the star, `aria-label="תוכנית הדירה"` | Sheet, plans tab |
| My-list item | Same icon button, next to the notes field | Sheet, plans tab |
| "Building & floor" tab | Under the site map's facts: button **"תוכניות הבניין (7 גיליונות)"**. On the "units on this floor" table header: **"תוכנית הקומה"** | Building mode / Floor mode |
| Elevation (one building selected) | Text button **"תוכניות קומה"** in the elevation header, and a plan icon on each floor-row label | Building plans page at that floor |
| Site map building hotspot | Item "תוכניות" in the hotspot popover/legend | Building plans page |

### 4.4 Routes and state (URL-driven, like the current sheet)
- Sheet tab: `?apt=A1-37&tab=plans&mode=unit|floor|building&floor=7` (`floor` only for range sheets). Add `'plans'` to `SHEET_TABS` in `src/store/uiStore.ts`, keeping `lastSheetTab`.
- Standalone page: **`/buildings/:id/plans?sheet=A1-05-16&floor=7`**, wired in `src/app/routes.tsx` (lazy route). It is used when there is no apartment context (from the site map or the elevation) and can be shared as a deep link.
- All UI strings go in `he.plans` in `src/i18n/he.ts`.

---

## 5. Feature folder layout
```
src/features/floor-plans/
  index.ts
  PlansTab.tsx                 // sheet tab: resolves sheet, renders PlanViewer
  BuildingPlansPage.tsx        // /buildings/:id/plans
  PlanViewer.tsx + .module.css // image + overlay + zoom wrapper
  PlanToolbar.tsx              // mode toggle, caption, zoom/fullscreen/PDF
  FloorRail.tsx                // vertical / horizontal floor selector
  UnitOverlay.tsx              // SVG mask, outline, hotspots
  UnitHotspot.tsx
  SheetThumbGrid.tsx           // building mode grid
  NoPlanNotice.tsx             // fallback (§7)
  __tests__/
src/domain/floorPlans.ts (+ __tests__)
src/data/floor-plans/{manifest.ts, anchors.generated.json}
scripts/plans/{build.mjs, render-sheets.mjs, extract-anchors.mjs}
src/dev/PlanAnnotator.tsx      // dev-only
```
Lazy-load the feature (`React.lazy`) so the main bundle budget (`npm run size`) is not affected.

---

## 6. Performance and accessibility
- `<img loading="lazy" decoding="async" srcset="…@1x.webp 1600w, …@2x.webp 3200w">` with `width`/`height` set to avoid layout shift. Preload the adjacent floor sheet when idle.
- `alt` text, e.g. "תוכנית קומות 5–16, בניין A1. הדירה מסומנת: T-T5A". Hotspots are real `<button>`s in a logical tab order (by unit number). Full-screen uses the Fullscreen API with a CSS fallback.
- Dimming and outline colours pass contrast in light and dark themes (reuse the tokens from `tokens.css`).

---

## 7. Fallbacks and data quality
- **No plan for this apartment** (D15 units other than `T-T5C`, or a sheet not mapped yet): show `NoPlanNotice` with "תוכנית לדירה זו טרם נוספה" and a link to the building's available sheets, if any. Never show a wrong sheet.
- **Same plan, different floor**: in a range sheet the drawing is identical for every floor. The caption states the range so users do not think it is floor-specific.
- Disclaimer line under the viewer (from the sheets' own notes): the plans are sales plans and are not binding for construction. The developer's binding documents prevail.

---

## 8. Testing
- **Unit (Vitest):** `resolveSheet` for every apartment in `RAW`, snapshot of `coverageReport` (gaps must be explicit), alias resolution, floor-range parsing, hotspot → apartment mapping (one per planType per floor).
- **Manifest validation:** a Zod schema, plus checks that every `anchor` lies inside its `region`, every image file exists, and no two units on one sheet overlap.
- **Component (RTL):** mode toggle changes the visible layer, the floor stepper updates hotspot numbers, keyboard navigation works, and a hotspot click navigates.
- **E2E (Playwright):** open apartment → plans tab → switch to floor → click a neighbour → the sheet shows the neighbour. Mobile viewport: the rail is horizontal. Axe has no violations.

---

## 9. Phases
1. **Pipeline + manifest skeleton** (render, crop, anchors). Hand-map the sheets → floors for all 14 sets + D15. Run the coverage test. *(1–2 days)*
2. **Viewer MVP:** plans tab with Floor mode, zoom, hotspots without regions (anchor chips only). *(2 days)*
3. **Annotator + regions:** Apartment mode crop and highlight. *(1–2 days)*
4. **Building mode + standalone route + all entry points** (card, my list, building tab, elevation, site map). *(1–2 days)*
5. **Polish:** preloading, the PDF link, dark mode, E2E and a11y. *(1 day)*
6. *Optional:* if image weight is a problem, generate deep-zoom tiles (`sharp` + DZI) and swap the `<img>` for a tiled layer. The API stays the same.

## 10. Open questions
- Can we get the full **D15 building set** and per-unit 1:50 sheets for the other plan types (like the D15 `T-T5C` file)? This also helps the 3D plan.
- Should the original PDFs be hosted for the "PDF" button, or should the button be dropped?
- C3 penthouse: confirm whether `T-P6F` (data) and `T-P6.5F` (plan) are the same unit.
- **Side benefit:** `northDeg` + `region` give every apartment its real **facade orientation**. The app currently asks the user to enter it (`AZ`). This can pre-fill orientation for the sun simulation (see the 3D plan, §5).
