# Project Context - Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu

> Dibuat: 2026-06-30 | Diperbarui: 2026-07-05 (v9) | Stack: Nuxt 3 + NestJS + PostgreSQL
>
> Catatan versi: context ini sudah mengikuti generator kontrak **pure PDF** berbasis `pdfkit`, flow **Pengaturan > Umum**, sinkronisasi template kontrak `PKWT` / `MITRA` terbaru, modul **Contract Management** lengkap (State Machine, Cron Job, Guards, Renewal Flow, Summary Mode), **Import Karyawan Bulk** via Excel template, **Riwayat SP** di detail karyawan, fitur **Ganti Logo & Nama Organisasi**, dan perbaikan bug timezone date import.

---

## Ringkasan Proyek

Aplikasi manajemen karyawan internal untuk **Kokarsi PT. Sankyu**. Role internal: Master Admin dan Pengelola Koperasi. UI Bahasa Indonesia.

- **Repo**: `E:\Github\aplikasi-karyawan-kokarsi`
- **Frontend**: Nuxt 3 + Nuxt UI v4 + TypeScript + Tailwind -> `http://localhost:3000`
- **Backend**: NestJS + Prisma + PostgreSQL -> `http://localhost:3001/api`
- **Database**: PostgreSQL lokal project ini via `backend/.env` (`DATABASE_URL`), Docker `kokarsi-postgres`, port `5435`, DB `kokarsi_karyawan`
- **Login Admin**: `employeeNo=EMP001` / `password=admin123`
- **Login Admin User**: `username=admin.kokarsi` / `password=admin123`
- **Login Pengelola**: `username=pengelola1` / `password=pengelola123`

---

## Cara Menjalankan

```bash
# 1. Start PostgreSQL project ini
docker compose -f docker-compose.db.yml up -d

# 1a. Kredensial project ini:
#    user: kokarsi
#    password: kokarsi2026

# 2. Start Backend
cd E:\Github\aplikasi-karyawan-kokarsi\backend
node dist/main.js

# 3. Start Frontend
cd E:\Github\aplikasi-karyawan-kokarsi
pnpm dev
```

### Compile Backend (setelah ada perubahan kode)
```bash
cd E:\Github\aplikasi-karyawan-kokarsi\backend
NODE_OPTIONS="--max-old-space-size=4096" npx tsc -p tsconfig.json
```

---

## Fitur Selesai

