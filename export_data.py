"""Converts the contractor's price workbook to data.js.
Usage: python export_data.py path/to/Almogim_Prices.xlsx
Requires: pip install pandas openpyxl
"""
import json, sys
import pandas as pd, openpyxl

src = sys.argv[1]
df = pd.read_excel(src, sheet_name="דירות")
rows = []
for r in df.itertuples(index=False):
    b, plot, n, tp, ts, fl, rooms, area, outd, sarea, park, tgt, price, sno, sfl = r[:15]
    rows.append([str(b), int(plot), int(n), str(tp), str(ts), int(fl), float(rooms), round(float(area), 2),
                 round(float(outd), 2), round(float(sarea), 2), int(park), 1 if str(tgt).strip() == "כן" else 0,
                 None if pd.isna(price) else int(round(price)), str(sno).strip(), str(sfl).replace(".00", "").strip()])
meta = {}
for r in openpyxl.load_workbook(src, data_only=True)["סיכום"].iter_rows(min_row=2, max_row=10, values_only=True):
    if r[0]:
        meta[str(r[0])] = r[1]
m = {"dev": meta.get("שם קבלן/יזם"), "lottery": meta.get("מס' הגרלה"),
     "base": meta.get('מחיר למ"ר כולל מע"מ בש"ח (ללא הנחה)'), "file": src.replace("\\", "/").split("/")[-1]}
with open("data.js", "w", encoding="utf-8") as f:
    f.write("const RAW=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\nconst META=" + json.dumps(m, ensure_ascii=False) + ";")
print(len(rows), "rows written to data.js")
