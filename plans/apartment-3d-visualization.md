# Plan: 3D visualisation of each apartment from the real plans

Date: 2026-11-27 · Scope: replace the generated schematic 3D model (`src/domain/schematic.ts` + `src/features/viewer3d`) with a model built from the contractor's sales plans. The schematic stays as a fallback. Companion plan: [floor-plan-viewer.md](floor-plan-viewer.md), which supplies the sheet manifest, unit regions and north angles used here.

Status: **phase 1 and the viewer are implemented** (see §0) · Updated 2026-11-28.

---

## 0. Implementation status (2026-11-28)

**Built**
- Extractor: `npm run plans:model -- <type>` (`scripts/plans/extract-model.mjs`), with per-type specs in `scripts/plans/model-specs.json`. It works on a raster at 2 cm/px:
  - Walls come from the CAD layers, or from fill colours on 1:100 sheets.
  - Thin enclosed outlines are treated as wall interiors.
  - Rooms are split at door-sized necks by eroding 44 cm and growing back. One seed per room sets its type and name; several seeds in one space make an open-plan label.
  - Openings are gaps between wall ends. They become windows or sliders when one side is outdoors, otherwise doors, and the entrance is placed from a seed point.
- Geometry is stored as **unions of rectangles** rather than polygons. This is exact for the raster and simpler to extrude.
- **T-T5C** is modelled from the D15 1:50 sheet and covers 8 apartments (D15 and D13).
  - 11 rooms, 108.6 m² net against 128.2 m² contract (85 %).
  - Balcony 40.5 m² against 43.0 m².
  - Windows measure about 118 cm against the 115–120 cm dimension labels.
  - The salon faces east.
- App:
  - `src/domain/planModel.ts`: validation, `salonFacade`, mirroring, collision and the walk start point.
  - `src/data/plan-models/`: Zod schema, with each model in its own lazy chunk.
  - `src/features/viewer3d/planModelScene.ts`: merged walls split at the 1.2 m cut, sills, lintels and glass, floors per room, an invisible ceiling for sun patches, and labels.
  - `createApartmentScene`: dollhouse, orthographic top view (north up) and walk-through (keys, drag-look, buttons, wall collision).
  - The 3D tab shows a view switch, the "מבוסס תוכנית" or "סכמטי" badge, overlays, the walk pad, the real rooms table, and automatic orientation from the plan.
- Tests: model validation against the dataset, a scene builder without WebGL, camera and view switching, walking and collision, and tab UI tests.

**Not done yet**
- Models for the other ~40 plan types. The heuristic 1:100 path (`method: "colors"`) exists in the extractor, but it needs a unit crop and room seeds for each type, so the remaining types still show the schematic.
- The dev model editor (`/dev/plan-model-editor`). Seeds are edited in `model-specs.json` instead.
- Ghost floors, neighbour massing and furniture (phase 6).

---

## 1. Goals and non-goals

**Goals**
- A 3D model of every apartment with its **real walls, rooms, doors, windows, balcony/garden and safe room (ממ״ד)**, true to scale (±5 cm).
- Views: **dollhouse** (cut-away from above), **top plan** (orthographic) and **walk-through** (eye height). Room labels and areas are shown.
- **Real orientation and sun**: the north angle comes from the plan, and the floor height comes from the floor number. The existing season/hour sun simulation is reused.
- One model per **plan type** (~40 types across the project, not 406 apartments). Apartments that share a type share the model and differ only in floor height and orientation.

**Non-goals**
- No photoreal rendering, interior design or furniture catalogues. Furniture may be shown as simple shapes later.
- No editing by end users.
- No full-building or neighbourhood 3D in v1 (§8, phase 6).

---

## 2. What the source PDFs give us (findings)

