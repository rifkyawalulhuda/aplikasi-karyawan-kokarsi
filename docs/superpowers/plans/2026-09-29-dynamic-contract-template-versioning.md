# Dynamic Contract Template Versioning - Implementation Plan

**Date:** 2026-09-29  
**Feature:** Template Kontrak dinamis dengan versioning, shared fields, block editor, dan snapshot dokumen  
**Status:** Planning only

---

## Goal

Memungkinkan Admin mengubah teks, pasal, list, dan tabel Template Kontrak tanpa mengubah backend script, dengan tetap menjaga audit trail dan keutuhan kontrak lama.

Target utama:

1. Admin dapat membuat draft versi template baru.
2. Admin dapat menambah, mengubah, menghapus, dan mengurutkan pasal.
3. Admin dapat memakai blok `paragraph`, `article`, `list`, `table`, `pageBreak`, dan `signature`.
4. Admin dapat memakai placeholder sistem dan membuat field custom.
5. Field custom mendukung `TEXT`, `NUMBER`, `DATE`, `DROPDOWN`, dan `MASTER_REFERENCE`.
6. Field yang sama dapat dipakai ulang oleh beberapa template.
7. Semua sumber master yang aman tersedia melalui registry allowlist.
8. Template hanya aktif setelah dipublish.
9. Kontrak baru menyimpan versi template dan snapshot data yang digunakan.
10. Kontrak dan PDF lama tidak berubah saat template baru dipublish.

---

## Decisions

| Area | Keputusan |
|---|---|
| Cakupan perubahan | Berlaku untuk kontrak baru saja |
| Editor | Editor terstruktur, bukan HTML/WYSIWYG bebas |
| Pasal | Dapat ditambah, dihapus, dan diurutkan |
| Bahasa | MITRA: Indonesia; PKWT: Indonesia dan English |
| Versioning | Setiap perubahan disimpan sebagai versi baru |
| Aktivasi | Draft lalu publish |
| Kontrak lama | Immutable terhadap perubahan template |
| PDF existing | Immutable; regenerasi memakai snapshot kontrak |
| Field custom | Dapat dipakai ulang oleh beberapa template |
| Master reference | Semua sumber master yang masuk registry allowlist |
| Table | Wajib tersedia sejak V1; jumlah kolom boleh berubah antar-versi |
| List | Wajib tersedia sejak V1 |
| List alfabet (a, b, c) | Wajib tersedia sejak V1 untuk sub-butir ayat pasal MITRA |
| Identitas legal koperasi | Teks template editable; tidak lagi hardcode di renderer |
| Nomor dokumen | Mengikuti format util `{seq}/{code}/KUKP/SII/{romawi}/{tahun}` |
| Tanggal terbit KTP mitra | Custom field CONTRACT_INPUT bertipe DATE |
| Rentang dan durasi periode | Auto-derive dari startDate/endDate kontrak |
| Duties driver truk B3 | Template baru MITRA_DRIVER_TRUCK_B3 terpisah dari MITRA_DRIVER |

---

## Current State

Fondasi yang sudah tersedia:

- `ContractTemplate` menyimpan identitas template dan `contentOverrides` JSON.
- `PUT /contract-templates/:id/content-overrides` menyimpan override langsung.
- `mergeDefinition()` menggabungkan definisi hard-code dengan override.
- Definisi dokumen utama masih berada di `backend/src/contracts/contract-document-definitions.ts`.
- `Contract` memiliki `templateId`, `templateData`, `generatedPdfUrl`, dan `generatedAt`.
- Editor frontend masih berbasis field dan section yang ditentukan definisi hard-code.
- Download PDF dapat membuat ulang file jika file existing tidak ditemukan.

Keterbatasan:

