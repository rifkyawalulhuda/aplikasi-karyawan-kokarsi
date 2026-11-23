# Tinggi Ruang Tanda Tangan (Meterai) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Admin dapat mengatur tinggi ruang kosong tanda tangan (untuk menempel meterai) pada template PKWT dan MITRA, satu nilai untuk kedua kolom, disimpan per versi template.

**Architecture:** Field baru `signatureSpaceMm` pada blok `signature` (mm, 0–100, satu nilai untuk kiri & kanan). Modul daun `signature-space.ts` menormalkan nilai dan mengonversi mm→pt. Engine PKWT memakai nilai itu untuk tinggi baris body (ruang tetap, bukan sisa); engine MITRA mengganti tinggi baris `signSpaceRowH`. Kedua renderer membaca nilai dari blok template (bukan dari pemanggil), sehingga generate dan pratinjau tidak bisa menyimpang.

**Tech Stack:** NestJS + PDFKit (backend), Nuxt 3 + Nuxt UI (editor), Jest.

**Spec:** percakapan grilling 2026-11-23 (keputusan: PKWT susunan tetap hanya ruang diperpanjang ke bawah; MITRA default tidak berubah; template lama memakai default baru; satuan mm; batas 0–100).

## Global Constraints

- Satuan simpan: **mm**, 1–2 desimal, rentang **0–100**. Di engine dikonversi ke pt dengan `72 / 25.4`.
- Default PKWT: **28.95 mm** (tinggi meterai Rp10.000 = 28,95 mm; lebar 21 mm).
- Default MITRA: **88 pt** (31,04 mm) — persis `signSpaceRowH` sekarang, supaya MITRA tidak berubah.
- Nilai `undefined`/tidak sah → default keluarga. Tidak pernah melempar error saat render.
- Satu nilai untuk kolom kiri dan kanan.
- Field hanya ditampilkan di tab **Indonesia** (tabelnya satu untuk dua bahasa).
- Tidak boleh mengubah teks/redaksi kontrak. Hanya geometri tabel tanda tangan.

## Review Focus

1. Nilai maksimum (100 mm) → tabel tanda tangan harus pindah ke halaman baru, tidak terpotong.
2. Nama/jabatan panjang yang membungkus → garis bawah tetap di bawah teks, ruang meterai tidak termakan.
3. Template MITRA lama (tanpa field) → tinggi tabel tetap 88 pt, tidak berubah seperseratus pt.
4. Nilai 0 → baris serapat mungkin, garis bawah tidak menabrak teks jabatan.
5. Tab EN → tidak boleh lahir nilai kedua yang berbeda (field disembunyikan + catatan).

---

### Task 1: Modul daun `signature-space`

**Files:**
- Create: `backend/src/contracts/signature-space.ts`
- Test: `backend/src/contracts/signature-space.spec.ts`

**Interfaces:**
- Produces: `MAX_SIGNATURE_SPACE_MM = 100`, `PT_PER_MM`, `PKWT_DEFAULT_SIGNATURE_SPACE_MM = 28.95`, `MITRA_DEFAULT_SIGNATURE_SPACE_PT = 88`, `normalizeSignatureSpaceMm(value: unknown): number | undefined`, `signatureSpacePt(value: unknown, family: 'PKWT' | 'MITRA'): number`, `signatureSpaceDefaultMm(family): number`.

- [x] Step 1: Tulis tes gagal — `normalizeSignatureSpaceMm(0) === 0`, `(28.95) === 28.95`, `(100) === 100`, `(-1) === undefined`, `(101) === undefined`, `('30') === undefined`, `(NaN) === undefined`; `signatureSpacePt(undefined, 'MITRA') === 88`; `signatureSpacePt(undefined, 'PKWT')` close to `28.95 * 72/25.4`; `signatureSpacePt(40, 'PKWT')` close to `113.39`.
- [x] Step 2: Jalankan `npx jest src/contracts/signature-space.spec.ts` — FAIL (modul belum ada).
- [x] Step 3: Implementasi modul (tanpa dependensi PDFKit/NestJS, pola `block-spacing.ts`).
- [x] Step 4: Jalankan tes — PASS.
- [x] Step 5: Commit.