| Source | Content | Usefulness for 3D |
|---|---|---|
| **Unit sheet at 1:50** (only `D15 … T-T5C-50.pdf` today) | Vector drawing with **48 named CAD layers** (optional content): `00-walls`, `00-Hatch-W`, `00-windoors`, `…|00-walls_ in`, `…|00-furniture`, `…|00-sanitar`, `…|00-appliances`, `00-dim50`, `00-text50`, … Also has dimension annotations (e.g. 410, 318, 938 cm) and a north arrow | **Best source.** Walls and openings can be separated by layer, and dimensions allow a scale check |
| **Building floor sheets at 1:100** (14 sets) | Vector drawing (~120k paths per page) **without layers**. Fill colours are consistent: `#545454`/`#000000` for wall poché, `#989898`/`#bababa` for hatch and floor fill, red for the outline. Plan-type labels are text with coordinates | Usable with heuristics (filter by fill colour + region polygon), but noisier: furniture and fixtures are mixed in |
| Dataset `RAW` | `area`, `outdoorArea`, `rooms`, `floor` per apartment | **Validation:** the sum of the extracted room polygons must match `area` within ±3–5% |

Scale: A2 sheet = 1684 pt wide. 1 pt = 0.3528 mm on paper → **3.528 cm real at 1:100** and **1.764 cm at 1:50**. Every extraction is checked against at least one known dimension label.

**Recommendation:** ask the developer for the 1:50 unit sheets of every plan type (the D15 file name suggests a series: `…-<type>-50.pdf`). Until we have them, use the 1:100 building sheets with the heuristic path (§3.2).

---

## 3. Pipeline: PDF → plan model JSON (offline, per plan type)

```
PDF page ──(pdfjs getOperatorList + optional content)──► raw vector dump
   │
   ├─ 3.1 layer path (1:50 sheets): select layers walls / windoors / hatch-w
   └─ 3.2 heuristic path (1:100 sheets): clip to unit region (from floor-plan manifest),
          keep filled paths with wall colours, drop thin strokes (< 0.3 pt) and furniture-sized islands
   ▼
geometry clean-up (scripts/plans/geometry/*)
   - union wall fills → polygons (polygon-clipping), simplify (2 cm tolerance), snap to 0/90° and 5 cm grid
   - detect openings: gaps in wall polygons bridged by `windoors` symbols (door arcs = door, triple lines = window)
   - room detection: faces of the wall arrangement (planar graph) → room polygons
   - scale with sheet scale, verify against one dimension annotation
   ▼
semi-manual review in dev tool `/dev/plan-model-editor`
   - assign room types (salon, kitchen, master, bed, mamad, bath, wc, laundry, storage, balcony, garden)
   - fix opening types / sill and head heights, add sliding doors to balconies
   ▼
src/data/plan-models/<planType>.json   (+ mirrored variants referenced, not duplicated)
```

### 3.1 Model schema (`src/domain/planModel.ts`, Zod-validated)
```ts
interface PlanModel {
  planType: string;              // 'T-T5C'
  source: { file: string; page: number; scale: 50 | 100; method: 'layers' | 'heuristic' };
  unitsCm: true;                 // all coordinates in cm, plan-local, +x = sheet right, +y = sheet up
  northDeg: number;              // from sheet north arrow
  entrance: [number, number];
  walls: Array<{ id: string; polygon: [number, number][]; kind: 'exterior' | 'interior' | 'mamad' | 'party' }>;
  openings: Array<{
    wallId: string; kind: 'door' | 'window' | 'slider' | 'mamad-window' | 'entrance';
    from: [number, number]; to: [number, number];  // on wall axis
    sill: number; head: number;                     // cm; defaults by kind
    swing?: 'left' | 'right';
  }>;
  rooms: Array<{ id: string; type: RoomType; label: string; polygon: [number, number][]; areaM2: number }>;
  outdoor: Array<{ kind: 'balcony' | 'sun-balcony' | 'garden' | 'roof-terrace' | 'pool'; polygon: [number, number][]; covered: boolean }>;
  fixtures?: Array<{ kind: 'kitchen' | 'bath' | 'shower' | 'wc' | 'sink'; polygon: [number, number][] }>;
  mirrorOf?: string;             // e.g. T-T5E = mirror of T-T5A (to verify per pair)
}
```
- Fixed heights (unless the plans say otherwise): floor-to-floor **3.0 m** (check against the elevation drawing), clear height **2.7 m** (as the current `WALL_H`), window sill **0.9 m** / head **2.2 m**, doors **2.1 m**, sliding balcony doors **0–2.3 m**, mamad wall thickness from the drawing (~30–40 cm).

