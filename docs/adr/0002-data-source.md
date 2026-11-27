# 0002 — Data stays a typed module generated from the workbook

**Context.** The data is 406 rows from the contractor's price workbook. No database is needed.

**Decision.** `data.js` became `src/data/apartments.data.ts` with the same tuple row layout
(`RawRow` in `src/domain/types.ts`). `scripts/export_data.py` now writes this file. Runtime
upload of an updated workbook is kept (in memory only), validated with Zod.

**Consequences.** `tsc` rejects malformed rows at build time. The dataset is built once by the
pure `buildDataset()`; adding a backend later only changes where rows come from.