- Belum ada histori versi yang immutable.
- Belum ada status `DRAFT`, `PUBLISHED`, dan `ARCHIVED`.
- Kontrak belum menyimpan `templateVersionId`.
- Belum ada snapshot template dan resolved field values.
- Placeholder custom belum memiliki registry dan sumber nilai terstruktur.
- Pasal belum dapat ditambah atau dihapus secara bebas.
- Renderer belum membaca block definition dinamis sebagai sumber utama.
- Regenerasi PDF berisiko membaca template aktif terbaru.
- Recitals identitas legal koperasi masih hardcode di `contract-document.service.ts` (akta pendirian, notaris, SK Kemenkumham, alamat).
- Role tanda tangan MITRA (`(Mitra)`, `(Ketua Koperasi)`) masih hardcode di renderer.
- Sub-butir alfabet di dalam ayat belum didukung struktur konten.
- Tanggal terbit KTP mitra belum tersedia di model data.

---

## Target Architecture

```text
Shared Field Catalog
        |
        v
Template Version Schema + Ordered Content Blocks
        |
        v
Published Template Version
        |
        v
Contract Creation
        |
        +--> templateVersionId
        +--> templateSnapshot
        +--> templateData
        +--> resolvedTemplateData
        |
        v
Immutable PDF Renderer
```

Prinsip:

1. `ContractTemplate` menjadi identitas master, bukan sumber konten runtime yang mutable.
2. `ContractTemplateVersion` menyimpan definisi konten dan field yang immutable setelah publish.
3. `TemplateFieldDefinition` menjadi katalog field bersama.
4. Binding field ke template disnapshot ke versi saat publish.
5. Kontrak menyimpan versi dan snapshot agar perubahan template maupun master data tidak mengubah dokumen lama.
6. Renderer hanya menerima struktur blok yang divalidasi backend.
7. Tidak ada evaluasi JavaScript, SQL, atau expression bebas dari konten template.

---

## Data Model Plan

### Template Version

Tambahkan model versioning:

```prisma
enum TemplateVersionStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model ContractTemplateVersion {
  id                Int                   @id @default(autoincrement())
  templateId        Int
  versionNumber     Int
  status            TemplateVersionStatus @default(DRAFT)
  contentDefinition Json
  fieldDefinitions  Json
  changeSummary     String?
  createdByName     String?
  publishedByName   String?
  createdAt         DateTime              @default(now())
  publishedAt       DateTime?

  template   ContractTemplate @relation(fields: [templateId], references: [id])
  contracts  Contract[]

  @@unique([templateId, versionNumber])
  @@map("contract_template_versions")
}
```

Tambahkan relasi `versions` pada `ContractTemplate`.

### Shared Field Catalog

Field yang dapat dipakai ulang disimpan di katalog bersama:

```prisma
enum TemplateFieldType {
  TEXT
  NUMBER
  DATE
  DROPDOWN
  MASTER_REFERENCE
}

enum TemplateFieldSourceType {
  SYSTEM
  CONTRACT_INPUT
  MASTER_REFERENCE
}

model TemplateFieldDefinition {
  id            Int                    @id @default(autoincrement())
  key           String                 @unique @db.VarChar(150)
  label         String                 @db.VarChar(255)
  dataType      TemplateFieldType
  sourceType    TemplateFieldSourceType
  sourceConfig  Json?
  options       Json?
  isSystem      Boolean                @default(false)
  isActive      Boolean                @default(true)
  createdByName String?
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  templateBindings ContractTemplateField[]

  @@map("template_field_definitions")
}

model ContractTemplateField {
  id         Int                    @id @default(autoincrement())
  templateId Int
  fieldId    Int
  required   Boolean                @default(false)
  sortOrder  Int                    @default(0)
  config     Json?

  template ContractTemplate        @relation(fields: [templateId], references: [id])
  field    TemplateFieldDefinition @relation(fields: [fieldId], references: [id])

  @@unique([templateId, fieldId])
  @@map("contract_template_fields")
}
```

Aturan katalog:

