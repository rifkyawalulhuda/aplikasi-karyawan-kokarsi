# Struktur Organisasi (Teknis)

Dokumentasi teknis modul **Struktur Organisasi** — bagan kepengurusan koperasi per periode, dengan kanvas interaktif (pan/zoom, drag-drop), cetak, dan export.

Untuk panduan pengguna, lihat [Struktur Organisasi](/panduan-pengguna/struktur-organisasi).

## Ringkasan Arsitektur

```
Browser (Nuxt 4)
  └─ /struktur-organisasi
       ├─ StrukturOrganisasiOrgChartCanvas  → kanvas pan/zoom + drag-drop
       │    └─ StrukturOrganisasiOrgChart    → rekursif, render kartu
       │         └─ StrukturOrganisasiOrgNodeCard
       ├─ StrukturOrganisasiNodeFormModal    → tambah/edit jabatan
       ├─ StrukturOrganisasiPeriodModal      → tambah/edit periode
       └─ StrukturOrganisasiNodeDetailDrawer → detail + aksi
              │  $fetch('/api/org-structure/*')
              ▼
       Nitro proxy  server/api/org-structure/*
              │  (forward cookie auth_token → Bearer)
              ▼
       NestJS  OrgStructureController → OrgStructureService
              │
              ▼
       Prisma  OrgPeriod / OrgPosition  →  PostgreSQL
```

## Data Model

