# Project Context - Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu

> Dibuat: 2026-06-30 | Diperbarui: 2026-07-03 (v4) | Stack: Nuxt 3 + NestJS + PostgreSQL

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
npx tsc -p tsconfig.json
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
| 9 | Export Excel & PDF (semua data + semua kolom, Excel termasuk Departement) | `app/composables/useExport.ts`, `server/api/employees/export.get.ts` |
| 10 | Toast konfirmasi hapus untuk karyawan, kontrak, dan master data | `app/composables/useConfirmDeleteToast.ts`, `app/pages/karyawan/index.vue`, `app/pages/kontrak.vue`, `app/pages/settings/master-data.vue` |
| 11 | Role internal Master Admin vs Pengelola Koperasi dengan pembatasan Master Data | `backend/prisma/schema.prisma`, `backend/src/lookups/lookups.controller.ts`, `app/layouts/default.vue`, `app/middleware/auth.global.ts` |
| 12 | Master User untuk admin membuat akun Admin/Pengelola | `backend/prisma/schema.prisma`, `backend/src/users/`, `app/pages/settings/users.vue`, `server/api/users/` |
| 13 | Validasi duplikat Master User yang ramah di UI + 409 conflict backend | `app/pages/settings/users.vue`, `backend/src/users/users.service.ts` |
14 | Tabel Data Karyawan mendukung sorting dari header kolom | `app/pages/karyawan/index.vue` |
15 | Master Data Departement sebagai lookup baru | `backend/prisma/schema.prisma`, `backend/src/lookups/`, `app/pages/settings/master-data.vue`, `server/api/lookups/` |
16 | Redesign Login Page — corporate modern minimalis (split screen) | `app/pages/login.vue` |
17 | Toast konfirmasi logout sebelum sesi diakhiri | `app/composables/useConfirmActionToast.ts`, `app/components/UserMenu.vue` |
18 | Status kepegawaian otomatis + flow offboarding + status kontrak `SELESAI` | `backend/src/employees/`, `backend/src/contracts/`, `app/pages/karyawan/index.vue`, `app/pages/kontrak.vue`, `app/pages/index.vue` |
19 | Halaman detail data karyawan (`/karyawan/:id`) — fix SSR auth + route conflict | `app/pages/karyawan/[id].vue`, `app/components/karyawan/detail/ProfileHeader.vue` |
| 20 | Tabel Manajemen Kontrak mendukung sorting dari header kolom (6 kolom) | `app/pages/kontrak.vue` |
| 21 | Manajemen Surat Peringatan + generate PDF (pdfkit, template kop surat + logo) | `app/pages/dokumen/surat-peringatan/index.vue`, `app/components/warning-letters/AddModal.vue`, `backend/src/warning-letters/`, `server/api/warning-letters/` |
| 22 | Auto-calculate "Berlaku Sampai" (6 bulan dari Tanggal Surat) + field read-only | `app/components/warning-letters/AddModal.vue` |
| 23 | Endpoint pengurus koperasi (tanpa admin-only guard) untuk dropdown | `backend/src/users/users.controller.ts`, `server/api/users/pengurus.get.ts` |
| 24 | Fondasi template dokumen kontrak otomatis: master template, preview, generate DOCX/PDF, dan field legal kontrak | `backend/src/contracts/`, `backend/src/contract-templates/`, `app/pages/kontrak.vue`, `app/pages/settings/contract-templates.vue` |
| 25 | Generator dokumen kontrak langsung ke PDF native (pdfkit), tanpa template DOCX atau LibreOffice | `backend/src/contracts/contract-document.service.ts` |
| 26 | Layout PDF kontrak: 2 kolom paralel (ID/EN) untuk PKWT, sequential untuk MITRA | `backend/src/contracts/contract-document.service.ts` |
| 27 | Dashboard admin untuk melihat status kesiapan template kontrak dan menyiapkan starter template otomatis | `app/pages/index.vue`, `backend/src/contract-templates/contract-template-assets.service.ts`, `server/api/contract-templates/system-status/` |
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
Status kontrak dihitung dari `endDate` terhadap tanggal hari ini, jadi UI tidak perlu input manual untuk status kontrak.

Aturan yang dipakai:
- `SELESAI` jika karyawan sudah offboarding (`RESIGN` / `PHK`) dan kontrak bukan `DIBATALKAN`
- `EXPIRED` jika `endDate` sudah lewat
- `AKAN_HABIS` jika sisa kontrak 30 hari atau kurang
- `AKTIF` jika sisa kontrak lebih dari 30 hari
- `DIBATALKAN` tetap dipertahankan bila kontrak memang dibatalkan

