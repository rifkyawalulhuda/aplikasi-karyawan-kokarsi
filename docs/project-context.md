# Project Context — Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu

> Dibuat: 2026-06-30 | Diperbarui: 2026-06-30 | Stack: Nuxt 3 + NestJS + PostgreSQL

---

## Ringkasan Proyek

Aplikasi manajemen karyawan internal untuk **Kokarsi PT. Sankyu**. Single role: Master Admin. UI Bahasa Indonesia.

- **Repo**: `E:\Github\aplikasi-karyawan-kokarsi`
- **Frontend**: Nuxt 3 + Nuxt UI v4 + TypeScript + Tailwind → `http://localhost:3000`
- **Backend**: NestJS + Prisma + PostgreSQL → `http://localhost:3001/api`
- **Database**: Docker `app-karyawan-postgres`, port `5434`, DB `kokarsi_karyawan`
- **Login**: `employeeNo=EMP001` / `password=admin123`

---

## Cara Menjalankan

```bash
# 1. Start PostgreSQL
docker start app-karyawan-postgres

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
| 4 | CRUD Karyawan (tambah, edit, hapus) | `app/pages/karyawan.vue`, `app/components/karyawan/` |
| 5 | Fix Status Pajak (race condition + key mismatch) | `app/components/karyawan/EditModal.vue` |
| 6 | Master Data CRUD (lokasi, jabatan, level, pajak) | `app/pages/master-data.vue`, `server/api/lookups/` |
| 7 | CRUD Kontrak + status otomatis berdasarkan tanggal + riwayat per karyawan | `app/pages/kontrak.vue`, `app/pages/karyawan.vue`, `app/components/kontrak/` |
| 8 | Upload foto karyawan | `app/components/karyawan/EditModal.vue`, `server/api/employees/[id]/photo.post.ts` |
| 9 | Export Excel & PDF (semua data + semua kolom) | `app/composables/useExport.ts`, `server/api/employees/export.get.ts` |
| 10 | Toast konfirmasi hapus untuk karyawan, kontrak, dan master data | `app/composables/useConfirmDeleteToast.ts`, `app/pages/karyawan.vue`, `app/pages/kontrak.vue`, `app/pages/settings/master-data.vue` |

---

## Arsitektur

```
Frontend (Nuxt 3)          Nitro Server           Backend (NestJS)
app/pages/            →    server/api/        →   src/
app/components/            server/middleware/      Prisma → PostgreSQL
app/composables/
```

### Nitro Auth Pattern
Semua Nitro handler baca `auth_token` cookie → forward `Authorization: Bearer <token>` ke NestJS.

### Response Wrapper
Backend return `{ data: [...], total, page, limit, totalPages }` untuk list endpoints.

### Kontrak Otomatis
Status kontrak dihitung dari `endDate` terhadap tanggal hari ini, jadi UI tidak perlu input manual untuk status kontrak.

Aturan yang dipakai:
- `EXPIRED` jika `endDate` sudah lewat
- `AKAN_HABIS` jika sisa kontrak 30 hari atau kurang
- `AKTIF` jika sisa kontrak lebih dari 30 hari
- `DIBATALKAN` tetap dipertahankan bila kontrak memang dibatalkan

### USelect Nuxt UI v4
`value` di items harus exact match type dengan model value. Integer ID harus match integer.

---

## Struktur File Penting

```
app/
  pages/
    index.vue          # Dashboard
    karyawan.vue       # Manajemen karyawan
    kontrak.vue        # Manajemen kontrak
    master-data.vue    # Master data
    login.vue          # Login
  components/
    karyawan/
      AddModal.vue     # Tambah karyawan
      EditModal.vue    # Edit karyawan + upload foto
    kontrak/
      AddContractModal.vue
      EditContractModal.vue
  composables/
    useConfirmDeleteToast.ts  # Toast konfirmasi hapus reusable
    useExport.ts       # Export Excel & PDF (semua data dari DB)
  types/
    index.d.ts         # Employee, Contract, dll