| # | Fitur | File Utama |
|---|-------|-----------|
| 1 | JWT auth via cookie (Nitro proxy) | `server/middleware/auth.ts`, `server/api/auth/` |
| 2 | Login / Logout + nama admin di sidebar | `app/pages/login.vue`, `app/layouts/` |
| 3 | Dashboard stats + donut chart + progress bars | `app/pages/index.vue` |
| 4 | CRUD Karyawan (tambah, edit, hapus) | `app/pages/karyawan/index.vue`, `app/components/karyawan/` |
| 5 | Fix Status Pajak (race condition + key mismatch) | `app/components/karyawan/EditModal.vue` |
| 6 | Master Data CRUD (lokasi, jabatan, level, pajak, tipe kontrak) | `app/pages/settings/master-data.vue`, `server/api/lookups/` |
| 7 | CRUD Kontrak + status otomatis berdasarkan tanggal + riwayat per karyawan | `app/pages/kontrak.vue`, `app/pages/karyawan/index.vue`, `app/components/kontrak/` |
| 8 | Upload foto karyawan | `app/components/karyawan/EditModal.vue`, `server/api/employees/[id]/photo.post.ts` |
| 9 | Export Excel & PDF (semua data + semua kolom termasuk NIK, Tempat Lahir, Alamat) | `app/composables/useExport.ts`, `server/api/employees/export.get.ts` |
| 10 | Toast konfirmasi hapus untuk karyawan, kontrak, dan master data | `app/composables/useConfirmDeleteToast.ts` |
| 11 | Role internal Master Admin vs Pengelola Koperasi dengan pembatasan Master Data | `backend/prisma/schema.prisma`, `backend/src/lookups/lookups.controller.ts` |
| 12 | Master User untuk admin membuat akun Admin/Pengelola | `backend/src/users/`, `app/pages/settings/users.vue` |
| 13 | Validasi duplikat Master User yang ramah di UI + 409 conflict backend | `app/pages/settings/users.vue`, `backend/src/users/users.service.ts` |
| 14 | Tabel Data Karyawan mendukung sorting dari header kolom | `app/pages/karyawan/index.vue` |
| 15 | Master Data Departement sebagai lookup baru | `backend/prisma/schema.prisma`, `backend/src/lookups/` |
| 16 | Redesign Login Page — corporate modern minimalis (split screen) | `app/pages/login.vue` |
| 17 | Toast konfirmasi logout sebelum sesi diakhiri | `app/composables/useConfirmActionToast.ts` |
| 18 | Status kepegawaian otomatis + flow offboarding + status kontrak `SELESAI` | `backend/src/employees/`, `backend/src/contracts/` |
| 19 | Halaman detail data karyawan (`/karyawan/:id`) — NIK, Tempat Lahir, Alamat + layout Data Pekerjaan / Data Pribadi | `app/pages/karyawan/[id].vue`, `app/components/karyawan/detail/SummaryCards.vue` |
| 20 | Tabel Manajemen Kontrak mendukung sorting dari header kolom (6 kolom) | `app/pages/kontrak.vue` |
| 21 | Manajemen Surat Peringatan + generate PDF (pdfkit, template kop surat + logo) | `app/pages/dokumen/surat-peringatan/index.vue`, `backend/src/warning-letters/` |
| 22 | Auto-calculate "Berlaku Sampai" (6 bulan dari Tanggal Surat) + field read-only | `app/components/warning-letters/AddModal.vue` |
| 23 | Endpoint pengurus koperasi (tanpa admin-only guard) untuk dropdown | `backend/src/users/users.controller.ts`, `server/api/users/pengurus.get.ts` |
| 24 | Fondasi template dokumen kontrak otomatis: master template, preview, generate PDF | `backend/src/contracts/`, `backend/src/contract-templates/` |
| 25 | Generator dokumen kontrak langsung ke PDF native (pdfkit), tanpa LibreOffice | `backend/src/contracts/contract-document.service.ts` |
| 26 | PDF PKWT: 2 kolom bilingual (ID/EN), header hanya halaman 1, border kolom, signature box | `backend/src/contracts/contract-document.service.ts` |
| 27 | PDF PKWT 1:1: 11 pasal, font Times New Roman, data dinamis, closing bilingual | `backend/src/contracts/contract-document-definitions.ts` |
| 28 | PDF MITRA: layout booklet 2-kolom split 50/50, 15 pasal legal lengkap, border luar + divider tengah | `backend/src/contracts/contract-document.service.ts`, `backend/src/contracts/contract-document-definitions.ts` |
| 29 | PDF MITRA 1:1 dengan sample: header halaman 1, title full-width, hari/tanggal tanda tangan dinamis | `backend/src/contracts/contract-document.service.ts` |
| 30 | PDF MITRA signature footer: 2 pilar (PIHAK PERTAMA/KEDUA) di luar garis, full-width, tidak terpisah | `backend/src/contracts/contract-document.service.ts` |
| 31 | Preview PDF dokumen kontrak dan surat peringatan via PDF.js canvas render (bukan iframe) | `app/components/PdfViewer.client.vue`, `app/pages/kontrak.vue`, `app/pages/dokumen/surat-peringatan/index.vue` |
| 32 | Eskalasi Surat Peringatan: rule SP1→SP2→SP3, blokir jika SP3 aktif, validasi backend + UI | `backend/src/warning-letters/warning-letters.service.ts`, `app/components/warning-letters/AddModal.vue` |
| 33 | Upload dokumen kontrak PDF (scan tanda tangan) menggantikan field URL Dokumen | `backend/src/contracts/contracts.controller.ts`, `app/components/kontrak/EditContractModal.vue`, `server/api/contracts/[id]/document.post.ts` |
| 34 | Pengaturan Umum untuk edit nama Ketua Koperasi (`cooperativeChairmanName`) | `app/pages/settings/index.vue`, `server/api/settings/general.get.ts`, `server/api/settings/general.put.ts`, `backend/src/settings/` |
| 35 | Master template kontrak aktif untuk keluarga `PKWT` dan `MITRA` | `app/pages/settings/contract-templates.vue`, `backend/src/contract-templates/` |
| 36 | Self-healing default `ContractType` dan sinkronisasi relasi template `PKWT` / `MITRA` | `backend/src/lookups/lookups.service.ts`, `backend/src/contract-templates/contract-templates.service.ts` |
| 37 | Contract State Machine: enum `DRAFT` + cron job harian 00:01 WIB (`@nestjs/schedule`) untuk auto-shift `AKTIF`→`AKAN_HABIS`→`EXPIRED` + sync employment status atomik | `backend/prisma/schema.prisma`, `backend/src/contract-cron/`, `backend/src/app.module.ts` |
| 38 | Contract Guards: Anti-Overlap (409 Conflict), SP3 Lockout (403 Forbidden), State Lock untuk kontrak bertanda tangan (400 BadRequest) | `backend/src/contracts/contracts.service.ts` |
| 39 | Contract History Chain: field `parentContractId` self-referential untuk audit trail renewal, auto-link ke kontrak expired terakhir saat create biasa | `backend/prisma/schema.prisma`, `backend/src/contracts/contracts.service.ts` |
| 40 | Contract Summary Mode: halaman kontrak tampil 1 baris per karyawan (bukan semua kontrak), endpoint `GET /api/contracts/summary` dengan prioritas `AKTIF`→`AKAN_HABIS`→`EXPIRED` | `backend/src/contracts/contracts.service.ts`, `app/pages/kontrak.vue`, `server/api/contracts/summary.get.ts` |
| 41 | Contract Renewal Flow: endpoint `POST /api/contracts/:id/renew`, modal `RenewContractModal.vue`, validasi `startDate >= parent.endDate`, parent harus `AKAN_HABIS` atau `EXPIRED` | `backend/src/contracts/contracts.service.ts`, `app/components/kontrak/RenewContractModal.vue`, `server/api/contracts/[id]/renew.post.ts` |
| 42 | Contract History API: endpoint `GET /api/contracts/history/:employeeId` untuk ambil semua kontrak karyawan, modal riwayat fetch per employee (bukan filter lokal) | `backend/src/contracts/contracts.service.ts`, `server/api/contracts/history/[employeeId].get.ts`, `app/pages/kontrak.vue` |
| 43 | Add Contract Modal — Contract Status Awareness: saat employee dipilih, form cek kontrak terakhir, tampil warning untuk `AKTIF`/`AKAN_HABIS` (disable simpan), info untuk `EXPIRED` (boleh simpan) | `app/components/kontrak/AddContractModal.vue` |
| 44 | Nitro Proxy Error Handling: semua proxy contracts pakai `$fetch.raw` + `createError` untuk forward error backend (409/403/400) ke frontend sebagai toast | `server/api/contracts.ts`, `server/api/contracts/[id].ts`, `server/api/contracts/summary.get.ts`, `server/api/contracts/history/[employeeId].get.ts`, `server/api/contracts/[id]/renew.post.ts` |
| 45 | Riwayat Surat Peringatan di halaman Detail Karyawan: timeline SP per karyawan (badge level, jenis pelanggaran, masa berlaku, dokumen), scrollable max-h-[600px] | `app/components/karyawan/detail/WarningLetterList.vue`, `app/pages/karyawan/[id].vue` |
| 46 | Scrollable timeline di detail karyawan: ContractTimeline + WarningLetterList, max-h-[400px] mobile/max-h-[600px] desktop, gradient fade indicator dark-mode-aware | `app/components/karyawan/detail/ContractTimeline.vue`, `app/components/karyawan/detail/WarningLetterList.vue` |
| 47 | Import Data Karyawan Bulk via Excel Template: template dengan dropdown validasi data master (ExcelJS backend), parse/validate di frontend (xlsx), bulk create all-or-nothing transaction backend | `app/composables/useImportTemplate.ts`, `app/components/karyawan/ImportModal.vue`, `backend/src/employees/employees.service.ts`, `server/api/employees/bulk-import.post.ts`, `server/api/employees/import-template.get.ts` |
| 48 | Fix: Edit Kontrak Bad Request — State Lock normalisasi Date vs String perbandingan (Date.toISOString vs DTO string) | `backend/src/contracts/contracts.service.ts` |
| 49 | Fix: Kontrak PHK/RESIGN tidak bisa buat kontrak baru — guard `checkTerminationLockout()` di create/renew, status summary override ke SELESAI untuk karyawan offboarded | `backend/src/contracts/contracts.service.ts` |
| 50 | Fix: Import tanggal off-by-one (timezone) — eliminasi `toISOString()` dari `parseDateString()`, pakai local date components, `raw: false` di xlsx untuk avoid Date objects | `app/composables/useImportTemplate.ts` |
| 51 | Ganti Logo & Nama Organisasi: upload logo (JPG/PNG/WEBP/SVG, max 512x512px, 2MB), field Nama Organisasi di Pengaturan > Umum (Admin only), tampil dinamis di sidebar TeamsMenu | `backend/src/settings/`, `app/composables/useAppSettings.ts`, `app/components/TeamsMenu.vue`, `app/pages/settings/index.vue`, `server/api/settings/logo.post.ts` |
| 52 | Profil Akun di Pengaturan: menampilkan data aktual user login (fullName, employeeNo, email untuk user_account, role). Email di JWT payload, master_admin tidak punya email | `backend/src/auth/auth.service.ts`, `app/stores/auth.ts`, `app/pages/settings/index.vue` |