### Dokumen Kontrak Otomatis
Modul kontrak menggunakan **generator PDF native** (pdfkit) — tidak ada dependency DOCX/LibreOffice:
- Master data template kontrak (`ContractTemplate`) terhubung ke kontrak karyawan
- Preview kontrak menampilkan metadata template legal, status missing field, dan susunan generator
- Generate dokumen menghasilkan PDF langsung dari kode (tanpa template DOCX atau LibreOffice)
- Layout PDF: 2 kolom paralel (ID/EN) untuk PKWT, sequential untuk MITRA, signature page di halaman akhir
- Admin bisa memantau kesiapan template dari Dashboard

### Status Kepegawaian Otomatis
Status kepegawaian tidak lagi diinput manual di form karyawan.

Aturan yang dipakai:
- `RESIGN` atau `PHK` jika sudah diproses lewat offboarding
- `AKTIF` jika kontrak terbaru masih aktif secara tanggal
- `KONTRAK_EXPIRED` jika tidak ada kontrak aktif terbaru lagi

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
        index.vue          # Manajemen Surat Peringatan (list + generate PDF)
    settings/master-data.vue  # Master data
    settings/users.vue        # Master user
    login.vue              # Login
  components/
    karyawan/
      AddModal.vue         # Tambah karyawan
      EditModal.vue        # Edit karyawan + upload foto
      ContractTable.vue    # Tabel kontrak (sorting support)
      detail/
        ProfileHeader.vue  # Header profil karyawan
        DataKaryawan.vue   # Tab data karyawan
    kontrak/
      AddContractModal.vue
      EditContractModal.vue
    warning-letters/
      AddModal.vue           # Form SP dengan dynamic violations + auto-validUntil
  composables/
    useConfirmDeleteToast.ts   # Toast konfirmasi hapus reusable
    useConfirmActionToast.ts   # Toast konfirmasi aksi generic (logout, dll)
    useExport.ts             # Export Excel & PDF (semua data dari DB)
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
    warning-letters/
      index.ts              # GET list + POST
      [id].ts               # GET + PUT + DELETE
      [id]/generate.get.ts  # GET generate PDF (proxy stream)
    users/
      pengurus.get.ts       # GET list pengurus (no admin guard)
    lookups/
      [resource].ts         # GET list + POST
      [resource]/[id].ts    # PUT + DELETE
    users.ts                # CRUD master user list/create
    users/[id].ts           # CRUD master user detail
  middleware/
    auth.ts                 # JWT guard

backend/
  src/
    employees/              # CRUD + upload foto endpoint
    contracts/              # CRUD kontrak
    contract-templates/     # CRUD master template kontrak
    warning-letters/        # CRUD surat peringatan + PDF generator (pdfkit)
    lookups/                # Work locations, job roles, levels, tax status, contract types
    users/                  # CRUD master user internal + pengurus endpoint
    auth/                   # JWT strategy
    main.ts                 # Static assets /uploads + dotenv/config
    prisma/                 # Prisma service adapter
  prisma/
    schema.prisma           # Employee, Contract, WarningLetter, MasterAdmin, UserAccount, dll
  assets/
    logo-sp.png             # Logo PT Sankyu untuk PDF surat peringatan
    contract-templates/     # (kosong — arsip non-runtime)
  uploads/
    photos/                 # Foto karyawan tersimpan di sini
    contracts/              # Hasil generate dokumen kontrak PDF
