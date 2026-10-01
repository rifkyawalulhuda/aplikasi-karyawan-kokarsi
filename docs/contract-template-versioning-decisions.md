# Keputusan Teknis: Versioning Template Kontrak

## 2026-02 — Field dinamis CONTRACT_INPUT untuk form kontrak (Fase 2)

### Keputusan
- `GET /api/contract-templates/:id/fields` membaca `fieldDefinitions` versi
  **PUBLISHED**, bukan katalog `ContractTemplateField`. Alasannya: sumber itu juga
  yang divalidasi `TemplateSnapshotService` saat kontrak dibuat/diperpanjang, jadi
  field yang tampil di form selalu identik dengan yang diwajibkan server.
- Urutan field mengikuti urutan array `fieldDefinitions` (urutan editor admin),
  bukan `sortOrder` binding.
- `key` dikembalikan **tanpa** prefix `custom.` karena resolver kontrak
  (`template-value-resolver.helpers.ts`) menerima key tanpa prefix.
- `required` = checkbox per-template; `{{custom.x}}` menyiratkan required.

### Guard baru
- `validateFieldDefinitions()` (dipakai publish/preview/rollback) kini **menolak**
  field `sourceType: 'MASTER_REFERENCE'`. Registry master reference masih ada dan
  tervalidasi, tetapi belum ada jalur resolve di resolver kontrak, sehingga field
  seperti itu tidak akan pernah punya nilai: kalau `required` pembuatan kontrak
  selalu gagal, kalau opsional PDF diam-diam kosong.
- Keempat jalur bootstrap yang menerbitkan versi PUBLISHED langsung sekarang
  semuanya melewati `applyTemplateBindings()`:
  1. `ContractTemplateVersionsService.createDraft()`
  2. `ContractTemplateVersionsService.getPublished()` (bootstrap lazy)
  3. `ContractTemplatesService.ensureDefaultTemplates()`
  4. seed `prisma/seed.ts`

## 2026-02 — Bootstrap lazy `getPublished()` vs draft yang belum terbit (Fase 5)

### Masalah
`getPublished()` menerima versi **PUBLISHED** terakhir; kalau tidak ada, ia
menerbitkan versi bootstrap `versionNumber: 1` secara langsung. Selama ini aman
karena template selalu punya versi PUBLISHED hasil `ensureDefaultTemplates()`.

Setelah Fase 4, `GET /api/contract-templates/:id/fields` (dipanggil modal
Buat/Edit/Perpanjang Kontrak) ikut memakai `getPublished()`. Muncul celah:
template yang **baru dibuat lewat Master Template** → admin menyimpan **draft**
tanpa mempublikasikannya → `createDraft()` menulis `versionNumber: 1` (status
DRAFT) → bootstrap lazy mencoba menulis `versionNumber: 1` lagi → **P2002
`Unique constraint failed on (templateId, versionNumber)`**. Akibatnya editor
template *dan* modal kontrak gagal dibuka; fitur mati total untuk template itu.

### Keputusan
- `getPublished()` **tidak** mem-bootstrap bila template sudah punya versi apa
  pun. Versi terbaru (`orderBy: versionNumber desc`, tanpa filter status) dipakai
  sebagai versi efektif. Pemeriksaan ini **menghasilkan perilaku identik** untuk
  template yang sudah punya versi PUBLISHED, jadi tidak mengubah apa pun di jalur
  normal.
- Cabang "fallback menerbitkan versi" hanya berlaku untuk template yang
  **benar-benar belum punya satu versi pun** (template legacy tanpa snapshot) —
  peran aslinya sebagai jalur migrasi tetap utuh, termasuk overlay
  `applyTemplateBindings()`.
- Balapan dua request (editor template + modal kontrak membuka bersamaan) yang
  sama-sama menulis v1 ditangani: `P2002` pada `create` tidak diteruskan ke
  pengguna; request yang kalah memakai versi pemenang.

### Guardrail yang membatasi dampak
Draft **tidak pernah** ikut tervalidasi atau tercetak ke kontrak:
`TemplateSnapshotService.buildSnapshot()` melakukan query sendiri yang tetap
memfilter `status: 'PUBLISHED'` dan mengembalikan `null` bila tidak ada. Jadi
mengembalikan draft dari `getPublished()` hanya membuat UI dapat dibuka — tidak
pernah membuat kontrak memakai template yang belum terbit.