---

## Arsitektur

```
Frontend (Nuxt 3)          Nitro Server           Backend (NestJS)
app/pages/            ->    server/api/        ->   src/
app/components/            server/middleware/      Prisma -> PostgreSQL
app/composables/
```

### Nitro Auth Pattern
Semua Nitro handler baca `auth_token` cookie -> forward `Authorization: Bearer <token>` ke NestJS.

### Response Wrapper
Backend return `{ data: [...], total, page, limit, totalPages }` untuk list endpoints.

### Kontrak Otomatis
Status kontrak dihitung dari `endDate` terhadap tanggal hari ini:
- `DRAFT` kontrak yang belum final (tidak diproses cron, tidak hitung anti-overlap, tidak hitung employment status)
- `SELESAI` jika karyawan sudah offboarding dan kontrak bukan `DIBATALKAN`
- `EXPIRED` jika `endDate` sudah lewat
- `AKAN_HABIS` jika sisa kontrak 30 hari atau kurang
- `AKTIF` jika sisa kontrak lebih dari 30 hari
- `DIBATALKAN` tetap dipertahankan

### Contract State Machine & Cron Job
Cron job harian jam 00:01 WIB (`@nestjs/schedule`, timezone `Asia/Jakarta`) di `ContractCronService`:
- Query semua kontrak dengan status `AKTIF` atau `AKAN_HABIS`
- Shift `AKTIF` → `AKAN_HABIS` jika sisa ≤30 hari
- Shift `AKTIF` / `AKAN_HABIS` → `EXPIRED` jika `endDate` sudah lewat
- Skip `SELESAI` dan `DIBATALKAN`
- Dalam `$transaction` atomik: update contract status + sync `Employee.employmentStatus` ke `KONTRAK_EXPIRED` jika semua kontrak expired