- `sourceConfig` hanya boleh memakai registry backend.
- Field system tidak boleh dihapus.
- Field custom yang sudah dipakai versi published diarsipkan, bukan dihapus.
- Mengubah arti atau tipe field harus membuat field key baru atau revisi baru.
- Satu field dapat dipakai banyak template dengan label, format, dan status required berbeda.

### Contract Snapshot

Tambahkan ke `Contract`:

```prisma
templateVersionId    Int?
templateSnapshot     Json?
resolvedTemplateData Json?

templateVersion ContractTemplateVersion? @relation(fields: [templateVersionId], references: [id])
```

`templateData` menyimpan input asli. `resolvedTemplateData` menyimpan nilai display yang telah di-resolve, termasuk label master reference. `templateSnapshot` menyimpan content definition dan field definition versi yang dipakai kontrak.

---

## Content Definition

Konten disimpan sebagai blok terurut, bukan hanya section dengan heading hard-code.

```json
{
  "languages": {
    "id": [
      {
        "id": "article-1",
        "type": "article",
        "heading": "PASAL 1",
        "paragraphs": ["PIHAK PERTAMA dan {{employee.fullName}} sepakat ..."]
      },
      {
        "id": "duties",
        "type": "list",
        "style": "numbered",
        "items": [{ "text": "Melaksanakan tugas sesuai jadwal." }]
      },
      {
        "id": "compensation",
        "type": "table",
        "columns": [
          { "key": "component", "label": "Komponen", "width": 55 },
          { "key": "amount", "label": "Jumlah", "width": 45, "format": "currency" }
        ],
        "rows": [{ "component": "Upah Pokok", "amount": "{{contract.baseCompensation}}" }]
      }
    ],
    "en": []
  }
}
```

Block types V1:

- `title`
- `subtitle`
- `paragraph`
- `article`
- `list`
- `table`
- `pageBreak`
- `signature`

V1 tidak mendukung HTML/CSS bebas, JavaScript, SQL, formula antar-cell, nested table, atau layout absolut.

---

## Shared Fields and Placeholders

Format placeholder:

```text
{{employee.fullName}}
{{contract.contractNo}}
{{custom.nomor_surat_internal}}
```

Placeholder sistem tambahan yang diwajibkan untuk mendukung sample Perjanjian Kemitraan MITRA:

| Placeholder | Sumber | Contoh nilai |
|---|---|---|
| `{{doc.hariTanggal}}` | Auto-derive dari tanggal tanda tangan | `hari Senin tanggal 31 bulan Agustus tahun 2026` |
| `{{contract.termRange}}` | Auto-derive dari startDate/endDate | `01 September 2026 - 31 Maret 2027` |
| `{{contract.duration}}` | Auto-derive dari startDate/endDate | `6 (enam) bulan` |
| `{{contract.docDate}}` | Tanggal dokumen di header | `31 Agustus 2026` |
| `{{employee.ktpIssuedDate}}` | Custom field CONTRACT_INPUT | `08 Agustus 2024` |

Jenis sumber:

| Source | Contoh | Perilaku |
|---|---|---|
| `SYSTEM` | `contract.contractNo` | Diambil otomatis dari data kontrak |
| `CONTRACT_INPUT` | `custom.nomor_surat_internal` | Diisi saat membuat kontrak |
| `MASTER_REFERENCE` | `employee.jobRole` | Dipilih dari registry master dan disimpan bersama snapshot label |

Tipe field:

- `TEXT`: string bebas dengan batas panjang.
- `NUMBER`: angka dengan validasi min/max dan format output.
- `DATE`: tanggal ISO dengan format tampilan configurable.
- `DROPDOWN`: pilihan yang didefinisikan pada field.
- `MASTER_REFERENCE`: ID record dari sumber master yang diizinkan.

Contoh field master reference:

```json
{
  "key": "employee.jobRole",
  "label": "Jabatan",
  "dataType": "MASTER_REFERENCE",
  "sourceType": "MASTER_REFERENCE",
  "sourceConfig": {
    "master": "JOB_ROLE",
    "valueField": "id",
    "labelField": "name"
  },
  "required": true
}
```

