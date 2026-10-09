"""
Perbandingan programmatic: Perjanjian Kemitraan hasil generate vs MASTER.
Jalankan: python scripts/compare-kemitraan-layout.py
"""
import pdfplumber, statistics, sys
from collections import Counter

GEN = r"E:\Github\aplikasi-karyawan-kokarsi\backend\tmp\perjanjian-kemitraan-generated.pdf"
MST = r"E:\Github\aplikasi-karyawan-kokarsi\docs\sample-legal-doc\pdf\KONTRAK KERJA MITRA DRIVER OPS .pdf"

LEFT = (27.02, 296.62); RIGHT = (309.4, 566.98)


def col_boxes(pg):
    """Kotak kolom: rect stroke penuh dengan lebar > 200 dan tinggi > 300."""
    return [r for r in pg.rects if r["width"] > 200 and r["height"] > 300 and r.get("stroke")]


def header_rules(pg):
    return [r for r in pg.rects if r["top"] < 160 and r["width"] > 400]


def dom_font(pg):
    c = Counter(round(ch["size"], 2) for ch in pg.chars)
    return max(c.items(), key=lambda kv: kv[1]) if c else (0, 0)


def leading(pg, col):
    crop = pg.crop((col[0], 0, col[1], pg.height))
    tops = sorted(set(round(w["top"], 1) for w in crop.extract_words()))
    deltas = [round(b - a, 2) for a, b in zip(tops, tops[1:]) if 5 < b - a < 40]
    return round(statistics.median(deltas), 2) if deltas else 0


def overlaps(pg):
    bad = 0
    ws = pg.extract_words()
    for i in range(len(ws)):
        for j in range(i + 1, len(ws)):
            a, b = ws[i], ws[j]
            if abs(a["top"] - b["top"]) < 4:
                continue
            if a["x0"] < b["x1"] and a["x1"] > b["x0"] and a["top"] < b["bottom"] and a["bottom"] > b["top"]:
                bad += 1
    return bad


def title_count(path):
    with pdfplumber.open(path) as pdf:
        return sum((pg.extract_text() or "").count("PERJANJIAN KEMITRAAN") for pg in pdf.pages)


def report(path, label):
    print("=" * 70)
    print(label, path)
    with pdfplumber.open(path) as pdf:
        print(f"pages={len(pdf.pages)}")
        total_ov = 0
        for i, pg in enumerate(pdf.pages):
            boxes = col_boxes(pg)
            rules = header_rules(pg)
            ov = overlaps(pg)
            total_ov += ov
            dom = dom_font(pg)
            leadL = leading(pg, LEFT)
            print(
                f"  p{i+1:2d} size={pg.width:.1f}x{pg.height:.1f} boxes={len(boxes)} "
                f"rules={len(rules)} domFont={dom[0]:.2f} leading={leadL} overlaps={ov}"
            )
        print(f"  TOTAL OVERLAPS = {total_ov}")
    print(f"  'PERJANJIAN KEMITRAAN' occurrences = {title_count(path)}")


report(GEN, "GENERATED")
report(MST, "MASTER")

# Perbandingan kotak halaman 1
print("=" * 70)
with pdfplumber.open(GEN) as g, pdfplumber.open(MST) as m:
    gb = [(round(r["x0"], 2), round(r["x1"], 2), round(r["top"], 2), round(r["bottom"], 2)) for r in col_boxes(g.pages[0])]
    mb_raw = m.pages[0].rects
    # master simpan sebagai 4 segmen: rekonstruksi kotak dari pasangan vertikal
    vert = sorted(set(round(r["x0"], 2) for r in mb_raw if r["height"] > 300 and r["width"] < 3))
    top = min(r["top"] for r in mb_raw if r["height"] > 300)
    bot = max(r["bottom"] for r in mb_raw if r["height"] > 300)
    mb = []
    for k in range(0, len(vert), 2):
        if k + 1 < len(vert):
            mb.append((vert[k], vert[k + 1], round(top, 2), round(bot, 2)))
    print("GEN page1 boxes:", gb)
    print("MST page1 boxes:", mb)