### Task 2: Engine PKWT — baris body dinamis

**Files:**
- Modify: `backend/src/contracts/pkwt-layout.engine.ts` (`PkwtSignatureOptions`, `pkwtSignatureHeight`, `renderPkwtSignature`, call site ~1830)

**Interfaces:**
- Consumes: `signatureSpacePt` (Task 1) — dipakai renderer, bukan engine; engine menerima `spacePt` yang sudah final.
- Produces: `PkwtSignatureOptions.spacePt?: number`; `pkwtSignatureHeight(doc: any, o?: PkwtSignatureOptions): number`.

- [x] Step 1: Tulis tes gagal di `pkwt-layout.engine.spec.ts`: dengan doc PDFKit nyata, tinggi `spacePt = 40mm` minus `spacePt = 29mm` = `11 * 72/25.4` (±0,01); `spacePt = 0` tetap > tinggi teks; label row tetap 34.52.
- [x] Step 2: Jalankan — FAIL (signature lama tidak menerima argumen / tinggi konstan).
- [x] Step 3: Implementasi: `pkwtSignatureRowHeights(doc, o)` = `[SIG_LABEL_ROW, SIG_PAD + textH + spacePt + SIG_UNDERLINE_GAP]`, dipakai oleh `pkwtSignatureHeight` dan `renderPkwtSignature` (satu sumber). `textH` = `doc.heightOfString` maksimum kiri/kanan.
- [x] Step 4: Jalankan tes — PASS.
- [x] Step 5: Commit.

### Task 3: Renderer PKWT membaca nilai dari blok + meta layout

**Files:**
- Modify: `backend/src/contracts/pkwt-document.renderer.ts:386-450`

**Interfaces:**
- Produces: `renderPkwtDocumentInto` mengisi `signature.spacePt` dari blok `signature` (kolom ID, fallback EN) via `signatureSpacePt(block.signatureSpaceMm, 'PKWT')`; `doc.__pkwtLayout.signatureHeight`.

- [x] Step 1: Tulis tes gagal di `pkwt-document.renderer.spec.ts`: blok `signature` dengan `signatureSpaceMm: 40` → `__pkwtLayout.signatureHeight` lebih besar ±`(40-28.95)*72/25.4` daripada tanpa field; tanpa field → default PKWT.
- [x] Step 2: Jalankan — FAIL.
- [x] Step 3: Implementasi (satu pembacaan blok, jangan duplikasi di service).
- [x] Step 4: Jalankan tes — PASS.
- [x] Step 5: Commit.

### Task 4: Engine + renderer MITRA

**Files:**
- Modify: `backend/src/contracts/mitra-layout.engine.ts` (`MitraSignatureOptions`, `mitraSignatureRows`), `backend/src/contracts/mitra-document.renderer.ts:152-167`

**Interfaces:**
- Produces: `MitraSignatureOptions.spacePt?: number`; `mitraSignatureRows` memakai `o?.spacePt ?? T.signSpaceRowH`.

- [x] Step 1: Tulis tes gagal di `mitra-layout.engine.spec.ts`: `mitraSignatureTableHeight(doc)` tanpa opsi = lama; dengan `spacePt: 40mm` bertambah `(40 - 88/2.8346)*2.8346`.
- [x] Step 2: Jalankan — FAIL.
- [x] Step 3: Implementasi + isi `spacePt` di `renderMitraDocumentInto` dari blok `signature`.
- [x] Step 4: Jalankan tes — PASS.
- [x] Step 5: Commit.

### Task 5: Validator skema template

**Files:**
- Modify: `backend/src/contract-templates/template-schema.validator.ts:452-462`
- Test: `backend/src/contract-templates/template-schema.validator.spec.ts`

**Interfaces:**
- Consumes: `normalizeSignatureSpaceMm`, `MAX_SIGNATURE_SPACE_MM` (Task 1).

- [x] Step 1: Tulis tes gagal: `signatureSpaceMm: 0` dan `28.95` lolos; `-1`, `101`, `'30'` menghasilkan issue dengan `fieldPath` `languages.id[...].signatureSpaceMm`.
- [x] Step 2: Jalankan — FAIL.
- [x] Step 3: Implementasi validasi di cabang `signature` (sebelum `return`).
- [x] Step 4: Jalankan tes — PASS.
- [x] Step 5: Commit.