Contoh custom field untuk sample MITRA:

```json
{
  "key": "ktp_issued_date",
  "label": "Tanggal Terbit KTP Mitra",
  "dataType": "DATE",
  "sourceType": "CONTRACT_INPUT",
  "required": true
}
```

`ktp_issued_date` wajib tersedia pada seed katalog field untuk family MITRA.

Semua master data harus melalui `MASTER_REFERENCE_REGISTRY`. Registry harus menentukan model, field yang boleh dibaca, formatter, dan rule akses. Jangan izinkan admin memilih tabel atau kolom database secara bebas.

Sumber master yang dapat didaftarkan mencakup Employee, Department, JobRole, JobLevel, WorkLocation, TaxStatus, ContractType, Company, LegalKoperasi, DocumentType, pengurus koperasi, kendaraan, dan vendor jika data tersebut memang tersedia dan aman untuk dokumen.

Sumber sensitif atau transaksional seperti password, activity log, notification, session, dan audit internal tidak boleh tersedia sebagai placeholder.

---

## MITRA Sample Conformance

Referensi: `docs/sample-legal-doc/pdf/DRAFT KONTRAK KERJA MITRA.pdf` (hasil parse: `.firecrawl/draft-kontrak-mitra.md`).

Pemetaan struktur sample ke blok template:

| Bagian sample | Blok template | Catatan |
|---|---|---|
| Judul `PERJANJIAN KEMITRAAN` | `title` | Editable per versi |
| `Nomor: 220/KUKP-SII/2026` | `paragraph` + `{{contract.contractNo}}` | Format mengikuti util `{seq}/{code}/KUKP/SII/{romawi}/{tahun}` |
| `Tanggal 31 Agustus 2026` | `paragraph` + `{{contract.docDate}}` | Auto-derive |
| Pembukaan `dibuat dan ditandatangani pada hari ...` | `paragraph` + `{{doc.hariTanggal}}` | Nama hari dihitung otomatis |
| Recitals PIHAK PERTAMA (akta, notaris, SK Kemenkumham, alamat, Ketua Koperasi) | `paragraph` editable | Diekstrak dari hardcode `contract-document.service.ts:515` |
| Recitals PIHAK KEDUA (nama, WNI, tempat/tgl lahir, alamat, KTP + tanggal terbit) | `paragraph` editable | `{{employee.ktpIssuedDate}}` dari custom field |
| Recitals menerangkan 3 butir | `list` style `numbered` | |
| Pasal 1-15 | `article` berurutan | Heading editable, urutan bebas |
| Ayat dengan sub-butir a, b, c | `list` style `alphabetic` | Style baru di V1 |
| Pasal 2 (jangka waktu) | `article` + `{{contract.termRange}}`, `{{contract.duration}}` | Auto-derive agar tidak terjadi inkonsistensi seperti pada sample (teks "6 bulan" padahal rentang 7 bulan) |
| Penutup (rangkap, meterai) | `paragraph` | |
| Tabel tanda tangan 2 kolom | `signature` | Role `(Ketua Koperasi)` dan `(Mitra)` menjadi konfigurasi blok, tidak hardcode |

Konsekuensi renderer:

- Blok `signature` MITRA menerima konfigurasi `leftRole` dan `rightRole` per versi template.
- Recitals legal koperasi berhenti menjadi string literal di `contract-document.service.ts`; menjadi konten versi pertama saat migrasi.
- Layout booklet dua kolom (pembagian 50/50, garis pembatas, border, signature footer full-width) tetap tanggung jawab renderer dan tidak diekspos ke editor.

---

## API Plan

### Template and Version Endpoints

```text
GET  /contract-templates
GET  /contract-templates/:id
POST /contract-templates/:id/versions
GET  /contract-templates/:id/versions
GET  /contract-template-versions/:versionId
PUT  /contract-template-versions/:versionId
POST /contract-template-versions/:versionId/preview
POST /contract-template-versions/:versionId/publish
POST /contract-template-versions/:versionId/rollback
```