Dua tabel: **`org_periods`** dan **`org_positions`** (self-reference hierarki). Detail kolom ada di [Database Schema → Tabel Struktur Organisasi](/teknis/database-schema#tabel-struktur-organisasi).

- **`OrgPeriod`** — periode kepengurusan (`name`, `startDate`, `endDate?`, `isActive`, `notes?`). Menghapus periode **cascade** ke seluruh jabatan.
- **`OrgPosition`** — satu jabatan dalam hierarki (`parentId` self-reference `Restrict`, `employeeId?` ke `employees` `SetNull`, `photoUrl`, `skNumber/skDate`, `startDate/endDate`, `status`, `sortOrder`, `notes`).

Enum `OrgPositionStatus`: `AKTIF` · `AKAN_BERAKHIR` · `EXPIRED` · `TIDAK_AKTIF`.

## Backend — `backend/src/org-structure/`

### Endpoint

| Method | Route | Akses | Keterangan |
|---|---|---|---|
| GET | `/org-structure/periods` | Auth | Daftar periode (+ jumlah jabatan) |
| POST | `/org-structure/periods` | ADMIN | Buat periode |
| PUT | `/org-structure/periods/:id` | ADMIN | Ubah periode |
| DELETE | `/org-structure/periods/:id` | ADMIN | Hapus periode (cascade jabatan) |
| GET | `/org-structure/tree?periodId=` | Auth | Bagan hierarkis (nested `children`) |
| GET | `/org-structure/nodes?periodId=` | Auth | Daftar jabatan datar |
| GET | `/org-structure/nodes/:id` | Auth | Detail satu jabatan |
| POST | `/org-structure/nodes` | ADMIN | Buat jabatan |
| PUT | `/org-structure/nodes/:id` | ADMIN | Ubah jabatan |
| POST | `/org-structure/nodes/:id/move` | ADMIN | Pindah jabatan (atasan & urutan) |
| DELETE | `/org-structure/nodes/:id` | ADMIN | Hapus jabatan |
| POST | `/org-structure/nodes/:id/photo` | ADMIN | Unggah foto jabatan |

Seluruh route dilindungi `@UseGuards(AuthGuard('jwt'))`. Operasi tulis melewati `ensureWriteAccess()` (hanya `ADMIN`).

### Status Otomatis

`OrgStructureService.computeStatus()` menghitung status dari `endDate`:

| Kondisi | Status |
|---|---|
| Tanpa `endDate` | `AKTIF` (atau nilai eksplisit) |
| Sisa > 30 hari | `AKTIF` |
| Sisa 0–30 hari | `AKAN_BERAKHIR` |
| Sudah lewat | `EXPIRED` |

### Penjagaan Hierarki

`assertParentValid()` menolak:

- atasan menunjuk ke **dirinya sendiri**;
- atasan berada di **periode berbeda**;
- atasan berasal dari **bawahannya sendiri** (siklus) — dicek dengan penelusuran `collectDescendantIds()`.

Menghapus jabatan yang **masih punya bawahan** ditolak (`ConflictException`).

### Foto Jabatan

`POST /nodes/:id/photo` memakai `FileInterceptor` (multer `diskStorage` → `uploads/org-structure/`):

- hanya `jpg`/`jpeg`/`png`/`webp`;
- maksimum **2 MB**;
- isi file divalidasi **magic bytes** (`validateImageBuffer`); file ditolak akan dihapus dari disk;
- foto lama dihapus otomatis saat diganti.

### Efek Samping

Setiap operasi tulis mencatat **Activity Log** (modul `Struktur Organisasi`) dan menginvalidasi dashboard cache.

## Nitro Proxy — `server/api/org-structure/`

Route proxy meneruskan request ke backend dengan cookie `auth_token` → header `Authorization: Bearer`:

| File | Backend |
|---|---|
| `periods/index.ts` | `GET/POST /org-structure/periods` |
| `periods/[id].ts` | `PUT/DELETE /org-structure/periods/:id` |
| `tree.get.ts` | `GET /org-structure/tree` |
| `nodes/index.ts` | `GET/POST /org-structure/nodes` |
| `nodes/[id].ts` | `GET/PUT/DELETE /org-structure/nodes/:id` |
| `nodes/[id]/move.post.ts` | `POST /org-structure/nodes/:id/move` |
| `nodes/[id]/photo.post.ts` | `POST /org-structure/nodes/:id/photo` |

## Frontend

### Halaman & Komponen

| Berkas | Peran |
|---|---|
| `app/pages/struktur-organisasi/index.vue` | Halaman utama: pilih periode, tab Bagan/Tabel, pencarian, export, cetak |
| `app/components/struktur-organisasi/OrgChartCanvas.vue` | Kanvas: pan, zoom (roda/cubit/tombol), fit, kontrol zoom, latar & pola |
| `app/components/struktur-organisasi/OrgChart.vue` | Render hierarki rekursif + logika drag-drop |
| `app/components/struktur-organisasi/OrgNodeCard.vue` | Kartu satu jabatan |
| `app/components/struktur-organisasi/NodeFormModal.vue` | Form tambah/edit jabatan |
| `app/components/struktur-organisasi/PeriodModal.vue` | Form tambah/edit periode |
| `app/components/struktur-organisasi/NodeDetailDrawer.vue` | Panel detail + aksi (edit, tambah bawahan, hapus, navigasi) |

### Composables

| Berkas | Tanggung jawab |
|---|---|
| `app/composables/useOrgChartDisplay.ts` | Preferensi elemen kartu (foto/jabatan/unit/status), persist `localStorage` |
| `app/composables/useOrgChartBackground.ts` | Tema latar, pola, warna kustom, auto-kontras; persist `localStorage` |
| `app/composables/useOrgChartView.ts` | State pan/zoom + kartu terciut per periode (debounced); persist `localStorage` |
| `app/composables/useOrgChartPrint.ts` | Mesin cetak A4/A3 via iframe tersembunyi |
| `app/composables/useOrgChartContext.ts` | Injection key konteks bagan (drag, collapse, aksi node) |
| `app/composables/useExport.ts` → `exportOrgStructureExcel()` | Export Excel jabatan |

State bagan dibagikan lewat `useState` (aman SSR); preferensi pengguna dipersist di `localStorage` per-browser.

### Tipe

`app/types/org-structure.ts`: `OrgPeriod`, `OrgNode`, `OrgPositionStatus`, `OrgChartDisplay`, `OrgChartBackground`, `OrgChartViewState`.

## Mesin Cetak (`useOrgChartPrint`)

Cetak tidak memakai `window.print()` halaman, melainkan **iframe tersembunyi** agar tidak diblokir popup blocker dan bebas dari CSS aplikasi.

1. Bagan dibangun ulang sebagai HTML/CSS (semua cabang terbuka, mengikuti `OrgChartDisplay`).
2. Ukuran intrinsik konten diukur (`getBoundingClientRect`).
3. Orientasi dipilih otomatis dari rasio konten (potret/lanskap) untuk **A4** atau **A3**.
4. Skala = `min(lebar area / lebar konten, tinggi area / tinggi konten, 1)` sehingga muat satu halaman.
5. Dialog cetak dipicu setelah gambar termuat (maks 1,5 dtk).

Teks di-escape (`escapeHtml`) sebelum disisipkan ke HTML.

## Akses & Keamanan

- **Baca** — semua pengguna terautentikasi.
- **Tulis** — hanya `ADMIN` (dicek di controller via `ensureWriteAccess`).
- UI menyembunyikan tombol kelola lewat `auth.canManageMasterData`.
- Unggah foto divalidasi MIME + magic bytes + batas ukuran.
- Semua query backend ter-scope per `periodId`; relasi `employeeId` memakai `SetNull` agar menghapus karyawan tidak memutus data struktur.

## Uji & Verifikasi

Modul ini tidak memiliki unit test khusus; verifikasi dilakukan lewat type-check (`nuxt typecheck`), lint, dan pengujian manual UI (pan/zoom, drag-drop, cetak, export).