### 3.2 Validation (unit tests, run in CI on the JSON files only)
- Σ room areas (excluding outdoor) vs. `area` from the dataset for every apartment of that type: within **±5%** (warn at 3%).
- Σ outdoor areas vs. `outdoorArea`: within ±5%.
- Room count by type matches `rooms` (salon + bedrooms + mamad = rooms; ".5" counts handled).
- Every opening lies on its wall, walls do not overlap, and room polygons are closed and non-overlapping.
- Every `planType` in `RAW` has a model or is on an explicit `PENDING_MODELS` list.

---

## 4. Rendering (three.js, inside the existing lazy `viewer3d` feature)

### 4.1 Geometry builder (`src/features/viewer3d/planModelScene.ts`, pure, no renderer)
- **Walls:** extrude each wall polygon to `clearHeight` (`THREE.ExtrudeGeometry`). Openings are cut by splitting walls into segments along the opening span: a sill box below and a lintel box above. Avoid CSG at runtime (simpler and faster). Use `three-bvh-csg` only if curved walls appear.
- **Floors:** one `ShapeGeometry` per room, tinted by room type with the existing `ROOM_COLOR` palette. Optionally use the **plan image crop as a floor texture** (from the floor-plan pipeline) for a "plan on the floor" look.
- **Glass:** windows and sliders are thin transparent panes with frames. The mamad window gets a steel shutter material.
- **Outdoor:** balcony slab, glass railing at 1.05 m, a pergola outline for covered parts, a garden lawn plane, and the pool for penthouses where drawn.
- **Labels:** reuse `makeLabel` sprites (room name + m², from `rooms[].areaM2`).
- Merge static meshes per material (`BufferGeometryUtils.mergeGeometries`) so a unit uses fewer than 30 draw calls.

### 4.2 Scene context
- Orientation: rotate the model by `northDeg`, plus the building's site rotation. This **pre-fills** the orientation the user currently sets by hand. The user can still override it, and the override stays saved in my-list `az`.
- Elevation: put the unit at `floor × 3.0 m` above ground. Show a translucent slab "ghost" of the floors above and below for context. Garden units get the ground plane at slab level.
- Sun: reuse `solarPosition` and the `SunControls` season/hour. Shadows are cast through real window openings, so the sun patches on the floor are the main value for buyers.
- Phase 6 (optional): neighbour buildings as simple extruded boxes, using footprints from the site plan and heights from the floor counts, so shading by neighbours shows.

### 4.3 View modes and controls
| Mode | Camera | Notes |
|---|---|---|
| **Dollhouse** (default) | Perspective orbit (`OrbitControls`), 45° from above | Walls cut at 1.2 m by default; toggle full height |
| **Top plan** | Orthographic, straight down, north up | Matches the 2D sheet; good for comparing |
| **Walk-through** | First person at 1.6 m. Desktop: WASD + drag. Mobile: virtual joystick + swipe-look | Collision with walls (2D segment test). Starts at the entrance |

---

## 5. UI and button placement (detail sheet, renamed tab "הדמיה תלת־ממדית")

```
┌──────────────────────────────────────────────────────────────┐
│ [ בית בובות | מבט על | סיור ]            מבוסס תוכנית ✓        │ ← toolbar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     3D canvas                         [⛶]   │
│                                                    [⟲ N]    │ ← top-left overlay: full screen, reset/north
│                                                              │
│  [◐ קירות: נמוכים/גבוהים]  [🏷 תוויות]                        │ ← bottom-right overlay toggles
├──────────────────────────────────────────────────────────────┤
│ ☀ עונה: [חורף|אביב|קיץ]   שעה: ──●───── 09:00   כיוון: [אוטומטי ▾] │ ← existing SunControls row
├──────────────────────────────────────────────────────────────┤
│ Rooms table (real areas from the model)                       │
└──────────────────────────────────────────────────────────────┘
```
- **Toolbar (top, right side, start of the RTL row):** view-mode segmented control (`ToggleGroup`). **Left side (end):** a source badge, **"מבוסס תוכנית"** (green) or **"סכמטי"** (amber, with a tooltip saying no plan model exists yet).
- **Canvas overlay, top-left corner** (inline end): full screen, reset camera/north-up, and a compass rose showing the real north.
- **Canvas overlay, bottom-right corner** (inline start, near the thumb on mobile): wall-height toggle, labels toggle, and in walk mode a "back to entrance" button. The virtual joystick appears bottom-left in walk mode on touch devices.
- **Below the canvas:** the existing season/hour/orientation controls. The orientation select gains an **"אוטומטי (לפי התוכנית)"** option, which becomes the default when `northDeg` is known.
- **Cross-links:** a "הצג בתוכנית" button in the toolbar caption jumps to the plans tab (Floor mode). From the plans tab, a "תלת־ממד" button jumps back with the same apartment. Clicking a room label in 3D highlights the room in the rooms table, and the reverse also works.
- The automatic rotation (`autoRotate`) stays for dollhouse mode only and stops on first interaction, as today.