### Contract Guards (Multi-Layer Validations)
- **Anti-Overlap Rule** (409 `ConflictException`): blokir create kontrak baru jika karyawan punya kontrak `AKTIF` atau `AKAN_HABIS`
- **SP3 Lockout** (403 `ForbiddenException`): blokir create/renew jika karyawan punya SP3 aktif (`warningLevel: 3` AND `validUntil >= hari ini`)
- **State Lock** (400 `BadRequestException`): blokir edit field `baseCompensation`, `startDate`, `endDate`, `employeeId` jika `documentUrl` sudah terisi (kontrak sudah ditandatangani)

### Contract Renewal Flow
Perpanjangan kontrak dipisah dari create biasa:
- **Create biasa** (`POST /api/contracts`): untuk karyawan baru atau kontrak terakhir `EXPIRED`. Auto-link `parentContractId` ke kontrak expired terakhir jika ada
- **Renewal** (`POST /api/contracts/:id/renew`): parent harus `AKAN_HABIS` atau `EXPIRED`. Validasi `startDate >= parent.endDate`. Auto-set `parentContractId = parent.id`
- Renewal diblok untuk parent `AKTIF`, `SELESAI`, `DIBATALKAN`
- Tombol `Perpanjang` muncul di UI hanya jika status `AKAN_HABIS` atau `EXPIRED`

### Contract Summary Mode
Halaman Manajemen Kontrak tampil **1 karyawan = 1 baris**, bukan list semua kontrak:
- Endpoint `GET /api/contracts/summary` mengembalikan 1 kontrak representatif per karyawan
- Prioritas pemilihan: `AKTIF` → `AKAN_HABIS` → `EXPIRED` → terbaru non-dibatalkan
- Field summary: employeeId, employeeNo, fullName, contractId, contractNo, contractType, startDate, endDate, status, daysRemaining, historyCount, canRenew
- Riwayat lengkap diakses via modal yang fetch `GET /api/contracts/history/:employeeId`

### Add Contract Modal — Contract Status Awareness
Form tambah kontrak menampilkan status kontrak karyawan saat dipilih:
- Jika `AKTIF` / `AKAN_HABIS`: tampil warning alert + disable tombol Simpan
- Jika `EXPIRED`: tampil info alert bahwa histori akan otomatis tersambung + tombol Simpan aktif
- Jika belum punya kontrak: form normal tanpa alert

### Dokumen Kontrak Otomatis
Modul kontrak menggunakan **generator PDF native** (pdfkit):
- Master data template kontrak (`ContractTemplate`) terhubung ke kontrak karyawan
- Preview kontrak menampilkan PDF langsung via PDF.js (render ke canvas, bukan iframe)
- Generate dokumen menghasilkan PDF dari kode
- Endpoint `download-pdf` selalu regenerate (tidak serve cache basi)
- Sample legal di `docs/sample-legal-doc/pdf` dipakai sebagai **referensi visual**, bukan template runtime
- Runtime dokumen kontrak **tidak bergantung** pada DOC, DOCX, Microsoft Word, atau LibreOffice headless

**Layout PDF PKWT (Kesepakatan Kerja Waktu Tertentu):**
- 2 kolom paralel bilingual (Indonesia kiri, English kanan) dengan border
- Header corporate (kop surat + logo) **hanya di halaman 1**, halaman 2+ tanpa header
- Font Times New Roman, 11 pasal lengkap, data dinamis (tanggal, upah)
- Blok identitas karyawan (II. Nama / Tgl Lahir / Gender / Alamat) menggunakan tabular layout (posisi colon tetap) agar sejajar
- Closing paragraph bilingual + signature box 2-kolom border di luar border kolom

**Layout PDF MITRA (Perjanjian Kemitraan):**
- Layout booklet 2-kolom: konten dibagi 50/50 tinggi, paruh pertama mengisi kolom kiri semua halaman, paruh kedua kolom kanan
- Header corporate + title ("PERJANJIAN KEMITRAAN" + Nomor + Tanggal) full-width **hanya halaman 1**
- Hari + tanggal tanda tangan diisi otomatis di paragraf pembuka
- 15 pasal legal lengkap per role (Driver/Komart/Staff/Warehouse) + daftar tugas spesifik
- Border luar (kotak) mengelilingi kedua kolom + garis pembatas vertikal tengah
- Heading PASAL tidak pernah terpisah dari paragraf pertamanya (break-inside: avoid)
- Signature 2 pilar (PIHAK PERTAMA / PIHAK KEDUA) di **paling bawah di luar garis border**