### Field Catalog Endpoints

```text
GET  /template-fields
POST /template-fields
PUT  /template-fields/:id
POST /template-fields/:id/archive
GET  /template-master-sources
GET  /template-master-sources/:source/records
```

### Contract Endpoints

Perubahan utama:

- Saat create, backend mengambil versi `PUBLISHED` secara atomik.
- Backend mengisi `templateVersionId`, `templateSnapshot`, dan `resolvedTemplateData`.
- `templateId` tetap dipertahankan sebagai relasi master untuk kebutuhan list dan filter.
- Update kontrak tidak boleh mengganti versi template pada kontrak yang sudah memiliki dokumen final.
- Preview dan generate PDF memakai snapshot kontrak setelah kontrak dibuat.

Endpoint lama `content-overrides` dipertahankan hanya selama masa migrasi, lalu dinonaktifkan setelah seluruh template bermigrasi.

---

## Publish Rules and Validation

Publish harus atomic dan hanya boleh menghasilkan satu versi `PUBLISHED` per master template.

Validasi publish:

- semua block memiliki ID unik;
- block type termasuk allowlist;
- placeholder memiliki sintaks valid;
- semua placeholder terdaftar;
- field custom memiliki definisi dan tipe yang valid;
- required field memiliki sumber data;
- table memiliki minimal satu kolom;
- row table hanya memakai key kolom yang terdaftar;
- list memiliki minimal satu item;
- signature block tersedia;
- PKWT memiliki struktur Indonesia dan English;
- MITRA memiliki struktur Indonesia;
- tidak ada duplicate field key;
- tidak ada duplicate table column key;
- tidak ada master source yang tidak terdaftar;
- preview PDF berhasil dibuat dengan data contoh.

Publish flow:

```text
load draft
  -> validate schema and placeholders
  -> validate master registry references
  -> render preview
  -> archive current published version
  -> publish draft in one transaction
  -> write activity log
```

---

## Rendering Plan

Alur renderer baru:

```text
contract.templateSnapshot
  -> choose language
  -> resolve values from contract snapshot
  -> validate no unresolved placeholder
  -> render ordered blocks
  -> render PDF
```

Renderer V1 harus memiliki handler terpisah untuk setiap block type:

- `renderTitle`
- `renderSubtitle`
- `renderParagraph`
- `renderArticle`
- `renderList`
- `renderTable`
- `renderPageBreak`
- `renderSignature`

Table V1 mendukung penambahan atau penghapusan kolom antar-versi, placeholder di cell, format text/number/currency/date, alignment, width, header, dan repeat header ketika melewati halaman.

List V1 mendukung bullet, numbered, placeholder di item, dan indent level terbatas.

Jika file PDF hilang, regeneration wajib memakai `templateSnapshot` dan `resolvedTemplateData`, bukan master template aktif.

---

## Migration Plan

1. Tambahkan tabel versioning dan field catalog.
2. Buat registry field system dan master source.
3. Untuk setiap `ContractTemplate`, gabungkan definisi hard-code dengan `contentOverrides` lama.
4. Buat versi `PUBLISHED` pertama dari hasil gabungan tersebut.
5. Tambahkan `templateVersionId` pada `Contract`.
6. Backfill kontrak lama ke versi template yang sesuai.
7. Untuk kontrak lama yang sudah memiliki PDF, simpan snapshot dari versi yang digunakan dan pertahankan file.
8. Untuk kontrak lama tanpa snapshot, buat snapshot dari versi publish saat migrasi dan tandai hasil migrasi di audit log.
9. Migrasikan `templateData` lama ke struktur field baru jika memungkinkan.
10. Pastikan endpoint create kontrak selalu mengambil versi publish terbaru.
11. Nonaktifkan runtime dependency pada `contentOverrides` setelah verifikasi migrasi.
12. Hapus endpoint legacy hanya setelah tidak ada consumer aktif.
13. Ekstrak recitals identitas legal koperasi yang hardcode di renderer menjadi konten versi pertama untuk setiap template MITRA.
14. Ekstrak role tanda tangan MITRA yang hardcode (`(Mitra)`, `(Ketua Koperasi)`) menjadi konfigurasi blok signature per template.
15. Seed template baru `MITRA_DRIVER_TRUCK_B3` dengan duties dari sample (SIM aktif, ceklis kendaraan, trip report/manifest, pengangkutan B3, APAR, APD) tanpa mengubah `MITRA_DRIVER` yang ada.

