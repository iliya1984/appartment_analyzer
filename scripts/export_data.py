"""Converts the contractor's price workbook to src/data/apartments.data.ts.
Usage: python scripts/export_data.py path/to/Almogim_Prices.xlsx   (or: npm run data:export -- path/to/file.xlsx)
Requires: pip install pandas openpyxl
"""
import json
import sys
from pathlib import Path

import openpyxl
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "apartments.data.ts"


def num(v):
    """Integral floats are written without a decimal point (5.0 -> 5) to match JSON.stringify."""
    return int(v) if float(v).is_integer() else v


src = sys.argv[1]
df = pd.read_excel(src, sheet_name="דירות")
rows = []
for r in df.itertuples(index=False):
    b, plot, n, tp, ts, fl, rooms, area, outd, sarea, park, tgt, price, sno, sfl = r[:15]
    rows.append([str(b), int(plot), int(n), str(tp), str(ts), int(fl), num(float(rooms)), num(round(float(area), 2)),
                 num(round(float(outd), 2)), num(round(float(sarea), 2)), int(park), 1 if str(tgt).strip() == "כן" else 0,
                 None if pd.isna(price) else int(round(price)), str(sno).strip(), str(sfl).replace(".00", "").strip()])

meta = {}
for r in openpyxl.load_workbook(src, data_only=True)["סיכום"].iter_rows(min_row=2, max_row=10, values_only=True):
    if r[0]:
        meta[str(r[0])] = r[1]
m = {"dev": meta.get("שם קבלן/יזם"), "lottery": meta.get("מס' הגרלה"),
     "base": meta.get('מחיר למ"ר כולל מע"מ בש"ח (ללא הנחה)'), "file": src.replace("\\", "/").split("/")[-1]}


def js(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


body = ",\n".join("  " + js(r) for r in rows)
OUT.write_text(
    "// Generated from the contractor's price workbook by scripts/export_data.py. Do not edit by hand.\n"
    "// Row layout: see RawRow in src/domain/types.ts.\n"
    "import type { ProjectMeta, RawRow } from '@/domain/types';\n\n"
    f"export const META: ProjectMeta = {js(m)};\n\n"
    f"export const RAW: readonly RawRow[] = [\n{body},\n];\n",
    encoding="utf-8",
)
print(len(rows), "rows written to", OUT)