### Pengaturan Umum
- Nama Ketua Koperasi disimpan di tabel `AppSetting` dengan key `cooperativeChairmanName`
- Nama Organisasi disimpan di tabel `AppSetting` dengan key `organizationName` (tampil di sidebar)
- Logo Organisasi disimpan di tabel `AppSetting` dengan key `appLogoUrl` (tampil di sidebar)
- Dikelola dari halaman `Pengaturan > Umum` — hanya Admin yang bisa ubah
- Logo: upload JPG/PNG/WEBP/SVG, max 512x512px, max 2MB. Validasi dimensi di frontend sebelum upload
- Composable `useAppSettings.ts` menyediakan `logoUrl`, `organizationName`, `cooperativeChairmanName` secara reaktif untuk sidebar (`TeamsMenu.vue`)
- Fallback: jika logo kosong → tampilkan huruf pertama nama organisasi; jika nama kosong → "Kokarsi PT. Sankyu"

### Eskalasi Surat Peringatan
Rule eskalasi aktif:
- Tidak ada SP aktif → admin bebas pilih SP1, SP2, atau SP3
- SP1 aktif → default SP2, SP1 dinonaktifkan, SP3 tetap boleh
- SP2 aktif → hanya SP3 diizinkan
- SP3 aktif → pembuatan SP baru **diblokir** sampai masa SP selesai (`validUntil` < hari ini)

Endpoint: `GET /api/warning-letters/escalation/:employeeId`

### Upload Dokumen Kontrak (Scan)
- Upload file PDF kontrak yang sudah ditandatangani & scan
- Endpoint: `POST /api/contracts/:id/document` (multipart, field `document`, max 10MB, PDF only)
- File disimpan di `uploads/contracts/scanned/`, path disimpan di field `documentUrl`
- Di form Edit Kontrak, field "URL Dokumen" diganti file upload; Tambah Kontrak tidak ada upload (harus via Edit setelah kontrak dibuat)

### Status Kepegawaian Otomatis
- `RESIGN` atau `PHK` jika sudah diproses lewat offboarding
- `AKTIF` jika kontrak terbaru masih aktif
- `KONTRAK_EXPIRED` jika tidak ada kontrak aktif

### Preview PDF (PDF.js)
- Komponen `PdfViewer.client.vue` — render PDF ke `<canvas>` via `pdfjs-dist` (v6.1.200)
- Fetch PDF sebagai bytes (dengan credentials cookie), render per-halaman
- Dipakai di preview dokumen kontrak & surat peringatan
- Tidak bergantung plugin PDF bawaan browser

### USelect Nuxt UI v4
`value` di items harus exact match type dengan model value. Integer ID harus match integer.

---

## Struktur File Penting

