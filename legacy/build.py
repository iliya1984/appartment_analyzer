"""Builds index.html from template.html + data.js (inlines the data)."""
from pathlib import Path
here = Path(__file__).parent
t = (here / "template.html").read_text(encoding="utf-8")
d = (here / "data.js").read_text(encoding="utf-8")
(here / "index.html").write_text(t.replace("/*DATA*/", d, 1), encoding="utf-8")
print("built index.html")
