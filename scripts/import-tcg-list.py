# One-off extractor for the personal "TCG List.xlsx" spreadsheet.
#
# Usage:
#   python scripts/import-tcg-list.py "C:\path\TCG List.xlsx" data/tcg-list.json
#
# Sheets "Hayday" (unrelated game) and "Trade" (trade matrix, not a collection)
# are ignored. Sheets whose first row is title-less (the "1-3" deck list) are
# extracted too but the importer decides what to use.
#
# Only stdlib (zipfile + ElementTree), no openpyxl dependency.
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

DIAMOND, STAR, SPARKLE, CROWN = chr(0x1F4A0), chr(0x2B50), chr(0x2728), chr(0x1F451)
M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = {"m": M}
RELS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def col_index(ref):
    letters = re.match(r"([A-Z]+)", ref).group(1)
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch) - 64)
    return value - 1


def read_sheet(z, path, shared):
    root = ET.fromstring(z.read(path))
    rows = {}
    for row in root.iter(f"{{{M}}}row"):
        cells = {}
        for c in row.findall("m:c", NS):
            kind = c.get("t")
            v = c.find("m:v", NS)
            if kind == "s" and v is not None:
                value = shared[int(v.text)]
            elif kind == "inlineStr":
                value = "".join(x.text or "" for x in c.iter(f"{{{M}}}t"))
            elif kind == "str" and v is not None:
                value = v.text
            else:
                value = v.text if v is not None else None
            if value not in (None, ""):
                cells[col_index(c.get("r"))] = str(value).strip()
        if cells:
            rows[int(row.get("r"))] = cells
    return rows


def tier_name(label):
    if not label:
        return None
    if set(label) == {CROWN}:
        return "Crown1"
    for ch, name in ((DIAMOND, "Diamond"), (STAR, "Star"), (SPARKLE, "Shiny")):
        if set(label) == {ch}:
            return f"{name}{len(label)}"
    return None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if len(sys.argv) < 3:
        raise SystemExit('usage: python scripts/import-tcg-list.py "<xlsx>" <output.json>')

    source, target = sys.argv[1], sys.argv[2]
    z = zipfile.ZipFile(source)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in ss.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(f"{{{M}}}t")))

    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relmap = {r.get("Id"): r.get("Target") for r in rels}
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    sheets = [
        (s.get("name"), "xl/" + relmap[s.get(RELS)].lstrip("/").replace("xl/", ""))
        for s in workbook.find("m:sheets", NS)
    ]

    result = {"source": source, "sheets": []}
    for name, sheet_path in sheets:
        if name in ("Hayday", "Trade"):
            continue
        rows = read_sheet(z, sheet_path, shared)
        header, first = rows.get(2, {}), rows.get(1, {})
        starts = sorted([c for c, v in header.items() if v and v.startswith("EX / Card Name")])
        blocks = []
        for i, start in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else max(header) + 3
            account = re.sub(r"^Account Name\s*:\s*", "", first.get(start, "")).strip()
            columns = []
            for c in range(start + 1, end):
                label = header.get(c)
                tier = tier_name(label)
                if tier:
                    columns.append((c, tier))
                if label in ("Total", "Deskripsi"):
                    break
            data_rows = []
            for rn in sorted(rows):
                if rn <= 2:
                    continue
                cells = rows[rn]
                name_cell = cells.get(start)
                if not name_cell:
                    continue
                # Second stacked table inside the same block is a trade list.
                if name_cell.lower().startswith("ex / card name"):
                    break
                qty = {}
                for c, tier in columns:
                    raw = cells.get(c)
                    if raw is None:
                        continue
                    try:
                        value = float(raw)
                    except ValueError:
                        continue
                    if value > 0:
                        qty[tier] = value
                if qty:
                    data_rows.append({"name": name_cell, "qty": qty})
            blocks.append(
                {"account": account, "tiers": [t for _, t in columns], "rows": data_rows}
            )
        result["sheets"].append({"sheet": name, "blocks": blocks})

    with open(target, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)

    for sheet in result["sheets"]:
        summary = ", ".join(
            f"{b['account'] or '(tanpa nama)'}={len(b['rows'])}" for b in sheet["blocks"]
        )
        print(f"{sheet['sheet']}: {summary}")
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