```
app/
  pages/
    index.vue              # Dashboard
    karyawan/
      index.vue            # Manajemen karyawan (list)
      [id].vue             # Detail karyawan
    kontrak.vue            # Manajemen kontrak
    dokumen/
      surat-peringatan/
        index.vue          # Manajemen Surat Peringatan (preview PDF)
    settings/index.vue      # Pengaturan umum (Ketua Koperasi, Nama Organisasi, Logo)
    settings/master-data.vue  # Master data
    settings/contract-templates.vue # Master template kontrak
    settings/users.vue        # Master user
    login.vue              # Login
  components/
    PdfViewer.client.vue   # Preview PDF via PDF.js canvas render
    karyawan/
      AddModal.vue         # Tambah karyawan
      EditModal.vue        # Edit karyawan + upload foto
      detail/
        SummaryCards.vue   # Ringkasan data (Data Pekerjaan + Data Pribadi)
        ProfileHeader.vue  # Header profil karyawan
    kontrak/
      AddContractModal.vue   # Tambah kontrak + status awareness (warning/info)
      EditContractModal.vue  # Edit kontrak + upload dokumen scan PDF
      RenewContractModal.vue # Perpanjang kontrak dari parent (renewal flow)
    warning-letters/
      AddModal.vue           # Form SP + eskalasi rule
  composables/
    useConfirmDeleteToast.ts   # Toast konfirmasi hapus reusable
    useConfirmActionToast.ts   # Toast konfirmasi aksi generic
    useExport.ts             # Export Excel & PDF (semua data + NIK/Alamat/TmptLahir)
  types/
    index.d.ts              # Employee, Contract, dll

server/
  api/
    auth/                   # Login, logout, me
    employees/
      index.ts              # GET list + POST
      [id].ts               # GET detail + PUT + DELETE
      [id]/photo.post.ts    # Upload foto
      export.get.ts         # Fetch semua data untuk export
    contracts/
      index.ts              # GET list + POST
      [id].ts               # GET + PUT + DELETE
      summary.get.ts        # GET summary 1 row per karyawan
      history/[employeeId].get.ts  # GET riwayat kontrak per karyawan
      [id]/download-pdf.get.ts    # Stream PDF kontrak (selalu regenerate)
      [id]/document-preview.get.ts # Preview metadata kontrak
      [id]/document.post.ts       # Upload dokumen scan PDF
      [id]/generate-document.post.ts # Generate dokumen kontrak
      [id]/renew.post.ts   # POST perpanjang kontrak (renewal flow)
    warning-letters/
      index.ts              # GET list + POST
      [id].ts               # GET + PUT + DELETE
      [id]/generate.get.ts  # GET generate PDF (download)
      [id]/preview.get.ts   # GET preview PDF (inline)
      escalation/[employeeId].get.ts # GET status eskalasi SP per karyawan
    settings/
      general.get.ts        # GET pengaturan umum
      general.put.ts        # PUT pengaturan umum
    users/
      pengurus.get.ts       # GET list pengurus (no admin guard)
    contract-templates.ts   # GET/POST master template kontrak
    contract-templates/[id].ts # PUT/DELETE master template kontrak
    lookups/
      [resource].ts         # GET list + POST
      [resource]/[id].ts    # PUT + DELETE
    users.ts                # CRUD master user list/create
    users/[id].ts           # CRUD master user detail
  middleware/
    auth.ts                 # JWT guard

backend/
  src/
    employees/              # CRUD + upload foto + offboarding
    contracts/              # CRUD kontrak + upload scan + generate PDF + renewal + summary
      contract-document.service.ts    # Generator PDF native (PKWT + MITRA)
      contract-document-definitions.ts # Definisi pasal legal per template (15 pasal MITRA, 11 pasal PKWT)
    contract-cron/            # Cron job harian 00:01 WIB untuk sync status kontrak
    contract-templates/     # CRUD master template kontrak
    settings/               # Pengaturan umum aplikasi (AppSetting)
    warning-letters/        # CRUD SP + PDF generator + eskalasi rule
    lookups/                # Work locations, job roles, levels, tax status, contract types
    users/                  # CRUD master user internal + pengurus endpoint
    auth/                   # JWT strategy
    main.ts                 # Static assets /uploads + dotenv/config
    prisma/                 # Prisma service adapter
  prisma/
    schema.prisma           # Employee, Contract, WarningLetter, MasterAdmin, UserAccount, dll
  assets/
    logo-sp.png             # Logo PT Sankyu untuk PDF surat peringatan
    contract-logo-pkwt.jpg  # Logo kop surat PKWT
    contract-logo-mitra.jpg # Logo kop surat MITRA
  uploads/
    photos/                 # Foto karyawan
    contracts/              # Hasil generate dokumen kontrak PDF
    contracts/scanned/      # Dokumen kontrak scan (upload manual)
```

---

## Database Schema Utama

### Employee
| Field | Type | Keterangan |
|-------|------|-----------|
| `employeeNo` | String | Unique, e.g. SKY-001 |
| `fullName` | String | Nama lengkap |
| `nik` | String? | NIK (KTP) |
| `birthPlace` | String? | Tempat lahir |
| `address` | String? | Alamat lengkap |
| `employmentStatus` | Enum | AKTIF / KONTRAK_EXPIRED / RESIGN / PHK |
| `gender` | Enum | MALE / FEMALE |
| `birthDate` | Date | Tanggal lahir |
| `joinDate` | Date | Tanggal bergabung |
| `email` | String | Unique |
| `phoneNumber` | String? | Opsional |
| `educationLevel` | Enum | SMA / D3 / S1 / S2 |
| `workLocationId` | Int | FK ke WorkLocation |
| `jobRoleId` | Int | FK ke JobRole |
| `jobLevelId` | Int | FK ke JobLevel |
| `taxStatusId` | Int | FK ke TaxStatus |
| `departmentId` | Int? | FK ke Department |
| `fotoKaryawan` | String? | Path foto |

### Contract
| Field | Type | Keterangan |
|-------|------|-----------|
| `contractNo` | String | Nomor kontrak (unique) |
| `employeeId` | Int | FK ke Employee |
| `contractTypeId` | Int? | FK ke ContractType |
| `templateId` | Int? | FK ke ContractTemplate |
| `startDate` | Date | Tanggal mulai |
| `endDate` | Date | Tanggal selesai |
| `status` | Enum | Computed (DRAFT / AKTIF / AKAN_HABIS / EXPIRED / SELESAI / DIBATALKAN) |
| `signedDate` | Date? | Tanggal penandatanganan |
| `positionLabel` | String? | Label posisi di dokumen PDF |
| `workLocationLabel` | String? | Label lokasi kerja di dokumen PDF |
| `baseCompensation` | Int? | Nominal kompensasi/upah |
| `documentUrl` | String? | Path file PDF scan kontrak yang sudah ditandatangani |
| `generatedPdfUrl` | String? | Path hasil generate PDF |
| `generatedAt` | DateTime? | Tanggal generate PDF |
| `parentContractId` | Int? | FK ke Contract (self-reference untuk renewal chain) |