Migration harus idempotent atau memiliki checkpoint agar dapat dilanjutkan jika gagal.

---

## Frontend Plan

### Template Management

Ubah halaman `app/pages/settings/contract-templates.vue` menjadi area pengelolaan:

- daftar versi dan status;
- buat draft dari versi publish;
- editor block dengan drag/reorder;
- editor article dan paragraph;
- editor list;
- editor table dengan tambah/hapus kolom dan baris;
- pemilihan bahasa Indonesia/English;
- field catalog picker;
- custom field builder;
- placeholder autocomplete;
- preview data contoh;
- publish, archive, dan rollback;
- ringkasan perubahan.

### Contract Form

Ubah `AddContractModal.vue` dan `RenewContractModal.vue` agar:

- mengambil field definition dari versi publish;
- merender input berdasarkan tipe field;
- mengambil opsi master reference melalui endpoint allowlist;
- memvalidasi required field;
- menampilkan warning jika nilai master berubah sebelum submit;
- mengirim `templateData` dengan format yang tervalidasi.

### UX Safety

- Draft menampilkan badge `DRAFT` dan tidak boleh dipilih saat membuat kontrak.
- Publish membutuhkan confirmation dialog dan change summary.
- Field yang akan diarsipkan menampilkan template yang masih menggunakannya.
- Preview harus memperlihatkan placeholder yang belum terisi secara jelas.
- Perubahan jumlah kolom tabel ditampilkan dalam diff sebelum publish.

---

## Backend Modules and Files

### New or Expanded Modules

- `backend/src/contract-templates/contract-template-version.service.ts`
- `backend/src/contract-templates/contract-template-version.controller.ts`
- `backend/src/contract-templates/template-field.service.ts`
- `backend/src/contract-templates/template-field.controller.ts`
- `backend/src/contract-templates/template-schema.validator.ts`
- `backend/src/contract-templates/template-master-registry.ts`
- `backend/src/contracts/template-value-resolver.service.ts`
- `backend/prisma/migrations/<timestamp>_add_contract_template_versioning/`

### Existing Files to Modify

- `backend/prisma/schema.prisma`
- `backend/src/contract-templates/contract-templates.service.ts`
- `backend/src/contract-templates/contract-templates.controller.ts`
- `backend/src/contracts/contracts.service.ts`
- `backend/src/contracts/contracts.controller.ts`
- `backend/src/contracts/contract-document.service.ts`
- `backend/src/contracts/contract-document-definitions.ts`
- `app/pages/settings/contract-templates.vue`
- `app/components/kontrak/TemplateContentModal.vue`
- `app/components/kontrak/AddContractModal.vue`
- `app/components/kontrak/RenewContractModal.vue`
- `app/composables/useTemplateContentEditor.ts`
- `app/types/index.d.ts`

---

## Task Breakdown

### Phase 1 - Schema and Registry

1. Tambahkan model template version, field catalog, binding, dan contract snapshot.
2. Tambahkan enum status dan field types.
3. Implementasikan registry master source yang allowlisted.
4. Seed system fields dari data kontrak, employee, settings, dan master data aman.
5. Seed custom field `ktp_issued_date` (DATE, CONTRACT_INPUT, required untuk family MITRA).
6. Generate dan verifikasi migration Prisma.

