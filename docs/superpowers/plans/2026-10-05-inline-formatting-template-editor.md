# Editor Pemformatan Inline pada Template Kontrak (PKWT & MITRA) — Implementation Plan

**Date:** 2026-10-05
**Feature:** Pemformatan teks terbatas: **Bold**, **Italic**, **Underline** + perataan **Left**, **Center**, **Right**, **Justify**
**Status:** Fase 1 ✅, Fase 2a ✅, Fase 2b ✅ (PKWT), Fase 2c ✅ (MITRA), Fase 2d ✅ (2026-10-05), Fase 3 validator ✅ + **audit DB ✅ (0 blocking / 0 align)** (2026-10-05), **Fase 4 frontend ✅** (2026-10-05). **Seluruh fase selesai** — sisa hanya dua item OPSIONAL (lihat catatan akhir).
**Revisi 2026-10-05 (a):** lingkup dipersempit ke 4 kontrol saja (Justify, Bold, Italic, Underline). Dukungan `list` dan `table` dikeluarkan dari lingkup.
**Revisi 2026-10-05 (b):** perataan diperluas dari 2 nilai (`justify`/`left`) menjadi **4 nilai**: `left`, `center`, `right`, `justify`.
**Revisi 2026-10-05 (c):** keputusan terbuka dikunci; Fase 1 diimplementasikan (lihat **Plan vs Implementation Reconciliation**).
**Revisi 2026-10-05 (d):** Fase 2a diimplementasikan sebagai berkas baru `inline-run-layout.ts` (bukan menyunting `table-layout.helpers.ts`) — lihat penyimpangan #6.
**Revisi 2026-10-05 (e):** Fase 2b (PKWT) diimplementasikan. Dua bug PDFKit nyata ditemukan oleh tes dan diperbaiki — lihat penyimpangan #10 dan #11.
**Revisi 2026-10-05 (f):** Fase 3 **audit** dijalankan: `backend/scripts/scan-inline-mark-collisions.ts` dibuat dan dijalankan pada **seluruh 43 versi template** (semua keluarga, semua status) → **blocking=0, align=0, warning=0, info=14**, dan seluruh 14 temuan `info` berada di versi **ARCHIVED**. Lihat **Verifikasi audit Fase 3**.
**Berkas terkait:** `docs/superpowers/plans/2026-09-29-dynamic-contract-template-versioning.md`, `docs/pkwt-visual-spec.md`, `docs/perjanjian-kemitraan-visual-spec.md`, `docs/contract-template-versioning-decisions.md`

---

## Goal

Memberi Admin **7 kontrol pemformatan** di dalam blok teks Template Kontrak (PKWT dan MITRA) langsung dari editor yang sudah ada:

| Kontrol | Sifat | Bentuk tersimpan |
|---|---|---|
| **Bold** | Mark karakter (sebagian teks) | `**teks**` di dalam string |
| **Italic** | Mark karakter (sebagian teks) | `*teks*` di dalam string |
| **Underline** | Mark karakter (sebagian teks) | `__teks__` di dalam string |
| **Left** (Rata Kiri) | Perataan **tingkat blok** (bukan mark karakter) | `align: 'left'` pada blok |
| **Center** (Rata Tengah) | Perataan tingkat blok | `align: 'center'` pada blok |
| **Right** (Rata Kanan) | Perataan tingkat blok | `align: 'right'` pada blok |
| **Justify** (Rata Kanan-Kiri) | Perataan tingkat blok | `align: 'justify'` pada blok |

Semua dikerjakan **tanpa**:

1. mengubah tata letak PDF — margin, kolom, ukuran font, dan perataan kop tetap milik renderer;
2. mengubah satu byte pun pada output template yang tidak memakai pemformatan;
3. merusak versi template `PUBLISHED` yang sudah ada (snapshot immutable);
4. merusak penguncian baris ID/EN pada PKWT, maupun batas 2 baris judul pasal.

Target UX: **semi-WYSIWYG** — toolbar `B I U | ⯇ ⯈ ≡` pada field teks, dengan modal **Pratinjau PDF** yang sudah ada sebagai acuan akhir 1:1.

### Dua temuan penting

#### (1) Perataan sudah justified secara default

**Paragraf badan kontrak sudah justified secara default hari ini.** Ini terverifikasi di kode, bukan asumsi:

| Jalur | Bukti | Perilaku sekarang |
|---|---|---|
| MITRA | `mitra-layout.engine.ts:560` — `const align = o.align ?? 'justify'`; `paragraphOpts()` (`:701-704`) **tidak** menimpa `align` | Blok `paragraph` dan `article.paragraphs` justified |
| PKWT | `pkwt-layout.engine.ts:582-583` — `idJustify: !idBold && left !== undefined && !left.lastOfPara` | Semua baris badan justified kecuali baris terakhir paragraf |
| Legacy | `contract-block-renderer.ts:144` — `align: opts2.align ?? 'justify'` | Justified |

Konsekuensinya: nilai default (properti `align` tidak ada) **wajib** berarti "perilaku sekarang" supaya tidak ada regresi. `align: 'justify'` eksplisit menghasilkan output yang **sama persis** dengan tanpa `align`, sehingga tombol Justify berfungsi sebagai cara **kembali** ke perilaku default setelah admin memilih `center`/`right`/`left` — bukan sebagai perubahan tersendiri.

#### (2) Perataan bersifat NETRAL-TINGGI → paginasi aman

Ini temuan yang paling menentukan keamanan fitur ini:

| Bukti | Detail |
|---|---|
| PKWT | `measureRow()` (`pkwt-layout.engine.ts:1037-1046`) memanggil `doc.heightOfString(row.id, { width: innerW0, lineGap: G.lineGap })` — **tanpa** `align` |
| MITRA | `writeText()` (`:645-646`) memang meneruskan `align`, tetapi PDFKit memecah baris **hanya berdasarkan `width`**; perataan tidak mengubah titik pemecahan |

Artinya: `left`, `center`, `right`, dan `justify` menghasilkan **jumlah baris yang identik** untuk teks dan lebar yang sama. Yang berubah hanya posisi horizontal di dalam kotak baris. Karena jumlah baris tidak berubah:

- paginasi tidak berubah;
- `PKWT_GEOMETRY` / `MITRA_GEOMETRY` tidak perlu disentuh;
- penguncian baris ID/EN pada PKWT tetap utuh (`measureRow` mengembalikan tinggi yang sama untuk kedua kolom).

Bandingkan dengan jalur mark (bold/italic): font bold **lebih lebar**, sehingga pemecahan baris **bisa** berubah. Karena itu mark dan perataan diperlakukan sebagai dua sumbu terpisah dengan tingkat risiko berbeda, dan perataan jauh lebih aman.

Konsekuensi praktis: perataan boleh diterapkan lebih luas daripada mark. Yang tetap dilarang hanyalah perataan pada blok yang tidak punya teks badan (`signature`, `pageBreak`), pada `list`/`table` (perataan sendiri), dan pada `title`/`subtitle` (chrome kop) — lihat **Matriks dukungan per lokasi**.

**Namun** — netral-tinggi harus **dibuktikan**, bukan diasumsikan. Karena itu ada gerbang khusus: **jumlah halaman pada keempat varian PKWT produksi** diukur dengan pdfplumber untuk mark + keempat nilai `align`, dan harus tetap sama (lihat **Testing Plan → Kasus uji khusus perataan**). Ini bukti yang lebih kuat daripada mengukur tinggi baris, karena yang diukur adalah dokumen legal yang sebenarnya.

---

## Decisions

| Area | Keputusan | Alasan |
|---|---|---|
| Bentuk representasi | Markup inline di dalam string yang sudah ada (`**bold**`, `*italic*`, `__underline__`) | Schema `contentDefinition` tidak berubah; versi `PUBLISHED` lama tetap valid; kedua engine tetap menerima `string` |
| Cakupan fitur | **Hanya** 7 kontrol: Bold, Italic, Underline + Left, Center, Right, Justify | Sesuai kebutuhan; menghindari ukuran/warna font dan tata letak yang merusak geometri master |
| Lokasi mark (B/I/U) | `paragraph`, `title`, `subtitle`, dan `article.paragraphs` | Lokasi dengan risiko geometri paling kecil |
| Lokasi perataan | Hanya `paragraph` dan `article` | Blok yang punya teks badan; `title`/`subtitle` adalah chrome, `list`/`table` punya perataan sendiri |
| Lokasi **tidak** didukung | `list.items[]`, sel `table`, `article.heading` | Di luar kebutuhan; ditolak validator agar tidak mencetak `**` literal di PDF legal |
| Judul pasal (`article.heading`) | **Tanpa** mark — mark di sini = error publish. **Perataan mengikuti bloknya** | Mark mengubah tinggi (2 baris dijaga); perataan netral-tinggi sehingga aman diikuti |
| Normalisasi saat simpan | **Tidak ada.** Renderer parse secara lenient; validator hanya **melaporkan** | Menjaga prinsip PASSTHROUGH: kode tidak menambah/mengubah redaksi yang tersimpan |
| Delimiter tanpa pasangan | Diperlakukan sebagai teks literal (tidak dibuang) | Tidak boleh ada karakter yang hilang dari dokumen legal |
| Placeholder `{{...}}` | Opaque — isinya tidak pernah di-parse sebagai markup | Mencegah key ber-underscore (`{{custom.ktp_issued_date}}`) salah tafsir |
| Jalur render | **Dua sumbu terpisah**: teks tanpa mark memakai jalur lama 100% utuh; `align` absen memakai rumus perataan lama | Menjamin nol regresi pada seluruh template yang sudah ada |
| Perataan | Properti blok opsional `align: 'left' \| 'center' \| 'right' \| 'justify'`; **absen = perilaku sekarang** | Badan kontrak sudah justified default; tombol perataan menggantinya secara eksplisit tanpa menyentuh template lama |
| Perataan netral-tinggi | **Dibuktikan dengan tes**, bukan diasumsikan | Jumlah baris hanya bergantung `width`; ini yang membuat perataan jauh lebih aman daripada mark |
| Mark + perataan bersamaan | **Perataan run-aware WAJIB** (bukan opsional) | Admin memakai Bold dan Center/Justify sekaligus; baris campuran tetap harus rata sesuai pilihan |
| Dependensi frontend | **Tanpa** dependensi baru (textarea + toolbar) | Menghindari contentEditable/Tiptap yang menuntut sanitizer + migrasi data |
| Versioning / Prisma | Tanpa perubahan schema | Fitur murni representasi teks + satu properti blok opsional |

## Non-Goals

Dikeluarkan secara eksplisit karena tidak dibutuhkan:

- **Mark B/I/U pada `list.items[]` dan sel `table`** — keduanya tetap teks polos.
- **Mark pada `article.heading`** — sudah bold penuh dan dibatasi 2 baris.
- **Perataan pada `list`, sel `table`, `title`, dan `subtitle`** — `list`/`table` punya perataan sendiri (left / per-kolom); `title`/`subtitle` adalah chrome kop.
- **Ukuran font, keluarga font, warna teks, margin, jumlah kolom, spasi baris** — tetap milik renderer.
- **Gambar, hyperlink, tabel bersarang, bullet kustom, blok baru.**
- **HTML/CSS bebas atau `contentEditable`.**

Catatan: `left`, `center`, `right`, dan `justify` **masuk lingkup** — keempatnya tersedia sebagai tombol perataan untuk blok `paragraph` dan `article`.

Tetap di luar lingkup untuk alasan teknis:

- Migrasi versi `PUBLISHED` lama (tidak perlu — representasi backward-compatible).
- Mengubah `PKWT_GEOMETRY` / `MITRA_GEOMETRY`.
- Menghidupkan kembali `app/composables/useTemplateContentEditor.ts` (saat ini tidak direferensikan komponen mana pun).
- Formatting pada blok `signature` dan `pageBreak`.

---

## Current State — fakta terverifikasi

Semua baris di bawah diperiksa langsung pada kode, bukan asumsi.

| Lapisan | Berkas | Fakta |
|---|---|---|
| Halaman | `app/pages/settings/contract-templates.vue` | Membuka `TemplateContentModal`; hanya `auth.canManageMasterData` yang boleh masuk |
| Modal editor | `app/components/kontrak/TemplateContentModal.vue` (1611 baris) | Mengelola `draft.contentDefinition.languages.{id,en}`; `insertField()` di `:611-655` menyisipkan `{{key}}` dengan **menempel ke akhir** string (`appendTo`), bukan pada posisi kursor |
| Kartu blok | `app/components/kontrak/TemplateBlockCard.vue` | `UTextarea` di-bind **langsung ke string**: `block.text` (`:328`), `block.heading` (`:345`), `block.paragraphs[p]` (`:366`); `UInput` untuk `block.items[p]` (`:419`) dan sel tabel `r[c.key]` (`:483`). `onHeadingKeydown` (`:80-84`) menjaga judul pasal maks 2 baris |
| Pemindai field | `app/utils/field-usage.ts` | Fungsi murni; `PLACEHOLDER_RE` (`:49`) memindai `text`, `heading`, `paragraphs`, `items`, `columns.label`, `rows` |
| Harness FE | `scripts/check-field-usage.mjs` | Pola verifikasi utilitas `app/` tanpa test runner: transpile dengan `typescript`, jalankan di Node, `process.exit(1)` bila gagal |
| Validator | `backend/src/contract-templates/template-schema.validator.ts` | `BLOCK_TYPES` (`:4-13`); `PLACEHOLDER_REGEX` (`:25`); `MAX_ARTICLE_HEADING_LINES = 2` (`:37`); `normalizeArticleHeading()` (`:40`); `normalizeArticleHeadings()` (`:65`); `validateContentDefinition()` (`:118`); `collectAllPlaceholders()` (`:308`); `normalizeCustomPlaceholders()` (`:350`) |
| Normalisasi | `contract-template-versions.service.ts` | Jalur preview memanggil `normalizeCustomPlaceholders()` + `normalizeArticleHeadings()` (`:290-296`); jalur `renderPreviewPdf()` (`:316`) memanggil `normalizeArticleHeadings()` (`:332`) |
| Render PKWT | `pkwt-document.renderer.ts` → `blocksToPkwtParagraphs()` (`:128-176`) | Menghasilkan `PkwtParagraph{text, bold, blockId, blockIndex}`: `paragraph` → `bold:false` (`:143`), `article.heading` → `bold:true` (`:148`), `article.paragraphs` → `bold:false` (`:150`), `list` → `bold:false` (`:158`) |
| Engine PKWT | `pkwt-layout.engine.ts` | `PKWT_FONT_NAMES` (`:259-271`) sudah punya `regular/bold/italic/boldItalic`; `PkwtRow` (`:280-305`) punya `idBold`/`enBold`/`idJustify`/`enJustify` **per kolom**; `buildPkwtRowsFromStructuredParagraphs()` (`:529`) memakai `wrapCellLines()` (`:540`); `renderPkwtLayout()` (`:1021`), `measureRow()` (`:1037-1046`), `drawCell()` (`:1060-1072`), loop baris (`:1074-1103`) |
| Render MITRA | `mitra-document.renderer.ts` | `resolveMitraFonts()` (`:35-42`) hanya `regular/bold/italic` — **belum ada bold-italic** |
| Engine MITRA | `mitra-layout.engine.ts` | `MITRA_FONT_NAMES` (`:256-260`); `writeText()` (`:543`); cabang blok `paragraph` (`:737`), `article` (`:741-756`), `list` (`:758-773`), `table` (`:775`); cabang hanging-indent (`:593-642`); alur paragraf lintas halaman (`:644+`) |
| Ukur / justifikasi | `table-layout.helpers.ts` | `computeColumnWidths()` (`:36`), `computeRowHeight()` (`:51`), `wrapCellLines()` (`:70`), `drawJustifiedLine()` (`:112`) — **semuanya mengukur dengan satu font aktif** |
| Tes | `backend/jest.config.js` | `rootDir: 'src'`, `testRegex: '.*\\.spec\\.ts$'`, `ts-jest` + `tsconfig.test.json` |
| Jalur pratinjau | `contract-template-versions.service.ts:338-340` | PKWT → `createPkwtPdfBuffer`, MITRA → `createMitraPdfBuffer` — **mesin yang sama** dengan Generate Kontrak, sehingga pratinjau 1:1 secara konstruksi |