### WarningLetter
| Field | Type | Keterangan |
|-------|------|-----------|
| `letterNumber` | String | Unique |
| `employeeId` | Int | FK ke Employee |
| `violationType` | String[] | Array deskripsi pelanggaran |
| `warningLevel` | Int | 1, 2, atau 3 (SP 1/2/3) |
| `letterDate` | Date | Tanggal surat diterbitkan |
| `validUntil` | Date | Tanggal berakhir (auto: letterDate + 6 bulan) |
| `processedById` | Int | ID user pemroses |
| `processedByName` | String | Nama pengurus koperasi |

### ContractTemplate
| Field | Type | Keterangan |
|-------|------|-----------|
| `code` | String | Kode template internal |
| `name` | String | Nama template |
| `family` | Enum | MITRA / PKWT |
| `templateKey` | String | Kunci generator (PKWT_DRIVER, MITRA_KOMART, dll) |
| `isActive` | Boolean | Status template aktif |

### AppSetting
| Field | Type | Keterangan |
|-------|------|-----------|
| `key` | String | Unique key setting |
| `value` | String | Nilai setting |

**Keys yang dipakai:**
- `cooperativeChairmanName` — Nama Ketua Koperasi (dipakai di dokumen kontrak)
- `organizationName` — Nama Organisasi (tampil di sidebar header, default: "Kokarsi PT. Sankyu")
- `appLogoUrl` — Path logo organisasi (tampil di sidebar header, kosong = fallback huruf pertama)

---

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Data user login |
| GET | `/api/employees` | List karyawan (pagination, search, filter) |
| POST | `/api/employees` | Tambah karyawan |
| GET | `/api/employees/:id` | Detail karyawan + kontrak |
| PUT | `/api/employees/:id` | Edit karyawan |
| POST | `/api/employees/:id/offboarding` | Proses offboarding |
| DELETE | `/api/employees/:id` | Hapus karyawan |
| POST | `/api/employees/:id/photo` | Upload foto |
| GET | `/api/contracts` | List kontrak (legacy, semua kontrak) |
| GET | `/api/contracts/summary` | Summary 1 kontrak representatif per karyawan |
| GET | `/api/contracts/history/:employeeId` | Riwayat semua kontrak per karyawan |
| POST | `/api/contracts` | Tambah kontrak (anti-overlap + SP3 check + auto-link parent) |
| POST | `/api/contracts/:id/renew` | Perpanjang kontrak (renewal flow, parent harus AKAN_HABIS/EXPIRED) |
| PUT | `/api/contracts/:id` | Edit kontrak (state lock jika documentUrl terisi) |
| DELETE | `/api/contracts/:id` | Hapus kontrak |
| GET | `/api/contracts/:id/download-pdf` | Download/generate PDF kontrak |
| GET | `/api/contracts/:id/document-preview` | Preview metadata dokumen kontrak |
| POST | `/api/contracts/:id/generate-document` | Generate ulang PDF kontrak |
| POST | `/api/contracts/:id/document` | Upload dokumen scan PDF (multipart) |
| GET | `/api/contract-templates` | List master template kontrak |
| POST | `/api/contract-templates` | Tambah master template kontrak |
| PUT | `/api/contract-templates/:id` | Edit master template kontrak |
| DELETE | `/api/contract-templates/:id` | Hapus master template kontrak |
| GET | `/api/warning-letters` | List surat peringatan |
| POST | `/api/warning-letters` | Tambah surat peringatan |
| GET | `/api/warning-letters/:id` | Detail surat peringatan |
| PUT | `/api/warning-letters/:id` | Edit surat peringatan |
| DELETE | `/api/warning-letters/:id` | Hapus surat peringatan |
| GET | `/api/warning-letters/:id/generate` | Generate PDF SP (download) |
| GET | `/api/warning-letters/:id/preview` | Preview PDF SP (inline) |
| GET | `/api/warning-letters/escalation/:employeeId` | Status eskalasi SP per karyawan |
| GET | `/api/users` | List master user (admin only) |
| GET | `/api/users/pengurus` | List pengurus (semua role) |
| POST | `/api/users` | Tambah user internal |
| PUT | `/api/users/:id` | Edit user internal |
| DELETE | `/api/users/:id` | Hapus user internal |
| GET | `/api/settings/general` | Ambil pengaturan umum (semua role) |
| PUT | `/api/settings/general` | Simpan pengaturan umum (Admin only) |
| POST | `/api/settings/logo` | Upload logo organisasi (Admin only, max 512x512px 2MB, JPG/PNG/WEBP/SVG) |
| GET | `/api/employees/import-template` | Download template Excel import karyawan (dengan dropdown validasi data master) |
| POST | `/api/employees/bulk-import` | Import karyawan bulk (all-or-nothing transaction, auto-reject duplikat) |
| GET | `/api/lookups/*` | CRUD lookup data |
| GET | `/uploads/photos/:filename` | Serve foto statis |
| GET | `/uploads/contracts/**` | Serve PDF kontrak statis |
| GET | `/uploads/settings/:filename` | Serve logo organisasi statis |

---

## Export Data

