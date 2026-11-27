# 0001 — App at the repo root, legacy site kept in `legacy/`

**Context.** The old site was a single `template.html` with inline CSS/JS, built by `build.py`.

**Decision.** The Vite app lives at the repository root. The old files were moved with `git mv`
into `legacy/` (history kept) and still work there (`legacy/index.html`). `export_data.py` moved
to `scripts/`.

**Consequences.** Old and new can be compared side by side (`scripts/capture-screenshots.mjs`).
After sign-off, delete `legacy/`; keep `fixtures/legacy-derived.json` as regression data.