Konsekuensi langsung dari tabel di atas: **seluruh nilai teks di jalur kontrak hari ini adalah `string` polos.** Tidak ada parser markup, tidak ada sanitizer, dan tidak ada tempat di kedua engine yang menerima selain `string`. Itulah alasan representasi harus tetap string.

## Mengapa bukan WYSIWYG bebas

Tiga batasan keras, semuanya berasal dari kode dan spec yang sudah ada:

1. **Tata letak milik renderer.** Dinyatakan eksplisit di `contract-block-renderer.ts:10` (*"Layout tetap milik renderer (margin, kolom, font) — admin hanya mengatur konten"*) dan di `docs/pkwt-visual-spec.md:16-18` (aturan PASSTHROUGH). Ukuran font, warna, perataan, dan margin tidak boleh menjadi domain editor.
2. **PKWT terkunci per baris.** Kolom ID dan EN harus duduk pada `y` yang sama; `buildPkwtRowsFromStructuredParagraphs()` memasangkan paragraf **per `blockId`/`blockIndex`** supaya perbedaan jumlah paragraf tidak menggeser seluruh dokumen. Pemformatan yang menambah tinggi di satu sisi menggeser penguncian itu.
3. **Judul pasal maks 2 baris.** Tingginya diukur dengan asumsi tersebut (`MAX_ARTICLE_HEADING_LINES`, `keepWithNextLines`). Mark yang menambah baris merusak paginasi.

Tambahan: keputusan desain yang sudah terdokumentasi di plan versioning (`:34`) adalah *"Editor terstruktur, bukan HTML/WYSIWYG bebas"*.

**Ruang aman yang tersisa:** pemformatan karakter inline — bold, italic, underline — tanpa menyentuh tata letak.

---

## Model Konten — mark inline + properti blok `align`

Teks tetap `string`, ditambah **satu properti blok opsional** (`align`). Bentuk array (`paragraphs`, `items`, `rows`) **tidak berubah** sama sekali.

### Sintaks

| Penulisan | Efek | Font |
|---|---|---|
| `**teks**` | Bold | PKWT: `PKWT-Bold`; MITRA: `MitraTimesBold` |
| `*teks*` | Italic | PKWT: `PKWT-Italic`; MITRA: `MitraTimesItalic` |
| `__teks__` | Underline | Font aktif + garis bawah |
| `\*` `\_` `\\` | Escape → karakter literal | — |

### Aturan parsing (wajib, dan diuji)