- **Excel**: `xlsx` library - semua data + 25 kolom termasuk NIK, Tempat Lahir, Alamat, Departement -> `.xlsx`
- **PDF**: `jspdf` + `jspdf-autotable` - landscape A4 -> `.pdf`
- **Kolom export Excel**: No. Induk, Nama, NIK, Status, Gender, Tempat Lahir, Tgl. Lahir, Alamat, Tgl. Gabung, Email, HP, Pendidikan, Lokasi, Jabatan, Level, Departement, Status Pajak, No. Kontrak Aktif, Tgl. Mulai/Selesai Kontrak, Status Kontrak, Foto, Dibuat, Diperbarui

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Backend tidak start | Compile dulu: `NODE_OPTIONS="--max-old-space-size=4096" npx tsc -p tsconfig.json` |
| Backend `node dist/main.js` gagal baca env | Load `dotenv/config`, pastikan run dari folder `backend` |
| PDF kontrak masih versi lama setelah ubah kode | Endpoint `download-pdf` selalu regenerate. Pastikan backend di-restart |
| Preview PDF tidak muncul (iframe kosong) | Sudah diganti PdfViewer.client.vue (PDF.js canvas render). Cek console error |
| Status Pajak tampil angka | Key backend `taxStatus` bukan `taxStatuses` |
| USelect tidak resolve label | Race condition - watch lookups + watch employee keduanya diperlukan |
| Upload foto/dokumen tidak jalan | Restart backend setelah compile (endpoint baru) |
| Detail karyawan `/karyawan/:id` tidak render | Route conflict diselesaikan. Gunakan `useFetch + useRequestHeaders(['cookie'])` |
| Sorting tidak konsisten | Pola: `toggleSort()` + `getSortValue()` + `sortableHeader()` |
| Dropdown pengurus koperasi kosong | Gunakan `/api/users/pengurus` (tanpa admin guard) |
| USelect value `null` vs `undefined` | Nuxt UI v4 expect `undefined` untuk empty state |
| `PrismaService` property tidak ditemukan | Tambah getter baru di PrismaService |
| TypeScript compile OOM | Gunakan `NODE_OPTIONS="--max-old-space-size=4096"` |
| SP tidak bisa dibuat padahal tidak ada SP aktif | Cek endpoint escalation, pastikan `validUntil` SP lama sudah lewat |
| Template kontrak `MITRA` tidak muncul | Cek data `contract_types`, jalankan sync/seed template, dan pastikan relasi `ContractTemplate` ke `MITRA` sudah terbentuk |
| Nama Ketua Koperasi di PDF kontrak masih lama | Cek `Pengaturan > Umum`, pastikan `cooperativeChairmanName` sudah tersimpan di `AppSetting` |
| Kontrak gagal dibuat dengan error 409 | Karyawan masih punya kontrak `AKTIF` atau `AKAN_HABIS`. Gunakan flow Perpanjang dari kontrak yang `AKAN_HABIS`/`EXPIRED` |
| Kontrak gagal dibuat dengan error 403 SP3 | Karyawan punya SP3 aktif (`warningLevel: 3`, `validUntil >= hari ini`). Tunggu sampai SP3 selesai |
| Kontrak gagal diperpanjang (startDate invalid) | `startDate` kontrak baru harus `>= parent.endDate`. Lihat info di modal Perpanjang |
| Edit kontrak gagal dengan error 400 | Kontrak sudah ditandatangani (`documentUrl` terisi). Field `baseCompensation`, `startDate`, `endDate`, `employeeId` dikunci |
| Tabel kontrak tampil duplikat nama karyawan | Pastikan pakai endpoint `/api/contracts/summary` (1 row per karyawan), bukan `/api/contracts` |
| Toast error tidak muncul saat simpan kontrak gagal | Pastikan proxy Nitro pakai `$fetch.raw` + `createError` (bukan `ignoreResponseError` tanpa check) |
| Import karyawan Bad Request | Pastikan field `rowNumber` di-strip dari payload sebelum kirim ke backend (`map(({ rowNumber, ...emp }) => emp)`) |
| Tanggal import karyawan beda 1 hari (timezone) | Jangan pakai `toISOString()` untuk parse tanggal dari xlsx. Pakai local date components atau `raw: false` di `sheet_to_json` |
| Template Excel dropdown tidak muncul | Template dihasilkan oleh backend (Node.js), bukan frontend — generate ulang via backend endpoint `/api/employees/import-template` |
| Logo sidebar tidak tampil | Pastikan prefix `http://localhost:3001` saat load logo dari `appLogoUrl`, bukan path relatif |
| Email profil akun kosong | `MasterAdmin` tidak punya field email. Hanya `user_account` (Pengelola) yang punya email. Perlu logout + login ulang setelah update auth.service.ts |
| Kontrak PHK/RESIGN masih bisa buat kontrak baru | Guard `checkTerminationLockout()` di `contracts.service.ts`, frontend juga fetch `employmentStatus` di AddContractModal |
| Edit kontrak dengan scan dokumen selalu error 400 | State Lock compare string vs Date object — sekarang sudah difix dengan normalisasi ke ISO string sebelum compare |
| Unduh dokumen kontrak scan 404 | Gunakan `http://localhost:3001${documentUrl}` untuk buka file, bukan path relatif (Vue Router intercept) |
