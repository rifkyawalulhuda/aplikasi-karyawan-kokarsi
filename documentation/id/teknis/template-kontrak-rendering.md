# Template Kontrak — Model & Rendering

Halaman ini menjelaskan cara kerja teknis Template Kontrak: model konten, pemformatan inline, perataan, validasi, versioning, hingga alur render PDF.

## Ringkasan Arsitektur

```
ContractTemplate (kode, keluarga, template key)
   └─ ContractTemplateVersion   (vN, status DRAFT/PUBLISHED/ARCHIVED)
        ├─ contentDefinition     { languages: { id: [...], en: [...] } }
        └─ fieldDefinitions      snapshot field yang dibekukan saat publish
              │
              ├─ Validasi       template-schema.validator.ts
              │
              └─ Render
                   ├─ PKWT   → pkwt-document.renderer.ts  → pkwt-layout.engine.ts
                   └─ MITRA  → mitra-document.renderer.ts → mitra-layout.engine.ts
                        └─ inline-run-layout.ts (mark + perataan)
```

Pratinjau pada editor dan tombol Generate Kontrak memanggil **fungsi render yang sama** (`createPkwtPdfBuffer` / `createMitraPdfBuffer`), sehingga hasil pratinjau 1:1 dengan dokumen final.

## Model Konten (`contentDefinition`)

Teks disimpan sebagai **`string`** biasa, ditambah properti blok opsional (`align`, `headingAlign`, `spaceAfter`). Tidak ada model data baru dan tidak ada migrasi untuk versi lama.

```ts
contentDefinition = {
  languages: {
    id: Block[],   // wajib (PKWT & MITRA)
    en: Block[],   // wajib hanya untuk PKWT
  },
}
```

### Tipe Blok

| `type` | Field utama | Keterangan |
|---|---|---|
| `title` | `text`, `spaceAfter?` | Judul utama (rata tengah, chrome kop) |
| `subtitle` | `text`, `spaceAfter?` | Subjudul di bawah judul |
| `paragraph` | `text`, `align?`, `spaceAfter?` | Satu blok teks |
| `article` | `heading`, `paragraphs[]`, `align?`, `headingAlign?`, `spaceAfter?` | Judul pasal + uraian |
| `list` | `style`, `items[]`, `spaceAfter?` | `style`: `bullet` \| `numbered` \| `alphabetic` |
| `table` | `columns[]`, `rows[]`, `spaceAfter?` | Kolom: `{ key, label, format? }`, `format`: `text` \| `number` \| `currency` \| `date` |
| `pageBreak` | — | Memaksa halaman baru |
| `signature` | `leftRole`, `rightRole`, … | Blok tanda tangan (tepat satu per bahasa) |

Setiap blok memiliki `id` unik (tidak boleh duplikat dalam satu bahasa).