### Konsekuensi yang perlu diketahui
- Form kontrak untuk template yang belum pernah terbit menampilkan field dari
  versi terbaru (draft terakhir). Ini **bukan** celah validasi: kontraknya tidak
  akan pernah memakai draft itu sebagai dokumen.
- ⚠️ Koreksi catatan awal: server **tidak** menolak submit kontrak ber-template
  belum-terbit. `buildContractSnapshot()` mengembalikan `null`, dan
  `contracts.create()` tetap menyimpan kontrak dengan `templateVersionId: null` /
  `templateSnapshot: null` (tanpa error). Saat PDF diminta,
  `contract-document.service` melihat `!snapshot?.contentDefinition` → jatuh ke
  jalur legacy `CONTRACT_DOCUMENT_DEFINITIONS[templateKey]`. Artinya: **kontrak
  tersimpan sukses, tapi field dinamis dan seluruh isi draft hilang tanpa pesan
  apa pun.** Ini kegagalan senyap, bukan fail-safe.
- Karena itu guardrail-nya dipindahkan ke UI (lihat bagian berikut).

### Guardrail UI (dipakai bersama tiga modal kontrak)
`GET /contract-templates/:id/fields` kini mengembalikan
`{ published: boolean; fields: ContractInputField[] }` (tipe FE
`ContractInputFieldsResponse`) sehingga modal tahu apakah versi yang dipakai
sudah terbit:

| Modal | Perilaku saat `published === false` |
| --- | --- |
| `AddContractModal` | **Submit diblokir** + banner peringatan. Kontrak baru akan lahir tanpa snapshot, dan user masih bisa memilih template lain atau menerbitkan template. |
| `EditContractModal` | **Peringatan saja** (tidak diblokir). Kontrak seperti ini memang legacy, dan `contracts.update()` sengaja tidak menimpa snapshot lama saat snapshot baru gagal dibangun — jadi tanggal/kompensasi tetap sah diperbaiki. |
| `RenewContractModal` | **Peringatan saja** (tidak diblokir). Perpanjangan kontrak legacy tetap harus bisa jalan; user diberi tahu bahwa data warisan tidak akan tercetak. |

Alasan asimetri: blokir hanya masuk akal pada pembuatan kontrak baru (ada jalur
perbaikan yang jelas dan template lain bisa dipilih). Mem-blokir edit/perpanjang
akan mengunci kontrak legacy yang sudah ada tanpa cara memperbaikinya dari layar
itu.

- Endpoint `GET /versions/published` kini bisa mengembalikan baris non-PUBLISHED.
  Tidak ada konsumen frontend yang memanggilnya (hanya route proxy yang tersedia),
  sehingga tidak ada perilaku UI yang berubah.
- Satu draft terbuka per template tetap dipaksakan `ensureNoOpenDraft()`; keputusan
  ini tidak melonggarkan aturan tersebut.

### Bukti verifikasi end-to-end (2026-10-01, app di port 3000 + backend 3001)
Dijalankan lewat HTTP yang sama dengan yang dipakai UI (proxy Nuxt `/api/...`),
lalu data uji dibersihkan lagi:

1. `GET /contract-templates/:id/fields` pada template **tanpa versi** → `200`,
   bootstrap lazy menerbitkan `v1 PUBLISHED` (jalur migrasi legacy masih utuh).
2. Binding `CONTRACT_INPUT` ditambahkan ke katalog → publish `v2` → `GET /fields`
   mengembalikan `{ published: true, fields: [ktp_issued_date, shift_code] }`.
3. `POST /contracts` dengan `templateData: { ktp_issued_date: '2026-03-12', shift_code: 'PAGI' }`
   → kontrak tersimpan, `templateVersionId` menunjuk versi PUBLISHED,
   `resolvedTemplateData` = `custom.ktp_issued_date` → `{ value: '2026-03-12T00:00:00.000Z',
   displayValue: '12 Maret 2026' }` (tanpa pergeseran UTC) dan `custom.shift_code` → `PAGI`.
4. `POST /contracts/:id/generate-document` → `201`, `renderEngine: PDF_NATIVE`,
   `layoutMode: LEGAL_PDF_TEMPLATE`.