```

---

## Database Schema Utama

### Employee
| Field | Type | Keterangan |
|-------|------|-----------|
| `employeeNo` | String | Unique, e.g. SKY-001 |
| `fullName` | String | Nama lengkap |
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
| `fotoKaryawan` | String? | Path foto, mis. `/uploads/photos/photo-xxx.jpg` |

### Contract
| Field | Type | Keterangan |
|-------|------|-----------|
| `contractNo` | String | Nomor kontrak |
| `employeeId` | Int | FK ke Employee |
| `contractTypeId` | Int? | FK ke ContractType |
| `templateId` | Int? | FK ke ContractTemplate |
| `startDate` | Date | Tanggal mulai |
| `endDate` | Date | Tanggal selesai |
| `status` | Enum | Dihitung otomatis dari status karyawan + tanggal (AKTIF / AKAN_HABIS / EXPIRED / SELESAI / DIBATALKAN) |
| `signedDate` | Date? | Tanggal penandatanganan dokumen |
| `positionLabel` | String? | Label posisi untuk dokumen kontrak |
| `workLocationLabel` | String? | Label lokasi kerja untuk dokumen kontrak |
| `baseCompensation` | Decimal/Number? | Nilai kompensasi/upah di dokumen |
| `generatedPdfUrl` | String? | Path hasil generate PDF |
| `generatedAt` | DateTime? | Tanggal generate PDF |

### ContractTemplate
| Field | Type | Keterangan |
|-------|------|-----------|
| `code` | String | Kode template internal |
| `name` | String | Nama template |
| `family` | Enum | MITRA / PKWT |
| `templateKey` | String | Kunci generator / mapping sample legal |
| `contractTypeId` | Int? | FK opsional ke tipe kontrak |
| `jobRoleId` | Int? | FK opsional ke jabatan |
| `isActive` | Boolean | Status template aktif |

### ContractType
| Field | Type | Keterangan |
|-------|------|-----------|
| `name` | String | Nama tipe kontrak, mis. PKWT / PKWTT / Magang |

### EmployeeOffboarding
| Field | Type | Keterangan |
|-------|------|-----------|
| `employeeId` | Int | Satu record offboarding aktif per karyawan |
| `terminationType` | Enum | RESIGN / PHK |
| `terminationDate` | Date | Tanggal efektif offboarding |
| `reason` | String? | Catatan atau alasan offboarding |
| `processedById` | Int | ID user pemroses |
| `processedByName` | String | Nama user pemroses |
| `processedByRole` | String | Role user pemroses |
| `processedByKind` | String | Jenis akun (`master_admin` / `user_account`) |

### UserAccount
| Field | Type | Keterangan |
|-------|------|-----------|
| `name` | String | Nama lengkap akun internal |
| `nik` | String | Unique, dipakai sebagai identitas login alternatif |
| `email` | String | Unique |
| `role` | Enum | ADMIN / PENGELOLA_KOPERASI |
| `username` | String | Unique, dipakai login utama |
| `password` | String | Hash password di backend |

### WarningLetter
| Field | Type | Keterangan |
|-------|------|-----------|
| `letterNumber` | String | Unique, format: 195 /KUKP-SII/VIII/2025 |
| `employeeId` | Int | FK ke Employee |
| `violationType` | String[] | Array deskripsi pelanggaran |
| `warningLevel` | Int | 1, 2, atau 3 (SP 1/2/3) |
| `letterDate` | Date | Tanggal surat diterbitkan |
| `validUntil` | Date | Tanggal berakhir (auto: letterDate + 6 bulan) |
| `processedById` | Int | ID user pemroses |
| `processedByName` | String | Nama pengurus koperasi |
| `documentUrl` | String? | Opsional, URL dokumen |

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
| POST | `/api/employees/:id/offboarding` | Proses offboarding karyawan (RESIGN / PHK) |
| DELETE | `/api/employees/:id` | Hapus karyawan |
| POST | `/api/employees/:id/photo` | Upload foto |
| GET | `/api/contracts` | List kontrak |
| POST | `/api/contracts` | Tambah kontrak |
| PUT | `/api/contracts/:id` | Edit kontrak |
| DELETE | `/api/contracts/:id` | Hapus kontrak |
| GET | `/api/lookups` | Semua lookup data |
| GET | `/api/lookups/work-locations` | List lokasi kerja |
| POST | `/api/lookups/work-locations` | Tambah lokasi kerja |
| PUT | `/api/lookups/work-locations/:id` | Edit lokasi kerja |
| DELETE | `/api/lookups/work-locations/:id` | Hapus lokasi kerja |
| GET | `/api/lookups/contract-types` | List tipe kontrak |
| POST | `/api/lookups/contract-types` | Tambah tipe kontrak |
| PUT | `/api/lookups/contract-types/:id` | Edit tipe kontrak |
| DELETE | `/api/lookups/contract-types/:id` | Hapus tipe kontrak |
| GET | `/api/lookups/departments` | List departement |
| POST | `/api/lookups/departments` | Tambah departement |
| PUT | `/api/lookups/departments/:id` | Edit departement |
| DELETE | `/api/lookups/departments/:id` | Hapus departement |
| GET | `/api/users` | List master user (admin only) |
| GET | `/api/users/pengurus` | List pengurus (semua role) |
| POST | `/api/users` | Tambah user internal |
| PUT | `/api/users/:id` | Edit user internal |
| DELETE | `/api/users/:id` | Hapus user internal |
| GET | `/api/warning-letters` | List surat peringatan (pagination, search) |
| POST | `/api/warning-letters` | Tambah surat peringatan |
| GET | `/api/warning-letters/:id` | Detail surat peringatan |
| PUT | `/api/warning-letters/:id` | Edit surat peringatan |
| DELETE | `/api/warning-letters/:id` | Hapus surat peringatan |
| GET | `/api/warning-letters/:id/generate` | Generate PDF surat peringatan |
| GET | `/uploads/photos/:filename` | Serve foto statis |

---

## Export Data

- **Excel**: `xlsx` library - semua data + 22 kolom lengkap termasuk `Departement`, status kepegawaian otomatis, dan kontrak relevan terbaru -> `.xlsx`
- **PDF**: `jspdf` + `jspdf-autotable` - landscape A4, semua kolom lama -> `.pdf`
- **Kolom export Excel**: No. Induk, Nama, Status, Gender, Tgl. Lahir, Tgl. Gabung, Email, HP, Pendidikan, Lokasi, Jabatan, Level, Departement, Status Pajak, No. Kontrak Aktif, Tgl. Mulai/Selesai Kontrak, Status Kontrak, Foto, Dibuat, Diperbarui
- **Riwayat kontrak**: Tersedia read-only dari halaman Data Karyawan dalam bentuk timeline kontrak terbaru ke lama
- **Sorting tabel**: Kedua halaman (Data Karyawan & Manajemen Kontrak) mendukung sorting header kolom dengan 3-state cycle (asc → desc → null) menggunakan icon lucide (arrow-up-down/arrow-up/arrow-down)
- **Hapus data**: Karyawan, kontrak, master data, dan user memakai toast konfirmasi sebelum delete dijalankan
- **Master User**: Admin dapat membuat akun internal dengan role `ADMIN` atau `PENGELOLA_KOPERASI`; password disimpan hash, seed sudah menambahkan akun Admin dan Pengelola, login mendukung `username` atau `NIK`, dan duplikat `NIK/Email/Username` menampilkan pesan validasi yang ramah
- **Master Data Departement**: Lookup baru tersedia dengan rule CRUD yang sama seperti master data lain, dan masuk ke seed awal
- **Surat Peringatan**: CRUD lengkap dengan generate PDF (pdfkit) sesuai template asli (logo, kop surat, font TimesNewRoman + Calibri). Form AddModal menggunakan UForm + zod validation, dynamic violation list (add/remove), auto-fill pengurus dari user login, auto-calculate "Berlaku Sampai" = Tanggal Surat + 6 bulan (read-only field). Endpoint `/api/users/pengurus` dibuat terpisah dari `/api/users` karena `GET /api/users` memerlukan role ADMIN, sedangkan pengurus perlu diakses semua role untuk dropdown form SP
- **Sidebar Dokumen Karyawan**: Group baru di sidebar dengan icon `i-lucide-file-badge`, berisi submenu "Surat Peringatan"

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bearer token ter-mask Hermes | Gunakan Python `base64.b64decode('QmVhcmVyIA==')` untuk generate string |
| Backend tidak start | Compile dulu: `npx tsc -p tsconfig.json` |
| Backend `node dist/main.js` gagal baca env | `backend/src/main.ts` sudah load `dotenv/config`, pastikan dijalankan dari folder `backend` |
| Prisma migrate gagal auth | Pastikan `DATABASE_URL` mengarah ke `kokarsi-postgres` di port `5435` |
| Status Pajak tampil angka | Key backend `taxStatus` bukan `taxStatuses` |
| USelect tidak resolve label | Race condition - watch lookups + watch employee keduanya diperlukan |
| Upload foto tidak jalan | Restart backend setelah compile (endpoint baru) |
| Export tidak include kontrak | Backend `findAll` tidak include contracts - gunakan endpoint `/api/employees/export` (limit=9999) |
| Data master tidak muncul setelah save | Pastikan backend validasi DTO lookup aktif dan frontend me-refresh resource master data setelah CRUD |
| Detail karyawan `/karyawan/:id` tidak render | Route conflict: `karyawan.vue` vs `karyawan/[id].vue`. Pindah list ke `karyawan/index.vue`, hapus `karyawan.vue` |
| SSR auth gagal di detail karyawan | `$fetch` tidak forward cookie saat SSR. Ganti ke `useFetch + useRequestHeaders(['cookie'])` |
| SSR crash `Cannot read properties of undefined` | Nested data (ex: `employee.fullName`) undefined saat SSR. Tambah optional chaining: `employee?.fullName` |
| Sorting tidak konsisten antar halaman | Pola sorting: `toggleSort()` + `getSortValue()` + `sortableHeader()` + `UIcon` (lucide icons) |
| Dropdown pengurus koperasi kosong | `GET /api/users` butuh role ADMIN. Gunakan `/api/users/pengurus` (tanpa admin guard) |
| Modal tidak muncul saat klik tombol | Pastikan komponen modal di **luar** `<UDashboardPanel>`, bukan di dalamnya (slot `#body` atau `#default` saja yang valid) |
| USelect value `null` vs `undefined` | Nuxt UI v4 `USelect` expect `undefined` bukan `null` untuk empty state. Gunakan `as number | undefined` |
| `PrismaService` property tidak ditemukan | PrismaService pakai explicit getter proxy. Tambah getter baru untuk model baru: `get warningLetter() { return this.client.warningLetter }` |
| Prisma `mode: 'insensitive'` type error | Gunakan `as const` atau cast `where: any` untuk avoid QueryMode type mismatch |