> `spaceAfter` hanya berlaku pada blok yang benar-benar mengalir ke dokumen (lihat [Spasi Antar Blok](#spasi-antar-blok-spaceafter)).

## Pemformatan Inline (Bold / Italic / Underline)

Modul murni: `backend/src/contracts/inline-marks.ts` (tanpa PDFKit/NestJS/Prisma) dan cerminnya di frontend `app/utils/inline-marks.ts`.

### Sintaks

| Penulisan | Efek | Font |
|---|---|---|
| `**teks**` | Bold | PKWT: `PKWT-Bold`; MITRA: `MitraTimesBold` |
| `*teks*` | Italic | PKWT: `PKWT-Italic`; MITRA: `MitraTimesItalic` |
| `__teks__` | Underline | Font aktif + garis bawah |
| `\*` `\_` `\\` | Escape → karakter literal | — |

### Aturan Parsing

1. **Placeholder `&#123;&#123;...&#125;&#125;` opaque** — isinya tidak pernah diparsing sebagai markup. Melindungi key ber-underscore seperti `&#123;&#123;custom.ktp_issued_date&#125;&#125;`.
2. **Delimiter tanpa pasangan = teks literal** (tidak dibuang). Invariant: `runsToText(parseInlineRuns(t)) === t` untuk teks tanpa mark.
3. **Pasangan tanpa isi** (`a****b`) juga teks literal.
4. **`_` tunggal bukan delimiter** — hanya `__` dan `*`, sehingga `snake_case_field` aman.
5. **Tidak ada normalisasi saat simpan** — renderer parse lenient, validator hanya melaporkan (prinsip PASSTHROUGH).
6. **Mark boleh melintasi `\n`**; pemecahan baris dilakukan renderer.
7. **Pemasangan delimiter per jenis mark** (bukan tumpukan global), sehingga `**tebal *dan miring***` terdefinisi tanpa aturan tumpukan.

Bentuk internal render (tidak pernah disimpan ke DB):

```ts
interface InlineRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}
```

### Lokasi yang Mendukung Mark

| Lokasi | Mark | Catatan |
|---|---|---|
| `paragraph.text` | ✅ | `allowMarks: true` |
| `article.paragraphs[]` | ✅ | `allowMarks: true` |
| `article.heading` | ❌ | Mark mengubah tinggi → judul pasal dijaga 2 baris |
| `title.text` / `subtitle.text` | ❌ | Renderer tidak menerapkan mark pada chrome kop |
| `list.items[]` | ❌ | Cabang hanging-indent tidak run-aware |
| sel `table` | ❌ | Cabang tabel tidak run-aware |
| `signature` / `pageBreak` | ❌ | Bukan blok teks |

Mark yang sah di lokasi terlarang menjadi **error publish** (bukan diabaikan), karena bila dibiarkan penanda akan tercetak literal di dokumen legal. Yang diperiksa adalah `hasInlineMarks()` — `*` tunggal yang tak berpasangan tetap lolos.

## Perataan (`align` / `headingAlign`)

Perataan adalah **properti tingkat blok**, bukan mark karakter.

| Nilai | Efek |
|---|---|
| tidak ada | Perilaku bawaan (paragraf/uraian justified, judul pasal mengikuti keluarga) |
| `'justify'` | Rata kanan-kiri (baris terakhir paragraf tetap rata-kiri) |
| `'left'` | Rata kiri |
| `'center'` | Rata tengah |
| `'right'` | Rata kanan |

- `align` hanya sah pada blok `paragraph` dan `article` (`ALIGN_CAPABLE_BLOCKS`).
- `headingAlign` hanya sah pada blok `article` — mengatur judul pasal secara terpisah dari uraian.
- Nilai yang sah didefinisikan sekali di `INLINE_RUN_ALIGN_VALUES` (`inline-run-layout.ts`) dan dialias oleh `BLOCK_ALIGN_VALUES`.

### Perataan Bersifat Netral-Tinggi

PDFKit memecah baris **hanya berdasarkan `width`**, bukan `align`. Karena itu `left`/`center`/`right`/`justify` menghasilkan **jumlah baris yang identik** untuk teks dan lebar yang sama — paginasi tidak berubah. Ini dibuktikan lewat tes jumlah halaman pada varian produksi, bukan diasumsikan.

Berbeda dengan **mark**: font bold/italic lebih lebar dari regular, sehingga jumlah baris **bisa** berubah pada paragraf yang benar-benar memakai mark.

### Strategi Dua Sumbu

Kedua sumbu punya jalur masing-masing agar nol regresi pada template lama:

| Sumbu | Gerbang |
|---|---|
| Mark (per nilai teks) | Bila `hasInlineMarks()` `false` → **jalur lama dipanggil apa adanya** |
| Perataan (per blok) | Bila `align` tidak ada → **rumus lama persis** (`resolveCellAlign` / default `justify`) |

Template tanpa mark **dan** tanpa `align` mengeksekusi kode yang sama seperti sebelum fitur → output byte/paginasi identik.

## Spasi Antar Blok (`spaceAfter`)

`spaceAfter` adalah **properti tingkat blok** berupa bilangan bulat **0–40 pt** — jarak vertikal **tambahan** di bawah blok, di atas jarak bawaan renderer. Berlaku untuk **kedua keluarga**, tetapi himpunan tipe blok yang bermakna berbeda karena cara kedua engine mengalirkan konten berbeda.

- **Aditif, bukan menimpa.** `spaceAfter: 12` berarti "tambah 12 pt", bukan "set jarak menjadi 12 pt". Nilai `undefined`/`0` → tidak ada jarak tambahan (perilaku lama persis).
- **Titik penerapan berbeda per engine:**
  - **MITRA** (`mitra-layout.engine.ts`) mengalirkan blok dua-kolom. `renderMitraPass` menambahkan jarak tepat **sebelum blok berikutnya**, dan hanya bila (1) blok berikutnya benar-benar menggambar konten (bukan `signature`/`pageBreak`, bukan blok `title` pertama yang jadi kop), dan (2) blok berikutnya masih di **kolom/halaman yang sama**.
  - **PKWT** (`pkwt-layout.engine.ts`) mengunci baris ID/EN per blok. `buildPkwtRowsFromStructuredParagraphs` menambahkan `spaceAfter` blok ke-`i` pada `gapBefore` baris pembuka blok ke-`i+1`, di atas `PKWT_GEOMETRY.blockGap`. Blok terakhir tidak menyumbang apa pun. Karena baris ID/EN terkunci, jarak blok = **max** `spaceAfter` kedua kolom (bila hanya satu bahasa disetel, nilai itu tetap berlaku).
- **Himpunan tipe yang didukung** (`spaceCapableBlocks(family)`):
  - MITRA (`SPACE_CAPABLE_BLOCKS`): `title`, `subtitle`, `paragraph`, `article`, `list`, `table`.
  - PKWT (`PKWT_SPACE_CAPABLE_BLOCKS`): `paragraph`, `article`, `list` — `title`/`subtitle` jadi kop (chrome) dan `table` tidak dirender di kolom.
  - `pageBreak` & `signature` ditolak validator (struktural / footer).
- **Ikut terukur.** MITRA mengukur lewat `planMitraLayout`; PKWT menghitung ulang paginasi per baris. Paginasi selalu konsisten dengan hasil akhir.
- **Nol regresi template lama.** Tanpa blok ber-`spaceAfter`, tidak ada jarak yang ditambahkan → output identik.

| Aspek | Nilai |
|---|---|
| Properti | `block.spaceAfter` (integer pt) |
| Rentang sah | `0`–`40` |
| Preset editor | Rapat `0`, Normal `undefined`, Renggang `12`, Ekstra `20`, Kustom `0–40` |
| Normalisasi bersama | `contracts/block-spacing.ts` (`normalizeBlockSpaceAfter`, `blockSpaceAfterPts`) |
| Batas maksimum | `MAX_BLOCK_SPACE_AFTER` (`block-spacing.ts`) |

## Validasi (`template-schema.validator.ts`)

`validateContentDefinition(content, fieldKeys, family)` mengembalikan hitungan `placeholderCount`, `blockCount`, `markedBlockCount`, `alignedBlockCount`, `spacedBlockCount`, dan `inlineMarkWarnings`. Validasi melempar `BadRequestException` dengan `issues` terstruktur bila ada masalah.

Aturan utama:

- Struktur wajib `{ languages: { id: [], en: [] } }`; PKWT memerlukan `id` **dan** `en`, MITRA hanya `id`.
- Setiap bahasa: minimal satu blok konten **dan** tepat satu blok `signature`.
- `id` blok tidak boleh duplikat; `type` harus salah satu dari `BLOCK_TYPES`.
- `align`/`headingAlign` harus bernilai sah dan pada tipe blok yang mendukungnya.
- `spaceAfter` harus bilangan bulat 0–40, hanya pada blok yang mengalir ke dokumen (`spaceCapableBlocks(family)`), untuk keluarga MITRA maupun PKWT.
- Mark hanya boleh pada `paragraph.text` dan `article.paragraphs[]`.
- Placeholder harus terdaftar di katalog field; sintaks `&#123;&#123;...&#125;&#125;` yang rusak ditolak.
- Judul pasal dinormalisasi maksimal 2 baris (`normalizeArticleHeadings`) — menutup celah paste dari Word.

## Versioning & Snapshot

Status versi: `DRAFT` → `PUBLISHED` → `ARCHIVED`.

| Operasi | Perilaku |
|---|---|
| **Draft baru** | Menyalin versi `PUBLISHED` terakhir (atau definisi bawaan) menjadi `DRAFT` baru dengan `versionNumber` berikutnya |
| **Publish** | Atomik: arsipkan `PUBLISHED` lama → set draft menjadi `PUBLISHED` → bekukan `fieldDefinitions` sebagai snapshot |
| **Rollback** | Mengaktifkan kembali versi `ARCHIVED` sebagai `PUBLISHED` |

- Versi `PUBLISHED` bersifat **immutable** — perubahan hanya lewat draft baru.
- `fieldDefinitions` dibekukan saat publish; placeholder `&#123;&#123;custom.*&#125;&#125;` divalidasi terhadap snapshot itu.
- **Kontrak memakai snapshot versi** saat dibuat. Publish ulang template tidak mengubah kontrak lama.

## Field Dinamis & Placeholder

| Sumber (`sourceType`) | Diisi oleh | Contoh |
|---|---|---|
| `SYSTEM` | Data turunan sistem | `&#123;&#123;employee.fullName&#125;&#125;`, `&#123;&#123;contract.contractNo&#125;&#125;`, `&#123;&#123;settings.cooperativeChairmanName&#125;&#125;` |
| `CONTRACT_INPUT` | Manual di form kontrak | `&#123;&#123;custom.ktp_issued_date&#125;&#125;` |

- Field `SYSTEM` di-seed idempotent dari `template-field-seeds.ts`; setiap placeholder system yang dipakai definisi bawaan **wajib** ada di katalog atau publish ditolak.
- Field `CONTRACT_INPUT` memakai prefix `custom.`. `normalizeCustomPlaceholders()` menyelaraskan penulisan lama tanpa prefix agar tidak gagal publish.
- Field bertipe **Master Reference** belum didukung pada dokumen kontrak dan ditolak saat publish.

## Font per Keluarga

| Keluarga | Badan/Judul | Kop |
|---|---|---|
| **PKWT** | Lucida Sans Typewriter (`PKWT-Regular/Bold/Italic/BoldItalic`) | Times New Roman regular (`PKWT-HeaderRegular`) |
| **MITRA** | Times New Roman (`MitraTimes`, `MitraTimesBold`, `MitraTimesItalic`, `MitraTimesBoldItalic`) | Times |

- `boldItalic` bersifat **opsional** — bila `timesbi.ttf` tidak tersedia, teks bold+italic jatuh ke font **bold** (bukan italic).
- Tinggi baris pada jalur run diukur dari **satu font acuan**, bukan maksimum antar-run, agar paginasi tidak bergeser.

## Lokasi Kode

| Lapisan | Berkas |
|---|---|
| Parse/serialize mark | `backend/src/contracts/inline-marks.ts` |
| Tata letak run + perataan | `backend/src/contracts/inline-run-layout.ts` |
| Engine PKWT | `backend/src/contracts/pkwt-layout.engine.ts` |
| Engine MITRA | `backend/src/contracts/mitra-layout.engine.ts` |
| Renderer jalur legacy | `backend/src/contracts/contract-block-renderer.ts` |
| Validasi | `backend/src/contract-templates/template-schema.validator.ts` |
| Normalisasi spasi blok (bersama) | `backend/src/contracts/block-spacing.ts` |
| Versioning / preview | `backend/src/contract-templates/contract-template-versions.service.ts` |
| Helper mark (FE) | `app/utils/inline-marks.ts` |
| Field berformat (FE) | `app/components/kontrak/RichTextField.vue`, `AlignButtonGroup.vue` |
| Kontrol spasi antar blok (FE) | `app/components/kontrak/BlockSpaceControl.vue` |

## Lihat Juga

- [Template Kontrak](/panduan-pengguna/template-kontrak) — panduan pengguna
- [Autentikasi](/teknis/autentikasi) — sesi & role