server/
  api/
    auth/              # Login, logout, me
    employees/
      index.ts         # GET list + POST
      [id].ts          # GET detail + PUT + DELETE
      [id]/photo.post.ts  # Upload foto
      export.get.ts    # Fetch semua data untuk export
    contracts/
      index.ts         # GET list + POST
      [id].ts          # GET + PUT + DELETE
    lookups/
      [resource].ts    # GET list + POST
      [resource]/[id].ts  # PUT + DELETE
  middleware/
    auth.ts            # JWT guard

backend/
  src/
    employees/         # CRUD + upload foto endpoint
    contracts/         # CRUD kontrak
    lookups/           # Work locations, job roles, levels, tax status
    auth/              # JWT strategy
    main.ts            # Static assets /uploads
  prisma/
    schema.prisma      # Employee, Contract, MasterAdmin, dll
  uploads/
    photos/            # Foto karyawan tersimpan di sini
```

---

## Database Schema Utama

### Employee
| Field | Type | Keterangan |
|-------|------|-----------|
| `employeeNo` | String | Unique, e.g. SKY-001 |
| `fullName` | String | Nama lengkap |
| `employmentStatus` | Enum | MITRA / KONTRAK |
| `gender` | Enum | MALE / FEMALE |
| `birthDate` | Date | Tanggal lahir |
| `joinDate` | Date | Tanggal bergabung |
| `email` | String | Unique |
| `phoneNumber` | String? | Opsional |
| `educationLevel` | Enum | SMA / D3 / S1 / S2 |
| `workLocationId` | Int | FK → WorkLocation |
| `jobRoleId` | Int | FK → JobRole |
| `jobLevelId` | Int | FK → JobLevel |
| `taxStatusId` | Int | FK → TaxStatus |
| `fotoKaryawan` | String? | Path foto, e.g. `/uploads/photos/photo-xxx.jpg` |

### Contract
| Field | Type | Keterangan |
|-------|------|-----------|
| `contractNo` | String | Nomor kontrak |
| `employeeId` | Int | FK → Employee |
| `startDate` | Date | Tanggal mulai |
| `endDate` | Date | Tanggal selesai |
| `status` | Enum | Dihitung otomatis dari `endDate` (AKTIF / AKAN_HABIS / EXPIRED / DIBATALKAN) |

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
| GET | `/uploads/photos/:filename` | Serve foto statis |

---

## Export Data

- **Excel**: `xlsx` library — semua data + 21 kolom lengkap → `.xlsx`
- **PDF**: `jspdf` + `jspdf-autotable` — landscape A4, semua kolom → `.pdf`
- **Kolom export**: No. Induk, Nama, Status, Gender, Tgl. Lahir, Tgl. Gabung, Email, HP, Pendidikan, Lokasi, Jabatan, Level, Status Pajak, No. Kontrak Aktif, Tgl. Mulai/Selesai Kontrak, Status Kontrak, Foto, Dibuat, Diperbarui
- **Riwayat kontrak**: Tersedia read-only dari halaman Data Karyawan dalam bentuk timeline kontrak terbaru ke lama
- **Hapus data**: Karyawan, kontrak, dan master data memakai toast konfirmasi sebelum delete dijalankan

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bearer token ter-mask Hermes | Gunakan Python `base64.b64decode('QmVhcmVyIA==')` untuk generate string |
| Backend tidak start | Compile dulu: `npx tsc -p tsconfig.json` |
| Status Pajak tampil angka | Key backend `taxStatus` bukan `taxStatuses` |
| USelect tidak resolve label | Race condition — watch lookups + watch employee keduanya diperlukan |
| Upload foto tidak jalan | Restart backend setelah compile (endpoint baru) |
| Export tidak include kontrak | Backend `findAll` tidak include contracts — gunakan endpoint `/api/employees/export` (limit=9999) |
| Data master tidak muncul setelah save | Pastikan backend validasi DTO lookup aktif dan frontend me-refresh resource master data setelah CRUD |