1. **Placeholder `{{...}}` bersifat opaque.** Setiap rentang `{{ ... }}` di-ekstraksi lebih dulu dan tidak pernah di-parse sebagai markup. Ini melindungi key seperti `{{custom.ktp_issued_date}}` (ber-underscore) dan `{{employee.fullName}}`.
2. **Delimiter tanpa pasangan menjadi teks literal** — tidak dibuang. Invariant yang dipegang: `runsToText(parseInlineRuns(t)) === t` untuk seluruh `t` tanpa mark (diverifikasi 10 sampel teks legal) dan serialisasi kanonik bersifat idempoten.
3. **Pasangan TANPA isi juga menjadi teks literal.** `a****b` tidak boleh berubah menjadi `ab` — keempat bintang itu akan hilang dari dokumen legal. Diperlakukan sama seperti delimiter tak berpasangan.
4. **Tidak ada normalisasi otomatis saat simpan.** Renderer parse secara lenient; validator hanya melaporkan. Alasannya: mengubah string tersimpan berarti kode "mengubah redaksi", yang dilarang aturan PASSTHROUGH (`docs/pkwt-visual-spec.md:16-18`).
5. **Mark boleh melintasi `\n`** di dalam satu nilai string. Setiap baris hasil wrap membawa run-nya sendiri.
6. **Mark tidak berlaku di lokasi yang tidak didukung.** `validateInlineMarks(text, { allowMarks: false })` menjadikan mark **yang benar-benar sah** sebagai **error publish** dengan pesan yang menyebut lokasinya. Berlaku untuk `article.heading`, `list.items[]`, sel `table`, dan blok `signature`/`pageBreak`. Yang diperiksa `hasInlineMarks()`, **bukan** `containsMarkDelimiters()` — tanda `*` tunggal yang tidak berpasangan tetap lolos karena tercetak apa adanya (lihat **Rekonsiliasi #2**).
7. **Mark tidak menyentuh batas baris/paragraf pada tingkat blok** — hanya di dalam nilai string.
8. **Nesting/overlap:** diizinkan dan dikombinasikan pada level run (`bold+italic`, `bold+underline`, dst.). Parser memasangkan delimiter **per jenis mark secara independen** (bukan tumpukan global), sehingga `**tebal *dan miring***` terdefinisi tanpa aturan tumpukan yang rumit.
9. **`_` tunggal bukan delimiter.** Hanya `__` (underline) dan `*` (italic) yang dikenali, sehingga `snake_case_field` tidak pernah salah tafsir.
10. **Perataan tidak memengaruhi parsing mark.** Keduanya orthogonal: mark ada di dalam string, `align` di tingkat blok.

### Bentuk data internal (bukan bentuk tersimpan)

```ts
/** Satu potongan teks dengan gaya seragam. */
export interface InlineRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}
```

`InlineRun[]` **hanya hidup di dalam proses render** — tidak pernah ditulis ke database, tidak pernah muncul di API.

### Mengapa bukan sidecar offset

Alternatif yang dipertimbangkan dan **ditolak**: menyimpan teks polos + daftar rentang `{start,end,mark}`. Alasan penolakan:

- `normalizeCustomPlaceholders()` (`template-schema.validator.ts:350-393`) **menyisipkan `custom.`** (7 karakter) ke dalam teks saat publish. Setiap offset setelah titik sisipan akan bergeser dan mark akan menempel pada karakter yang salah — kegagalan senyap pada dokumen legal.
- Rentang harus diperbaiki ulang di `normalizeArticleHeadings()` (`:65-83`) yang memangkas baris dan spasi ujung.
- `insertField()` di editor menempel `{{key}}` ke akhir string, sehingga setiap penyisipan juga menggeser offset.

Dengan markup inline, mark **bergerak bersama teksnya** di seluruh jalur normalisasi tersebut, sehingga tidak mungkin desinkron.

### Risiko sintaks terhadap redaksi lama

Karakter `*` dan `_` bisa saja muncul di teks legal lama. Perilakunya:

| Kasus | Hasil |
|---|---|
| `*` atau `_` tunggal (tanpa pasangan) | Teks literal — output **tidak berubah** |
| `**` / `__` berpasangan di teks lama | Akan dirender bold/underline. **Ini satu-satunya perubahan perilaku yang mungkin terjadi.** |
| `{{custom.a_b}}` | Aman — placeholder opaque |
| Teks di dalam blok `table`/`list` | Tidak di-parse — mark di sana **ditolak validator**, bukan dicetak literal |

Mitigasi untuk baris kedua: `scripts/scan-inline-mark-collisions.ts` (Fase 3) memindai seluruh versi template yang ada dan melaporkan setiap nilai teks yang sudah mengandung `**`/`__` berpasangan **sebelum** fitur dinyalakan, sehingga tim dapat memutuskan perbaikan manual per temuan.

### Perataan — properti blok `align`

Perataan **bukan** mark karakter, jadi tidak ditulis di dalam string. Ia properti opsional pada blok:

```ts
{ id: 'para-1', type: 'paragraph', text: '...', align: 'center' }      // rata tengah
{ id: 'para-2', type: 'paragraph', text: '...' }                       // default: perilaku sekarang
{ id: 'sec-1',  type: 'article', heading: 'PASAL 1', paragraphs: [...], align: 'left' }
```

| Nilai `align` | Efek | PDFKit |
|---|---|---|
| tidak ada | **Perilaku sekarang** (badan justified, judul center/left, list/table left) | — |
| `'justify'` | Rata kanan-kiri; baris terakhir tiap paragraf tetap rata-kiri | `drawJustifiedLine` |
| `'left'` | Rata kiri | `align: 'left'` |
| `'center'` | Rata tengah | `align: 'center'` |
| `'right'` | Rata kanan | `align: 'right'` |
| nilai lain | Ditolak validator (`BLOCK_ALIGN_VALUES`) | — |

**Perataan berlaku untuk seluruh baris teks blok itu, termasuk `article.heading`.** Alasannya: "Rata Tengah" pada sebuah pasal harus menengahkan pasal itu secara utuh — judul dan uraiannya. Judul yang tetap menempel kiri di atas uraian yang tengah terlihat rusak. Bila admin butuh judul dan uraian dengan perataan berbeda, ia memecah blok — sama seperti escape hatch untuk kasus per-paragraf.

**Pengecualian `'justify'`:** justifikasi **tidak** merentangkan baris terakhir sebuah paragraf (sama seperti Word/LaTeX dan sama dengan perilaku sekarang). Karena `article.heading` adalah paragraf tersendiri yang hanya satu baris, `align: 'justify'` pada blok `article` **tidak** akan merentangkan judulnya. Jadi `'justify'` aman dipasang di mana saja.

**Mengapa tingkat blok, bukan tingkat paragraf:** `article.paragraphs` bertipe `string[]`. Per-paragraf akan menuntut bentuk `Array<string | { text, align }>`, yang menyentuh `validateContentDefinition()`, `blocksToPkwtParagraphs()`, kedua engine, `app/utils/field-usage.ts`, `default-template-definition.ts`, seeder, dan seluruh versi `PUBLISHED` yang sudah tersimpan. Risikonya tidak sepadan. Tingkat blok menambah satu properti opsional dan **nol** perubahan bentuk array.

**Konsekuensi yang diterima:** satu blok `article` punya satu pengaturan perataan untuk semua paragrafnya. Ini juga lebih mudah dipahami pengguna daripada pengaturan tersembunyi per paragraf.

**Mengapa validator tidak perlu perubahan struktural:** `validateContentDefinition()` (`template-schema.validator.ts:169-252`) hanya memeriksa field **wajib** per tipe blok dan tidak pernah menolak properti tambahan. Jadi `align` aman ditambahkan; yang perlu ditambah hanyalah **validasi nilai** `align` itu sendiri.

**Perubahan tipe yang dibutuhkan:** `'right'` belum ada di tipe `align` yang berlaku sekarang, jadi harus ditambahkan di dua tempat:

| Berkas | Baris | Sekarang | Menjadi |
|---|---|---|---|
| `mitra-layout.engine.ts` | `:548` | `align?: 'left' \| 'center' \| 'justify'` | `align?: 'left' \| 'center' \| 'right' \| 'justify'` |
| `contract-block-renderer.ts` | `:132` | `align?: 'left' \| 'justify' \| 'center'` | `align?: 'left' \| 'center' \| 'right' \| 'justify'` |

### Matriks dukungan per lokasi

| Lokasi | B | I | U | Left | Center | Right | Justify |
|---|---|---|---|---|---|---|---|
| `paragraph.text` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `title.text` / `subtitle.text` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `article.paragraphs[]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `article.heading` | ❌ | ❌ | ❌ | ⤴ blok | ⤴ blok | ⤴ blok | ⤴ blok |
| `list.items[]` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| sel `table` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `signature` / `pageBreak` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Keterangan: `⤴ blok` = perataan judul mengikuti nilai `align` pada blok `article`-nya (lihat penjelasan di atas). Mark tetap **ditolak** di `article.heading` karena mark mengubah tinggi, sedangkan perataan tidak.

Sel untuk lokasi yang tidak didukung **wajib ditolak validator**, bukan diabaikan diam-diam. Alasannya: mark yang tidak dirender akan tampil sebagai `**` literal di dokumen legal. Lebih baik publish gagal dengan pesan jelas.

Catatan: kolom `title`/`subtitle` perataannya tetap milik renderer (center) karena blok itu adalah **chrome kop** — di PKWT keduanya bahkan tidak masuk kolom isi (`blocksToPkwtParagraphs` melewatinya; judul diambil `extractTitle` untuk header). Memberi tombol perataan di sana akan jadi no-op yang membingungkan.

---

## Arsitektur Target

```
contentDefinition.languages.id[]        bentuk TIDAK BERUBAH (string + properti blok opsional)
   │
   ├─ .text / .paragraphs[]  →  string bermarkup  `**bold**` `*italic*` `__underline__`
   └─ .align                 →  'left' | 'center' | 'right' | 'justify'
        │                       (properti blok opsional, absen = perilaku sekarang)
        ├─ app/utils/inline-marks.ts        ← helper murni FE (toolbar + pratinjau inline)
        │
        └─ backend: inline-marks.ts         ← helper murni BE (parse/serialize/validasi)
                 │
                 ├─ pkwt-document.renderer.ts  blocksToPkwtParagraphs()
                 │        │                      → PkwtParagraph.runs? + .align?
                 │        └─ pkwt-layout.engine.ts
                 │              buildPkwtRowsFromStructuredParagraphs()
                 │                → PkwtRow.idRuns/enRuns? + idAlign/enAlign?
                 │              renderPkwtLayout() → measureRow() / drawCell()
                 │
                 └─ mitra-layout.engine.ts
                        writeText()            (tanpa mark — JALUR LAMA, utuh; align sudah didukung)
                        writeRuns()            (ada mark — jalur baru, perataan sendiri)
                              └─ table-layout.helpers.ts
                                     wrapRunsToLines() / measureRunsLine()
                                     drawRunsLine()          ← mendukung 4 perataan
                                     wrapCellLines() / drawJustifiedLine() (dipakai apa adanya)
```

### Strategi inti: dua keputusan independen

Keputusan paling penting dalam rencana ini. Mark dan perataan adalah dua sumbu terpisah dengan **tingkat risiko berbeda**, jadi masing-masing punya gerbangnya sendiri.

**Sumbu 1 — mark karakter (per nilai teks): MENGUBAH TINGGI**

```ts
const runs = parseInlineRuns(text)          // helper murni, tanpa efek samping
const styled = runs.length > 1 || runs.some(r => r.bold || r.italic || r.underline)
```

- `styled === false` → **jalur lama dipanggil apa adanya**, tanpa satu pun perubahan kode di dalamnya.
- `styled === true` → jalur run-aware dipakai (termasuk perataan run-aware bila baris itu punya perataan).

Font bold/italic lebih lebar dari regular, sehingga pemecahan baris bisa berubah. Ini satu-satunya sumbu yang bisa menggeser paginasi, dan hanya untuk paragraf yang memang memakai mark.

**Sumbu 2 — perataan (per blok): TIDAK MENGUBAH TINGGI**

```ts
// undefined = perilaku sekarang. Hanya nilai eksplisit yang mengubah apa pun.
const align = block.align ?? defaultAlignFor(block)   // paragraph / article
```

| `block.align` | Hasil |
|---|---|
| tidak ada | Rumus lama persis (`!lastOfPara` di PKWT, default `'justify'` di MITRA). **Nol perubahan** |
| `'justify'` | Rumus lama juga — hasil identik dengan "tidak ada" |
| `'left'` | Seluruh baris blok itu rata-kiri |
| `'center'` | Seluruh baris blok itu rata tengah |
| `'right'` | Seluruh baris blok itu rata kanan |

Perataan hanya memindahkan teks secara horizontal di dalam kotak baris yang lebarnya sama, jadi **jumlah baris tidak berubah** dan paginasi aman. Karena itu perataan bisa diterapkan pada `article.heading` juga, sementara mark tidak.

Jaminan yang didapat: template yang tidak memakai mark **dan** tidak memakai `align` menghasilkan byte dan paginasi yang identik dengan sebelum fitur ini, karena kode yang dieksekusi memang kode yang sama. Ini yang membuat regresi dapat dibuktikan, bukan sekadar diharapkan.

---

## Rencana Backend

### Fase 1 — Modul murni `inline-marks.ts`

**Berkas baru:** `backend/src/contracts/inline-marks.ts`
**Tes baru:** `backend/src/contracts/inline-marks.spec.ts`

Tanpa dependensi PDFKit/NestJS/Prisma (pola sama dengan `table-layout.helpers.ts:1-8`), sehingga mudah diuji dan tidak mungkin membuat siklus modul.

```ts
export interface InlineRun { text: string, bold: boolean, italic: boolean, underline: boolean }

/** Parse lenient. Delimiter tanpa pasangan menjadi literal. Placeholder {{...}} opaque. */
export function parseInlineRuns(text: string): InlineRun[]

/** Serialisasi kanonik (dipakai hanya oleh helper editor, bukan jalur simpan). */
export function runsToText(runs: InlineRun[]): string

/** Teks tanpa mark — dipakai untuk pengukuran & pencarian placeholder. */
export function stripInlineMarks(text: string): string

/** true bila ada minimal satu mark aktif. */
export function hasInlineMarks(text: string): boolean

/** Laporkan delimiter tak berpasangan / mark di posisi terlarang. Tidak melempar. */
export function validateInlineMarks(
  text: string,
  opts?: { allowMarks?: boolean, location?: string },
): { ok: boolean, issues: InlineMarkIssue[] }

/** Apakah teks (di luar placeholder) memuat karakter delimiter sama sekali. */
export function containsMarkDelimiters(text: string): boolean
```

**Catatan lingkup modul:** `inline-marks.ts` **hanya** menangani mark karakter. Justify tidak di sini — `align` dibaca langsung oleh renderer (`block.align === 'left'`) dan divalidasi di `template-schema.validator.ts` lewat konstanta `BLOCK_ALIGN_VALUES`/`ALIGN_CAPABLE_BLOCKS` (lihat Fase 3). Pemisahan ini disengaja: mark adalah masalah parsing teks, perataan adalah masalah properti blok.

**Kasus uji** (`inline-marks.spec.ts`) — **41 tes, semuanya lulus**:

| Kasus | Harapan |
|---|---|
| `''` | `[{text:'', …false}]` |
| `'teks biasa'` | 1 run, semua mark `false` |
| `'**tebal**'` | 1 run bold, `text:'tebal'` |
| `'a **b** c'` | 3 run: `a `, `b`(bold), ` c` |
| `'*miring*'`, `'__garis__'` | italic / underline |
| `'***teks***'` | **1** run bold+italic |
| `'**tebal *dan miring***'` | 2 run: `tebal `(bold), `dan miring`(bold+italic) |
| `'*tak berpasangan'` | 1 run literal, `text === '*tak berpasangan'` |
| `'**a'`, `'__a'` | 1 run literal |
| `'**a***'` | `a`(bold) + `*` literal |
| `'a****b'`, `'****'`, `'a____b'` | 1 run literal — pasangan tanpa isi tidak menghilangkan karakter |
| `'\*literal\*'` | 1 run, `text:'*literal*'` |
| `'C:\temp'` | backslash sebelum karakter biasa dibiarkan |
| `'{{custom.ktp_issued_date}}'` | 1 run literal (underscore tidak dianggap mark) |
| `'**{{employee.fullName}}**'` | run bold, teks placeholder utuh |
| `'PASAL 1\nRUANG LINGKUP'` | tidak terpengaruh |
| Invariant: `runsToText(parseInlineRuns(t)) === t` | 10 sampel teks legal tanpa mark |
| Idempotensi kanonik: `parse(runsToText(parse(t)))` = `parse(t)` | 10 sampel bermark |
| `validateInlineMarks('**a**', {})` | `ok:true`, tanpa issue |
| `validateInlineMarks('*tak berpasangan')` | `ok:true` + 1 **warning** `unpaired` |
| `validateInlineMarks('**a**', { allowMarks:false })` | `ok:false`, error `forbidden` |
| `validateInlineMarks('PASAL 1 * CATATAN', { allowMarks:false })` | **`ok:true`** — `*` tunggal tetap lolos |
| `validateInlineMarks(null)` | aman, `ok:true` |

### Fase 2 — Rendering run-aware

Dikerjakan **sebelum** UI apa pun. Alasannya: inilah bagian yang menyentuh geometri master, dan harus terbukti aman lebih dulu.

#### Fase 2a — Helper tata letak run — ✅ SELESAI

**Berkas baru:** `backend/src/contracts/inline-run-layout.ts` (+ `inline-run-layout.spec.ts`)

**Mengapa berkas baru, bukan menyunting `table-layout.helpers.ts`** (penyimpangan #6): nol perubahan pada berkas lama = nol risiko regresi pada perilaku yang sudah terbukti, dan nama `table-layout` memang bukan tempat yang tepat untuk helper non-tabel.

```ts
export interface RunFonts { regular: string; bold: string; italic: string; boldItalic?: string }
export const INLINE_RUN_ALIGN_VALUES = ['left', 'center', 'right', 'justify'] as const
export type InlineRunAlign = (typeof INLINE_RUN_ALIGN_VALUES)[number]

/** Font per run. bold+italic jatuh ke BOLD (bukan italic) bila boldItalic tidak ada. */
export function runFont(run: InlineRun, fonts: RunFonts): string

/** Bungkus runs menjadi baris-baris; menghormati `\n`; pemecahan sama dengan wrapCellLines. */
export function wrapRunsToLines(
  doc: any, runs: InlineRun[], width: number, fonts: RunFonts, size: number,
): InlineRun[][]

/** Tinggi SATU line box dari font acuan (bukan maksimum antar-run). */
export function measureRunsLine(doc: any, font: string, size: number, lineGap?: number): number

/** Gambar satu baris runs pada x/y, satu potong per run, dengan perataan. */
export function drawRunsLine(
  doc: any, runs: InlineRun[], x: number, y: number, width: number,
  fonts: RunFonts, size: number, align?: InlineRunAlign,
): void
```

**Keempat perataan ada di dalam `drawRunsLine`** — ini bagian yang wajib, bukan opsional, karena admin memakai Bold bersama Center/Right/Justify. Algoritmanya memperluas pola yang sudah terbukti di `drawJustifiedLine()` (`table-layout.helpers.ts:112-145`):

1. Pecah baris menjadi token **kata dan spasi terpisah**; setiap token membawa font-nya sendiri (`bold`/`italic`/`boldItalic`/`regular`) dan flag underline. Spasi pemisah mewarisi gaya run **sebelumnya**, sehingga `aaa **bbb**` menghasilkan `'aaa '`(regular) + `'bbb'`(bold) — bukan spasi bergaya bold.
2. `natural = Σ doc.widthOfString(token)` dengan font token masing-masing.
3. Hitung titik awal `startX`:
   - `'left'` → `x`
   - `'center'` → `x + (width - natural) / 2`
   - `'right'` → `x + width - natural`
   - `'justify'` → `x`, lalu celah antar-kata direntangkan (langkah 4)
4. Khusus `'justify'`: spasi asli dibuang dan diganti celah `gap = (width − natural) / (jumlahKata − 1)` — persis `drawJustifiedLine()`.
5. Gambar tiap potongan dengan `doc.text(piece, cx, y, { lineBreak: false, underline })`, maju sebesar lebar potongan.
6. Jatuh ke rata-kiri bila `align === 'left'`, atau `'justify'` dengan `gap <= 0`, atau baris hanya punya satu kata. Sama seperti `drawJustifiedLine` yang sudah ada, sehingga kata tidak pernah menumpuk.
7. `center`/`right` hanya menggeser titik awal (tidak merentangkan celah), dan `startX` **dijepit minimal `x`** agar teks yang lebih lebar dari kotak tidak bocor ke luar kolom.

**Dua keputusan yang menjaga paginasi:**

- **Tinggi baris dari SATU font acuan.** `measureRunsLine()` memakai font yang diberikan pemanggil (regular), bukan maksimum antar-run. Bold/italic punya metrik ascender/descender sedikit berbeda; kalau tinggi dihitung per-run, baris bermark bisa berbeda tinggi dari baris tanpa mark dan paginasi bergeser.
- **Normalisasi spasi mengikuti `wrapCellLines`.** Deret spasi dipadatkan menjadi satu spasi, sehingga keputusan pemecahan baris identik dengan jalur lama.

**Bukti (bukan asumsi):** spec memverifikasi langsung terhadap **PDFKit nyata** (font Times sungguhan, 9 sampel × 5 lebar = 45 perbandingan):

| Pemeriksaan | Hasil |
|---|---|
| Pemecahan baris teks tanpa mark vs `wrapCellLines` | **0 mismatch / 45** |
| Selisih kerning (jumlah lebar token vs lebar gabungan) | **0.000000 pt** |
| Tinggi baris jalur run vs rumus jalur lama | **identik** (11.202) |

Konsekuensi yang tetap harus disadari: pada paragraf yang **benar-benar** memakai mark, font bold/italic lebih lebar dari regular sehingga **jumlah baris bisa sedikit berbeda**. Itu tidak dapat dihindari dan hanya terjadi pada paragraf bermark — karena itu spec regresi membandingkan teks **tanpa** mark, yang terbukti identik di atas.

#### Fase 2b — PKWT (`pkwt-layout.engine.ts` + `pkwt-document.renderer.ts`) — ✅ SELESAI

| Perubahan | Hasil implementasi |
|---|---|
| Tipe `align` | `export type PkwtAlign = InlineRunAlign` (alias, bukan daftar kedua — satu sumber kebenaran) + `PKWT_RUN_FONTS` (nama logis font untuk jalur run) |
| `PkwtParagraph` | Tambah `runs?: InlineRun[]` dan `align?: PkwtAlign` |
| `blocksToPkwtParagraphs()` | `markedRuns(text)` mengisi `runs` **hanya bila teks bermark** (`undefined` bila tidak → jalur lama). `localAlign` dari `pkwtBlockAlign(block.align)` untuk `paragraph`/`article` saja |
| `PkwtRow` | Tambah `idRuns`/`enRuns`/`idAlign`/`enAlign` |
| `buildPkwtRowsFromStructuredParagraphs()` | `toLines()` memakai `wrapRunsToLines()` bila `p.runs` ada; jika tidak `wrapCellLines()`. `BlockLine` membawa `runs` + `align`; `emitBlock()` meneruskan keduanya |
| `resolveCellAlign()` (BARU, diekspor) | Prioritas eksplisit: `align` eksplisit > `bold` → `'left'` > `justify` → `'justify'` > `'left'`. Tanpa `align`, mereproduksi rumus lama PERSIS |
| `measureRow()` | **TIDAK DIUBAH** (lihat penyimpangan #12) |
| `drawCell()` | Tanda tangan `(cell, runs, x, w, bold, align)`. Tiga jalur: `runs` → `drawRunsLine()`; `align='justify'` → `drawJustifiedLine()` (lama); selain itu → `doc.text({ align })` |
| `idJustify`/`enJustify` | **Tetap dihitung** seperti semula (kompatibilitas); tidak lagi dipakai `drawCell` secara langsung |
| `kind`, `idBold` | **Tidak berubah** |

Yang **tidak** berubah: `PKWT_GEOMETRY`, `markBlockGaps()`, `pkwtSignatureHeight()`, penomoran halaman, dan rumus `boxBottoms`.

Catatan `article.heading`: baris judul tidak pernah diberi `runs` (tetap bold penuh), tetapi **ikut memakai `align` bloknya** — sehingga `align: 'center'` menengahkan judul dan uraiannya sekaligus. Tanpa `align`, judul tetap rata-kiri seperti sekarang.

Catatan `PkwtParagraph.text`: berisi teks **setelah interpolasi** (jadi masih memuat penanda mark, mis. `'Halo **Budi**!'`). Teks polos yang dipakai untuk pengukuran ada di `PkwtRow.id`/`en` (hasil gabungan run). Ini disengaja: `p.text` hanya dibaca jalur lama, sedangkan jalur run memakai `p.runs`.

#### Fase 2c — MITRA (`mitra-layout.engine.ts` + `mitra-document.renderer.ts`) — ✅ SELESAI (2026-10-05)

| Perubahan | Detail | Status |
|---|---|---|
| Tipe `align` `writeText()` (`:548`) | Tambah `'right'` → `'left' \| 'center' \| 'right' \| 'justify'` | ✅ |
| `MITRA_FONT_NAMES` (`:263`) | Tambah `boldItalic: 'MitraTimesBoldItalic'` | ✅ |
| `resolveMitraFonts()` (`mitra-document.renderer.ts`) | Tambah `boldItalic?: \`${dir}/timesbi.ttf\`` (**opsional**, fallback ke `timesbd.ttf` bila berkas tidak ada) | ✅ (penyimpangan #14) |
| Registrasi font | Daftarkan `MitraTimesBoldItalic`; **fallback ke bold** bila `timesbi.ttf` tidak tersedia | ✅ (penyimpangan #14) |
| `writeRuns()` (baru, di samping `writeText()`) | Pre-wrap paragraf → baris runs via `wrapRunsToLines()`, gambar per baris dengan `ensureSpace()` + `nextPageForStream()` via `drawRunsLine()`. **Delegasi ke `writeText()` bila teks tanpa mark** (jalur lama utuh) | ✅ (penyimpangan #15) |
| Cabang blok `paragraph` & `article.paragraphs` | Pilih `writeRuns()` bila `hasInlineMarks()`, selain itu `writeText()` seperti sekarang | ✅ |
| Perataan blok | `block.align` ada → `mitraBlockAlign()` → diteruskan ke `writeText()`/`writeRuns()`. Tidak ada → panggilan lama tidak disentuh (default `'justify'` tetap berlaku) | ✅ |
| Judul `article` | `align: mitraBlockAlign(block?.align) ?? 'center'` — eksplisit menang, kalau tidak tetap `'center'` hardcode | ✅ |
| Cabang hanging-indent (`writeText`) | **Tidak diubah**. `writeRuns()` mengimplementasikan hanging indent sendiri via `opts.firstLineWidth` pada `wrapRunsToLines()` — paragraf bernomor bermark tidak kehilangan indentasinya (terbukti di uji geometri) | ✅ (penyimpangan #16) |
| `mitraInterpolate()` (`:274`) | Dipanggil **sebelum** parsing mark | ✅ |

Bukti verifikasi Fase 2c:

| Perintah / pemeriksaan | Hasil |
|---|---|
| `npx jest src/contracts/mitra-layout.engine.spec.ts src/contracts/mitra-document.renderer.spec.ts` | 38 + seluruh suite renderer hijau |
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| Geometri hanging indent (PDF nyata) | kolom baris lanjutan **identik bit-per-bit** antara jalur polos & jalur run (327.5pt), delta = `listHangingIndent` 13.5pt persis |
| Ekuivalensi pembungkus (teks polos) | `wrapRunsToLines` ≡ rumus word-wrap lama `writeText` pada teks sama |
| Font mark | `doc.font()` dipanggil dengan nama logis `MitraTimesBold`/`MitraTimesItalic`/`MitraTimesBoldItalic` sesuai mark; teks polos TIDAK meminta font mark |
| Gerbang paginasi | 4 varian MITRA produksi × mark × 4 `align` → jumlah halaman tak berubah |

Catatan pengukuran (penting untuk perawatan): **nama font di byte PDF TIDAK dapat dipakai untuk asersi** — PDFKit menuliskan nama INTERNAL dari TTF (`TimesNewRomanPS-BoldMT`), bukan nama logis yang didaftarkan (`MitraTimesBold`). Asersi font memakai sadapan `doc.font()` (nama logis yang diminta renderer). Selain itu, jumlah baris bermark **boleh** berbeda dari polos (bold lebih lebar); yang dikunci identik adalah geometri indentasi, bukan jumlah baris.

Catatan `paragraphOpts()` (`:701-704`): fungsi ini hanya menyetel `gapAfter`/`hangingIndent` dan **tidak** menyetel `align`, sehingga perataan jatuh ke default `'justify'` di `writeText()`. Jadi menambahkan `align` di tingkat blok tidak bertabrakan dengan logika penomoran otomatis (`NUMBERED_ITEM`) yang sudah ada.

#### Fase 2d — Jalur legacy (`contract-block-renderer.ts`) — ✅ SELESAI (2026-10-05)

`renderBlocks()` (`:98`) masih dipakai jalur non-snapshot. Agar konsisten, `writeText()` di sana juga menerima runs dan `align` dengan pola dua-sumbu yang sama. Bila tidak dikerjakan, blok tanpa mark tetap benar (jalur lama) — jadi ini opsional, tetapi disarankan agar tidak ada dua perilaku berbeda.

**Rekonsiliasi implementasi Fase 2d (2026-10-05):**

- `writeRuns()` ditambahkan di `contract-block-renderer.ts`: teks bermark digambar per potongan run (`drawRunsLine`, `lineBreak: false`) dengan keempat nilai `align`; teks TANPA mark mendelegasikan ke `writeText()` sehingga kode lama tak tersentuh. `blockAlign()` menjaga hanya `paragraph`/`article` yang membawa `align` (pola `pkwtBlockAlign`).
- **Bug paginasi ditemukan & diperbaiki:** jalur bermark awalnya memanggil `ensureSpace(lineHeight)` per baris, sedangkan jalur polos memanggil `ensureSpace(paragraphHeight)` — paragraf bermark bisa mengisi sisa kolom sementara paragraf polos dipindah UTUH, sehingga dokumen yang sama bisa berbeda jumlah halaman (4 vs 5) hanya karena ada/tidaknya mark. Perbaikan: paragraf bermark yang masih muat dalam satu kolom kini dipindah **UTUH** via `ensureSpace(paragraphHeight)` — identik dengan aturan jalur polos; hanya paragraf yang lebih tinggi dari satu kolom yang dicicil per baris. Smoke gate (dokumen panjang, plain vs bermark) kini menghasilkan jumlah halaman yang sama.
- Verifikasi: `contract-block-renderer.spec.ts` **44/44 tes** (regresi jalur polos, jalur bermark & keempat perataan, regresi pindah-UTUH), smoke spec hijau, suite contracts penuh **254/254 tes / 11 suite**, `tsc --noEmit` backend bersih, `pnpm typecheck` frontend **exit 0**.
- Catatan: `renderBlocks` tidak dipakai jalur produksi (PKWT/MITRA memakai engine masing-masing) — Fase 2d murni menjaga konsistensi jalur legacy.

#### Fitur lanjutan — `headingAlign` pada blok `article` (2026-10-05)

Setelah Fase 2d, admin meminta perataan JUDUL pasal ("PASAL 1") yang lepas dari
perataan uraian — sebelumnya `align` blok menggeser judul + uraian sekaligus.
Ditambahkan properti opsional `headingAlign`, hanya sah pada blok `article`:

- `template-schema.validator.ts` — `validateHeadingAlign()`: nilai sah sama
  dengan `align` (`BLOCK_ALIGN_VALUES`); `headingAlign` pada blok selain
  `article` ditolak. Tidak mengubah `alignedBlockCount`.
- `mitra-layout.engine.ts` (case `article`) — judul memakai
  `headingAlign ?? align ?? 'center'` (perilaku lama tetap fallback); uraian
  tetap mengikuti `align` blok.
- `contract-block-renderer.ts` (legacy, case `article`) — konsisten:
  `headingAlign ?? align ?? 'left'` (default legacy judul tetap `left`).
- `AlignButtonGroup.vue` — `defaultAlign` kini menerima `'center'` (pola hapus
  properti saat kembali ke default tetap berlaku).
- `TemplateBlockCard.vue` — grup radio "Perataan judul" di atas textarea judul
  pasal, `default-align="center"`, menulis/menghapus `block.headingAlign`.
- Spec regresi: `mitra-layout.engine.spec.ts` (opsi `align` judul berubah,
  opsi align uraian tetap; helper `draw()` kini juga merekam opsi `align`
  `doc.text()`), `contract-block-renderer.spec.ts` (2 kasus),
  `template-schema.validator.spec.ts` (3 kasus).

**Tambahan — PKWT (korosi terlambat, 2026-10-05)**: implementasi awal melewatkan
`pkwt-document.renderer.ts`. Di sana case `article` meneruskan `localAlign`
(= `block.align`) seragam ke SEMUA paragraf termasuk judul, sehingga
`headingAlign` diabaikan di preview/generate PKWT. Perbaikan: `PkwtParagraph`
sudah membawa `align` per-paragraf, jadi paragraf judul kini diberi
`align: pkwtBlockAlign(block?.headingAlign)` sendiri; paragraf lain memakai
`p.align ?? localAlign` seperti sebelumnya (template lama tak berubah — tanpa
`headingAlign`, judul kembali ke rumus lama `resolveCellAlign`: baris bold →
`'left'`). Spec regresi di `pkwt-document.renderer.spec.ts` (3 kasus).

**Tambahan — UI (default tombol vs fallback renderer, 2026-10-05)**: pola
*delete-on-default* di `AlignButtonGroup.vue` membuat klik "Rata Tengah"
MENGHAPUS `headingAlign` (karena `default-align="center"`). Di MITRA ini tak
terlihat (fallback renderer = center), tetapi di PKWT fallback = rumus lama
(baris bold → left), sehingga judul pasal PKWT tak pernah bisa di-center.
Perbaikan: `TemplateBlockCard.vue` menerima prop `headingAlignDefault`
('left' | 'center', default 'center') dan `TemplateContentModal.vue`
meneruskannya sesuai keluarga template: `isPkwt ? 'left' : 'center'` — default
tombol kini selalu persis sama dengan fallback renderer keluarga itu.
Verifikasi: PKWT renderer + engine spec 64/64 PASS; backend `tsc --noEmit`
clean; frontend `pnpm typecheck` clean.

### Fase 3 — Validator, normalisasi, dan alat audit

**`template-schema.validator.ts`**

| Perubahan | Detail |
|---|---|
| `normalizeArticleHeading()` (`:40`) | Hitung batas 2 baris pada `stripInlineMarks()`; **tetap simpan string asli** |
| `validateContentDefinition()` (`:118`) | Panggil `validateInlineMarks()` untuk setiap nilai teks, dengan `allowMarks: false` pada `article.heading`, `list.items[]`, sel `table`, dan blok `signature`/`pageBreak` |
| Validasi `align` (baru) | Tolak nilai selain `left`/`center`/`right`/`justify`; tolak `align` pada tipe blok yang tidak mendukungnya (`title`, `subtitle`, `list`, `table`, `signature`, `pageBreak`) |
| `collectAllPlaceholders()` (`:308`) | Tidak berubah — regex `{{...}}` tetap bekerja pada teks bermark |
| `normalizeCustomPlaceholders()` (`:350`) | **Tidak berubah** (mark ikut berpindah bersama teks) |
| Fungsi baru | `countInlineMarkedBlocks(content)` dan `countAlignedBlocks(content)` → dilaporkan di hasil preview agar admin tahu berapa blok berformat |

`BLOCK_TYPES` (`:4-13`) **tidak berubah** — tidak ada tipe blok baru. Yang ditambah hanya dua konstanta:

```ts
export const BLOCK_ALIGN_VALUES = ['left', 'center', 'right', 'justify'] as const
export type BlockAlign = (typeof BLOCK_ALIGN_VALUES)[number]
/** Hanya blok ini yang boleh membawa properti `align`. */
export const ALIGN_CAPABLE_BLOCKS = ['paragraph', 'article'] as const
```

**`contract-template-versions.service.ts`**

- `preview()` (`:290-296`) dan `renderPreviewPdf()` (`:316-340`): tambahkan pemanggilan validasi mark (tanpa normalisasi) supaya error judul pasal muncul di jalur preview, bukan baru saat publish.

**Alat audit (skrip sekali jalan):**

- `backend/scripts/scan-inline-mark-collisions.ts` — memindai semua `ContractTemplateVersion.contentDefinition` (draft + published), melaporkan nilai teks yang **sudah** memuat `**`/`__` berpasangan sebelum fitur dinyalakan. Dry-run default; hanya membaca.

**Rekonsiliasi implementasi Fase 3 (2026-10-05):**

- Validator menghitung `markedBlockCount`/`alignedBlockCount` dan mengembalikan `inlineMarkWarnings` berisi jalur field untuk delimiter tak berpasangan. Warning tidak memblokir publish; error mark/alignment tetap dilempar sebagai `BadRequestException` dengan `issues` terstruktur dan mencapai toast validasi di editor serta endpoint publish.
- Mark ditolak pada teks title/subtitle juga (di luar heading article, list, table, signature), karena renderer tidak menerapkan inline marks pada blok tersebut. Label kolom tabel ikut diperiksa sebagai teks tak didukung.
- `BLOCK_ALIGN_VALUES` mengalias `INLINE_RUN_ALIGN_VALUES`; hitungan alignment hanya memasukkan paragraph/article dengan nilai valid.
- Spec validator mencakup lokasi mark yang diizinkan/ditolak, alignment tak valid/tak didukung, jumlah, warning, serta hasil tes 43/43 dan TypeScript `--noEmit` berhasil.
- Ringkasan modal PDF preview menampilkan hitungan blok bermark/diratakan dan warning tak berpasangan. Validasi JSON preview ditangkap sebagai warning toast; PDF masih tetap dapat dipratinjau untuk diagnosis. Endpoint publish melempar error validasi sebelum transaksi archive/publish.
- **Verifikasi audit Fase 3 (2026-10-05, penambahan):** skrip audit collision database yang tadinya "belum dikerjakan" di atas **kini SELESAI dibuat dan dijalankan** (`npm run contract-templates:scan-inline-collisions`, alias `npx ts-node scripts/scan-inline-mark-collisions.ts`):
  - Cakupan: **43 dari 43 versi** `ContractTemplateVersion` (semua keluarga PKWT/MITRA, semua status), **strictly read-only** — tidak ada perubahan DB.
  - Hasil: **blocking=0, align=0, warning=0, info=14** → tidak ada publish yang akan ditolak, tidak ada teks warisan yang memicu perubahan validator.
  - Seluruh 14 temuan `info` berada di versi **ARCHIVED** (Mitra Driver v2/v3, Mitra Driver Truck B3, Mitra Kasir Komart, Mitra Staff Admin, Mitra Warehouse) dan semuanya adalah token warisan `__MITRA_*__` (termasuk `__MITRA_TERM__`, `__MITRA_IMBALAN__`, `__MITRA_ADDRESS__`) di `paragraph` — token ini akan ditafsirkan sebagai *underline* jika fitur inline dinyalakan, lalu dibersihkan `scrubRawTokens()` menjadi `MITRA_EMPTY_FALLBACK` di jalur MITRA (pemetaan `parseInlineRuns('__MITRA_TERM__')` = run ber-underline `MITRA_TERM`, terverifikasi langsung).
  - Keputusan: tidak ada temuan yang memerlukan perbaikan manual — versi ARCHIVED tidak dirender ulang untuk kontrak baru (kontrak memakai snapshot), jadi temuan `info` bersifat kosmetik dan tidak menghalangi aktivasi editor.
  - Skrip terdaftar di `backend/package.json` sebagai `contract-templates:scan-inline-collisions` dan aman dijalankan ulang kapan saja (mendukung `--family=`, `--status=`, `--json`, `--strict`).
- **Belum dikerjakan:** validasi eksplisit atas editan draft yang belum disimpan pada endpoint validasi JSON (saat ini ia memvalidasi versi tersimpan; preview PDF menerima konten draft).

---

## Rencana Frontend

Prinsip: **tanpa dependensi baru**, tetap `<textarea>` + `v-model` string. `insertField()` di `TemplateContentModal.vue:611` menempel `{{key}}` ke akhir string, sehingga tidak terpengaruh.

### Fase 4 — Helper + komponen field berformat

**Berkas baru 1:** `app/utils/inline-marks.ts` — cermin logika backend, fungsi murni:

```ts
export type InlineMark = 'bold' | 'italic' | 'underline'

/** Terapkan/lepas mark pada rentang seleksi. Mengembalikan teks + seleksi baru. */
export function toggleMark(
  text: string, start: number, end: number, mark: InlineMark,
): { text: string, selectionStart: number, selectionEnd: number }

/** Mark yang aktif pada posisi kursor (untuk status tombol toolbar). */
export function activeMarksAt(text: string, pos: number): Set<InlineMark>

/** Untuk pratinjau inline di editor (tanpa PDF). */
export function parseInlineMarks(text: string): Array<{
  text: string, bold: boolean, italic: boolean, underline: boolean
}>
```

**Berkas baru 2:** `app/components/kontrak/RichTextField.vue`

- `v-model` bertipe `string` (API identik `UTextarea`), prop `disabled`, `rows`, `autoresize`, `placeholder`.
- Toolbar baris pertama: tiga tombol mark **B / I / U** memakai `UButton` `size="xs"` `variant="ghost"`, status aktif dari `activeMarksAt()`.
- Toolbar baris kedua (opsional, hanya bila `showAlign`): **empat tombol perataan** yang saling eksklusif (radio):
  - `Left` — ikon `i-lucide-align-left`
  - `Center` — ikon `i-lucide-align-center`
  - `Right` — ikon `i-lucide-align-right`
  - `Justify` — ikon `i-lucide-align-justify`
- Prop & emit perataan:
  - `showAlign?: boolean` — menampilkan grup perataan (hanya `true` untuk blok `paragraph` dan `article`).
  - `align?: 'left' | 'center' | 'right' | 'justify'` + emit `update:align`.
  - `defaultAlign?: 'justify' | 'left'` — nilai yang ditampilkan sebagai "aktif" saat `align` **tidak ada**. `'justify'` untuk `paragraph`/`article` (perilaku sekarang).
- Perilaku grup perataan — **radio empat arah, bukan toggle**:
  - `align` tidak ada → tombol `defaultAlign` tampak aktif (menunjukkan perilaku nyata hari ini), sisanya tidak.
  - Klik `Justify` saat `defaultAlign === 'justify'` → **hapus** properti (emit `update:align(undefined)`) supaya payload draft bersih; PDF identik.
  - Klik nilai lain → emit `update:align(value)`.
  - Klik tombol yang sudah aktif → tidak mengubah apa pun (bukan toggle-off), karena "tanpa perataan" bukan keadaan yang bermakna di sini.
- Seleksi diambil dari `HTMLTextAreaElement.selectionStart/selectionEnd`; penggantian memakai `setRangeText` + `setSelectionRange`, sehingga undo bawaan browser tetap bekerja.
- Meneruskan `@focusin` dan `@click` ke parent agar `markFocus()` / `markBlockOnly()` di `TemplateBlockCard.vue` tetap menandai blok & sub-bagian target.
- Pratinjau inline opsional (satu blok `<div>` di bawah textarea) memakai `parseInlineMarks()`, dengan gaya `font-weight: 600` / `font-style: italic` / `text-decoration: underline`, dan `text-align: left|center|right|justify` mengikuti prop `align` (jatuh ke `defaultAlign` bila kosong). Ini pratinjau perkiraan; acuan final tetap modal **Pratinjau PDF**.

**Berkas baru 3:** `scripts/check-inline-marks.mjs` — harness mengikuti pola `scripts/check-field-usage.mjs` (transpile `app/utils/inline-marks.ts` dengan `typescript`, jalankan di Node, `process.exit(1)` bila ada assertion gagal). Ini satu-satunya cara memverifikasi logika FE karena `app/` tidak punya test runner.

### Fase 4 — Integrasi ke `TemplateBlockCard.vue`

| Lokasi | Aksi |
|---|---|
| `:325-338` — `paragraph` | `UTextarea` → `RichTextField` dengan `show-align`, `default-align="justify"`, dan `v-model:align="block.align"` |
| `:325-338` — `title` / `subtitle` | `UTextarea` → `RichTextField` **tanpa** `show-align` (perataan center milik renderer) |
| `:340-355` — `article.heading` | **Tetap `UTextarea`.** `onHeadingKeydown` (`:80-84`) dipertahankan apa adanya |
| `:356-393` — `article.paragraphs[p]` | `UTextarea` → `RichTextField` untuk mark. Grup perataan diletakkan **sekali di tingkat field "Uraian pasal"** (bukan per paragraf), karena `align` milik blok |
| `:396-445` — `list.items[p]` | **Tetap `UInput`** — di luar lingkup |
| `:447-518` — sel tabel | **Tetap `UInput`** — di luar lingkup |
| `summary` (`:103-124`) | `clean(b.text)` → `clean(stripInlineMarks(b.text))` agar ringkasan kartu tidak menampilkan `**` |
| `emptyWarnings` (`:127-142`) | `blank()` dihitung pada teks tanpa mark |

### Fase 4 — Integrasi ke `TemplateContentModal.vue`

| Lokasi | Aksi |
|---|---|
| Panel sisip field (`insertField()` `:611`) | Opsional: sisipkan `{{key}}` pada posisi kursor alih-alih akhir string, bila `RichTextField` mengekspos posisi terakhir. Perubahan kecil, terpisah dari fitur mark |
| Pemindai pemakaian (`app/utils/field-usage.ts`) | **Tidak berubah** — `PLACEHOLDER_RE` tetap menemukan `{{...}}` di dalam teks bermark |
| Panel validasi pratinjau (`:1180-1183`) | Tambahkan baris "Blok berformat: N" dari `preview.markedBlockCount` |
| Hint editor | Tambahkan teks bantuan singkat: `**tebal**`, `*miring*`, `__garis bawah__` |

### Verifikasi Fase 4 (2026-10-05)

| Gerbang | Hasil |
|---|---|
| `node scripts/check-inline-marks.mjs` | ✅ exit 0 — 36 assertion (parse, pelindung teks legal, activeMarks, toggleMark) **+ 15 kasus paritas: `parseInlineMarks` (FE) identik dengan `parseInlineRuns` (BE) pada semua sampel**, termasuk placeholder opaque, `snake_case`, delimiter ganjil, pasangan kosong, escape, mark lintas baris, dan token warisan `__MITRA_*__` |
| `pnpm typecheck` | ✅ exit 0 (vue-tsc, tanpa error) |
| Lint berkas Fase 4 | ✅ bersih — `app/utils/inline-marks.ts`, `RichTextField.vue`, `AlignButtonGroup.vue`, `scripts/check-inline-marks.mjs` tanpa error/warning. Catatan: `pnpm lint` repo-wide memang sudah ribuan error **pra-ada** (termasuk `vue/no-mutating-props` pada pola `v-model="block.*"` yang sudah ada di seluruh `TemplateBlockCard.vue`); Fase 4 tidak menambah pola baru di luar konvensi berkas tersebut |

**Penyimpangan implementasi (dicatat, bukan terlupa):**

- **`AlignButtonGroup.vue`** ditambahkan sebagai berkas baru ke-4: grup radio perataan diekstrak agar bisa dipakai `RichTextField` (blok `paragraph`) DAN sekali di tingkat field "Uraian pasal" (`article`), sesuai keputusan "perataan milik blok".
- **`activeMarksForRange()`** ditambahkan di `app/utils/inline-marks.ts`: status tombol toolbar untuk SELEKSI (bukan hanya kursor) — mark dianggap aktif hanya jika seluruh run yang tersapu seleksi memilikinya.
- Pratinjau inline perkiran implementasi di `RichTextField` (sesuai rencana); acuan final tetap modal **Pratinjau PDF**.
- **Belum dikerjakan (opsional sesuai rencana):** `insertField()` menyisipkan `{{key}}` di posisi kursor `RichTextField` — masih menyisip di akhir string.
- Pintasan tambahan di luar rencana: Ctrl/Cmd+B / I / U pada `RichTextField` (preventDefault, aman terhadap `disabled`).

---

### Dikeluarkan dari lingkup (tidak dikerjakan)

Dicatat di sini supaya tidak dianggap pekerjaan yang terlupa:

- Mark B/I/U pada `list.items[]` — menuntut run-aware di cabang hanging-indent MITRA (`:593-642`), bagian paling sensitif geometri.
- Mark B/I/U pada sel tabel — menuntut run-aware di `drawRow` MITRA (`:789`) dan cabang `table` `contract-block-renderer.ts:213`.
- Perataan pada `list`, sel tabel, `title`, dan `subtitle`.
- Pratinjau WYSIWYG penuh di dalam editor (yang ada hanya pratinjau inline perkiraan).

---

## Testing Plan

### Unit — backend (`cd backend; npx jest`)

| Berkas | Status | Isi |
|---|---|---|
| `src/contracts/inline-marks.spec.ts` | ✅ **baru** | 41 tes: tabel kasus Fase 1 + invariant `runsToText(parseInlineRuns(t)) === t` |
| `src/contracts/inline-run-layout.spec.ts` | ✅ **baru** | 33 tes: `runFont`, konsistensi `wrapRunsToLines` vs `wrapCellLines`, `measureRunsLine`, keempat perataan, font & underline per run, **konsistensi dengan PDFKit nyata** |
| `src/contracts/pkwt-layout.engine.spec.ts` | ✅ diperluas | +15 kasus: `resolveCellAlign` (4), runs & align di `buildPkwtRowsFromStructuredParagraphs` (7), **gerbang paginasi produksi** (1) |
| `src/contracts/pkwt-document.renderer.spec.ts` | ✅ diperluas | +12 kasus: `blocksToPkwtParagraphs` runs & align (8), PDF nyata (4) |
| `src/contracts/table-layout.helpers.spec.ts` | tidak disentuh | Helper run pindah ke `inline-run-layout.spec.ts` (penyimpangan #6) |
| `src/contracts/mitra-layout.engine.spec.ts` | ✅ **diperluas (Fase 2c)** | `writeRuns()` memakai font italic/bold yang benar; keempat nilai `align` diteruskan apa adanya |
| `src/contracts/contract-block-renderer.spec.ts` | ✅ **diperluas (Fase 2d)** | `renderBlocks()` jalur legacy tetap benar + jalur runs/align — 44 tes |
| `src/contract-templates/template-schema.validator.spec.ts` | ✅ **diperluas (Fase 3)** | Mark di lokasi terlarang → `issues`; `align` tak dikenal / tipe tak didukung → `issues`; keempat nilai sah → lolos |

### Kasus uji khusus perataan

**Gerbang utama — netral-tinggi.** Klaim terpenting rencana ini, dan cara membuktikannya **berubah** setelah Fase 2b:

| Pendekatan | Status |
|---|---|
| ~~`heightOfString()` sama untuk keempat nilai `align`~~ | Digantikan — `measureRow()` ternyata **tidak perlu diubah** sama sekali (penyimpangan #12), jadi tidak ada rumus tinggi baru untuk diuji |
| **Jumlah halaman sama** pada 4 varian PKWT **produksi**, mark + keempat nilai `align` | ✅ **lulus** (pdfplumber, 8.9 s) — bukti yang lebih kuat karena mengukur dokumen legal yang sebenarnya |

**Perilaku per nilai (semua ✅ lulus):**

| Kasus | Hasil |
|---|---|
| Tanpa `align` | `resolveCellAlign` → `'justify'`/`'left'` persis rumus lama |
| `align: 'justify'` | Identik dengan tanpa `align` |
| `align: 'left'`/`'center'`/`'right'` | Diteruskan ke semua baris blok |
| `article` + `align: 'center'` | Baris `heading` **dan** `paragraphs` sama-sama `'center'` |
| `align` tak dikenal (`'middle'`) | Diabaikan → perilaku lama (jaring pengaman) |
| Mark tanpa `align` | Justified + bold (perilaku lama untuk perataan) |
| Mark + `align` | Perataan run-aware (justify dengan celah merata, center, right) |

### Regresi wajib (gerbang utama)

Tes ini lulus **tanpa satu pun berkas fixture diubah**:

1. ✅ Seluruh spec geometris PKWT dan MITRA yang sudah ada tetap hijau.
2. ✅ `blocksToPkwtParagraphs()` pada konten tanpa mark menghasilkan `runs`/`align` `undefined` → jalur lama.
3. ✅ Render fixture template menghasilkan **jumlah halaman yang sama**.
4. ✅ `resolveCellAlign(undefined, …)` mereproduksi `idJustify`/`enJustify` lama **persis**.
5. ✅ **Jumlah halaman tidak berubah** pada 4 varian produksi untuk keempat nilai `align`.

### Frontend

| Alat | Perintah |
|---|---|
| Harness helper mark | `node scripts/check-inline-marks.mjs` |
| Harness pemindai field (tidak boleh rusak) | `node scripts/check-field-usage.mjs` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm lint` |

### Verifikasi manual (bukti akhir)

1. Buka **Pengaturan → Template Kontrak** → template PKWT → **Buat draft**.
2. Tambahkan blok `paragraph` dengan `Halo **dunia**`.
3. Klik **Pratinjau** → PDF harus menampilkan `Halo ` regular + `dunia` bold, **pada halaman yang sama seperti sebelumnya**.
4. Ulangi untuk MITRA (`*miring*` dan `__garis bawah__`).
5. Pada blok `paragraph` yang sama, coba tombol **Center** → pratinjau PDF harus menampilkan blok itu rata tengah, sementara blok lain tetap justified.
6. Coba **Right** → rata kanan. Coba **Left** → rata kiri. Coba kembali **Justify** → kembali justified seperti semula.
7. Kombinasikan: blok `paragraph` dengan `**bold**` **dan** Justify tetap aktif → PDF harus tetap justified (celah antar-kata merata), dengan kata bold di dalamnya.
8. Kombinasikan lagi: `**bold**` + **Center** → kata bold ikut rata tengah.
9. Isi `**` di **judul pasal** → publish harus **ditolak** dengan pesan yang menyebut judul pasal tidak boleh memakai pemformatan.
10. Isi `**` di **item daftar** → publish harus **ditolak** (lokasi tidak didukung).
11. Set `align: 'center'` pada blok `article` → judul pasal **dan** uraiannya rata tengah.
12. Bandingkan PDF pratinjau dengan PDF **Generate Kontrak** dari kontrak nyata yang memakai template itu → harus identik (satu jalur render).
13. Pastikan **Pratinjau** dan **Generate** pada template yang **tidak** memakai mark maupun `align` menghasilkan PDF dengan jumlah halaman yang sama seperti sebelum fitur.

---

## Acceptance Criteria

1. Template **tanpa** mark dan **tanpa** `align` menghasilkan PDF dengan isi dan **jumlah halaman identik** dengan sebelum fitur.
2. `**teks**` menghasilkan glyph bold pada PDF; terverifikasi lewat spec render, bukan hanya lewat UI.
3. `*teks*` menghasilkan italic pada PKWT (Lucida italic) dan MITRA (Times italic).
4. `__teks__` menghasilkan garis bawah.
5. **Perataan tersedia keempatnya**: `left`, `center`, `right`, dan `justify` semuanya menghasilkan perataan yang benar di PDF, untuk blok `paragraph` dan `article`.
6. **Perataan netral-tinggi**: mengubah `align` **tidak mengubah jumlah baris maupun jumlah halaman** — dibuktikan lewat tes `heightOfString`, bukan diasumsikan.
7. Blok tanpa `align` tetap justified persis seperti sebelumnya (perilaku lama tak tersentuh).
8. **Perataan + mark bersamaan** berfungsi: baris justified yang memuat kata bold tetap justified dengan celah antar-kata merata; baris center yang memuat kata bold tetap center.
9. Perataan pada blok `article` ikut berlaku untuk `article.heading`.
10. Judul pasal (`article.heading`) tetap maksimal 2 baris; mark di sana, di `list.items[]`, dan di sel `table` **ditolak saat publish** dengan pesan yang menyebut lokasinya.
11. `align` dengan nilai tak dikenal, atau dipasang pada tipe blok yang tidak mendukung (`title`, `subtitle`, `list`, `table`, `signature`, `pageBreak`), ditolak validator.
12. Publish tidak pernah gagal karena mark yang sah; `{{...}}` tetap terdeteksi dan tervalidasi seperti sebelumnya.
13. Seluruh versi template `PUBLISHED` yang sudah ada tetap terbaca, ter-render, dan ter-publish ulang tanpa migrasi.
14. Kontrak lama tetap memakai snapshot-nya; tidak ada kontrak lama yang berubah.
15. Tidak ada perubahan pada `PKWT_GEOMETRY`, `MITRA_GEOMETRY`, schema Prisma, dan `package.json`.
16. Pratinjau PDF tetap 1:1 dengan Generate Kontrak (dijamin karena memakai fungsi render yang sama).
17. `npx jest` (backend) hijau, `node scripts/check-inline-marks.mjs` hijau, `pnpm typecheck` dan `pnpm lint` bersih.

### Status kriteria saat ini (per akhir Fase 2b)

| # | Kriteria | Status |
|---|---|---|
| 1 | Tanpa mark & `align` → PDF identik | ✅ terbukti (spec lama hijau tanpa perubahan fixture) |
| 2 | `**teks**` bold di PDF | ✅ terbukti (font Lucida Bold tertanam + `idRuns`) |
| 3 | `*teks*` italic PKWT | ✅ terbukti (PKWT **dan** MITRA) |
| 4 | `__teks__` garis bawah | ✅ terbukti (garis digambar manual; jumlah & posisi diuji) |
| 5 | Keempat perataan | ✅ terbukti (PKWT **dan** MITRA) |
| 6 | Perataan netral-tinggi | ✅ **terbukti** — gerbang paginasi produksi: 4 varian × 4 nilai `align` → halaman sama |
| 7 | Tanpa `align` → perilaku lama | ✅ terbukti (`resolveCellAlign` mereproduksi rumus lama) |
| 8 | Perataan + mark bersamaan | ✅ terbukti (PKWT) |
| 9 | Perataan `article` ikut ke `heading` | ✅ terbukti |
| 10 | Mark di lokasi terlarang ditolak publish | ✅ Fase 3 (validator). Di PKWT, mark di `article.heading` sudah **diabaikan** oleh `blocksToPkwtParagraphs` |
| 11 | `align` tak dikenal / tipe tak didukung ditolak | ✅ Fase 3. Di PKWT, `align` tak dikenal sudah **diabaikan** (`pkwtBlockAlign`) |
| 12 | Publish tidak gagal karena mark sah | ✅ Fase 3 |
| 13-16 | Versi lama, snapshot, geometri, pratinjau 1:1 | ✅ tidak tersentuh (nol perubahan pada `PKWT_GEOMETRY`/`MITRA_GEOMETRY`/schema; pratinjau memakai fungsi render yang sama) |
| 17 | Jest + harness + typecheck | ✅ backend hijau (471 tes / 26 suite), **harness FE hijau** (`node scripts/check-inline-marks.mjs`, exit 0), **`pnpm typecheck` exit 0** |

---

## Risks and Mitigations

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Paginasi/geometri bergeser pada template existing | Tinggi — dokumen legal | Dua sumbu **terpisah**: tanpa mark & tanpa `align` = kode lama. Spec geometris jadi gerbang. Fase 2 dikerjakan sebelum UI |
| Teks legal lama yang memuat `**`/`__` berpasangan berubah tampilan | Sedang | `backend/scripts/scan-inline-mark-collisions.ts` dipindai & dievaluasi **sebelum** fitur dinyalakan |
| Delimiter tak berpasangan membuat karakter hilang | Tinggi | Aturan 2: delimiter tak berpasangan = literal; invariant round-trip diuji |
| `{{custom.x}}` salah tafsir karena underscore | Tinggi | Placeholder opaque; diuji eksplisit |
| `timesbi.ttf` tidak tersedia di server produksi | Sedang | Verifikasi `FONT_DIR` sebelum Fase 2c; fallback: `bold+italic` dirender bold saja, keterbatasan dicatat |
| Jumlah baris berbeda pada paragraf bermark | Sedang | Font bold/italic lebih lebar dari regular — hanya terjadi pada paragraf yang memang memakai mark. Spec regresi membandingkan teks **tanpa** mark, yang tetap harus identik |
| Perataan run-aware salah menghitung titik awal / celah antar-kata | Sedang | `left`/`center`/`right` hanya menggeser titik awal; `justify` meniru `drawJustifiedLine()` yang sudah teruji dan jatuh ke rata-kiri saat `gap <= 0`. `startX` dijepit agar teks tidak bocor keluar kolom |
| Baris bermark lebih lebar dari kotak → `center`/`right` bisa keluar kolom | Sedang | `startX` dijepit ke `x` bila `natural > width`; diuji |
| Mark tidak sengaja ditulis di lokasi tak didukung lalu tercetak literal | Tinggi | Validator **menolak** mark di `article.heading`/`list`/`table` dengan pesan berisi lokasi |
| Admin tidak sadar perataan default adalah Justify | Rendah | Grup perataan adalah radio empat arah; tombol `defaultAlign` tampak aktif saat `align` kosong, sehingga status nyata terbaca jelas |
| `align` pada versi `PUBLISHED` lama | Rendah | Properti tidak ada = perilaku sekarang; tidak ada versi lama yang perlu diubah |
| Versi `PUBLISHED` lama rusak | Tinggi | Representasi backward-compatible, tanpa migrasi; tes regresi render fixture |
| Admin bingung dengan sintaks `**` | Rendah | Toolbar B/I/U + pratinjau inline + hint teks |
| Dua implementasi parser (FE & BE) menyimpang | Sedang | Kasus uji identik di `inline-marks.spec.ts` dan `scripts/check-inline-marks.mjs`; FE hanya untuk UX, BE tetap otoritatif |

---

## File Structure

### Baru dibuat

| Berkas | Fase | Status |
|---|---|---|
| `backend/src/contracts/inline-marks.ts` | 1 | ✅ selesai |
| `backend/src/contracts/inline-marks.spec.ts` | 1 | ✅ selesai |
| `backend/src/contracts/inline-run-layout.ts` | 2a | ✅ selesai |
| `backend/src/contracts/inline-run-layout.spec.ts` | 2a | ✅ selesai |
| `backend/scripts/scan-inline-mark-collisions.ts` | 3 | ✅ selesai — dijalankan 43/43 versi: 0 blocking, 0 align, 0 warning, 14 info (semua ARCHIVED) |
| `app/utils/inline-marks.ts` | 4 | ✅ selesai — cermin logika backend + `toggleMark`/`activeMarksAt`/`activeMarksForRange` |
| `app/components/kontrak/RichTextField.vue` | 4 | ✅ selesai — toolbar B/I/U + pintasan Ctrl+B/I/U + pratinjau inline |
| `app/components/kontrak/AlignButtonGroup.vue` | 4 | ✅ selesai — radio perataan 4 arah (dipakai `RichTextField` dan sekali di tingkat pasal) |
| `scripts/check-inline-marks.mjs` | 4 | ✅ selesai — 36 assertion + **15 kasus paritas FE↔BE semuanya identik** |

### Dimodifikasi

| Berkas | Fase | Sifat perubahan |
|---|---|---|
| `backend/src/contracts/pkwt-layout.engine.ts` | 2b | ✅ `PkwtAlign`, `PKWT_RUN_FONTS`, `runs`/`align` pada `PkwtParagraph`, `idRuns`/`enRuns`/`idAlign`/`enAlign` pada `PkwtRow`, `toLines()` run-aware, `resolveCellAlign()`, `drawCell()` menerima `runs` + `align`. **`measureRow()` tidak disentuh** |
| `backend/src/contracts/pkwt-document.renderer.ts` | 2b | ✅ `markedRuns()`, `pkwtBlockAlign()`, `blocksToPkwtParagraphs()` mengisi `runs`/`align` |
| `backend/src/contracts/pkwt-layout.engine.spec.ts` | 2b | ✅ +3 blok `describe` (15 kasus), termasuk gerbang paginasi produksi |
| `backend/src/contracts/pkwt-document.renderer.spec.ts` | 2b | ✅ +2 blok `describe` (12 kasus) |
| `backend/src/contracts/mitra-layout.engine.ts` | 2c | Tambah `'right'` pada tipe `align` `writeText()` + `writeRuns()` (perataan sendiri) + cabang pemilihan jalur |
| `backend/src/contracts/mitra-document.renderer.ts` | 2c | Tambah font `boldItalic` |
| `backend/src/contracts/contract-block-renderer.ts` | 2d | Tambah `'right'` pada tipe `align` + cabang run/align di `writeText()` (opsional) |
| `backend/src/contract-templates/template-schema.validator.ts` | 3 | Validasi mark per lokasi + `BLOCK_ALIGN_VALUES`/`ALIGN_CAPABLE_BLOCKS` + `countInlineMarkedBlocks()`/`countAlignedBlocks()` |
| `backend/src/contract-templates/contract-template-versions.service.ts` | 3 | Panggil validasi mark & `align` di jalur preview |
| `app/components/kontrak/TemplateBlockCard.vue` | 4 | `UTextarea` → `RichTextField` pada `paragraph`/`title`/`subtitle`/`article.paragraphs`; grup perataan 4 arah; `summary`/`emptyWarnings` bebas mark |
| `app/components/kontrak/TemplateContentModal.vue` | 4 | Baris "Blok berformat" + hint sintaks |

Catatan: `backend/src/contracts/table-layout.helpers.ts` **TIDAK disentuh** (penyimpangan #6). Helper run hidup di `inline-run-layout.ts`.

**Ringkasan perubahan tipe `align`** (satu-satunya perubahan tipe yang diperlukan):

| Lokasi | Sebelum | Sesudah |
|---|---|---|
| `mitra-layout.engine.ts:548` | `'left' \| 'center' \| 'justify'` | `+ 'right'` |
| `contract-block-renderer.ts:132` | `'left' \| 'justify' \| 'center'` | `+ 'right'` |
| `pkwt-layout.engine.ts` | tidak ada tipe `align` | `PkwtAlign` baru |

---

## Task Breakdown

Setiap tugas punya gerbang verifikasi sendiri. Urutan ini **wajib** — Fase 2 tidak boleh dimulai sebelum Fase 1 hijau, dan Fase 4 tidak boleh dimulai sebelum Fase 2 terbukti tidak mengubah geometri.

### Fase 1 — Modul murni
1. Tulis `backend/src/contracts/inline-marks.ts` (`parseInlineRuns`, `runsToText`, `stripInlineMarks`, `hasInlineMarks`, `validateInlineMarks`, `containsMarkDelimiters`).
2. Tulis `inline-marks.spec.ts` dengan seluruh tabel kasus + invariant round-trip.
3. **Gerbang:** `cd backend; npx jest src/contracts/inline-marks.spec.ts` hijau.

### Fase 2 — Rendering (dengan gerbang regresi)
4. ✅ **SELESAI** — `wrapRunsToLines()`, `measureRunsLine()`, `drawRunsLine()` (perataan 4 arah) di `inline-run-layout.ts` (berkas BARU) + `inline-run-layout.spec.ts` (31 tes).
5. ✅ **GERBANG LULUS** — 31 tes baru hijau; `table-layout.helpers.spec.ts` dan spec PKWT/MITRA lama tetap hijau (belum ada berkas lama yang disentuh).
6. ✅ **SELESAI** — PKWT: `PkwtAlign`, `PKWT_RUN_FONTS`, `runs`/`align` pada `PkwtParagraph`, `idRuns`/`enRuns`/`idAlign`/`enAlign` pada `PkwtRow`, `toLines()` run-aware, `resolveCellAlign()` baru, `drawCell()` menerima `runs` + `align`.
7. ✅ **GERBANG LULUS** — spec PKWT hijau **tanpa mengubah fixture lama**. Ditambah: `resolveCellAlign` (4 kasus), runs & align di `buildPkwtRowsFromStructuredParagraphs` (7 kasus), `blocksToPkwtParagraphs` (8 kasus), PDF nyata (4 kasus), dan **tes geometris produksi** yang membuktikan mark + keempat nilai `align` tidak mengubah jumlah halaman pada keempat varian PKWT bawaan.
8. MITRA (mark + align): tambah `'right'` pada tipe `align` `writeText()`; tambah `boldItalic` di `MITRA_FONT_NAMES` + `resolveMitraFonts()` + registrasi font; tulis `writeRuns()` (perataan sendiri); sambungkan pada cabang `paragraph`/`article.paragraphs`; teruskan `block.align` bila ada, termasuk ke judul `article`.
9. **Gerbang regresi MITRA:** `npx jest src/contracts/mitra-layout.engine.spec.ts src/contracts/mitra-document.renderer.spec.ts` hijau tanpa mengubah fixture. Tambah kasus `**bold**`, `*italic*`, `__underline__`, dan keempat nilai `align`.
10. ✅ **SELESAI (2026-10-05)** — `contract-block-renderer.ts` cabang run/align (`writeRuns()` + `blockAlign()`) + `contract-block-renderer.spec.ts` diperluas (44 tes); bug paginasi bermark-vs-polos ditemukan dan diperbaiki (lihat rekonsiliasi Fase 2d).
11. **Gerbang penuh:** `cd backend; npx jest` hijau seluruhnya.

### Fase 3 — Validator & audit
12. `normalizeArticleHeading()` menghitung baris pada `stripInlineMarks()`; `validateContentDefinition()` menolak mark di lokasi tak didukung dan nilai `align` yang tidak valid; tambah `countInlineMarkedBlocks()`/`countAlignedBlocks()`.
13. Panggil validasi mark & `align` di `contract-template-versions.service.ts` jalur preview.
14. Perluas `template-schema.validator.spec.ts` + `contract-template-versions.service.spec.ts`, termasuk tabel kasus perataan (netral-tinggi + perilaku per nilai).
15. Tulis `backend/scripts/scan-inline-mark-collisions.ts` dan jalankan (dry-run) untuk melihat apakah ada template existing yang terpengaruh.
16. **Gerbang:** `npx jest` hijau; laporan collision kosong atau setiap temuan sudah dievaluasi.

### Fase 4 — Frontend
17. Tulis `app/utils/inline-marks.ts` (`toggleMark`, `activeMarksAt`, `parseInlineMarks`).
18. Tulis `scripts/check-inline-marks.mjs` dengan kasus **sama** seperti `inline-marks.spec.ts`.
19. **Gerbang:** `node scripts/check-inline-marks.mjs` hijau.
20. Tulis `app/components/kontrak/RichTextField.vue` — toolbar B/I/U, grup perataan 4 arah (radio), pratinjau inline.
21. Sambungkan ke `TemplateBlockCard.vue`: mark pada `paragraph`/`title`/`subtitle`/`article.paragraphs`; grup perataan pada `paragraph` dan (sekali saja) pada field "Uraian pasal"; sesuaikan `summary`/`emptyWarnings`.
22. Tambah baris "Blok berformat" + hint sintaks di `TemplateContentModal.vue`.
23. **Gerbang:** `pnpm typecheck` bersih, `pnpm lint` bersih, `node scripts/check-field-usage.mjs` hijau.
24. **Gerbang akhir:** verifikasi manual 13 langkah di atas, termasuk keempat perataan, perataan + Bold bersamaan, dan perbandingan jumlah halaman sebelum/sesudah.

Tidak ada Fase 5. Pekerjaan untuk `list.items[]`, sel tabel, dan perataan pada `title`/`subtitle`/`list`/`table` sudah dikeluarkan dari lingkup (lihat bagian **Dikeluarkan dari lingkup**).

---

## Open Questions — DIKUNCI (2026-10-05)

Pemilik produk menyerahkan keputusan kepada rekomendasi teknis. Semua terkunci sebagai berikut:

| # | Pertanyaan | Keputusan | Bukti / Alasan |
|---|---|---|---|
| 1 | Font `timesbi.ttf` untuk MITRA bold-italic | **Tersedia — tidak ada blocker.** Tambah `boldItalic` ke `resolveMitraFonts()` memakai pola `pick([preferred], fallback)` yang sudah dipakai `resolvePkwtFonts()` | Terverifikasi: `C:/Windows/Fonts/timesbi.ttf` ada (918.940 byte), dan `resolvePkwtFonts()` (`pkwt-document.renderer.ts:72`) **sudah** memakainya sebagai fallback `boldItalic` |
| 2 | Simpan `align: 'justify'` eksplisit? | **Hapus propertinya** saat nilainya sama dengan default. Properti hanya ada bila admin benar-benar menyimpang | Menjaga makna "properti ini hanya ada bila admin mengubah sesuatu"; payload draft tetap ringkas; PDF identik |
| 3 | Sisip field pada posisi kursor | **DITUNDA — di luar lingkup.** `insertField()` tidak disentuh | Prinsip "jangan tambah bug baru": itu perubahan UX tersendiri dengan risikonya sendiri (`TemplateContentModal.vue:611-655` menyentuh 4 tipe blok). Dipisah ke pekerjaan tersendiri bila diminta |
| 4 | Perataan `title`/`subtitle` | **Tetap di luar lingkup** | Blok itu chrome kop; di PKWT bahkan tidak masuk kolom isi (`blocksToPkwtParagraphs` melewatinya). Tombol perataan di sana akan jadi no-op yang membingungkan |
| 5 | Nama berkas rencana | **Tetap** `2026-10-05-inline-formatting-template-editor.md` | Mengikuti pola `docs/superpowers/plans/` yang ada |

### Pertanyaan yang sudah terjawab pada revisi sebelumnya

| Sebelumnya | Jawaban |
|---|---|
| Cakupan `list` & `table` — masuk lingkup atau ditunda? | **Dikeluarkan dari lingkup.** `list`/`table` tetap teks polos dan mark di sana ditolak validator |
| Perataan run-aware — wajib atau ditunda? | **Wajib.** Admin memakai Bold bersama perataan, jadi `drawRunsLine()` harus mendukung keempatnya sejak Fase 2a |
| Perataan diperluas ke Center/Right/Left? | **Ya.** Perataan kini 4 nilai: `left`, `center`, `right`, `justify`. Aman karena netral-tinggi (dibuktikan dengan tes) |

---

## Definition of Done

### Fase 1 — SELESAI (2026-10-05)

- [x] `backend/src/contracts/inline-marks.ts` ada, teruji, tanpa dependensi baru.
- [x] `inline-marks.spec.ts` — **41 tes lulus**.
- [x] Fase 1 **tidak menyentuh satu baris pun kode lama** — hanya menambah dua berkas baru.

### Fase 2a — SELESAI (2026-10-05)

- [x] `wrapRunsToLines` / `measureRunsLine` / `drawRunsLine` (perataan 4 arah) ada di `inline-run-layout.ts` dan teruji — **31 tes lulus**.
- [x] Pemecahan baris teks tanpa mark **identik** dengan `wrapCellLines` pada PDFKit nyata (0 mismatch / 45 perbandingan).
- [x] Tinggi baris jalur run **identik** dengan rumus jalur lama (11.202).
- [x] Tidak ada risiko kerning (selisih 0.000000 pt).
- [x] Fase 2a **tidak menyentuh satu baris pun kode lama** — hanya menambah dua berkas baru.
- [x] `npx jest` (backend) hijau seluruhnya: **409 tes / 26 suite**, **nol regresi**.
- [x] `npx tsc -p tsconfig.json --noEmit` bersih.

### Fase 2b — SELESAI (2026-10-05)

- [x] PKWT: `**bold**` / `*italic*` / `__underline__` tampil benar di PDF; `kind`/`idBold` tidak berubah; tanpa `align`, `resolveCellAlign` mereproduksi rumus lama PERSIS.
- [x] PKWT: keempat nilai `align` menghasilkan perataan yang benar pada semua baris blok itu (termasuk baris judul pasal).
- [x] PKWT: `measureRow()` **tidak diubah** → tinggi baris dijamin identik dengan jalur lama.
- [x] PKWT: mark + perataan bersamaan berfungsi (justified dengan celah merata, center, right).
- [x] **Gerbang paginasi:** pada keempat varian PKWT **produksi**, mark + keempat nilai `align` **tidak** mengubah jumlah halaman (dibuktikan dengan pdfplumber, bukan diasumsikan).
- [x] Seluruh spec lama hijau **tanpa mengubah satu pun fixture**.
- [x] `npx jest` (backend) hijau seluruhnya: **438 tes / 26 suite**, **nol regresi**.
- [x] `npx tsc -p tsconfig.json --noEmit` bersih.

### Fase 2c — SELESAI (2026-10-05)

- [x] MITRA: ketujuh kontrol tampil benar di PDF; font bold-italic terdaftar (**opsional** dengan fallback ke bold bila `timesbi.ttf` tidak ada — #14).
- [x] MITRA: `'right'` ditambahkan ke tipe `align` `writeText()` dan diteruskan apa adanya.
- [x] Paragraf bernomor BER-MARK tetap memakai hanging indent — terbukti geometrinya identik bit-per-bit dengan jalur lama (#16).

### Fase 2c-4 — SELESAI (2026-10-05, diverifikasi ulang saat Fase 2d)

- [x] Mark di `article.heading`, `list.items[]`, dan sel `table` ditolak dengan pesan yang menyebut lokasinya — saat publish **dan** saat preview. *(diverifikasi: `validateText(..., allowMarks: false)` pada semua lokasi kecuali `paragraph.text` dan `article.paragraphs[]`)*
- [x] Nilai `align` tak dikenal, atau `align` pada tipe blok tak didukung (`title`/`subtitle`/`list`/`table`/`signature`/`pageBreak`), ditolak validator.
- [x] Seluruh spec backend hijau **tanpa** mengubah fixture lama. *(suite contracts 254/254 pada 2026-10-05; full suite 471 tes hijau saat Fase 3)*
- [x] `node scripts/check-inline-marks.mjs` dan `node scripts/check-field-usage.mjs` hijau. *(dijalankan ulang 2026-10-05: keduanya lulus)*
- [x] `pnpm typecheck` dan `pnpm lint` bersih. **Typecheck: exit 0, bersih (2026-10-05).** Lint: GAGAL **secara pre-existing di seluruh repo** (8501 masalah, termasuk file yang tidak disentuh fitur ini — `AddContractModal.vue`, `kontrak.vue`, dll. juga lolos `eslint` dengan exit 1 saat diuji terpisah), jadi bukan regresi Fase 2d dan tidak memblokir fase ini; perbaikan lint massal di luar lingkup plan ini.
- [x] `RichTextField.vue` terpasang di `paragraph`, `title`, `subtitle`, dan `article.paragraphs`; judul pasal tetap `UTextarea` plain. *(diverifikasi di `TemplateBlockCard.vue:332/345/394`, judul pasal `UTextarea` di `:363`)*
- [x] Grup perataan hanya muncul pada `paragraph` dan `article` (sekali per blok untuk `article`). *(diverifikasi: `show-align` pada paragraf `:350`, satu `AlignButtonGroup` per pasal `:380`)*
- [x] Template tanpa mark **dan** tanpa `align` menghasilkan PDF dengan jumlah halaman yang sama seperti sebelum fitur (dibuktikan, bukan diasumsikan). *(smoke gate + gerbang paginasi produksi PKWT & MITRA)*
- [x] Laporan `scan-inline-mark-collisions.ts` dievaluasi (2026-10-05): **0 blocking, 0 align, 0 warning, 14 info** — semua `info` di versi **ARCHIVED** (lihat **Verifikasi audit Fase 3**). Tidak ada temuan yang perlu perbaikan manual.

---

## Plan vs Implementation Reconciliation

### Fase 1 — apa yang benar-benar dibangun (2026-10-05)

**Berkas baru (2), tanpa perubahan pada berkas lama:**

| Berkas | Baris | Isi |
|---|---|---|
| `backend/src/contracts/inline-marks.ts` | ~365 | `parseInlineRuns`, `runsToText`, `stripInlineMarks`, `hasInlineMarks`, `escapeInlineMarks`, `containsMarkDelimiters`, `validateInlineMarks`, `InlineRun`, `InlineMarkIssue`, `INLINE_MARK_DELIMITERS`, `INLINE_MARK_KINDS` |
| `backend/src/contracts/inline-marks.spec.ts` | ~285 | 41 tes dalam 7 blok `describe` |

**Bukti verifikasi:**

| Perintah | Hasil |
|---|---|
| `cd backend; npx jest src/contracts/inline-marks.spec.ts` | **41 passed / 41** |
| `cd backend; npx jest` | **378 passed / 378**, 25 suite, exit 0 → **nol regresi** |
| `cd backend; npx tsc -p tsconfig.json --noEmit` | exit 0 |

### Penyimpangan dari rencana awal (dan mengapa lebih aman)

Sembilan hal di bawah **berbeda** dari yang tertulis di revisi awal rencana — lima pada Fase 1, empat pada Fase 2a. Semuanya mengarah ke satu tujuan: **tidak ada bug baru pada template yang sudah ada.**

#### Fase 1

#### #1. Escape tidak menyentuh `_` tunggal

- **Rencana awal:** `escapeInlineMarks` meng-escape `*`, `_`, dan `\`.
- **Kenyataan:** meng-escape `_` tunggal **merusak invariant round-trip** — `snake_case_field` keluar sebagai `snake\_case\_field`. Ditemukan oleh tes, bukan teori.
- **Perbaikan:** hanya `__` (pasangan) yang di-escape. Parser memang hanya mengenal `__` sebagai underline, jadi `_` tunggal tidak pernah berbahaya.
- **Tes yang menangkap:** `invariant round-trip › teks tanpa mark keluar 100% identik`.

#### #2. Penanda tak berpasangan = **warning**, bukan error

- **Rencana awal:** tabel kasus uji menyebut `validateInlineMarks('**a', {})` → `ok:false`.
- **Kenyataan:** memblokir publish karena satu `*` literal akan **menggagalkan template lama yang sudah sah** — persis jenis bug baru yang harus dihindari.
- **Perbaikan:** `ok` berarti "tidak ada **error**". Penanda tak berpasangan hanya `warning` karena teksnya tetap tampil apa adanya (Aturan 2).
- **Tes yang menangkap:** `validateInlineMarks › delimiter tanpa pasangan hanya warning, bukan error`.

#### #3. Lokasi terlarang diperiksa dengan `hasInlineMarks()`, bukan `containsMarkDelimiters()`

- **Rencana awal:** "setiap delimiter di lokasi terlarang menjadi error".
- **Kenyataan:** itu akan menolak judul pasal yang memuat `*` literal (mis. `PASAL 1 * CATATAN`) tanpa alasan — penandanya toh tercetak apa adanya.
- **Perbaikan:** hanya **mark yang benar-benar sah** yang jadi error.
- **Tes yang menangkap:** `allowMarks:false tetap MELOLOSKAN tanda bintang tunggal`.

#### #4. Pasangan TANPA isi juga dikembalikan jadi teks

- **Rencana awal:** tidak disebutkan sama sekali.
- **Kenyataan:** `a****b` akan menjadi `ab` — **empat karakter hilang dari dokumen legal**. Pelanggaran Aturan 2 yang tidak tertangkap rencana.
- **Perbaikan:** pasangan tanpa isi diperlakukan sama seperti delimiter tak berpasangan.
- **Tes yang menangkap:** `pasangan tanpa isi tidak menghilangkan karakter`.

#### #5. Pemasangan delimiter per jenis mark (bukan tumpukan global)

- **Rencana awal:** "strategi *leftmost-longest*, satu tingkat per jenis mark".
- **Kenyataan:** pemasangan **per jenis secara independen** lebih sederhana dan menghasilkan perilaku terdefinisi untuk mark bersarang maupun tumpang tindih, tanpa aturan tumpukan.
- **Dampak:** `**tebal *dan miring***` menghasilkan **2** run (`tebal ` bold; `dan miring` bold+italic), bukan 1 run. Ini benar secara semantik; tabel kasus uji sudah dikoreksi.

#### Fase 2a

**Berkas baru (2), tanpa perubahan pada berkas lama:**

| Berkas | Isi |
|---|---|
| `backend/src/contracts/inline-run-layout.ts` | `runFont`, `wrapRunsToLines`, `measureRunsLine`, `drawRunsLine`, `RunFonts`, `InlineRunAlign`, `INLINE_RUN_ALIGN_VALUES` |
| `backend/src/contracts/inline-run-layout.spec.ts` | 31 tes dalam 7 blok `describe` |

**Bukti verifikasi:**

| Perintah / pemeriksaan | Hasil |
|---|---|
| `cd backend; npx jest src/contracts/inline-run-layout.spec.ts` | **31 passed / 31** |
| `cd backend; npx jest` | **409 passed / 409**, 26 suite, exit 0 → **nol regresi** |
| `cd backend; npx tsc -p tsconfig.json --noEmit` | exit 0 |
| Pemecahan baris vs `wrapCellLines` pada **PDFKit nyata** (Times 9.5pt, 9 sampel × 5 lebar) | **0 mismatch / 45** |
| Selisih kerning (Σ lebar token vs lebar gabungan) | **0.000000 pt** |
| Tinggi baris jalur run vs rumus jalur lama | **identik** (11.202) |

##### #6. Berkas BARU, bukan menyunting `table-layout.helpers.ts`

- **Rencana awal:** tambahkan `wrapRunsToLines`/`measureRunsLine`/`drawRunsLine` ke `table-layout.helpers.ts`.
- **Kenyataan:** helper run bukan soal tabel, dan menyunting berkas lama berarti ada risiko regresi pada fungsi yang sudah terbukti (`wrapCellLines`, `drawJustifiedLine`).
- **Perbaikan:** berkas baru `inline-run-layout.ts`. `table-layout.helpers.ts` **nol perubahan**, sehingga perilakunya dijamin tidak berubah.
- **Konsekuensi:** satu berkas baru, bukan satu berkas tersentuh. Ini pola yang sama dengan Fase 1.

##### #7. `measureRunsLine(doc, font, size, lineGap)` — tanpa parameter `runs`

- **Rencana awal:** `measureRunsLine(doc, runs, font, size)` dengan keterangan "tinggi = maks tinggi antar-run".
- **Kenyataan:** menghitung tinggi per-run **justru berbahaya**. Bold/italic punya metrik ascender/descender berbeda, sehingga baris bermark bisa lebih tinggi dari baris tanpa mark → paginasi bergeser. Selain itu parameter `runs` tidak dipakai sama sekali.
- **Perbaikan:** memakai SATU font acuan (regular), dan tanda tangannya dibersihkan. Tinggi jalur run kini **identik** dengan rumus jalur lama — dibuktikan (11.202 = 11.202).
- **Dampak positif:** baris bermark setinggi baris tanpa mark, sehingga jumlah baris == jumlah tinggi baris.

##### #8. Spasi menjadi token tersendiri, dengan gaya dari run TEMPATNYA

- **Rencana awal:** "pecah baris menjadi token kata".
- **Kenyataan:** tiga bug nyata muncul dari penyederhanaan itu, ditemukan bergantian oleh tes:
  1. Jika spasi digabung ke dalam kata, `justify` kehilangan pemisahan kata (`'a b c'` menjadi satu "kata") sehingga perentangan tidak pernah terjadi.
  2. Percobaan pertama memperbaiki (1) dengan menyisipkan spasi **buatan** yang mewarisi gaya run **sebelumnya**. Itu salah: pada `'a __b__ c'` spasi sebelum `c` berasal dari run `' c'` (regular), bukan dari run `__b__`, sehingga spasi itu **ikut bergaris bawah** — terlihat sebagai garis kedua di bawah spasi.
  3. Menggabung token tanpa memperhatikan jenisnya membuat spasi lenyap ke dalam kata.
- **Perbaikan final:** pecah tiap run per transisi spasi ↔ non-spasi dengan `split(/(\s+)/)` dan **pertahankan karakter spasi aslinya**, sehingga setiap token mewarisi gaya run tempat ia benar-benar berada. Deret spasi dipadatkan menjadi satu (sama seperti `wrapCellLines`), dan penggabungan hanya terjadi bila jenis (spasi/kata) **dan** gayanya sama.
- **Tes yang menangkap:** `spasi memakai gaya run TEMPATNYA, bukan run sebelumnya`, `spasi DI LUAR mark tetap regular`, `spasi DI DALAM mark ikut bergaya mark`, `celah = (width - natural) / (jumlah kata - 1) dan spasi asli dibuang`.

##### #9. Underline digambar MANUAL, bukan lewat opsi `underline` PDFKit

- **Rencana awal:** `doc.underline(cx, y + size + 1, lebarToken)`.
- **Percobaan kedua:** memakai opsi `underline: true` pada `doc.text(...)` dengan harapan PDFKit menangani metrik baseline sendiri.
- **Kenyataan (BUG PDFKit NYATA):** opsi itu **melempar** `unsupported number: NaN`. Sebabnya ada di `pdfkit/js/pdfkit.js`:
  - `_fragment` menghitung `renderedWidth = options.textWidth + wordSpacing * (options.wordCount - 1) + ...`;
  - `options.textWidth`/`options.wordCount` **hanya** diisi oleh `emitLine()` di jalur `options.width` (LineWrapper);
  - tanpa `width` (dan kita memang tidak memakainya, karena `lineBreak: false` + posisi eksplisit), keduanya `undefined` → `renderedWidth` = `NaN` → `lineTo(NaN)` → PDFKit melempar.
- **Perbaikan:** garis bawah digambar sendiri dengan `save`/`lineWidth`/`strokeColor`/`moveTo`/`lineTo`/`stroke`/`restore`, memakai rumus yang SAMA dengan PDFKit (`lineWidth = size < 10 ? 0.5 : floor(size/10)`, `y + currentLineHeight() - lineWidth`). Kita sudah tahu `x` dan lebar potongan tepat, jadi ini lebih pasti dan tidak bergantung pada jalur pembungkusan.
- **Tes yang menangkap:** `PKWT document renderer — mark & perataan di PDF NYATA › mark + perataan bersamaan tetap menghasilkan PDF sah`. Dokumen tiruan **tidak** bisa menangkap ini — hanya PDFKit sungguhan yang bisa.
- **Pengaman tambahan:** dokumen tiruan di spec sekarang **melempar** bila ada yang memakai `options.underline` lagi, sehingga regresi ini tidak bisa kembali diam-diam.

#### Fase 2b

**Berkas diubah (2) + spec (2), tanpa berkas baru:**

| Berkas | Isi perubahan |
|---|---|
| `backend/src/contracts/pkwt-layout.engine.ts` | `PkwtAlign` (alias), `PKWT_RUN_FONTS`, `runs`/`align` di `PkwtParagraph`, `idRuns`/`enRuns`/`idAlign`/`enAlign` di `PkwtRow`, `toLines()` run-aware, `resolveCellAlign()`, `drawCell()` menerima `runs` + `align` |
| `backend/src/contracts/pkwt-document.renderer.ts` | `markedRuns()`, `pkwtBlockAlign()`, `blocksToPkwtParagraphs()` mengisi `runs`/`align` |
| `backend/src/contracts/pkwt-layout.engine.spec.ts` | +3 blok `describe` (15 kasus) |
| `backend/src/contracts/pkwt-document.renderer.spec.ts` | +2 blok `describe` (12 kasus) |

**Bukti verifikasi:**

| Perintah / pemeriksaan | Hasil |
|---|---|
| `cd backend; npx jest` | **438 passed / 438**, 26 suite, exit 0 → **nol regresi** |
| `cd backend; npx tsc -p tsconfig.json --noEmit` | exit 0 |
| **Gerbang paginasi** — 4 varian PKWT **produksi**, mark + keempat nilai `align` | **jumlah halaman tidak berubah** (pdfplumber, 8.9 s) |
| Mark tidak mengubah jumlah halaman (fixture renderer) | sama |
| `__garis__` benar-benar menggambar garis (PDFKit nyata) | tidak melempar lagi |

##### #10. Underline: `underline: true` PDFKit MELEMPAR → digambar manual

Sudah diuraikan di **#9** (ditemukan saat Fase 2b menjalankan PDFKit nyata). Ini penyimpangan paling penting: rencana awal Fase 2a mengasumsikan opsi `underline` aman, padahal tidak.

##### #11. Spasi: "gaya run sebelumnya" → "gaya run tempatnya"

Sudah diuraikan di **#8** butir 2. Ditemukan oleh tes underline: `'a __b__ c'` menghasilkan **dua** garis bawah, karena spasi sebelum `c` ikut bergaris bawah.

##### #12. `measureRow()` TIDAK diubah (rencana awal menyuruh mengubahnya)

- **Rencana awal:** "Bila `row.idRuns` ada → tinggi = jumlah baris × `heightOfString('Xg', {lineGap})`".
- **Kenyataan:** perubahan itu **tidak diperlukan**. `buildPkwtRows*` sudah memanggil `wrapCellLines`/`wrapRunsToLines` lebih dulu, sehingga **setiap `PkwtRow` adalah SATU baris**. `heightOfString(satuBaris, { width })` mengembalikan tepat satu tinggi baris — nilai yang sama dengan `heightOfString('Xg')`.
- **Perbaikan:** `measureRow()` dibiarkan apa adanya.
- **Manfaat:** ini **menghapus** satu titik risiko. Tidak ada rumus tinggi baru yang bisa menyimpang; paginasi dijamin identik karena kode yang menghitungnya memang tidak disentuh.
- **Bukti:** gerbang paginasi produksi (4 varian × 4 nilai `align`) lulus.

##### #13. `resolveCellAlign()` diekstrak agar prioritas perataan bisa diuji

- **Rencana awal:** logika perataan ditulis inline di loop `renderPkwtLayout`.
- **Kenyataan:** logika inline tidak bisa diuji tanpa merender PDF. Padahal inilah kunci nol regresi: prioritas "eksplisit menang, kalau tidak pakai rumus lama" harus terbukti untuk **semua** kombinasi `align` × `bold` × `justify`.
- **Perbaikan:** diekstrak menjadi fungsi murni yang diekspor + 4 kasus uji (termasuk nilai tak dikenal → perilaku lama).

#### Fase 2c

##### #14. `boldItalic` bersifat OPSIONAL dengan fallback ke bold (rencana awal: wajib)

- **Rencana awal:** `resolveMitraFonts()` selalu mengembalikan `boldItalic: \`${dir}/timesbi.ttf\`` dan mendaftarkannya tanpa syarat.
- **Kenyataan:** `timesbi.ttf` (dan seluruh msttcorefonts) tidak dijamin ada di semua lingkungan — jalur Linux kontainer atau instalasi Windows minimal bisa kehilangan berkas itu. Font wajib yang hilang = crash render untuk SEMUA dokumen, bukan hanya yang bermark bold-italic.
- **Perbaikan:** `boldItalic?` opsional di tipe; `registerFont(F.boldItalic, opts.fonts.boldItalic ?? opts.fonts.bold)` — bila `timesbi.ttf` tidak ada, bold-italic dirender dengan font bold (masih terbaca, hanya tanpa kemiringan). `resolveMitraFonts()` hanya mengisi `boldItalic` bila berkasnya benar-benar ada.
- **Manfaat:** kegagalan degradatif, bukan katastropik. Dokumen yang sama tetap ter-render di lingkungan tanpa font lengkap.

##### #15. `writeRuns()` mendelegasi ke `writeText()` bila teks tanpa mark (rencana awal: hanya pemanggil yang memilih)

- **Rencana awal:** cabang blok yang memilih `writeRuns()` vs `writeText()` berdasarkan `hasInlineMarks()`.
- **Kenyataan:** dua titik pemilihan = dua peluang lupa. Lebih aman jika pengaman ada DI DALAM `writeRuns()` sendiri.
- **Perbaikan:** `writeRuns()` dimulai dengan `if (!hasInlineMarks(text)) { writeText(rawText, o); return }`. Cabang blok boleh selalu memanggil `writeRuns()`; teks polos otomatis jatuh ke jalur lama yang persis sama.
- **Manfaat:** tidak mungkin ada teks polos yang lolos ke jalur run karena lupa cek di pemanggil.

##### #16. Hanging indent didukung `wrapRunsToLines({ firstLineWidth })` — rencana awal menganggap cabang hanging hanya untuk `list`

- **Rencana awal:** "Cabang hanging-indent (`:593-642`) **tidak diubah** — hanya dipakai `list`, yang berada di luar lingkup."
- **Kenyataan:** asumsi itu keliru. `paragraphOpts()` memberi `hangingIndent: G.listHangingIndent` kepada SETIAP paragraf yang cocok `NUMBERED_ITEM` (`/^(?:\d{1,2}|[a-z])\.\s/`) — dan paragraf bernomor justru paling umum diberi mark di dokumen MITRA (butir pasal). Tanpa dukungan hanging di jalur run, paragraf `**1. Perusahaan...**` akan kehilangan indentasi gantungnya.
- **Perbaikan:** `wrapRunsToLines()` menerima `opts.firstLineWidth`; `writeRuns()` membungkus dengan `restWidth` dan memberi `firstLineWidth: fullWidth - indent` untuk baris pertama — matematika identik dengan cabang lama (`firstWidth`/`restWidth`/`lineX`).
- **Bukti:** uji geometri PDF nyata membuktikan kolom baris lanjutan identik bit-per-bit antara jalur polos dan jalur run (327.5pt; delta baris-1 → baris-2 = 13.5pt = `listHangingIndent` persis), dan uji ekuivalensi membuktikan `wrapRunsToLines` ≡ rumus word-wrap lama untuk teks polos.

##### #17. Dua jebakan pengukuran pada asersi PDF nyata (ditemukan saat menulis uji Fase 2c)

- **Jebakan 1 — nama font:** PDFKit menuliskan nama INTERNAL dari TTF (`TimesNewRomanPS-BoldMT`) ke byte PDF, bukan nama logis yang didaftarkan (`MitraTimesBold`). Asersi `buf.toString().toContain('Times-Bold')` tidak hanya rapuh (bisa match `Times-BoldItalic` secara prefix) tapi juga menguji hal yang tidak kita kendalikan. Perbaikan: sadap `doc.font()` dan asersi nama logis yang diminta.
- **Jebakan 2 — potongan ≠ baris:** `drawRunsLine` menggambar satu panggilan `doc.text` PER POTONGAN (per kata/per spasi), bukan per baris. Menghitung `doc.text` calls yang memuat 'kata' menghasilkan 40 untuk polos dan 31→(salah diukur) untuk bermark. Perbaikan: kelompokkan potongan per `y` unik dan ambil x MINIMUM per kelompok = awal baris; dan ingat awal baris ≠ posisi kata pertama (baris 1 diawali `"1. "` sehingga kata pertamanya ~12.95pt lebih kanan).
- **Jebakan 3 — bold lebih lebar:** jumlah baris bermark BOLEH lebih banyak dari polos (bold lebih lebar). Invariant yang benar: geometri indentasi identik, bukan jumlah baris identik.

### Yang **tidak** berubah dari rencana

- Representasi tetap `string` — nol perubahan schema.
- `inline-marks.ts` murni: tanpa PDFKit/NestJS/Prisma.
- Placeholder `{{...}}` tetap opaque.
- Tidak ada normalisasi saat simpan.
- Perataan tidak ikut di modul `inline-marks.ts` (masalah properti blok, bukan parsing teks).
- `list`, `table`, `title`, `subtitle` tetap di luar lingkup.
- `PKWT_GEOMETRY`, `MITRA_GEOMETRY`, `BLOCK_TYPES`, `schema.prisma`, dan `package.json` **tidak disentuh**.
- Versi template `PUBLISHED` lama tetap terbaca tanpa migrasi.

### Pelajaran

Pola yang berulang di ketiga fase: **mayoritas penyimpangan ditemukan oleh tes yang dijalankan, bukan oleh pembacaan ulang rencana.**

| Fase | Penyimpangan | Ditemukan oleh |
|---|---|---|
| 1 | #1–#5 (escape `_`, warning vs error, `hasInlineMarks`, pasangan kosong, pairing per jenis) | `npx jest` |
| 2a | #6–#9 (berkas baru, `measureRunsLine` tanpa `runs`, token spasi, underline) | `npx jest` + **PDFKit nyata** |
| 2b | #10–#13 (underline melempar NaN, gaya spasi, `measureRow` tidak perlu diubah, `resolveCellAlign` diekstrak) | **PDFKit nyata** + **pdfplumber** |
| 2c | #14–#17 (`boldItalic` opsional dgn fallback, delegasi `writeRuns`, hanging indent paragraf bernomor, nama font internal + potongan≠baris + bold-lebih-lebar) | **PDFKit nyata** (sadapan `doc.font`/`doc.text`) + spec debug geometri |

Pelajaran paling berharga: **verifikasi klaim "tidak mengubah apa pun" harus memakai mesin sungguhan.** Dokumen tiruan memakai lebar = jumlah karakter sehingga tidak akan pernah menangkap masalah kerning (Fase 2a) maupun bug `underline` PDFKit (Fase 2b). Dua bug paling berbahaya dalam seluruh pekerjaan ini — `lineTo(NaN)` dan spasi bergaris bawah — hanya tertangkap karena PDFKit sungguhan ikut dijalankan.

### Status saat ini (2026-10-05)

| Fase | Status | Bukti |
|---|---|---|
| 1 — `inline-marks.ts` | ✅ selesai | 41 tes |
| 2a — `inline-run-layout.ts` | ✅ selesai | 33 tes, 0 mismatch vs PDFKit nyata |
| 2b — PKWT | ✅ selesai | 27 tes baru; gerbang paginasi produksi lulus |
| 2c — MITRA | ✅ selesai | spec layout 38/38 + spec renderer hijau; gerbang paginasi produksi lulus; hanging indent terbukti identik |
| 3 — validator + audit | ✅ selesai | 26 suite / 471 tes hijau; `tsc --noEmit` exit 0; audit DB 43 versi → 0 blocking / 0 align |
| 2d — jalur legacy (`contract-block-renderer.ts`) | ✅ selesai | 44 tes renderer + smoke gate; bug paginasi bermark-vs-polos diperbaiki |
| 4 — frontend | ✅ selesai | `RichTextField` + `AlignButtonGroup` terpasang; validator tersambung ke preview & publish |

Berkas yang **berubah** sejauh ini: `pkwt-layout.engine.ts` (+ spec), `pkwt-document.renderer.ts` (+ spec), `mitra-layout.engine.ts` (+ spec), `mitra-document.renderer.ts` (+ spec), `contract-document.service.ts` (+ spec routing), `contract-block-renderer.ts` (+ spec). Berkas baru: `inline-marks.ts` (+ spec), `inline-run-layout.ts` (+ spec).

**Perbaikan bug pasca-rilis (2026-10-05): Italic tidak muncul di PDF hasil Generate MITRA.** Kedua jalur generate MITRA di `contract-document.service.ts` (`renderMitraLayoutFromBlocks` snapshot & `renderMitraPdf` legacy) meng-hardcode 3 font TANPA `boldItalic`, sehingga run tebal+miring jatuh ke fallback BOLD (`boldItalic ?? bold` di `runFont()`) — padahal pratinjau editor memakai `resolveMitraFonts()` lengkap dengan `timesbi.ttf`. Perbaikan: kedua jalur kini memakai `resolveMitraFonts()` (satu sumber font dengan pratinjau, pola yang sama dengan PKWT `resolvePkwtFonts()`). Diverifikasi: PDF replika generate vs pratinjau kini identik (BaseFont BoldItalicMT ikut tertanam); tes regresi ditambahkan di `contract-document.service.routing.spec.ts`.

Fitur kini **aktif di aplikasi**: `RichTextField` + `AlignButtonGroup` terpasang di editor template, validator menolak mark di lokasi terlarang (publish & preview). Dua item OPSIONAL tersisa (tidak memblokir rilis):

1. Validasi eksplisit atas editan draft yang belum disimpan pada endpoint validasi JSON (saat ini ia memvalidasi versi tersimpan; preview PDF menerima konten draft).
2. `insertField()` menyisipkan `{{key}}` di posisi kursor `RichTextField` — masih menyisip di akhir string.


