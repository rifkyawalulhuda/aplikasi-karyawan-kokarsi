# PKWT (Kesepakatan Kerja Waktu Tertentu) — Visual/Structural Spec (derived from MASTER PDF)

Source of truth: `docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf` (4 pages, A4, bilingual ID/EN).

All numbers below are **measured** with pdfplumber, not assumed. Values that are
derived arithmetically from measured values are labelled `(derived)`. Values that
are read from source code rather than from the PDF are labelled `(code)`.
Anything labelled `(assumed)` is not measured.

This document is the PKWT sibling of `docs/perjanjian-kemitraan-visual-spec.md`.
The two documents differ in font family, title layout, box paint mode and
signature placement — see [Diff vs MITRA master](#diff-vs-mitra-master).

## Content source rule (PASSTHROUGH)

- **KONTEN 100% dari Template Kontrak** — `contentDefinition` pada versi
  template yang dipublish (dapat diedit lewat Contract Template Editor).
- **Kode tidak menambah/mengubah redaksi** kontrak apa pun.
- **Hanya CHROME yang boleh hardcode**: kop surat + label tetap judul dan tanda
  tangan.
- Nilai dinamis memakai placeholder `{{...}}`; placeholder tanpa nilai ditandai
  fail-visible `«key»`, bukan dot-leader.
- PKWT membawa **dua bahasa** (`contentDefinition.languages.id` dan
  `.languages.en`) yang dirender berdampingan, lihat
  [Parallel-row alignment](#parallel-row-alignment).

## Page

| Property | Value |
|---|---|
| Size | A4 portrait, 595.5 x 842.25 pt |
| Total pages (reference) | 4 |
| Body font | **Lucida Sans Typewriter 9 pt** |
| Dominant font size, page 1 | mixed; **9.0** dominant |
| Dominant font size, pages 2–4 | 9.0 only (page 4 also 9.75) |
| Body chars at 9.0 / page | p1 = 2460, p2 = 3306, p3 = 4050, p4 = 2313 |
| Header org font | Times New Roman (`TimesNewRomanPSMT`) **regular** 14.27 pt |
| Header address/contact font | Times New Roman (`TimesNewRomanPSMT`) **regular** 12.0 pt |
| **Title block font (BOTH lines)** | **Lucida Sans Typewriter BOLD** 12.0 pt |
| Contract number line | `LucidaSans-TypewriterBold` **9.75** pt |
| Signature block | `LucidaSans-Typewriter` 9.75 pt + `LucidaSans-TypewriterBold` 9.75 pt |

### Font inventory (measured `fontname` / `size`)

| fontname | size (pt) | Used for |
|---|---|---|
| `TimesNewRomanPSMT` | 14.27 | header `KOPERASI KARYAWAN`, `PT. SANKYU...`, `UNIT KANTOR PUSAT` |
| `TimesNewRomanPSMT` | 12.0 | header address **and** contact line (`Telp.`/`Fax.`/e-mail) |
| `TimesNewRomanPS-BoldMT` | — | **not used for visible text** (see note below) |
| `LucidaSans-TypewriterBold` | 12.0 | **ID title line AND EN title line** |
| `LucidaSans-TypewriterBold` | 9.75 | `No. :` line |
| `LucidaSans-TypewriterBold` | 9.0 | body headings / emphasis |
| `LucidaSans-Typewriter` | 9.0 | **body text (dominant)** |
| `LucidaSans-Typewriter` | 9.75 | signature block |
| `LucidaSans-TypewriterBold` | 9.75 | signature block |
| `Calibri` | 11.25 | minor inline bits |
| `ArialMT` | 9.0 | minor inline bits |
| `Arial-BoldItalicMT` | 9.0 | minor inline bits |

`(code)` The repository **does** bundle the master family. Lucida Sans Typewriter
TTFs are registered under the logical names in `PKWT_FONT_NAMES`
(`pkwt-layout.engine.ts`): `PKWT-Regular`, `PKWT-Bold`, `PKWT-Italic`,
`PKWT-BoldItalic`, plus dedicated `PKWT-Times-*` names for the kop. Times New
Roman is used **only** in the kop; body, title and signature are Lucida.

**Correction (re-measured per character).** An earlier pass of this document
reported the ID title as `TimesNewRomanPS-BoldMT` 14.27 and the `No. :` line as
`LucidaSans-TypewriterBold` 12.0. Both were wrong. Per-character re-measurement
shows the **entire title block is one typeface — Lucida Sans Typewriter Bold —
at two sizes only: 12.0 (both title lines) and 9.75 (`No. :`)**. The two title
lines are 12 pt, so they each fit **one line** and never overlap; the earlier
"stacked/overlapping 14.27 pt" reading was a mis-measurement.

The `TimesNewRomanPS-BoldMT` runs present in the raw `fontname` stream are
**invisible empty-space artifacts inherited from the source DOCX** (zero-width
glyphs). They are not visible text and must not be treated as a layout target.

## Header block (page 1 ONLY)

```
glyph-top  KOPERASI KARYAWAN                       14.27 regular (Times)
+21.0      PT. SANKYU INDONESIA INTERNASIONAL      14.27 regular
+18.0      UNIT KANTOR PUSAT                       14.27 regular
+17.56     <address line 1>                        12.0  regular
+12.49     <contact line: Telp./Fax./e-mail>       12.0  regular
```

(y = **glyph** top of the text row, origin left-top. `headerTop` = 15.84.)

**Measured advance, org → address = 17.56; address → contact = 12.49.** The kop
spacing is deliberately **non-uniform**: these two gaps are *narrower* than the
intra-block leading (~18.76 between `UNIT KANTOR PUSAT` and the first address
line, ~14.25 between the three address lines). Do not model the kop as one
uniform leading — the engine exposes `headerOrgToAddressAdvance` and
`headerAddressToContactAdvance` for exactly this reason.

### Horizontal rules under header — TWO rules

| # | x range | y (top) | thickness |
|---|---|---|---|
| rule 1 | 15.6 → 578.25 | 125.42 | **2.85 pt** |
| rule 2 | 15.6 → 578.25 | 128.27 | **0.95 pt** |

Rule span = 562.65 pt `(derived: 578.25 − 15.6)`.

## Title block (page 1 ONLY)

```
glyph-top  KESEPAKATAN KERJA WAKTU TERTENTU       12.0 Lucida Bold  centered
+14.30     STATED PERIODS LABOUR AGREEMENT        12.0 Lucida Bold  centered
   (separator rule at y=155.40, x 183.23 → 415.28, 0.75 pt)
+13.80     No. : 174/KUKP-SII/VII/2026            9.75 Lucida Bold
```

Both title lines are the **same typeface and size** (Lucida Sans Typewriter Bold
12.0), centred on `headerCenterX` = 301.14. They are two separate centred lines
with a hairline rule between them, **not** a bold/regular pair and **not** 14.27 pt.
The `No. :` line is Lucida Bold **9.75** pt.

## Two-column box (EVERY page)

Two independently painted columns. Border weight 0.75 pt, **painted as FILLS,
not strokes** (`stroke=False`, `fill=True`).

| | x0 | x1 | width |
|---|---|---|---|
| Left column | 27.02 | 296.62 | **269.6** |
| Gutter | 296.62 | 309.4 | 12.78 `(derived)` |
| Right column | 309.4 | 566.98 | **257.58** |

| Page | box top y | box bottom y | height |
|---|---|---|---|
| Page 1 | **182.4** | **766.42** | 584.02 `(derived)` |
| Pages 2–4 | **31.53** | **767.92** | **736.39** |

**Key structural point (corrected):** on page 1 the column box top is **182.4**,
which sits *below* the whole title block (`No. :` at 172.4) and *below* both
header rules (125.42 / 128.27). The earlier claim that "box top 125.42 == rule y,
box hangs directly off the rule" was a **mis-measurement**: the rect pdfplumber
reports at y=125.42 with thickness 2.85 is **header rule 1**, not the column box.
The box is a separate fill that begins at 182.4.

**Border model (measured, do not simplify).** The 0.75 pt border is not a single
stroked rectangle. Vertical bars are painted **outside** the nominal column edges
(`x0−0.75 → x0` and `x1 → x1+0.75`) and span only the *inner* height, while the
top/bottom edges span the **full outer width**. Verified outer edges:
`26.27 → 27.02`, `296.62 → 297.37` (left column) and
`308.65 → 309.40`, `566.98 → 567.73` (right column).

Text inset inside each box is ~**5 pt**: ID text starts at x≈**32** (box x0
27.02), EN text starts at x≈**315** (box x0 309.4).

## Parallel-row alignment

PKWT is a **bilingual, two-track** document: the left box carries Indonesian, the
right box carries English, and every ID paragraph has its EN counterpart on the
**same visual row**.

| y (top) | Left column (ID) | Right column (EN) |
|---|---|---|
| 186 | opening: `Pada hari ini, Kamis, ...` | opening: `Today Thursday, dated july 02, 2026,` |
| 207 | `yang bertanda tangan di bawah ini :` | `undersign below :` |
| 228 | `I. Koperasi Karyawan PT. Sankyu Indonesia` (PARTY 1) | same, in BOTH columns |
| 270 | `yang diwakili oleh Bpk HARI SUHONO` | `represented by HARI SUHONO` |
| 291 | `Selanjutnya disebut PERUSAHAAN` | `Hereinafter refer to Company` |
| 312 | `II. N a m a : IBAD UBAIDILLAH` | `II. N a m a : IBAD UBAIDILLAH` |
| 321 | `Tgl. Lahir` | `Birth date` |
| 333 | `Jenis Kelamin` | `Gender` |
| 345 | `Alamat` | `Address` |
| 357 | address detail | address detail |

`(derived)` The first body row is the engine-verified `bodyTop = 186`; the
remaining row tops are from the initial measurement pass and are **indicative**
(±1–2 pt), not independently re-verified. The structural fact — that each ID row
has an EN counterpart on the same visual row — is what matters here, and it is
confirmed.

Body sections continue to flow in parallel (ID left box, EN right box, same row)
until page 4.

## Block spacing (body) — deliberate deviation from the master

Body blocks are separated by `PKWT_GEOMETRY.blockGap` = **10 pt** of *extra*
vertical space.

The gap is applied to the **first row of each block** (carried on `PkwtRow.gapBefore`
and consumed by `renderPkwtLayout`), never to continuation rows — so a `list`
block still reads as one uninterrupted list. The **first block of the document
gets no gap**: body text must start exactly at `boxTop + PAD_TOP`.

### What the master actually does

Re-measured with pdfplumber on `docs/sample-legal-doc/pdf/PKWT DRIVER 2026.pdf`
(glyph-top deltas of the left column) — the same sample the rest of this spec is
measured from:

| Separation | Master (glyph-top delta) |
|---|---|
| body line → body line (in block) | **10.50 pt** |
| → next paragraph (one blank line) | **21.02 pt** |
| → `Pasal N` heading (two blank lines) | **31.55 pt** |

So the master separates blocks with **one to two full blank lines**, not with a
4 pt nudge. The earlier `blockGap` = 4 was not a measured master value at all: it
existed only because the constant that was supposed to provide the gap
(`paragraphGap`) had **no reader whatsoever** — the draw loop only added
`headingGapAfter` after heading rows. A block boundary therefore printed at
exactly the same spacing as an ordinary line break, which is why blocks ran
together even though 4 pt of gap was technically present.

### Why 10 and not 21

Our own line pitch is already looser than the master's: **12.17 pt** (9 pt body +
`lineGap` 1.6) versus the master's 10.50 pt. The page budget is zero-sum — every
extra point of block gap has to be paid out of the slack on the last page, which
is only ~135 pt for the built-in templates (pages 2–3 end within ~4.85 pt of
their box bottom).

**10 pt is the largest value that keeps all four built-in PKWT variants at 4
pages**; 11 pt pushes every one of them to 5 pages (measured by rendering each
variant and re-opening the PDF). Raising it further requires reducing `lineGap`
first — that is the honest lever, because `lineGap` 1.6 is itself unvalidated
against the master.

With 10 pt the vertical rhythm is unambiguous and layered:

| Separation | Rendered gap |
|---|---|
| line → line inside a block | 3.17 pt |
| block heading → its first paragraph (`headingGapAfter`) | 7.17 pt |
| block → block (`blockGap`) | **13.17 pt** |

13.17 pt also matches the master's own paragraph-to-paragraph gap (12.02 pt), so
the document keeps the master's *rhythm* — it just does not reproduce the
master's extra-loose `Pasal N` break.

### Page budget ceiling

Measured on the built-in definitions (16 block boundaries):

| `blockGap` | PKWT_DRIVER | PKWT_KASIR | PKWT_STAFF | PKWT_WAREHOUSE |
|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 4 |
| 10 | **4** | **4** | **4** | **4** |
| 11 | 5 | 5 | 5 | 5 |

Regression cover: `pkwt-layout.engine.spec.ts` — the "jarak antar-blok" suite
(row-model placement, list blocks staying flush, empty blocks not consuming a
gap), a geometric test that renders two `paragraph` blocks against one `article`
block holding the same two paragraphs and asserts the measured row delta differs
by exactly `blockGap`, and a page-count invariant that renders all four built-in
variants and asserts **4 pages** (verified to fail at `blockGap` = 11).

## Signature block (page 4, inside/below the column area)

```
y=549.0  Bekasi, 02 Juli 2026
y=561.0  KOPERASI KARYAWAN PT SANKYU...
y=573.0  UNIT KANTOR PUSAT
y=597.0  Karyawan/employee        |   Pengusaha/Perusahaan
y=705.0  IBAD UBAYDILLAH          |   HARI SUHONO
```

The signature area is a **bordered 2-column sub-table on page 4**, sitting
**inside/below** the two-column column area — not outside it.

| Property | Value |
|---|---|
| Sub-table x range | 125.4 → 459.58 (width 334.18 `(derived)`) |
| Column divider x | **297.38** |
| Row height | **~34.52** |
| Underline rects | present |
| Measured rect heights | **97.57** / **502.2** |
| Signature fonts | `LucidaSans-Typewriter` 9.75, `LucidaSans-TypewriterBold` 9.75 |

`(assumed)` The two measured heights `97.57` / `502.2` are reported verbatim from
the measurement pass; which sub-table part each height belongs to (bordered box
vs. inner divider) is not resolved by the measurement, so their mapping is
assumed here and should be re-measured before being used as a layout constant.

## Column flow

- ID flows in the left column, EN in the right column, **row-locked** (see above).
- Header + horizontal rules + title appear **only on page 1**.
- Pages 2–4 carry the painted two-column boxes with **no header, no title**.
- The two title lines do NOT force a page break.
- Reference density: 2313–4050 chars/page at 9 pt.

## Diff vs MITRA master

| Aspect | MITRA (`perjanjian-kemitraan`) | PKWT |
|---|---|---|
| Body font | Times New Roman 12 pt | **Lucida Sans Typewriter 9 pt** |
| Titles | 1 line (`PERJANJIAN KEMITRAAN`) | **2 separate centred lines**, separator rule between (Lucida Bold 12.0, both lines) |
| Box paint | 0.75 pt **strokes**, square corners | 0.75 pt **fills** (`stroke=False`) |
| Box vs rule | box top 197.42, below title | box top **182.4**, below title **and** below both rules |
| Header rule x | 18.6 → 581.25 | **15.6 → 578.25** |
| Header rule 2 y | 129.22 | **128.27** |
| Signature | final page, spans BOTH columns, outside box, 9.75 pt | **bordered 2-col sub-table inside/below column area**, 9.75 pt |
| Language tracks | single language | **bilingual parallel rows (ID / EN)** |
| Block spacing | `paragraphGap` applied per paragraph (gapAfter) | **`blockGap` 10 pt applied per block** — deliberately *not* per paragraph; see [Block spacing](#block-spacing-body--deliberate-deviation-from-the-master) |

## Defects vs current renderer — RESOLVED

All four were confirmed by this spec, then fixed by routing the PKWT pipeline
through the verified engine (`pkwt-layout.engine.ts`) instead of the generic
block renderer. Kept here as the record of *why* the generic path must not be
used for PKWT.

One correction and one addition were made later, after re-measuring the masters
(see rows 3 and 3b): the body alignment was **not** justified at all (row 3), and
the long-standing "word spacing is stripped" defect (row 3b) turned out to be a
misreading of the raw content stream and is **retracted**.

| # | Defect | Master | Was | Cause | Status |
|---|---|---|---|---|---|
| 1 | Body font family | Lucida Sans Typewriter 9.0 | PDFKit builtin **`Times-Roman`** | `contract-document.service.ts` hardcoded `fontRegular: 'Times-Roman'` (also `Times-Bold`/`Times-Italic`) in the shared `opts` and again in `renderBlocksInSingleColumn`, so **both** columns rendered Times | **FIXED** — path now delegates to `renderPkwtDocumentInto`, which registers the Lucida TTFs from `PKWT_FONT_NAMES` |
| 2 | ID column font family | Lucida Sans Typewriter 9.0 | PDFKit builtin **`Times-Roman`** | `opts` built with `fontRegular: 'Times-Roman'` and passed to the ID path; `blocksEn` routed to `renderBlocksInSingleColumn` with the same literals | **FIXED** — same delegation; verified below |
| 3 | Body alignment | **justified** (69% of lines end on one exact right edge: 291.0pt ID / 561.5pt EN) | **ragged right** (only ~12–14% of lines shared an edge) | engine drew every row with `align: 'left'`; the justification pass was missing entirely | **FIXED** — `renderPkwtLayout` now calls `drawJustifiedLine` (`table-layout.helpers.ts:112`) for every line except the last line of each paragraph, which `buildPkwtRowsFromParagraphs` marks `justify: false`. Measured after: ID 54–55%, EN 60% flush — matching the master within ~1pt. |
| 3b | ~~Word spacing stripped during wrap~~ | normal spaces | never actually reproduced | **RETRACTED.** `contract-block-renderer.ts` defaulted `align: 'justify'`, and it was recorded that pdfkit 0.19.1 "drops space glyphs" (`3.AtasPekerjaanyangdilakukanPIHAKKEDUA`). **That is FALSE.** Justification writes the inter-word gap as a *numeric offset inside the `TJ` operator* (`<-wordSpacing>`, pdfkit.js:3717), not as a space glyph (0x20) — so the raw content stream contains no space bytes, but the rendered PDF and `extract_text()` output both keep the spaces intact (verified: a justified render extracted identically to a left-aligned one). | **NO BUG** — the per-line drawing in the engine is still kept, but for the real reason: it is what makes *per-line* justification (last line ragged) possible. |
| 4 | Box paint mode | fills, `stroke=False` | not measured | generic renderer stroked boxes; fill mode unverified for PKWT | **FIXED** — engine paints the 0.75 pt border as fills, with vertical bars outside the nominal column edges (see [Two-column box](#two-column-box-every-page)) |
| 5 | **EN column language** (found in the preview, not from the master) | right column is **English**, headings included (`Article 1 / Agreement Purpose` … `Article 11 / Completion of Complain`) | right column showed **Indonesian**: `Pasal 1\nMaksud Kesepakatan`, `Para Pihak`, `Ruang Lingkup dan Posisi`, `Jangka Waktu`, `Upah Karyawan`, `Penutup`, plus Indonesian opening/recitals/closing | **two causes.** (a) `englishSections` was typed `Record<string, string[]>` so the **map key was used as the heading** — and the keys were the *Indonesian* headings (`'Pasal 1\nMaksud Kesepakatan'`); only the paragraphs were English. (b) `toLanguageBlocks(definition, true)` hardcoded the Indonesian non-Pasal headings and passed `openingLine`/`recitals`/`closingParagraphs` through unchanged. Additionally `__TERM_DATE__`/`__WAGE_AMOUNT__` expand to **Indonesian sentences**, so Article 2 ¶1 and Article 3 ¶1 were Indonesian even inside the English articles. | **FIXED** — `englishSections` is now `Record<string, { heading; paragraphs }>` keyed by the Indonesian heading (pairing key only) and `definitionToContentDefinition` reads `body.heading`; new `englishBody` supplies the five non-Pasal blocks in English; `__EN_TERM_DATE__`/`__EN_WAGE_AMOUNT__` give the English sentences. All four PKWT variants now produce **19 EN blocks ↔ 19 ID blocks, 1:1**. Verified end-to-end from the **published DB versions**, not just from seed code. |

**Row 5 needs a data migration, not just a code fix.** A published template version
is an immutable snapshot: correcting `englishSections`/`englishBody` in the code
changes only what *future* seeds and publishes produce. Every already-published
PKWT version keeps its Indonesian `.languages.en`. `scripts/upgrade-pkwt-english-content.ts`
republishes them (new `versionNumber`, old versions `ARCHIVED` not deleted) —
dry-run by default, `--confirm` to apply, idempotent on re-run. It deliberately
does **not** gate on ID/EN body-shape alignment: a legacy `contentOverrides` that
shortens one side (e.g. `recitals`) would otherwise make the script re-publish
forever. Misalignment is reported as `bodyAligned` instead.

**Root cause (as corrected during the fix):** this was a **wiring bug, not a
missing-font bug.** The body size was already correct, and the master family was
already available in the repo — registered under `PKWT_FONT_NAMES` in
`pkwt-layout.engine.ts`. The service simply passed PDFKit builtin `Times-*`
literals instead of those registered Lucida names. No new font had to be
bundled.

A **second, structural** defect was found alongside these: the old path rendered
the ID and EN columns as **two independent streams**, so the two languages were
never row-locked. `renderParallelColumns` did not exist as such; the two-column
strategy was inline in `renderSnapshotPdf` and had no row-pairing, meaning the
master's row-aligned bilingual layout was unreachable on that path *regardless*
of the font bug. The engine's `buildPkwtRows` is what supplies row-locking.

### Verification after the fix

`npx ts-node scripts/verify-pkwt-pipeline.ts` renders the **production**
definitions (`CONTRACT_DOCUMENT_DEFINITIONS` → `definitionToContentDefinition`)
and re-measures the output with `pdfplumber`. All four PKWT variants
(DRIVER, KASIR, STAFF, WAREHOUSE) match the master:

| Check | Master | Measured |
|---|---|---|
| Pages | 4 | 4 |
| Dominant glyph size | 9.0 pt | 9.0 pt |
| Body/title font | Lucida Sans Typewriter | `LucidaSans-Typewriter` + `LucidaSans-TypewriterBold` embedded |
| Kop font | Times New Roman (regular) | `TimesNewRomanPSMT` only |

The `Times-*` literals now survive in `contract-document.service.ts` **only** on
the MITRA path, where Times is correct.

`(RETRACTED)` ~~A third, distinct failure mode is visible in row 3: the run
`3.AtasPekerjaanyangdilakukanPIHAKKEDUA` has **all intra-word spaces removed**,
which is characteristic of a per-word draw loop that measures/draws each word
separately and forgets to re-emit the separating space at a line/fit boundary.~~
**This was wrong.** That string is what a *raw content-stream* read of a
justified line looks like: pdfkit emits the inter-word gap as a numeric offset
inside the `TJ` operator (`<-wordSpacing>`), not as a space glyph, so no space
bytes appear between the word strings. The rendered PDF and the text extracted
by pdfplumber both keep every space intact — a justified render extracts
identically to a left-aligned one. There is no separate wrapping bug; see
[PKWT visual spec](pkwt-visual-spec.md) rows 3 and 3b for the measurements.

`(assumed)` Defect row 4 is stated at the level of confidence available from the
code reading only; the column-box fill/stroke behaviour of the current renderer
was not measured for PKWT.

## Numbering

- PKWT uses **roman party markers** (`I.`, `II.`) and colon-terminated label
  lines, not `PASAL n` headings.
- Section bodies use Lucida `9.0`; emphasis/headings use
  `LucidaSans-TypewriterBold 9.0`.
- No bullets, no merging/summarising, no re-ordering of the parallel rows.