---

## 6. Code changes

| Area | Change |
|---|---|
| `src/domain/planModel.ts` | Schema, loaders (`loadPlanModel(planType)` → dynamic `import()` of the JSON, so each model is its own chunk), mirroring helper, area utilities |
| `src/features/viewer3d/` | New `planModelScene.ts` (builder). `createApartmentScene.ts` chooses the plan model when one exists, otherwise `apartmentModel.ts` (schematic). New `controls/` for orbit/ortho/walk |
| `src/features/apartment-detail/SchematicTab.tsx` | Rename it to `ModelTab`, add the view-mode toolbar and source badge. The rooms table reads from the model when available |
| `src/domain/orientation.ts` | `defaultOrientation(apartment)` from `northDeg` + building rotation |
| `scripts/plans/geometry/` | Extraction, clean-up and export scripts. Dev deps: `pdfjs-dist`, `@napi-rs/canvas` (shared with the floor-plan pipeline), `polygon-clipping` |
| `src/dev/PlanModelEditor.tsx` | Dev-only editor: 2D canvas over the sheet image to tag rooms and openings and export JSON |
| `he.ts` | `he.model.*` strings (modes, badges, room types) |

Bundle: three is already lazy. Model JSONs are ~10–40 KB each and load on demand. Walk controls are lazy within the viewer chunk.

---

## 7. Testing
- **Geometry unit tests:** extruding walls with openings gives the expected vertex bounds. Mirroring preserves area. Snapping is idempotent.
- **Model validation tests** (§3.2) over all committed JSONs.
- **Scene builder tests** (no WebGL, as today for `apartmentModel.ts`): mesh counts, label count = room count, model height, north rotation.
- **E2E:** open the 3D tab for a modelled apartment, check the badge says "מבוסס תוכנית", switch to walk mode, take a screenshot. A non-modelled apartment shows the "סכמטי" badge. WebGL is unavailable in CI → test the fallback message.

---

## 8. Phases
1. **Spike (2 days):** extract `T-T5C` from the D15 1:50 sheet using layers. Render walls, openings and rooms. Check against dimensions (e.g. salon 410 × 417 cm) and dataset area (128.3 m²). Decide on the snapping tolerances.
2. **Heuristic extractor for 1:100 sheets** using the unit regions from the floor-plan manifest. Run it on one typical sheet per building family (A, B, C, D) and measure the clean-up effort per type.
3. **Model editor + first 10 plan types** (the most common: `T-T5A`, `T-T5E`, `T-T6D`, `T-T3B`, `T-T4.5C`, `T-T5.5F`, `T-T5G`, `T-T3H`, `T-T5I`, `T-T5.5J`). That covers most apartments.
4. **Viewer integration:** builder, dollhouse/top modes, source badge, real rooms table, automatic orientation.
5. **Walk-through mode**, remaining plan types (garden `T-G…` with gardens, penthouses `T-P…` with roof terraces and pools).
6. *Optional:* floor-stack ghosting, neighbour massing for shading, simple furniture from the `00-furniture` layer (1:50 sheets only).

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| 1:100 sheets have no layers; furniture and hatches are mixed with walls | Filter by fill colour + unit region, then manual review in the editor. Ask for the 1:50 unit sheets |
| Areas from the extracted polygons differ from the contract's areas (measurement method: walls included or not) | Validate against the dataset with tolerance. Show the **dataset** area as the official figure, with model areas per room only |
| Mirrored pairs are not exact mirrors | Treat `mirrorOf` as an optimisation only after the area and opening checks pass. Otherwise model the type separately |
| Mobile GPU performance | Merged geometry, shadows only from the sun with a 1024 shadow map, and pixel ratio capped at 2 |
| Users take the model as binding | Persistent disclaimer under the viewer: illustration based on sales plans, not binding |