### Phase 2 - Version Service and API

1. Implementasikan create draft dari versi publish.
2. Implementasikan read/update draft.
3. Implementasikan schema and placeholder validator.
4. Implementasikan preview.
5. Implementasikan publish atomic.
6. Implementasikan archive dan rollback.
7. Tambahkan activity log untuk create, update, publish, archive, rollback, dan archive field.

### Phase 3 - Contract Snapshot

1. Ubah create contract untuk memilih versi publish.
2. Resolve input, dropdown, dan master reference.
3. Implementasikan auto-derive placeholder: `doc.hariTanggal`, `contract.termRange`, `contract.duration`, `contract.docDate` dari data tanggal kontrak.
4. Simpan template snapshot dan resolved values.
5. Ubah regeneration PDF agar memakai snapshot.
6. Tambahkan regression test bahwa publish baru tidak mengubah kontrak lama.

### Phase 4 - Dynamic Renderer

1. Buat type guard untuk block schema.
2. Implementasikan renderer paragraph/article.
3. Implementasikan renderer list (bullet, numbered, alphabetic).
4. Implementasikan renderer table.
5. Implementasikan page break dan signature dengan role configurable per versi template.
6. Pertahankan definisi hard-code hanya untuk seed dan aturan layout khusus.

### Phase 5 - Frontend Editor

1. Implementasikan version list dan status.
2. Implementasikan block editor.
3. Implementasikan table/list editor.
4. Implementasikan shared field picker dan custom field builder.
5. Implementasikan placeholder autocomplete dan validation display.
6. Implementasikan preview, publish, rollback, dan diff.

### Phase 6 - Migration and Rollout

1. Jalankan migration pada database development.
2. Backfill template version dan contract snapshot.
3. Verifikasi jumlah template, versi, dan kontrak.
4. Generate sample PDF untuk setiap family/template.
5. Jalankan staging rollout.
6. Monitor error unresolved placeholder dan render failure.
7. Nonaktifkan legacy override setelah semua consumer berpindah.

---

## Testing Plan

### Unit Tests

- placeholder parser dan validator;
- field type validator;
- master registry resolver;
- dropdown resolver;
- snapshot builder;
- block schema validator;
- table column/row validator;
- publish state transition;
- rollback rules;
- PDF block renderer.

### Integration Tests

- create draft dari versi publish;
- publish mengganti versi aktif secara atomic;
- draft tidak dapat dipakai membuat kontrak;
- contract create menyimpan version ID dan snapshot;
- perubahan master label tidak mengubah resolved value kontrak lama;
- perubahan template baru tidak mengubah PDF lama;
- kontrak lama dapat diregenerate dari snapshot;
- PKWT Indonesia/English;
- MITRA Indonesia saja;
- custom field shared oleh dua template;
- tabel dengan jumlah kolom berbeda antar-versi;
- auto-derive `contract.duration` konsisten dengan `contract.termRange` (tidak terjadi inkonsistensi 6 vs 7 bulan seperti pada sample);
- `doc.hariTanggal` menghasilkan nama hari yang benar;
- template `MITRA_DRIVER_TRUCK_B3` terpisah dari `MITRA_DRIVER` dengan duties masing-masing;
- recitals legal koperasi dirender dari konten template, bukan hardcode;
- list alphabetic (a, b, c) dirender benar di dalam ayat.

### UI Tests

- tambah/hapus/reorder article;
- tambah/hapus kolom dan baris table;
- tambah/reorder list item;
- custom field untuk semua tipe;
- master reference selection;
- validation placeholder;
- publish confirmation;
- rollback confirmation;
- mobile layout untuk editor.

---

## Acceptance Criteria

