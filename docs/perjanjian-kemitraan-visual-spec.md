# Perjanjian Kemitraan — Visual/Structural Spec (derived from MASTER PDF)

Source of truth: `docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER OPS .pdf`
(= identical to `Original Example.pdf`; verified: 9 pages, A4, 12pt TNR, same box geometry)

All numbers below are **measured** with pdfplumber, not assumed.

## Content source rule (PASSTHROUGH)

- **KONTEN 100% dari Template Kontrak** — `contentDefinition` pada versi
  template yang dipublish (dapat diedit lewat Contract Template Editor).
- **Kode tidak menambah/mengubah redaksi** kontrak apa pun.
- **Hanya CHROME yang boleh hardcode**: kop surat + label tetap judul/tanda
  tangan, terpusat di `MITRA_HEADER_CHROME` (`mitra-layout.engine.ts`).
- Nilai dinamis memakai placeholder `{{...}}` (mis. `{{employee.fullName}}`,
  `{{contract.baseCompensation}}`, `{{custom.ktp_issued_date}}`); placeholder
  tanpa nilai ditandai fail-visible `«key»`, bukan dot-leader.
- Diuji oleh `src/contract-templates/mitra-passthrough.spec.ts`.

## Page

| Property | Value |
|---|---|
| Size | A4 portrait, 595.5 x 842.25 pt |
| Total pages (reference) | 9 |
| Body font | Times New Roman 12 pt |
| Dominant font size / page | 12.0 |
| Header font (KOPERASI/PT/UNIT) | TNR **regular** 14.27 pt (NOT bold) |
| Header address font | TNR regular 12 pt |
| Title font | TNR **Bold** 12 pt |
| Signature font | TNR 9.75 pt |

## Header block (page 1 ONLY)

```
logo image: x0=27.4 y0=18.2  w=85.6 h=85.95
top=16.0   KOPERASI KARYAWAN                              14.27 regular  centered
top=34.0   PT. SANKYU INDONESIA INTERNASIONAL             14.27 regular  centered
top=54.0   UNIT KANTOR PUSAT                              14.27 regular  centered
top=70.0   Jl. Kawasan Industri Terpadu ... Kav.20        12    regular  centered
top=86.0   GIIC - KOTA DELTAMAS - CIKARANG PUSAT - ...   12    regular  centered
top=98.0   TELP. 021 - 50555340, FAX. 021- 50555341       12    regular  centered
```

### Horizontal rules under header — TWO rules, both full width
- rule 1: x 18.6 -> 581.25, top 125.42, **thickness 2.85 pt**, black
- rule 2: x 18.6 -> 581.25, top 129.22, **thickness 0.95 pt**, black
- (span 562.65 pt wide)

## Title block (page 1 ONLY)

```
top=144.0  PERJANJIAN KEMITRAAN                    12 Bold  centered
top=158.0  Nomor: <DYNAMIC>                        12 regular centered
top=172.0  Tanggal <DYNAMIC>                       12 regular centered
```

## Two-column box (EVERY page)

Two independently bordered columns, drawn as 0.75 pt black strokes:

| | x0 | x1 | width |
|---|---|---|---|
| Left column | 27.02 | 296.62 | **269.6** |
| Gutter | 296.62 | 309.4 | 12.78 |
| Right column | 309.4 | 566.98 | **257.58** |

- Page 1: box top y = **197.42**, bottom y = **770.92** (height 572.0)
- Continuation pages: box top y = **31.53**, bottom y = **761.17** (height 728.9)
- Border: 0.75 pt, black, **square corners, no fill, no shading**
- Text inside left column starts at x≈31.6–32.3; right column x≈310.9–324.4

## Column flow

- Text flows LEFT column -> RIGHT column -> next page left column.
- Header + horizontal rules + title appear **only on page 1**.
- Pages 2..N carry the bordered two-column boxes with **no header, no title**.
- PASAL headings do NOT force a page break.
- Reference density: ~2400–3250 chars/page (12 pt).

## Numbering (must be preserved verbatim)

```
PASAL n
<NAMA PASAL>          <- heading, TNR Bold 12
1. ...
2. ...
a. ...
b. ...
```
No bullets, no "1. Ruang Lingkup" style headings, no merging/summarising.

## Signature block (final page, spans BOTH columns)

```
top=628.0  PIHAK PERTAMA        PIHAK KEDUA        (9.75 pt)
top=640.0  KOPERASI PT. SANKYU INT'L   MITRA        (9.75 pt)
top=754.0  <name left>          <name right>       (9.75 pt)
                                    (Jabatan) / (Driver)
```

## Measured defects of current System Generate

| # | Defect | Master | System | Cause |
|---|---|---|---|---|
| 1 | Body font size | 12.0 | **9.5** | hardcoded `fontSize` in `contract-document.service.ts` |
| 2 | Header font | 14.27 regular | **16 bold** | `drawCorporateHeader` |
| 3 | Two-column border box | present (24 rects/pg) | **absent (0 rects)** | renderer never strokes column boxes |
| 4 | Column x | 27.02 / 309.4 (269.6 / 257.58) | 34 / 310 (252) | `buildLayoutContext` |
| 5 | Title placement | top=144, page 1 only | **top=62 inside header cluster** | title block injected into header |
| 6 | Duplicate/overlap title | none | "PERJANJIAN KEMITRAAN" overlaps header | defect 5 |
| 7 | Header rules | 2 rules, 2.85 + 0.95 pt | 1+1 pt, decorative | `drawCorporateHeader` |
| 8 | Box on continuation pages | present, top=31.53 | none | renderer never strokes boxes |
| 9 | AI-invented sections | none | openingLine/recitals/`Para Pihak`/`Ruang Lingkup dan Posisi`/`Jangka Waktu` | `contract-document-definitions.ts` fields |
| 10 | ~~Whitespace between words stripped~~ | normal | ~~`3.AtasPekerjaanyangdilakukanPIHAKKEDUA`~~ | **RETRACTED — no such defect.** That string is only what a raw content-stream dump of a *justified* line shows: pdfkit writes the inter-word gap as a numeric offset inside the `TJ` operator, not as a space glyph (0x20). The rendered PDF and pdfplumber's `extract_text()` both keep all spaces. MITRA paragraphs are justified (`mitra-layout.engine.ts`), and that is correct. |