5. `PUT /contracts/:id` (ubah KTP + kompensasi) → snapshot dibangun ulang;
   `resolvedTemplateData` ikut berubah jadi `5 April 2026` / `MALAM`.
6. `POST /contracts/:id/renew` (dengan `templateId`, seperti yang selalu dikirim
   `RenewContractModal` karena field itu wajib) → kontrak perpanjangan mewarisi
   `templateData` dan **tetap punya snapshot** (`templateVersionId` terisi).
   Kalau `templateId` tidak dikirim, `renew()` kini mewarisi `templateId` kontrak
   induk (`dto.templateId ?? parent.templateId`), jadi hasilnya tetap punya
   snapshot — sebelumnya lahir tanpa snapshot (lihat perbaikan di bawah).
7. **Kasus negatif (template draft-only):** `GET /fields` → `{ published: false, fields: [] }`;
   `POST /contracts` tetap **`201`** dengan `templateVersionId: null`,
   `templateSnapshot: null`, `resolvedTemplateData: null`, sementara `templateData`
   tersimpan berisi nilai yang diisi. Saat PDF diminta → `400 "Data legal kontrak
   belum lengkap"` (jalur legacy memerlukan NIK/tempat lahir/alamat karyawan).
   Ini mengonfirmasi kegagalan senyap yang dicegah banner `AddContractModal`.

Catatan: `GET /versions/published` tidak dipakai UI mana pun; satu-satunya jalur
yang berubah perilakunya adalah `/fields` (dipakai membuka modal kontrak), yang
kini menyertakan flag `published`.

### Perbaikan susulan: `renew()` mewarisi `templateId` kontrak induk
**Masalah.** `renew()` memakai `dto.templateId` langsung untuk `buildContractSnapshot()`
**dan** untuk kolom `Contract.templateId`. `RenewContractModal` selalu mengirim field
ini (wajib di form), jadi dari UI hasilnya benar — tapi API-nya bebas. Perpanjangan
tanpa `templateId` menghasilkan kontrak dengan `templateId: null` dan
`templateVersionId: null` → PDF perpanjangan jatuh ke definisi legacy dan semua field
dinamis yang diwarisi dari induk hilang. Kontrak legacy tetap sah diperpanjang, hanya
tanpa jejak template.

**Perbaikan.** `const effectiveTemplateId = dto.templateId ?? parent.templateId ?? null`
dipakai untuk ketiga tempat (snapshot, kolom `templateId`, dan nilai tersimpan). Jadi
hasil jalur API identik dengan jalur UI. Kalau induknya pun tidak punya template,
perilakunya tidak berubah (`null`, jalur legacy).

**Tes.** `backend/src/contracts/contracts.service.spec.ts` — 4 kasus baru:
`renew` tanpa `templateId` mewarisi induk (5) dan tetap membangun snapshot; `templateId`
kiriman klien tidak ditimpa; `templateData` kiriman form menang atas warisan induk;
kontrak legacy (template induk belum terbit → `buildSnapshot()` null) tetap berhasil
diperpanjang dengan `templateId` terisi.

**Bukti E2E (2026-10-01).** Harness sementara melawan backend hidup (port 3001),
template uji `TEST001` (id 29984, v1 PUBLISHED), 12/12 check lulus:

| Kasus | Request | Hasil |
| --- | --- | --- |
| A | `renew` **tanpa** `templateId` | `201`; anak mewarisi `templateId: 29984` + `templateVersionId` + `templateSnapshot` + `resolvedTemplateData`; `templateData` = warisan induk |
| B | `renew` **dengan** `templateId` + `templateData` | `201`; `templateId` kiriman dipakai; `templateData` form menang (`MALAM` / `2026-05-01`) |
| C | `renew` induk **legacy** (`templateId: null`) | `201`; anak tetap `templateId: null` & tanpa snapshot (jalur legacy utuh) |

Kontrol negatif: dengan baris `templateId: effectiveTemplateId` dikembalikan ke
`dto.templateId` (build lama), kasus A gagal 4 check — anak tersimpan dengan
`templateId: null`, `templateVersionId: null`, `templateSnapshot: null`,
`resolvedTemplateData: null`. Jadi ini memang regresi nyata, bukan teori.

Semua kontrak uji dibersihkan setelah run (`sisa kontrak uji = 0`, total kontrak
kembali `66`), dan harness-nya dihapus.