- Admin dapat membuat draft versi baru tanpa mengubah source code.
- Admin dapat menambah, menghapus, dan mengurutkan pasal.
- Admin dapat membuat field custom baru.
- Field custom dapat dipakai oleh lebih dari satu template.
- Field `TEXT`, `NUMBER`, `DATE`, `DROPDOWN`, dan `MASTER_REFERENCE` tervalidasi backend.
- Master reference hanya berasal dari registry allowlist.
- Admin dapat membuat list dan table.
- Struktur table dapat berbeda total antar-versi.
- Draft tidak digunakan untuk kontrak baru sebelum publish.
- Setiap template hanya memiliki satu versi publish aktif.
- Kontrak baru menyimpan `templateVersionId`, template snapshot, dan resolved data.
- Kontrak lama tidak terpengaruh saat versi baru dipublish.
- PDF lama dapat diregenerate dari snapshot kontrak.
- PKWT mendukung Indonesia dan English.
- MITRA mendukung Indonesia.
- Hasil render PDF MITRA dapat dibandingkan 1:1 dengan sample `DRAFT KONTRAK KERJA MITRA.pdf` (header, recitals, pasal, penutup, tanda tangan).
- Hari, rentang, dan durasi periode selalu konsisten dengan tanggal kontrak karena dihitung otomatis.
- Identitas legal koperasi dapat diedit per versi template tanpa mengubah kode renderer.
- Sub-butir alfabet (a, b, c) dapat dirender di dalam pasal.
- Template `MITRA_DRIVER_TRUCK_B3` tersedia sebagai template terpisah.
- Tanggal terbit KTP mitra diisi saat kontrak dibuat melalui custom field DATE.
- Placeholder invalid ditolak saat publish.
- Semua perubahan penting tercatat dalam activity log.
- Rollback mengaktifkan versi sebelumnya tanpa mengubah kontrak yang sudah ada.

---

## Risks and Mitigations

| Risiko | Mitigasi |
|---|---|
| Master data berubah | Simpan value dan display label dalam snapshot kontrak |
| Field custom dihapus | Archive, jangan hard-delete |
| Tipe field berubah | Buat key/revisi baru |
| Placeholder tidak ter-resolve | Validasi publish dan render; fail closed |
| PDF lama memakai template baru | Renderer hanya memakai contract snapshot |
| Tabel terlalu kompleks | Batasi block schema V1; tanpa nested table/formula |
| Publish bersamaan | Transaction dan unique status rule |
| Migrasi gagal di tengah jalan | Migration checkpoint dan idempotent backfill |
| Registry membuka data sensitif | Allowlist source dan field, tanpa dynamic query |
| Perubahan legacy override hilang | Migrasi gabungkan hard-code dan override sebelum cutover |
| Konten sample legal berubah di masa depan | Konten editable per versi template; renderer hanya menangani layout |
| Inkonsistensi angka durasi vs rentang tanggal | `duration` dan `termRange` dihitung dari satu sumber (tanggal kontrak), tidak pernah manual |

---

## Rollout and Observability

- Jalankan migration pada development dan staging sebelum production.
- Log setiap publish, rollback, unresolved placeholder, dan render failure.
- Tambahkan metrik jumlah draft, publish failure, PDF render failure, dan fallback migration.
- Sediakan feature flag untuk memilih renderer legacy atau versioned saat rollout bertahap.
- Simpan backup database sebelum migration production.
- Setelah cutover, audit bahwa semua kontrak memiliki `templateVersionId` atau alasan migrasi yang tercatat.

---

## Definition of Done

Implementasi dinyatakan selesai setelah:

1. Migration schema berhasil dan tervalidasi.
2. Template lama sudah memiliki versi publish pertama.
3. Kontrak lama memiliki snapshot yang dapat dirender ulang.
4. Editor dapat menyimpan dan mempublish block definition.
5. Semua field type V1 telah tervalidasi.
6. Table dan list telah dirender pada PDF.
7. Kontrak baru memakai versi publish terbaru.
8. Kontrak lama tetap menghasilkan dokumen yang sama setelah template berubah.
9. Test unit, integration, dan UI utama lulus.
10. Legacy `contentOverrides` tidak lagi menjadi sumber runtime utama.
