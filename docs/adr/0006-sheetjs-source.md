# 0006 — SheetJS from the vendor CDN, lazy-loaded

**Context.** The npm-registry `xlsx@0.18.5` (used by the legacy site via cdnjs) is unmaintained
and has published vulnerabilities.

**Decision.** Install `xlsx` 0.20.3 from `https://cdn.sheetjs.com` (the vendor's supported
channel), pinned by the lockfile integrity hash. Loaded with `import('xlsx')` only for export
and upload. If it fails to load, export falls back to CSV.

**Consequences.** `npm audit` is clean. Upgrades mean changing the tarball URL in
`package.json`.