### Task 6: Editor — input tinggi ruang

**Files:**
- Modify: `app/components/kontrak/TemplateBlockCard.vue` (props + cabang `signature`), `app/components/kontrak/TemplateContentModal.vue:1601-1620`

**Interfaces:**
- Consumes: `family` prop yang sudah ada; `lang` baru (`'id' | 'en'`, default `'id'`).

- [x] Step 1: Tambah prop `lang` dan kirim `:lang="lang"` dari modal.
- [x] Step 2: Tambah input angka `signatureSpaceMm` (min 0, max 100, step 0,5, sufiks "mm") hanya saat `lang === 'id'`; placeholder = default keluarga (PKWT 28,95 / MITRA 31,04); peringatan bila nilai < 28,95; catatan di tab EN bahwa nilainya diatur di tab ID.
- [x] Step 3: `npm run typecheck` dan `npm run lint` — PASS.
- [x] Step 4: Commit.

### Task 7: Verifikasi end-to-end

- [x] Step 1: `npx jest` untuk spec yang tersentuh — PASS.
- [x] Step 2: Render PDF PKWT & MITRA via script probe, ukur jarak bawah teks jabatan → garis bawah; pastikan ≥ nilai yang diset dan halaman tidak terpotong.
- [x] Step 3: Hapus script probe sementara; commit.

---

## Status implementasi (23 Nov 2026)

Semua task di atas **selesai**. Penyimpangan dari rencana dan bukti verifikasi:

### Keputusan produk (dari sesi grilling)

1. **Kotak yang bisa diedit:** tinggi ruang kosong tempat meterai — bukan lebar
   kolom, bukan lebar garis bawah.
2. **Satu nilai** untuk kolom kiri dan kanan.
3. **PKWT** mempertahankan susunan sekarang (nama/jabatan langsung di bawah
   label) — hanya ruang di bawahnya yang memanjang.
4. **Default PKWT 28,95 mm** (tinggi meterai Rp10.000).
5. **Default MITRA dibiarkan 31,05 mm** (baris ruang master 88 pt) supaya
   template lama tidak berubah.
6. **Template lama tanpa field** memakai default keluarga — PKWT berubah
   (sesuai keputusan admin), MITRA identik.
7. **Batas 0–100 mm**, disimpan per versi template di blok `signature`, satuan mm.
8. **Halaman terakhir PKWT bertambah jadi 5 halaman** pada default 28,95 mm —
   DISENGAJA (admin memilih "terima 5 halaman" daripada menekan tabel ke margin).

### Penyimpangan dari rencana

- Editor memakai prop **`language`** yang sudah ada (bukan prop baru `lang`);
  kontrol hanya tampil di tab Indonesia + catatan di tab English.
- Input memakai **ref lokal + `@change`** (commit saat blur/Enter), bukan
  `@update:model-value`, agar mengetik tidak "berkelahi" dengan nilai tersimpan.
- Peringatan "di bawah tinggi meterai" bersifat **peringatan**, bukan blokir.
- `PKWT_GEOMETRY.signatureTable.height` kini hanya referensi master (diberi
  komentar); tinggi nyata dihitung `pkwtSignatureRowHeights`.

### Bukti

- `npx jest` backend: **34 suite / 717 tes PASS**.
- `npx nuxi typecheck`: **PASS**.
- `npx eslint` pada kedua file Vue: **tidak ada error baru** (102 error lama
  sudah ada sebelumnya; tidak satu pun di baris yang ditambahkan).
- Ukur PDF hasil render (pdfplumber), jarak bawah teks jabatan → garis bawah:
  - PKWT default → **28,95 mm**; `signatureSpaceMm: 40` → **40,00 mm**.
  - MITRA default → tidak berubah; `signatureSpaceMm: 40` → bertambah tepat
    `(40 − 31,05)` mm.
- Paginasi: 4 varian PKWT bawaan → **5 halaman** pada default (tes eksplisit
  `default ruang meterai 28,95 mm membuat varian bawaan 5 halaman`), dan tetap
  **4 halaman** saat ruang dipatok 20 mm (tes plafon `blockGap`).
