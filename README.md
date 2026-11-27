# Almogim Haifa apartment picker (lottery 2181)

Single-page site, Hebrew RTL. No build tooling beyond a tiny Python script.

## Files
- `template.html` — the app (HTML, CSS, JS). The line `/*DATA*/` is replaced by the data.
- `data.js` — the 406 apartments from the contractor workbook (`const RAW`, `const META`).
- `site.jpg` — project render used as the clickable map. Building hotspots are `SITE_PTS` in `template.html` (pixels on a 1100x527 image).
- `build.py` — writes `index.html` (template + data inlined). Open `index.html` in a browser, next to `site.jpg`.
- `export_data.py` — regenerates `data.js` from the workbook: `python export_data.py Almogim_Prices.xlsx`.

## External libraries (loaded from cdnjs)
three.js r128 (schematic 3D) and SheetJS 0.18.5 (Excel export and workbook upload). Offline, the 3D view and Excel features are unavailable.

## Known gaps
- 81 free-market apartments have no price in the workbook.
- No building orientation or position-in-floor data; the 3D layout is generated from area and room count (schematic). Orientation is chosen manually per apartment.
- Personal list (priorities, notes, orientation) is saved with the Claude artifact `db` capability when hosted there, otherwise in `localStorage`.
