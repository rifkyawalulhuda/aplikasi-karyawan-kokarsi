# Project Context - Aplikasi Manajemen Karyawan Kokarsi PT. Sankyu

> Dibuat: 2026-06-30 | Diperbarui: 2026-08-13 (v38) | Stack: Nuxt 4 + NestJS + PostgreSQL
>
> Catatan versi: context ini sudah mengikuti generator kontrak **pure PDF** berbasis `pdfkit`, flow **Pengaturan > Umum**, sinkronisasi template kontrak `PKWT` / `MITRA` terbaru, modul **Contract Management** lengkap (State Machine, Cron Job, Guards, Renewal Flow, Summary Mode), **Import Karyawan Bulk** via Excel template, **Riwayat SP** di detail karyawan, fitur **Ganti Logo & Nama Organisasi**, perbaikan bug timezone date import, **security hardening**, **centralisasi BACKEND_URL**, **SharedModule + DashboardCacheService**, **Unit Test Jest**, **PM2 process manager**, **Master Dokumen** (tabel `document_types` dengan Nama/Jenis/Penerbit), **Sertifikasi & Ijin** (halaman baru + modul backend + cron email + section detail karyawan + tombol Perpanjang), dan berbagai bug fix (contract 403 forbidden untuk karyawan baru, renew contractNo duplicate, hapus karyawan bersih semua tabel terkait, proxy employeeId filter). **auto-generate nomor kontrak & SP** (format {seq}/KK|SP/KUKP/SII/{bulan_romawi}/{tahun}, ikut tanggal acuan), **upload file di Surat Peringatan** (endpoint POST :id/file, magic bytes validation), **preview nomor dinamis** (refetch saat tanggal berubah), **CodeGraph integration** (pre-indexed knowledge graph untuk AI agent). **Legal Koperasi Perpanjang field Nama Dokumen read-only** (mode renew tidak bisa edit nama dokumen). **Bug fix cron email** (date boundary startOfDay, filter email null UserAccount, tambah MAILEROO_FROM_EMAIL/MAILEROO_FROM_NAME ke .env.example). **Sistem Notifikasi Expiry Reminder** (tabel `notifications`, endpoint /notifications, cron generateNotifications, catch-all pass berbasis tanggal bukan DB status, upsert untuk pesan selalu up-to-date, bell icon sidebar + UPopover + animasi bounce, halaman /notifications, SSE real-time via `CookieJwtStrategy` + `EventSource`, cron 5 menit untuk modul lain, hook fire-and-forget di ContractsService update/create/renew, deeplink notifikasi KONTRAK_KARYAWAN ke `/karyawan/{employeeId}`). **Status "Sudah Diperpanjang"** di Riwayat Kontrak halaman Kontrak (`getDisplayStatus` di `kontrak.vue`) DAN halaman Detail Karyawan (`ContractTimeline.vue`). **Mother Agreement sebagai link** di drawer detail Kontrak Vendor. **Pencarian global diperluas** ke Sertifikasi & Ijin, Kontrak Vendor, Legal Koperasi dengan deep-link `?openId=`. **Error message user-friendly** di edit kontrak (Nitro proxy `[id].ts` ekstrak pesan dari `res._data.message`, pesan backend diperbarui).openId=` untuk auto-buka drawer detail. **Space Dokumen: UI/UX Notion-style + Save cerdas + full-page editor** (route flat `/spaces/[id]-docs-[docId]` fix nested routing), **upload gambar di Tiptap editor** (toolbar/drag/paste/URL, disimpan backend `uploads/documents/` via endpoint `upload-image` + proxy, fix tampil di production). **Upload Foto Profil user** (Admin & Pengelola): field `photoUrl`, endpoint `/api/auth/profile/photo`, tab Profil Akun + avatar UserMenu. **Favicon tab browser mengikuti logo** organisasi. **STOP.bat KeepPostgres** (stop tanpa mematikan PostgreSQL). **Print CV Karyawan per individu** (A4, Teleport print multi-halaman). **Export Excel** kontrak vendor/legal/akte. **Notifikasi per-user** (kolom userId+userType, copy per akun, agenda/space per penerima, filter req.user, SSE broadcast per-user). **Redesign Drawer Sertifikasi & Ijin** (status ring, expiry card + progress bar, 2 kartu info). **Fix calendar overlap** (kolom berdampingan algoritma greedy cluster). **Hari Libur Nasional** di kalender (api.co.id, cache 24 jam per tahun, fail-silent, tampil Month/Week/Day View, auto-update per tahun). **Redesign Drawer Legal Koperasi** (category ring, Expiry Card 4 kondisi, Renewal Chain Timeline konektor). **Redesign Drawer Kontrak Customer/Vendor** (CUSTOMER/VENDOR ring berbeda, Mother Agreement anchor card, Renewal Chain + Riwayat Perpanjangan). **Redesign Drawer Akte Dokumen** (Notaris Card amber, ring primary). **Riwayat Kontrak tampilkan foto profil karyawan**. **Hapus check/pick Data Karyawan**. **Hapus Semua Notifikasi** (DELETE endpoint, bell tombol trash, confirmActionToast). **Fix bug Data Karyawan hanya tampil 10** (tambah `limit: 10000` pada useFetch). **Dropdown pilihan jumlah baris per halaman (page size) 15/30/50/100** di semua halaman daftar ber-Table (Data Karyawan, Kontrak, Dok. Karyawan, Sertifikasi & Ijin, Surat Peringatan, Akte Dokumen, Legal Koperasi, Kontrak Customer/Vendor, User). **Perbaiki pagination server-side Legal Koperasi & Kontrak Vendor** (`:total` total keseluruhan, `@update:page` memicu re-fetch, pakai `pagination` ref). **Konversi halaman User ke UTable + pagination + search + filter role + sorting** (dari daftar `v-for` manual). **Export PDF Data Karyawan dirapikan** (16 kolom eksplisit, font 6.5pt, theme grid, ellipsize, nomor halaman, margin 8mm). **Database Override Template Kontrak** (kolom `contentOverrides Json?`, `mergeDefinition()`, endpoint `GET/PUT /contract-templates/:id/content-overrides`, modal edit 4 tab, Nitro proxy, composable `useTemplateContentEditor`). **Placeholder `__ROLE_LABEL__`** di PKWT Pasal 1 ayat 2 (ID+EN) dan MITRA recital nomor 2 — `roleLabel` kini efektif di PDF. **Tab Teks Umum modal hanya tampilkan field yang benar-benar dirender** (PKWT: title+subtitle+roleLabel; MITRA: title+roleLabel). **Dropdown templateKey** di halaman Template Kontrak (8 key valid, filter per family, validasi Zod enum). **Konfirmasi hapus Template** via `confirmDeleteToast`. **Komentar Space lengkap** (soft delete + konfirmasi toast + edit inline + badge "Diedit" + placeholder "Komentar ini telah dihapus pada [tanggal jam]" + foto profil author dari DB + hanya penulis yang bisa edit/hapus). **Toast konfirmasi hapus Lampiran** di card Kanban. **Perbaikan bug email hilang saat gagal kirim** (cron email: urutan kirim→catat→commit status + dedup log seragam `EmailNotificationSentLog` untuk Dokumen/Vendor/Legal dengan sentinel `-1`, refactor `syncExpiredStatuses` jadi find-only + `commitStatuses`).

---

## Ringkasan Proyek

Aplikasi manajemen karyawan internal untuk **Kokarsi PT. Sankyu**. Role internal: Master Admin dan Pengelola Koperasi. UI Bahasa Indonesia.

- **Repo**: `E:\Github\aplikasi-karyawan-kokarsi`
- **Frontend**: Nuxt 4 + Nuxt UI v4 + TypeScript + Tailwind -> `http://localhost:3000`
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

# 2. Start Backend + Frontend via PM2
cd E:\Github\aplikasi-karyawan-kokarsi
.\deploy\start.ps1

# 3. Monitor proses
pm2 list
pm2 monit
pm2 logs kokarsi-frontend
pm2 logs kokarsi-backend
```

### Production (Cloudflare Tunnel)
```powershell
# Build frontend (dari root project)
pnpm build

# Start semua service (PostgreSQL + Backend + Frontend + Tunnel)
.\deploy\start.ps1

# Stop semua service
.\deploy\start.ps1 -Stop
```

**Public URL**: https://kokarsi-sankyu.web.id
**Cloudflare Tunnel**: ~/.cloudflared/config.yml (Tunnel ID: 483d9bfc-f094-4d30-a344-9c3019120a13)

### Compile Backend (setelah ada perubahan kode)
```bash
cd E:\Github\aplikasi-karyawan-kokarsi\backend
NODE_OPTIONS="--max-old-space-size=4096" npx tsc -p tsconfig.json
```

### Manajemen PM2 (production)
```powershell
pm2 list                          # status semua proses
pm2 monit                         # monitor realtime
pm2 logs kokarsi-frontend         # logs frontend
pm2 logs kokarsi-backend          # logs backend
pm2 restart kokarsi-frontend      # restart setelah pnpm build
pm2 restart kokarsi-backend       # restart setelah compile backend
pm2 startup                       # auto-start saat Windows boot (jalankan sebagai Admin sekali)
pm2 save                          # simpan daftar proses aktif
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
| 16 | Redesign Login Page ? corporate modern minimalis (split screen) | `app/pages/login.vue` |
| 17 | Toast konfirmasi logout sebelum sesi diakhiri | `app/composables/useConfirmActionToast.ts` |
| 18 | Status kepegawaian otomatis + flow offboarding + status kontrak `SELESAI` | `backend/src/employees/`, `backend/src/contracts/` |
| 19 | Halaman detail data karyawan (`/karyawan/:id`) ? NIK, Tempat Lahir, Alamat + layout Data Pekerjaan / Data Pribadi | `app/pages/karyawan/[id].vue`, `app/components/karyawan/detail/SummaryCards.vue` |
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
| 32 | Eskalasi Surat Peringatan: rule SP1?SP2?SP3, blokir jika SP3 aktif, validasi backend + UI | `backend/src/warning-letters/warning-letters.service.ts`, `app/components/warning-letters/AddModal.vue` |
| 33 | Upload dokumen kontrak PDF (scan tanda tangan) menggantikan field URL Dokumen | `backend/src/contracts/contracts.controller.ts`, `app/components/kontrak/EditContractModal.vue`, `server/api/contracts/[id]/document.post.ts` |
| 34 | Pengaturan Umum untuk edit nama Ketua Koperasi (`cooperativeChairmanName`) | `app/pages/settings/index.vue`, `server/api/settings/general.get.ts`, `server/api/settings/general.put.ts`, `backend/src/settings/` |
| 35 | Master template kontrak aktif untuk keluarga `PKWT` dan `MITRA` | `app/pages/settings/contract-templates.vue`, `backend/src/contract-templates/` |
| 36 | Self-healing default `ContractType` dan sinkronisasi relasi template `PKWT` / `MITRA` | `backend/src/lookups/lookups.service.ts`, `backend/src/contract-templates/contract-templates.service.ts` |
| 37 | Contract State Machine: enum `DRAFT` + cron job harian 00:01 WIB (`@nestjs/schedule`) untuk auto-shift `AKTIF`?`AKAN_HABIS`?`EXPIRED` + sync employment status atomik | `backend/prisma/schema.prisma`, `backend/src/contract-cron/`, `backend/src/app.module.ts` |
| 38 | Contract Guards: Anti-Overlap (409 Conflict), SP3 Lockout (403 Forbidden), State Lock untuk kontrak bertanda tangan (400 BadRequest) | `backend/src/contracts/contracts.service.ts` |
| 39 | Contract History Chain: field `parentContractId` self-referential untuk audit trail renewal, auto-link ke kontrak expired terakhir saat create biasa | `backend/prisma/schema.prisma`, `backend/src/contracts/contracts.service.ts` |
| 40 | Contract Summary Mode: halaman kontrak tampil 1 baris per karyawan (bukan semua kontrak), endpoint `GET /api/contracts/summary` dengan prioritas `AKTIF`?`AKAN_HABIS`?`EXPIRED` | `backend/src/contracts/contracts.service.ts`, `app/pages/kontrak.vue`, `server/api/contracts/summary.get.ts` |
| 41 | Contract Renewal Flow: endpoint `POST /api/contracts/:id/renew`, modal `RenewContractModal.vue`, validasi `startDate >= parent.endDate`, parent harus `AKAN_HABIS` atau `EXPIRED` | `backend/src/contracts/contracts.service.ts`, `app/components/kontrak/RenewContractModal.vue`, `server/api/contracts/[id]/renew.post.ts` |
| 42 | Contract History API: endpoint `GET /api/contracts/history/:employeeId` untuk ambil semua kontrak karyawan, modal riwayat fetch per employee (bukan filter lokal) | `backend/src/contracts/contracts.service.ts`, `server/api/contracts/history/[employeeId].get.ts`, `app/pages/kontrak.vue` |
| 43 | Add Contract Modal ? Contract Status Awareness: saat employee dipilih, form cek kontrak terakhir, tampil warning untuk `AKTIF`/`AKAN_HABIS` (disable simpan), info untuk `EXPIRED` (boleh simpan) | `app/components/kontrak/AddContractModal.vue` |
| 44 | Nitro Proxy Error Handling: semua proxy contracts pakai `$fetch.raw` + `createError` untuk forward error backend (409/403/400) ke frontend sebagai toast | `server/api/contracts.ts`, `server/api/contracts/[id].ts`, `server/api/contracts/summary.get.ts`, `server/api/contracts/history/[employeeId].get.ts`, `server/api/contracts/[id]/renew.post.ts` |
| 45 | Riwayat Surat Peringatan di halaman Detail Karyawan: timeline SP per karyawan (badge level, jenis pelanggaran, masa berlaku, dokumen), scrollable max-h-[600px] | `app/components/karyawan/detail/WarningLetterList.vue`, `app/pages/karyawan/[id].vue` |
| 46 | Scrollable timeline di detail karyawan: ContractTimeline + WarningLetterList, max-h-[400px] mobile/max-h-[600px] desktop, gradient fade indicator dark-mode-aware | `app/components/karyawan/detail/ContractTimeline.vue`, `app/components/karyawan/detail/WarningLetterList.vue` |
| 47 | Import Data Karyawan Bulk via Excel Template: template dengan dropdown validasi data master (ExcelJS backend), parse/validate di frontend (xlsx), bulk create all-or-nothing transaction backend | `app/composables/useImportTemplate.ts`, `app/components/karyawan/ImportModal.vue`, `backend/src/employees/employees.service.ts`, `server/api/employees/bulk-import.post.ts`, `server/api/employees/import-template.get.ts` |
| 48 | Fix: Edit Kontrak Bad Request ? State Lock normalisasi Date vs String perbandingan (Date.toISOString vs DTO string) | `backend/src/contracts/contracts.service.ts` |
| 49 | Fix: Kontrak PHK/RESIGN tidak bisa buat kontrak baru ? guard `checkTerminationLockout()` di create/renew, status summary override ke SELESAI untuk karyawan offboarded | `backend/src/contracts/contracts.service.ts` |
| 50 | Fix: Import tanggal off-by-one (timezone) ? eliminasi `toISOString()` dari `parseDateString()`, pakai local date components, `raw: false` di xlsx untuk avoid Date objects | `app/composables/useImportTemplate.ts` |
| 51 | Ganti Logo & Nama Organisasi: upload logo (JPG/PNG/WEBP/SVG, max 512x512px, 2MB), field Nama Organisasi di Pengaturan > Umum (Admin only), tampil dinamis di sidebar TeamsMenu | `backend/src/settings/`, `app/composables/useAppSettings.ts`, `app/components/TeamsMenu.vue`, `app/pages/settings/index.vue`, `server/api/settings/logo.post.ts` |
| 52 | Profil Akun di Pengaturan: menampilkan data aktual user login (fullName, employeeNo, email untuk user_account, role). Email di JWT payload, master_admin tidak punya email | `backend/src/auth/auth.service.ts`, `app/stores/auth.ts`, `app/pages/settings/index.vue` |

| 53 | Deployment production via Cloudflare Tunnel | `deploy/start.ps1`, `~/.cloudflared/config.yml` |
| 54 | Foto/dokumen via relative path (proxy Nuxt /uploads/**) | `nuxt.config.ts`, `app/composables/useAppSettings.ts`, `app/components/karyawan/detail/ProfileHeader.vue`, `ContractTimeline.vue`, `WarningLetterList.vue`, `app/pages/settings/index.vue`, `app/composables/useExport.ts` |
| 55 | Title browser & SEO meta diupdate | `app/app.vue` |
| 56 | Security: JWT_SECRET fail-fast (hapus fallback hardcoded), httpOnly cookie, CORS origin whitelist via env | `backend/src/auth/jwt.strategy.ts`, `backend/src/auth/auth.module.ts`, `server/api/auth/login.post.ts`, `nuxt.config.ts` |
| 57 | Security: Rate limiting login 5 req/menit via @nestjs/throttler | `backend/src/auth/auth.controller.ts`, `backend/src/app.module.ts` |
| 58 | Security: File upload magic bytes validation (file-type@16) ? bukan hanya MIME header | `backend/src/shared/file-validation.util.ts`, `backend/src/employees/employees.controller.ts`, `backend/src/settings/settings.controller.ts` |
| 59 | Security: Path traversal sanitasi pada download/serve PDF ? resolve dari cwd, bukan uploadRoot | `backend/src/contracts/contracts.controller.ts:downloadPdf` |
| 60 | Security: Fix auth store & middleware default role `?? 'ADMIN'` ? null-safe | `app/stores/auth.ts`, `app/middleware/auth.global.ts` |
| 61 | Centralisasi BACKEND_URL di `server/utils/backend.ts` ? Nitro auto-import, hapus 36 definisi duplikat | `server/utils/backend.ts` |
| 62 | Ekstrak `backend/src/shared/date-utils.ts` ? hapus duplikasi startOfDay & DAY_MS | `backend/src/shared/date-utils.ts` |
| 63 | SharedModule + DashboardCacheService: cache invalidasi berbasis event (bukan TTL buta) | `backend/src/shared/shared.module.ts`, `backend/src/shared/dashboard-cache.service.ts` |
| 64 | Unit Test Jest: 9 test AuthService (validateAdmin, login, changePassword) | `backend/src/auth/auth.service.spec.ts`, `backend/jest.config.js`, `backend/tsconfig.test.json` |
| 65 | N+1 fix: ensureDefaultContractTypes loop create ? createMany skipDuplicates | `backend/src/lookups/lookups.service.ts` |
| 66 | Search API: filter kontrak di database (bukan JS), tambah param search ke contracts.findAll | `server/api/search.get.ts`, `backend/src/contracts/contracts.service.ts` |
| 67 | Export karyawan: auth check 401, batas 5000 record, timeout 30 detik, error handling | `server/api/employees/export.get.ts` |
| 68 | Fix resolveActiveContract dipanggil 4x per row export ? 1x via spread IIFE | `app/composables/useExport.ts` |
| 69 | Fix download PDF kontrak: serve cached jika ada, generate hanya jika belum ada atau file hilang | `backend/src/contracts/contracts.controller.ts:downloadPdf` |
| 70 | Fix double `/api` di 7 Nitro proxy routes (warning-letters, employees, contracts, settings) | `server/api/warning-letters/[id]/preview.get.ts`, `server/api/employees/[id]/photo.post.ts`, `server/api/employees/import-template.get.ts`, dll |
| 71 | Fix file.buffer undefined dengan diskStorage ? baca file dari disk via readFileSync setelah upload | `backend/src/employees/employees.controller.ts`, `backend/src/settings/settings.controller.ts` |
| 72 | Fix FK violation hapus karyawan ? hapus employeeStatusHistory & employeeOffboarding dalam transaksi | `backend/src/employees/employees.service.ts:remove` |
| 73 | Fix UniqueConstraintViolation create kontrak ? tangkap P2002, pesan ramah user | `backend/src/contracts/contracts.service.ts:create` |
| 74 | Tambah .env.example root + backend/.env.example dengan semua variabel termasuk FONT_DIR, NUXT_ALLOWED_ORIGINS | `.env.example`, `backend/.env.example` |
| 75 | Fix typo 'Koprasi' ? 'Koperasi', 'departement' ? 'departemen' | `backend/src/warning-letters/pdf-generator.service.ts`, `backend/src/lookups/lookups.service.ts` |
| 76 | Fix font path hardcoded Windows ? cross-platform via FONT_DIR env, fallback per OS | `backend/src/warning-letters/pdf-generator.service.ts` |
| 77 | Fix AuthenticatedUser + JwtPayload interface ? ganti type `any` di auth files | `backend/src/auth/auth.service.ts`, `backend/src/auth/jwt.strategy.ts` |
| 78 | PM2 process manager ? auto-restart frontend/backend, env injection, logging | `ecosystem.config.cjs`, `deploy/start.ps1`, `.env` (root) |
| 79 | Master Dokumen ? tabel `document_types` (nama, jenis, penerbit), CRUD di Master Data tab baru | `backend/src/lookups/lookups.service.ts`, `backend/prisma/schema.prisma`, `app/pages/settings/master-data.vue` |
| 80 | Halaman Sertifikasi & Ijin ? CRUD dokumen karyawan, status otomatis (AKTIF/AKAN_EXPIRED/EXPIRED), upload file, tombol Perpanjang | `app/pages/dokumen/sertifikasi-ijin/index.vue`, `app/components/sertifikasi-ijin/FormModal.vue` |
| 81 | Backend Sertifikasi & Ijin ? module `employee-documents`, CRUD + upload file + compute status + filter employeeId | `backend/src/employee-documents/` |
| 82 | Cron email Sertifikasi & Ijin ? notifikasi AKAN_EXPIRED & EXPIRED digabung di cron kontrak harian | `backend/src/contract-cron/contract-cron.service.ts`, `backend/src/contract-cron/maileroo.service.ts` |
| 83 | Section Sertifikasi & Ijin di Detail Karyawan ? timeline scrollable read-only + link Lihat Semua | `app/components/karyawan/detail/EmployeeDocumentList.vue`, `app/pages/karyawan/[id].vue` |
| 84 | Fix 403 Forbidden buat kontrak baru ? checkTerminationLockout auto-reset status stale RESIGN/PHK jika tidak ada offboarding record | `backend/src/contracts/contracts.service.ts:checkTerminationLockout` |
| 85 | Fix hapus karyawan bersih ? tambah employeeDocument.deleteMany di transaksi hapus | `backend/src/employees/employees.service.ts:remove` |
| 86 | Fix P2002 duplikat contractNo di renew ? tangkap error dengan pesan ramah user | `backend/src/contracts/contracts.service.ts:renew` |
| 87 | Fix Nitro proxy tidak teruskan employeeId filter ? tambah query param di server/api/employee-documents/index.ts | `server/api/employee-documents/index.ts` |
| 88 | Auto-generate nomor kontrak ? format `{seq}/KK/KUKP/SII/{bulan_romawi}/{tahun}`, reset per tahun, ikut `startDate` | `backend/src/shared/document-number.util.ts`, `backend/src/contracts/contracts.service.ts:generateContractNo` |
| 89 | Auto-generate nomor SP ? format `{seq}/SP/KUKP/SII/{bulan_romawi}/{tahun}`, ikut `letterDate` | `backend/src/warning-letters/warning-letters.service.ts:generateLetterNumber` |
| 90 | Preview nomor dinamis ? fetch `/preview-number?startDate=` atau `?letterDate=`, refetch otomatis saat tanggal berubah | `server/api/contracts/preview-number.get.ts`, `server/api/warning-letters/preview-number.get.ts` |
| 91 | Upload file di Surat Peringatan ? endpoint `POST :id/file`, diskStorage ke `uploads/warning-letters/`, magic bytes validation, max 10MB | `backend/src/warning-letters/warning-letters.controller.ts`, `server/api/warning-letters/[id]/file.post.ts` |
| 92 | Tombol "Unduh Dokumen" kondisional di tabel aksi SP ? hanya muncul jika `documentUrl` ada | `app/pages/dokumen/surat-peringatan/index.vue:getRowItems` |
| 93 | CodeGraph integration ? pre-indexed knowledge graph 171 files, 1.957 nodes, 4.425 edges, auto-sync on file change | `.codegraph/` (generated), `codegraph` CLI global |
| 94 | Code Review Fixes (10 items): CORS env var, JWT cookie httpOnly server-side, bcrypt ESM import, NestFactory typed, devtools conditional, prisma.$transaction bug, UpdateEmployeeDto PartialType, N+1 notifications parallelized, Prisma.EmployeeWhereInput type safety | `backend/src/main.ts`, `backend/src/auth/`, `backend/src/employees/employees.service.ts`, `backend/src/notifications/notifications.service.ts` |
| 95 | Fix cleanupOrphanedFiles cron: AppSetting tidak di-query sehingga logo/background dihapus jam 02:00 WIB | `backend/src/contract-cron/contract-cron.service.ts` |
| 96 | Fix PDF preview chunk error: pdfjs worker ?url Vite virtual chunk tidak stabil, fix: new URL(pdfjs-dist/build/pdf.worker.min.mjs, import.meta.url) | `app/components/PdfViewer.client.vue` |
| 97 | Halaman Dok. Karyawan -- pusat upload dokumen pribadi karyawan (KTP/SIM/NPWP/KK/Paspor/BPJS/Ijazah/Sertifikat), data table 1 row per karyawan, tombol Tambah di navbar | `app/pages/dokumen/dok-karyawan/index.vue` |
| 98 | DetailDrawer Dok. Karyawan -- 2 section: Dokumen Pribadi (CRUD) + Sertifikasi & Ijin (read-only), rule no-duplicate dropdown (tipe sudah ada = disabled + cek) | `app/components/dok-karyawan/DetailDrawer.vue`, `app/components/dok-karyawan/FormModal.vue` |
| 99 | Backend GET /employee-documents/summary -- 1 row per karyawan dengan worstStatus, totalDocs | `backend/src/employee-documents/employee-documents.service.ts`, `server/api/employee-documents/summary.get.ts` |
| 100 | DocCategory enum PERSONAL/CERTIFICATION -- field category di DocumentType schema, seed 9 tipe pribadi, filter ?category= di lookups, kolom kategori di Master Data | `backend/prisma/schema.prisma`, `backend/src/lookups/lookups.service.ts`, `app/pages/settings/master-data.vue` |
| 101 | expiryDate nullable -- EmployeeDocument.expiryDate menjadi DateTime? untuk dokumen tanpa masa berlaku (KTP/NPWP/KK) | `backend/prisma/schema.prisma`, `backend/src/employee-documents/employee-documents.service.ts` |
| 102 | Filter documentTypeCategory -- GET /employee-documents mendukung ?documentTypeCategory=PERSONAL/CERTIFICATION, Sertifikasi & Ijin filter CERTIFICATION | `backend/src/employee-documents/employee-documents.service.ts`, `app/pages/dokumen/sertifikasi-ijin/index.vue` |
| 103 | Fix Nitro proxy [resource].ts -- query params tidak di-forward ke backend, fix: getQuery + URLSearchParams | `server/api/lookups/[resource].ts` |
| 104 | Fix CreateDocumentTypeDto -- field category di-strip oleh ValidationPipe whitelist, fix: tambah field + cast DocCategory | `backend/src/lookups/lookups.service.ts` |
| 105 | Modul Kalender -- CRUD agenda (`CalendarEvent`), endpoint GET/POST/PUT/DELETE `/api/calendar`, integrasi data read-only dari kontrak/dokumen/vendor/legal | `app/pages/kalender/index.vue`, `server/api/calendar/`, `backend/src/calendar/` |
| 106 | Kalender: 12 pilihan warna label (blue, sky, teal, green, yellow, orange, red, pink, purple, indigo, gray, slate) + color picker bulat di form | `app/pages/kalender/index.vue`, `backend/src/calendar/dto/calendar-event.dto.ts` |
| 107 | Kalender: `startTime` wajib diisi di form Tambah/Edit Agenda -- validasi frontend + backend | `app/pages/kalender/index.vue`, `backend/src/calendar/dto/calendar-event.dto.ts` |
| 108 | Kalender: `assignedUserIds[]` -- multi-select penerima notifikasi + shortcut "Semua User", tersimpan di `CalendarEvent.assignedUserIds` (Int[] PostgreSQL array) | `app/pages/kalender/index.vue`, `backend/prisma/schema.prisma` |
| 109 | Kalender: `AgendaNotificationService` cron tiap menit -- notifikasi pagi H-0 pada jam yang dikonfigurasi + notifikasi 5 menit sebelum agenda dimulai | `backend/src/calendar/agenda-notification.service.ts`, `backend/src/notifications/notifications.service.ts` |
| 110 | Kalender: `NotificationCategory.AGENDA` -- integrasi ke sistem notifikasi yang sudah ada, auto-resolve agenda yang sudah lewat | `backend/prisma/schema.prisma`, `backend/src/notifications/notifications.service.ts` |
| 111 | Kalender: Pengaturan jam notifikasi pagi di Pengaturan > Umum -- field `agendaNotificationMorningHour` di `AppSetting`, default jam 7 | `app/pages/settings/index.vue`, `backend/src/settings/settings.service.ts`, `backend/src/settings/settings.controller.ts` |
| 112 | Kalender: Nama pembuat agenda (`createdByName`) tampil di modal detail | `app/pages/kalender/index.vue` |
| 113 | Kalender: Tampilan Month/Week/Day View -- toggle button di header, navigasi prev/today/next adaptif per view | `app/pages/kalender/index.vue` |
| 114 | Kalender: Week View -- grid jam 00-23, all-day strip, blok event posisi CSS berbasis `startTime`+durasi, current time indicator, auto-scroll ke jam pertama agenda | `app/pages/kalender/index.vue` |
| 115 | Kalender: Day View -- grid jam 24 jam, all-day strip, blok event penuh, info pembuat di blok event langsung | `app/pages/kalender/index.vue` |
| 116 | Kalender: Tooltip popup di Week/Day View -- klik item â†’ floating tooltip dengan judul/waktu/lokasi/deskripsi/pembuat, tombol Edit & Hapus, animasi transisi, backdrop tutup | `app/pages/kalender/index.vue` |
| 117 | Kalender: Double-click tanggal di Month View â†’ pindah ke Day View untuk tanggal itu | `app/pages/kalender/index.vue` |
| 118 | Kalender: `confirmDeleteToast` untuk hapus agenda -- ganti native `confirm()` dengan toast konfirmasi yang konsisten | `app/pages/kalender/index.vue`, `app/composables/useConfirmDeleteToast.ts` |
| 119 | Bug fix Kalender: 401 SSR auth -- `$fetch` diganti `requestFetch` (useRequestFetch) agar cookie diteruskan saat SSR | `app/pages/kalender/index.vue` |
| 120 | Bug fix Kalender: form Tambah/Edit tumpang tindih -- `openCreate` dan `openEdit` set `selectedDate = null` sebelum buka form | `app/pages/kalender/index.vue` |
| 121 | Bug fix Kalender: `rangeEnd` tidak menambah hari jika akhir bulan = Minggu -- fix formula agar baris terakhir kalender selalu tampil penuh | `app/pages/kalender/index.vue` |
| 122 | Bug fix Kalender: `overlaps()` di service memiliki 4 parameter tapi hanya pakai 2 -- hapus parameter tidak terpakai | `backend/src/calendar/calendar.service.ts` |
| 123 | Bug fix Kalender: `UpdateGeneralSettingsDto` tidak punya field `agendaNotificationMorningHour` -- NestJS strip field sebelum sampai service, setting jam selalu kembali ke default | `backend/src/settings/settings.controller.ts` |

| 124 | Modul Space Phase 1 ï¿½ Kanban Board: CRUD Space + kolom + card, drag & drop native HTML5, template kolom preset (Simple/Dev/Bug/HR/Custom), member management, SSE real-time per-Space | `app/pages/spaces/`, `app/components/spaces/`, `backend/src/spaces/`, `server/api/spaces/` |
| 125 | Space: Card detail lengkap ï¿½ checklist, attachment (upload file + link), komentar, priority, due date, assignee, label, cover color | `app/components/spaces/CardDetailModal.vue` |
| 126 | Space: KanbanCard redesign modern ï¿½ cover bar, priority pill berwarna, assignee initials (dari memberMap), description preview, checklist inline progress bar, overdue pulsing indicator, hover lift+ring | `app/components/spaces/KanbanCard.vue` |
| 127 | Space: List View ï¿½ tabel semua cards dengan sort/filter/grouping (grouped by column / flat), sorted by title/priority/due/created/updated | `app/components/spaces/ListView.vue`, `app/components/spaces/ListCardRow.vue` |
| 128 | Space: Announcement/Pinned Notes ï¿½ area pengumuman di atas board, collapsible, pin/unpin, edit inline | `app/components/spaces/SpaceAnnouncement.vue`, `app/components/spaces/SpaceAnnouncementBar.vue` |
| 129 | Space: Dokumen ï¿½ CRUD dokumen bersama dengan Tiptap rich text editor (bold/italic/heading/list/blockquote/code), auto-save 1.5 detik, emoji picker, editor dibuka sebagai inline modal | `app/components/spaces/TiptapEditor.client.vue`, `app/components/spaces/SpaceDocsView.vue` |
| 130 | Space: Notifikasi in-app ï¿½ card assign, @mention di komentar, due date H-1, card pindah kolom ? kategori `SPACE` di bell existing | `backend/src/spaces/space-notification.service.ts` |
| 131 | Space: View toggle Board/List/Docs di header + Announcement Bar di semua view | `app/pages/spaces/[id].vue` |
| 132 | Space: Kelola Member ï¿½ modal tambah/hapus member per Space | `app/components/spaces/SpaceMemberModal.vue` |
| 133 | Space Phase 2: Prisma schema ï¿½ `SpaceAnnouncement`, `SpaceDocument`, `NotificationCategory.SPACE` | `backend/prisma/schema.prisma` |
| 134 | Bug fix Space: drag & drop card ï¿½ HTML5 DnD `setData()` wajib dipanggil di dragstart, kolom sebagai drop target langsung (bukan slot-based), optimistic UI update | `app/components/spaces/KanbanBoard.vue` |
| 135 | Bug fix Space: Tiptap SSE hydration mismatch ï¿½ rename `TiptapEditor.vue` ? `TiptapEditor.client.vue` agar hanya render di browser | `app/components/spaces/TiptapEditor.client.vue` |
| 136 | Bug fix Space: Document editor blank ï¿½ standalone `[docId].vue` route konflik dengan nested routing Nuxt 4, fix: inline modal editor di `SpaceDocsView.vue`, hapus standalone page files | `app/components/spaces/SpaceDocsView.vue` |
| 137 | Bug fix Space: `AddMemberDto` tidak punya validator ï¿½ `memberId` tiba sebagai string, `{ push: undefined }` gagal Prisma; fix: tambah `@IsInt()` + `@Type(() => Number)` + build array baru | `backend/src/spaces/spaces.controller.ts`, `backend/src/spaces/spaces.service.ts` |
| 138 | Bug fix Space: Announcement dropdown tidak tampil ï¿½ `hidden group-hover:flex` CSS broken, fix: hapus class `hidden`, dropdown selalu visible | `app/components/spaces/SpaceAnnouncement.vue` |
| 139 | Space Dokumen: UI/UX Notion-style + Tombol Save cerdas (dirty/saving/saved/idle), footer status + word/char count + timestamp "Tersimpan ï¿½ HH:mm", Ctrl/Cmd+S, konfirmasi tutup saat unsaved changes, auto-save 1.5s tetap jalan, `max-w-5xl` modal + editor `max-w-3xl`, `max-w` lega untuk full-page | `app/components/spaces/SpaceDocsView.vue`, `app/pages/spaces/[id]-docs-[docId].vue`, `app/composables/useDocStats.ts` |
| 140 | Space Dokumen: Tombol "Buka halaman penuh" (expand) di header modal editor `<` auto-save dulu jika dirty, navigasi ke route full-page `/spaces/[id]-docs-[docId]` | `app/components/spaces/SpaceDocsView.vue` |
| 141 | Space Dokumen: Route full-page editor flat `/spaces/[id]-docs-[docId]` (fix konflik nested routing Nuxt 4 tanpa `<NuxtPage />` di parent) + smart save + navbar status & tombol Simpan + onBeforeRouteLeave/beforeunload unsaved confirm | `app/pages/spaces/[id]-docs-[docId].vue` |
| 142 | Space Dokumen: Upload gambar di Tiptap editor (toolbar button + drag & drop + paste clipboard + URL eksternal), simpan ke `backend/uploads/documents/` dan diserve via proxy `/uploads/**`, max 5MB, semua format gambar, alt text, validasi magic bytes | `app/components/spaces/TiptapEditor.client.vue`, `server/api/spaces/[id]/documents/upload-image.post.ts`, `backend/src/spaces/space-documents.controller.ts`, `nuxt.config.ts` |
| 143 | Fix Space: Upload attachment (gambar/PDF) di card Space corrupt � proxy memakai `readRawBody`+`$fetch.raw` yang mendecode body multipart binary jadi UTF-8 (byte non-ASCII -> U+FFFD). Fix: ganti ke `proxyRequest` (stream body mentah tanpa decode), konsisten dengan proxy upload lain | `server/api/spaces/[id]/cards/[cardId]/attachments.post.ts` |
| 144 | Fix Space: Gambar dokumen tidak tampil di production (build). Penyebab: file disimpan di `public/uploads/documents/` tapi Nuxt prod hanya serve snapshot statis `.output/public/` (salinan saat build) sehingga file runtime tidak pernah ada -> 404. Fix: pindahkan penyimpanan ke backend `backend/uploads/documents/` (pola sama dgn foto/logo) via endpoint `upload-image` di `SpaceDocumentsController` + `proxyRequest`; hapus rule khusus `/uploads/documents/**` di nuxt.config | `backend/src/spaces/space-documents.controller.ts`, `server/api/spaces/[id]/documents/upload-image.post.ts`, `nuxt.config.ts` |
| 145 | Upload Foto Profil user (Pengelola & Admin): field `photoUrl` di `MasterAdmin` + `UserAccount`, endpoint `POST/DELETE /api/auth/profile/photo` (diskStorage `uploads/profile-photos/`, max 2MB, magic bytes), login sertakan `photoUrl`, tab Profil Akun (preview bulat + Upload + Hapus + loading), avatar UserMenu pakai foto, cookie `auth_admin` diupdate via `setPhotoUrl` tanpa relogin | `backend/prisma/schema.prisma`, `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `server/api/auth/profile/photo.post.ts`, `server/api/auth/profile/photo.delete.ts`, `app/pages/settings/index.vue`, `app/stores/auth.ts`, `app/components/UserMenu.vue` |
| 146 | Favicon tab browser mengikuti logo organisasi (`appLogoUrl`) jika ada, fallback `/favicon.ico`; `rel="icon"` + `shortcut icon`, refetch settings setelah login (SPA) | `app/app.vue`, `app/composables/useAppSettings.ts` |
| 147 | STOP.bat / `start.ps1 -Stop -KeepPostgres`: stop cloudflared + PM2 TANPA menghentikan PostgreSQL docker | `deploy/STOP.bat`, `deploy/start.ps1` |
| 148 | Print CV Karyawan per individu (layout A4): tombol "Cetak CV" di navbar detail karyawan, modal preview + Teleport ke `body` (`print-only-cv`) agar print multi-halaman tanpa clipping modal fixed, CSS `@media print` global, header foto + data pribadi/pekerjaan + riwayat kontrak/sertifikasi/SP (style ui-ux-pro-max) | `app/components/karyawan/detail/CvDocument.vue`, `app/components/karyawan/detail/PrintCvModal.vue`, `app/pages/karyawan/[id].vue`, `app/assets/css/main.css` |
| 149 | Export Excel Kontrak Customer/Vendor (modal filter Tahun/Semua, pola Surat Peringatan), useExport `exportVendorContractsExcel` | `app/composables/useExport.ts`, `app/pages/dokumen-legal/kontrak-vendor/index.vue` |
| 150 | Export Excel Legal Koperasi (tanpa filter, pola Sertifikasi & Ijin) + Export Akte Dokumen (pola sama) | `app/composables/useExport.ts`, `app/pages/dokumen-legal/legal-koperasi/index.vue`, `app/pages/dokumen-legal/akte-dokumen/index.vue` |
| 151 | Notifikasi PER-USER (fix bug): kolom `userId`+`userType` di `Notification` (nullable, migrasi `add_notification_user`), notif expiry disalin per akun aktif (master_admin + user_account), agenda (`agenda_morning_${userId}`/`agenda_before_${userId}`) & space (`space_card_assign_${userId}` dsb) sourceType per-user, `findAll`/`unreadCount`/`markRead` filter `req.user`, SSE `subscribe(userId,userType)` broadcast per-user, frontend kirim `userId/userType` dari `auth.admin`, map ikon `AGENDA`/`SPACE`, proxy `POST /notifications/trigger` | `backend/prisma/schema.prisma`, `backend/src/notifications/notifications.service.ts`, `backend/src/notifications/notifications.controller.ts`, `backend/src/spaces/space-notification.service.ts`, `app/composables/useNotifications.ts`, `app/components/NotificationBell.vue`, `app/pages/notifications/index.vue`, `server/api/notifications/trigger.post.ts` |
| 152 | Redesign Detail Drawer Sertifikasi & Ijin (modern, bersih): status ring berwarna (ikon + warna), Expiry Status Card dengan progress bar sisa hari (tabular), 2 kartu info (Karyawan/Penerbit & Dokumen/Status), file/keterangan rapi, metadata tipis; warna badge pakai type-safe `BadgeColor`, `panel` diubah ke `content` | `app/components/sertifikasi-ijin/DetailDrawer.vue` |
| 153 | Kalender: Fix card agenda bertumpuk (overlap layout) di Week/Day View — algoritma kolom tumpang-tindih (cluster transitif + greedy track assignment), agenda yang waktunya bertabrakan tampil berdampingan via `left`/`width` proporsional, border aksen kiri, overlay "tambah" `z-0` | `app/pages/kalender/index.vue` |
| 154 | Integrasi Hari Libur Nasional Indonesia (api.co.id) ke Kalender: backend `HolidaysService` (fetch + in-memory cache 24 jam per tahun, fail-silent jika tidak ada `HOLIDAY_API_KEY`), `GET /holidays?start=&end=`, Nitro proxy `holidays.get.ts`, frontend `loadHolidays`+`holidayMap` paralel dengan `loadItems`; tampilan nama libur merah kecil di bawah angka tanggal Month View, label merah di header kolom Week View, badge merah dengan ikon flag di header Day View; data terupdate otomatis per tahun (cache per tahun, TTL 24 jam) | `backend/src/holidays/`, `backend/src/app.module.ts`, `server/api/holidays.get.ts`, `app/pages/kalender/index.vue`, `backend/.env.example` |
| 155 | Redesign Detail Drawer Legal Koperasi (modern, konsisten): category ring berwarna per kategori (ikon anchor/shield/scroll/file-code), Expiry Status Card 4 kondisi (infinity/check-circle/minus-circle/ring+progress bar sisa hari), 2 kartu info bersih, Renewal Chain Timeline vertikal garis konektor dashed (renewedFrom → ini → renewedTo) sebagai signature element, keterangan blockquote, file preview, metadata tipis | `app/components/legal-koperasi/DetailDrawer.vue` |
| 156 | Redesign Detail Drawer Kontrak Customer/Vendor (modern, konsisten): category ring CUSTOMER/VENDOR berbeda ikon+warna (user-check info / building-2 success), Expiry Status Card 4 kondisi + progress bar "Sisa N hari" (bukan % sudah berjalan), Mother Agreement card aksen `border-l-4 border-l-primary` + ikon anchor sebagai signature element, Renewal Chain Timeline 3-node, Riwayat Perpanjangan flat list, animasi Transition preview tetap terjaga | `app/components/vendor-contracts/DetailDrawer.vue` |
| 157 | Redesign Detail Drawer Akte Dokumen (modern, konsisten): header ring primary `i-lucide-file-signature`, Notaris Card amber sebagai signature element (`border-l-4 border-l-amber-500 bg-amber-50/50`, ikon `i-lucide-scale-3`, "Disahkan pada"), 1 kartu "Detail Akte" (No. Akte mono + Tanggal), SK Terkait card kondisional (hanya jika `nomorSk` ada), keterangan blockquote, file Unduh+Preview seragam | `app/components/akte-dokumen/DetailDrawer.vue` |
| 158 | Riwayat Kontrak Karyawan di Detail Karyawan tampilkan foto profil: prop `employeePhoto` + `employeeName` di `ContractTimeline.vue`, avatar `size-7` di pojok kanan atas setiap kartu kontrak (foto atau fallback inisial), diteruskan dari `[id].vue` via `fotoKaryawan` + `fullName` | `app/components/karyawan/detail/ContractTimeline.vue`, `app/pages/karyawan/[id].vue` |
| 159 | Hapus fitur check/pick di halaman Data Karyawan: hapus state `rowSelection`/`columnVisibility`, kolom select (UCheckbox), `v-model:row-selection`/`v-model:column-visibility` dari UTable, ganti counter "X dipilih dari Y karyawan" jadi sederhana "Y karyawan" | `app/pages/karyawan/index.vue` |
| 160 | Hapus Semua Notifikasi di Bell: tombol `i-lucide-trash-2` (merah, ghost, xs) di header panel bell; backend `DELETE /notifications/all` (soft delete via `resolvedAt`, per-user, broadcast SSE), Nitro proxy `delete-all.delete.ts`, composable `deleteAll()` (clear local state), konfirmasi via `confirmActionToast` sebelum eksekusi | `backend/src/notifications/notifications.service.ts`, `backend/src/notifications/notifications.controller.ts`, `server/api/notifications/delete-all.delete.ts`, `app/composables/useNotifications.ts`, `app/components/NotificationBell.vue` |
| 161 | Fix bug Data Karyawan hanya menampilkan 10 dari 12 karyawan: `useFetch('/api/employees')` tidak mengirim `limit` sehingga backend default ke `limit=10`. Fix: tambah `query: { limit: 10000 }` pada useFetch agar semua data terambil (client-side pagination) | `app/pages/karyawan/index.vue` |
| 162 | Dropdown pilihan jumlah baris per halaman (page size) di semua halaman daftar ber-Table: opsi 15 (default) / 30 / 50 / 100 via `USelect` ter-bind `pagination.pageSize` + `watch` reset `pageIndex=0`; label footer konsisten | `app/pages/karyawan/index.vue`, `app/pages/kontrak.vue`, `app/pages/dokumen/surat-peringatan/index.vue`, `app/pages/dokumen/sertifikasi-ijin/index.vue`, `app/pages/dokumen/akte-dokumen/index.vue` (via dokumen-legal) |
| 163 | Dropdown page size server-side untuk Dok. Karyawan (`dok-karyawan`): `limit` ref dikirim ke `/api/employee-documents/summary`, tambah `limit` ke array `watch` useFetch untuk re-fetch server + reset `page=1`; sinkronkan `pagination.pageSize` TanStack dengan `limit` | `app/pages/dokumen/dok-karyawan/index.vue` |
| 164 | Perbaiki pagination server-side Legal Koperasi & Kontrak Vendor (bug: `:total` pakai jumlah baris halaman aktif bukan total, `@update:page` hanya `setPageIndex` tanpa re-fetch, referensi `table.tableApi` tidak ada karena UTable tanpa `getPaginationRowModel`). Fix: `:total="totalDocuments/totalContracts"`, `@update:page` set `pageIndex` + `fetchDocuments()/fetchContracts()`, pakai `pagination` ref langsung; tambah dropdown page size + `watch` re-fetch | `app/pages/dokumen-legal/legal-koperasi/index.vue`, `app/pages/dokumen-legal/kontrak-vendor/index.vue` |
| 165 | Konversi halaman User (Pengaturan > User) dari daftar `v-for` manual ke `UTable` + pagination + dropdown page size + search + filter role + sorting kolom (Nama/Role/Email/Username), hapus kolom "Password"; semua logika modal CRUD/validasi/hapus/stats tetap dipertahankan | `app/pages/settings/users.vue` |
| 166 | Export PDF Data Karyawan dirapikan: 16 kolom eksplisit (total 281mm = lebar halaman), font 6.5pt, theme grid, overflow ellipsize, nomor halaman footer "Halaman X dari Y", margin 8mm, hapus kolom Foto/Dibuat/Diperbarui/NIK, tambah Departement | `app/composables/useExport.ts` |
| 167 | Database Override Template Kontrak: kolom `contentOverrides Json?` di tabel `contract_templates`, fungsi `mergeDefinition()`, endpoint `GET/PUT /contract-templates/:id/content-overrides`, Nitro proxy, composable `useTemplateContentEditor`, modal edit 4 tab (Teks Umum, Pasal ID, Pasal EN untuk PKWT) | `backend/prisma/schema.prisma`, `backend/src/contracts/contract-document-definitions.ts`, `backend/src/contracts/contract-document.service.ts`, `backend/src/contract-templates/`, `app/components/kontrak/TemplateContentModal.vue`, `app/composables/useTemplateContentEditor.ts`, `server/api/contract-templates/[id]/` |
| 168 | Placeholder `__ROLE_LABEL__` di PKWT Pasal 1 ayat 2 (Indonesia + English) dan MITRA recital nomor 2 — `definition.roleLabel` kini benar-benar efektif di PDF kedua family | `backend/src/contracts/contract-document-definitions.ts`, `backend/src/contracts/contract-document.service.ts` |
| 169 | Tab Teks Umum modal Edit Konten Template: hanya tampilkan field yang benar-benar dirender (PKWT: title+subtitle+roleLabel; MITRA: title+roleLabel); sembunyikan 6 field tidak efektif (locationLine, termLine, compensationLabel, firstPartyLabel, secondPartyLabel) | `app/components/kontrak/TemplateContentModal.vue` |
| 170 | Dropdown templateKey di halaman Template Kontrak: ganti UInput bebas ketik dengan USelect 8 key valid (PKWT_DRIVER/KASIR/STAFF/WAREHOUSE, MITRA_DRIVER/KOMART/STAFF/WAREHOUSE), filter per family, validasi Zod enum, watch reset saat family berubah | `app/pages/settings/contract-templates.vue` |
| 171 | Konfirmasi hapus Template Kontrak via `confirmDeleteToast` (nama template di pesan, tombol "Hapus Template") | `app/pages/settings/contract-templates.vue` |
| 172 | Fix alert "X field diubah dari default" masih muncul setelah simpan di modal Edit Konten Template: tambah ref `baseline` (snapshot saat modal dibuka dari `res.merged`), `changesCount` dibandingkan vs baseline bukan hardcode, `save()` update baseline setelah berhasil | `app/components/kontrak/TemplateContentModal.vue` |
| 173 | Redesign DetailDrawer Dok. Karyawan (modern minimalis): status accent bar kiri per card, ikon spesifik per jenis dokumen (KTP/SIM/NPWP/dll), indikator sisa hari berwarna status, summary strip 4 stat, preview pop-up modal (pola Surat Peringatan, `max-w-5xl h-[90vh]`), loading/error state | `app/components/dok-karyawan/DetailDrawer.vue` |
| 174 | Fix foto profil karyawan tidak tampil di popup Riwayat Kontrak Karyawan (halaman Data Karyawan): modal hanya menampilkan inisial karena tidak ada tag `<img>`, padahal `historyTarget.fotoKaryawan` tersedia dari data list | `app/pages/karyawan/index.vue` |
| 175 | Komentar Space: soft delete + konfirmasi toast hapus + edit inline + badge "Diedit" + placeholder "Komentar ini telah dihapus pada [tanggal jam]". Kolom baru `isEdited/editedAt/isDeleted/deletedAt` di `space_card_comments`; backend `removeComment()` diubah dari hard delete ke soft delete (content dikosongkan); `updateComment()` set `isEdited:true, editedAt`; tombol Edit/Hapus hanya tampil untuk penulis sendiri (`authorId === currentUserId`) | `backend/prisma/schema.prisma`, `backend/src/spaces/space-cards.service.ts`, `app/types/space.d.ts`, `app/components/spaces/CardDetailModal.vue` |
| 176 | Komentar Space tampilkan foto profil author: kolom `authorPhotoUrl` di `space_card_comments`, backend `addComment()` fetch `photoUrl` langsung dari DB (UserAccount/MasterAdmin) karena tidak ada di JWT payload, frontend tampilkan `<img>` jika `authorPhotoUrl` ada dengan fallback inisial | `backend/prisma/schema.prisma`, `backend/src/spaces/space-cards.service.ts`, `backend/src/spaces/space-cards.controller.ts`, `app/types/space.d.ts`, `app/components/spaces/CardDetailModal.vue` |
| 177 | Toast konfirmasi hapus Lampiran di card Kanban: `deleteAtt(att)` pakai `confirmDeleteToast` dengan nama lampiran di pesan (ganti parameter dari `attId` ke object `att`) | `app/components/spaces/CardDetailModal.vue` |
| 178 | Dropdown page size konsisten di semua sub halaman Dokumen Karyawan (opsi 15 default/30/50/100): **Surat Peringatan** & **Sertifikasi & Ijin** pola client-side (`USelect` bind `pagination.pageSize` + `watch` reset `pageIndex=0`); **Dok. Karyawan** pola server-side (`limit` ref dikirim ke `/api/employee-documents/summary`, `limit` masuk array `watch` useFetch untuk re-fetch, reset `page=1`, sinkronkan `pagination.pageSize` TanStack dengan `limit`) | `app/pages/dokumen/surat-peringatan/index.vue`, `app/pages/dokumen/sertifikasi-ijin/index.vue`, `app/pages/dokumen/dok-karyawan/index.vue` |
| 179 | Perbaikan bug Halaman SPACE (Komentar + Lampiran card Kanban): **Komentar** soft delete (kolom `isDeleted/deletedAt`, content dikosongkan) + placeholder "Komentar ini telah dihapus pada [tanggal jam]", edit inline + badge "Diedit" (`isEdited/editedAt`), foto profil author (`authorPhotoUrl` di-fetch langsung dari DB karena tidak ada di JWT payload), tombol Edit/Hapus hanya untuk penulis sendiri (`authorId === currentUserId`); **Lampiran** hapus via `confirmDeleteToast` dengan nama file di pesan (ganti param `attId` → object `att`) | `app/components/spaces/CardDetailModal.vue`, `app/types/space.d.ts`, `backend/prisma/schema.prisma`, `backend/src/spaces/space-cards.controller.ts`, `backend/src/spaces/space-cards.service.ts` |
| 180 | Perbaikan bug notifikasi email hilang saat gagal kirim (cron harian): urutan diubah jadi **kirim → catat (recordSent) → commit status** untuk 3 kategori Dokumen Karyawan/Vendor/Legal (sebelumnya commit status dulu lalu kirim, sehingga gagal kirim membuat status sudah berubah dan email tidak pernah di-retry). Tambah **deduplication log seragam** via `EmailNotificationSentLog` dengan sentinel `triggerDay=-1` untuk ketiga kategori (`sourceType`: `employee_document`, `vendor_contract`, `legal_koperasi`), selaras dengan `contract` yang sudah ada. Refactor `syncExpiredStatuses()` (vendor & legal) jadi hanya `findMany` + method `commitStatuses(akanIds, expiredIds)`; commit status SELALU jalan agar status tetap ter-sync walau email nonaktif, `recordSent` hanya saat `sent===true` agar gagal kirim di-retry di run berikutnya | `backend/src/contract-cron/contract-cron.service.ts`, `backend/src/vendor-contracts/vendor-contracts.service.ts`, `backend/src/legal-koperasi/legal-koperasi.service.ts` |
## Arsitektur

```
Frontend (Nuxt 4)          Nitro Server           Backend (NestJS)
app/pages/            ->    server/api/        ->   src/
app/components/            server/middleware/      Prisma -> PostgreSQL
app/composables/           server/utils/
```

### Nitro BACKEND_URL Pattern
Semua file `server/api/**/*.ts` menggunakan variabel `BACKEND` yang di-auto-import oleh Nitro dari `server/utils/backend.ts`:
```typescript
// server/utils/backend.ts ? Nitro auto-import, tidak perlu import eksplisit
export const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001/api'
export const BACKEND_ROOT = process.env.BACKEND_ROOT ?? 'http://localhost:3001'
export const BACKEND = BACKEND_URL  // alias untuk semua server/api files
```
**JANGAN** tambahkan `import { BACKEND } from '~/server/utils/backend'` ? ini akan break karena alias `~` di Nitro menunjuk ke `app/` bukan root.

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
- Shift `AKTIF` ? `AKAN_HABIS` jika sisa =30 hari
- Shift `AKTIF` / `AKAN_HABIS` ? `EXPIRED` jika `endDate` sudah lewat
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
- Prioritas pemilihan: `AKTIF` ? `AKAN_HABIS` ? `EXPIRED` ? terbaru non-dibatalkan
- Field summary: employeeId, employeeNo, fullName, contractId, contractNo, contractType, startDate, endDate, status, daysRemaining, historyCount, canRenew
- Riwayat lengkap diakses via modal yang fetch `GET /api/contracts/history/:employeeId`

### Add Contract Modal ? Contract Status Awareness
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
- Dikelola dari halaman `Pengaturan > Umum` ? hanya Admin yang bisa ubah
- Logo: upload JPG/PNG/WEBP/SVG, max 512x512px, max 2MB. Validasi dimensi di frontend sebelum upload
- Composable `useAppSettings.ts` menyediakan `logoUrl`, `organizationName`, `cooperativeChairmanName` secara reaktif untuk sidebar (`TeamsMenu.vue`)
- Fallback: jika logo kosong ? tampilkan huruf pertama nama organisasi; jika nama kosong ? "Kokarsi PT. Sankyu"

### Eskalasi Surat Peringatan
Rule eskalasi aktif:
- Tidak ada SP aktif ? admin bebas pilih SP1, SP2, atau SP3
- SP1 aktif ? default SP2, SP1 dinonaktifkan, SP3 tetap boleh
- SP2 aktif ? hanya SP3 diizinkan
- SP3 aktif ? pembuatan SP baru **diblokir** sampai masa SP selesai (`validUntil` < hari ini)

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
- Komponen `PdfViewer.client.vue` ? render PDF ke `<canvas>` via `pdfjs-dist` (v6.1.200)
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
      dok-karyawan/
        index.vue          # Pusat dokumen pribadi karyawan
      sertifikasi-ijin/
        index.vue          # Sertifikasi & Ijin
    dokumen-legal/
      legal-koperasi/
        index.vue          # Legal Koperasi
      kontrak-vendor/
        index.vue          # Kontrak Customer/Vendor
      akte-dokumen/
        index.vue          # Akte Dokumen
    settings/index.vue      # Pengaturan umum (Ketua Koperasi, Nama Organisasi, Logo)
    settings/master-data.vue  # Master data
    settings/contract-templates.vue # Master template kontrak
    settings/users.vue        # Master user
    spaces/
      index.vue              # List Space
      [id].vue               # Detail Space (Board/List/Docs + modal editor)
      [id]-docs-[docId].vue  # Editor dokumen full-page (route flat)
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
    spaces/
      SpaceDocsView.vue      # Dokumen Space - modal editor + smart save + expand full-page
      TiptapEditor.client.vue # Tiptap rich editor + upload gambar
      KanbanBoard.vue        # Board drag & drop
      KanbanCard.vue         # Card design
      ListView.vue, ListCardRow.vue, SpaceAnnouncement*.vue, CardDetailModal.vue, SpaceMemberModal.vue
  composables/
    useConfirmDeleteToast.ts   # Toast konfirmasi hapus reusable
    useConfirmActionToast.ts   # Toast konfirmasi aksi generic
    useExport.ts             # Export Excel & PDF (semua data + NIK/Alamat/TmptLahir)
    useDocStats.ts           # Word/char count dari content ProseMirror (dipakai SpaceDocsView + full-page)
  types/
    index.d.ts              # Employee, Contract, dll

server/
  api/
    auth/                   # Login, logout, me
      login.post.ts         # Login (set cookie httpOnly)
      profile/photo.post.ts   # POST upload foto profil (proxyRequest stream)
      profile/photo.delete.ts # DELETE hapus foto profil
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
      [id]/download-pdf.get.ts    # Stream PDF kontrak (serve cached, generate jika belum ada)
      [id]/document-preview.get.ts # Preview metadata kontrak
      [id]/document.post.ts       # Upload dokumen scan PDF
      [id]/generate-document.post.ts # Generate dokumen kontrak
      [id]/renew.post.ts   # POST perpanjang kontrak (renewal flow)
      preview-number.get.ts  # GET preview nomor kontrak (?startDate=)
    warning-letters/
      index.ts              # GET list + POST
      [id].ts               # GET + PUT + DELETE
      [id]/generate.get.ts  # GET generate PDF (download)
      [id]/preview.get.ts   # GET preview PDF (inline)
      [id]/file.post.ts     # POST upload file dokumen SP
      escalation/[employeeId].get.ts # GET status eskalasi SP per karyawan
    settings/
      general.get.ts        # GET pengaturan umum
      general.put.ts        # PUT pengaturan umum
    users/
      pengurus.get.ts       # GET list pengurus (no admin guard)
    notifications/
      index.get.ts          # GET list notifikasi (per-user)
      count.get.ts          # GET unread count (per-user)
      read-all.post.ts      # POST tandai semua dibaca (per-user)
      trigger.post.ts       # POST trigger generate notifikasi manual
      [id]/read.post.ts     # POST tandai satu dibaca (per-user)
      stream.get.ts         # GET SSE real-time (raw proxy, cookie auth)
    contract-templates.ts   # GET/POST master template kontrak
    contract-templates/[id].ts # PUT/DELETE master template kontrak
    lookups/
      [resource].ts         # GET list + POST
      [resource]/[id].ts    # PUT + DELETE
    spaces/
      index.ts              # GET list + POST
      [id].ts               # GET detail + PUT + DELETE
      [id]/documents/index.ts  # GET list dokumen + POST
      [id]/documents/[docId].ts  # GET detail + PUT + DELETE
      [id]/documents/upload-image.post.ts # POST proxy upload gambar editor -> backend (stream, tanpa corrupt)
      [id]/members.post.ts  # POST tambah member
      [id]/columns.post.ts, [id]/columns/[colId].ts, [id]/columns/reorder.post.ts
      [id]/cards/*          # card CRUD + move + checklist + attachment + komentar
      [id]/stream.get.ts    # SSE per-Space
      [id]/announcements.*  # CRUD pengumuman
    users.ts                # CRUD master user list/create
    users/[id].ts           # CRUD master user detail
    dashboard-stats.ts      # GET dashboard stats (proxy ke backend)
    search.get.ts           # GET global search (karyawan, kontrak, SP) ? filter di DB
    holidays.get.ts         # GET hari libur nasional (proxy ke backend HolidaysService, fail-silent)
  utils/
    backend.ts              # BACKEND, BACKEND_URL, BACKEND_ROOT ? Nitro auto-import
  middleware/
    auth.ts                 # JWT guard

backend/
  src/
    employees/              # CRUD + upload foto + offboarding
    contracts/              # CRUD kontrak + upload scan + generate PDF + renewal + summary
      contract-document.service.ts    # Generator PDF native (PKWT + MITRA)
      contract-document-definitions.ts # Definisi pasal legal per template (15 pasal MITRA, 11 pasal PKWT)
    contract-cron/            # Cron job harian 00:01 WIB untuk sync status kontrak + dokumen karyawan
    contract-templates/     # CRUD master template kontrak
    settings/               # Pengaturan umum aplikasi (AppSetting)
    warning-letters/        # CRUD SP + PDF generator + eskalasi rule
    lookups/                # Work locations, job roles, levels, tax status, contract types, document types
    employee-documents/     # CRUD Sertifikasi & Ijin karyawan + upload file + compute status
    users/                  # Master user (MasterAdmin + UserAccount)
    auth/                   # Login, JWT strategy, local strategy
    spaces/                 # Space: board, cards, columns, dokumen, announcement, SSE, upload-image
      space-documents.controller.ts # CRUD dokumen + POST upload-image (magic bytes)
      space-cards.controller.ts     # CRUD card + attachment upload (diskStorage)
      space-sse.service.ts          # SSE per-Space (rooms Map + broadcast)
    notifications/          # Notifikasi per-user (userId+userType), SSE broadcast per-user
    holidays/               # Hari libur nasional (HolidaysService, in-memory cache 24 jam per tahun, HOLIDAY_API_KEY)
    prisma/                 # PrismaService (singleton pool)
    shared/
      date-utils.ts         # startOfDay, endOfDay, DAY_MS ? dipakai contracts & cron
      file-validation.util.ts  # validateImageBuffer, validatePdfBuffer via magic bytes (file-type@16)
      simple-cache.util.ts  # SimpleCache<T> utility (TTL-based, tidak dipakai dashboard)
      dashboard-cache.service.ts  # DashboardCacheService ? cache invalidasi berbasis event
      shared.module.ts      # SharedModule ? export DashboardCacheService ke semua modul
      document-number.util.ts  # buildDocumentNumber ? auto-generate nomor {seq}/KK|SP/KUKP/SII/{romawi}/{tahun}
    main.ts                 # Static assets /uploads + dotenv/config
  prisma/
    schema.prisma           # Employee, Contract, WarningLetter, MasterAdmin, UserAccount, DocumentType, EmployeeDocument, dll
  assets/
    logo-sp.png             # Logo PT Sankyu untuk PDF surat peringatan
    contract-logo-pkwt.jpg  # Logo kop surat PKWT
    contract-logo-mitra.jpg # Logo kop surat MITRA
    uploads/
      photos/                 # Foto karyawan
      contracts/              # Hasil generate dokumen kontrak PDF
      contracts/scanned/      # Dokumen kontrak scan (upload manual)
      employee-docs/          # File dokumen sertifikasi & ijin karyawan
      warning-letters/        # File dokumen SP yang diupload (PDF/gambar)
      spaces/                 # Attachment card Space (file upload)
      documents/              # Gambar yang diupload di editor dokumen Space
      settings/               # Logo organisasi + gambar login
      profile-photos/         # Foto profil user (Admin & Pengelola)
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
- `cooperativeChairmanName` ? Nama Ketua Koperasi (dipakai di dokumen kontrak)
- `organizationName` ? Nama Organisasi (tampil di sidebar header, default: "Kokarsi PT. Sankyu")
- `appLogoUrl` ? Path logo organisasi (tampil di sidebar header, kosong = fallback huruf pertama)

### MasterAdmin
| Field | Type | Keterangan |
|-------|------|-----------|
| `id` | Int | Primary key |
| `employeeNo` | String | Unique, akun ADMIN |
| `fullName` | String | Nama lengkap |
| `password` | String | Hash bcrypt |
| `role` | Enum | ADMIN |
| `photoUrl` | String? | Path foto profil (uploads/profile-photos/) |
| `employee` | Relasi | FK via employeeNo |

### UserAccount
| Field | Type | Keterangan |
|-------|------|-----------|
| `id` | Int | Primary key |
| `name` | String | Nama lengkap |
| `nik` | String | Unique |
| `email` | String | Unique |
| `role` | Enum | ADMIN / PENGELOLA_KOPERASI |
| `username` | String | Unique |
| `password` | String | Hash bcrypt |
| `photoUrl` | String? | Path foto profil (uploads/profile-photos/) |

### Notification
| Field | Type | Keterangan |
|-------|------|-----------|
| `id` | Int | Primary key |
| `category` | Enum | KONTRAK_KARYAWAN / SERTIFIKASI_IJIN / KONTRAK_VENDOR / LEGAL_KOPERASI / AGENDA / SPACE |
| `severity` | Enum | WARNING / CRITICAL |
| `title` | String | Judul |
| `message` | String | Isi pesan |
| `sourceType` | String | Sumber + suffix userId (mis. `contract_12`, `agenda_morning_12`, `space_card_assign_12`) |
| `sourceId` | Int | ID record sumber |
| `triggerDay` | Int | H-berapa sebelum expired (0/-1 = catch-all) |
| `deeplink` | String | URL navigasi saat klik |
| `userId` | Int? | ID akun penerima (nullable utk data lama) |
| `userType` | String? | `master_admin` / `user_account` |
| `isRead` | Boolean | Status baca (per-user) |
| `readAt` | DateTime? | Waktu dibaca |
| `resolvedAt` | DateTime? | Waktu resolve (null = aktif) |
| `expiryDate` | Date | Tanggal expired sumber |
| `createdAt` | DateTime | Waktu dibuat |

**Unique:** `(sourceType, sourceId, triggerDay)` — sourceType menyertakan userId sehingga unik per penerima.

---

## API Endpoints

| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Data user login |
| POST | `/api/auth/profile/photo` | Upload foto profil (multipart field `photo`, max 2MB, image/*) |
| DELETE | `/api/auth/profile/photo` | Hapus foto profil |
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
| GET | `/api/contracts/:id/download-pdf` | Serve cached PDF kontrak, generate hanya jika belum ada |
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
| POST | `/api/warning-letters/:id/file` | Upload file dokumen SP (PDF/JPG/PNG/WEBP, max 10MB) |
| GET | `/api/contracts/preview-number?startDate=` | Preview nomor kontrak berdasarkan tanggal mulai |
| GET | `/api/warning-letters/preview-number?letterDate=` | Preview nomor SP berdasarkan tanggal surat |
| GET | `/api/warning-letters/escalation/:employeeId` | Status eskalasi SP per karyawan |
| GET | `/api/users` | List master user (admin only) |
| GET | `/api/users/pengurus` | List pengurus (semua role) |
| POST | `/api/users` | Tambah user internal |
| PUT | `/api/users/:id` | Edit user internal |
| DELETE | `/api/users/:id` | Hapus user internal |
| GET | `/api/settings/general` | Ambil pengaturan umum (semua role) |
| PUT | `/api/settings/general` | Simpan pengaturan umum (Admin only) |
| POST | `/api/settings/logo` | Upload logo organisasi (Admin only, max 512x512px 2MB, JPG/PNG/WEBP/SVG) |
| POST | `/api/settings/login-image/:side` | Upload gambar login (left/right, Admin only, max 5MB, JPG/PNG/WEBP) |
| GET | `/api/employees/dashboard-stats` | Dashboard stats (cache invalidasi berbasis event, TTL 5 menit fallback) |
| GET | `/api/search?q=...` | Global search karyawan + kontrak + SP (filter di database) |
| GET | `/api/notifications` | List notifikasi aktif (per-user: userId/userType dari cookie) |
| GET | `/api/notifications/count` | Jumlah notifikasi belum dibaca (per-user) |
| POST | `/api/notifications/read-all` | Tandai semua dibaca (per-user) |
| POST | `/api/notifications/:id/read` | Tandai satu notifikasi dibaca (per-user) |
| GET | `/api/notifications/stream` | SSE real-time count notifikasi (per-user, cookie auth) |
| POST | `/api/notifications/trigger` | Trigger generate notifikasi manual (testing) |
| GET | `/api/holidays` | Hari libur nasional Indonesia (proxy ke backend HolidaysService, filter Public + National Holiday, fail-silent, cache 24 jam per tahun) |
| GET | `/api/employees/import-template` | Download template Excel import karyawan (dengan dropdown validasi data master) |
| POST | `/api/employees/bulk-import` | Import karyawan bulk (all-or-nothing transaction, auto-reject duplikat) |
| GET | `/api/lookups/*` | CRUD lookup data (termasuk document-types) |
| GET | `/api/lookups/document-types` | List tipe dokumen |
| POST | `/api/lookups/document-types` | Tambah tipe dokumen (Admin only) |
| PUT | `/api/lookups/document-types/:id` | Edit tipe dokumen (Admin only) |
| DELETE | `/api/lookups/document-types/:id` | Hapus tipe dokumen (Admin only) |
| GET | `/api/employee-documents` | List dokumen karyawan (pagination, search, status, employeeId filter) |
| POST | `/api/employee-documents` | Tambah dokumen karyawan |
| GET | `/api/employee-documents/:id` | Detail dokumen karyawan |
| PUT | `/api/employee-documents/:id` | Edit dokumen karyawan |
| DELETE | `/api/employee-documents/:id` | Hapus dokumen karyawan |
| POST | `/api/employee-documents/:id/file` | Upload file dokumen (PDF/JPG/PNG/WEBP, max 10MB) |
| GET | `/uploads/photos/:filename` | Serve foto statis |
| GET | `/uploads/contracts/**` | Serve PDF kontrak statis |
| GET | `/uploads/settings/:filename` | Serve logo organisasi statis |
| GET | `/uploads/employee-docs/:filename` | Serve file sertifikasi & ijin statis |
| GET | `/api/calendar?start=&end=` | List item kalender (agenda + kontrak/dokumen/vendor/legal yang berakhir dalam range) |
| POST | `/api/calendar` | Tambah agenda baru (startTime wajib, assignedUserIds opsional) |
| PUT | `/api/calendar/:id` | Edit agenda (reset notifikasi sent flags) |
| DELETE | `/api/calendar/:id` | Hapus agenda |
| GET | `/api/spaces` | List spaces milik user + member |
| POST | `/api/spaces` | Buat Space baru (dengan template kolom) |
| GET | `/api/spaces/:id` | Detail Space + kolom + cards |
| PUT | `/api/spaces/:id` | Update Space |
| DELETE | `/api/spaces/:id` | Hapus Space (cascade) |
| POST | `/api/spaces/:id/members` | Tambah member |
| DELETE | `/api/spaces/:id/members/:userId` | Hapus member |
| POST | `/api/spaces/:id/columns` | Tambah kolom |
| PUT | `/api/spaces/:id/columns/:colId` | Update kolom |
| DELETE | `/api/spaces/:id/columns/:colId` | Hapus kolom |
| POST | `/api/spaces/:id/columns/reorder` | Reorder kolom |
| POST | `/api/spaces/:id/columns/:colId/cards` | Buat card |
| GET | `/api/spaces/:id/cards/:cardId` | Detail card + checklist + attachment + komentar |
| PUT | `/api/spaces/:id/cards/:cardId` | Update card |
| DELETE | `/api/spaces/:id/cards/:cardId` | Hapus card |
| POST | `/api/spaces/:id/cards/:cardId/move` | Pindah card ke kolom lain |
| POST | `/api/spaces/:id/cards/:cardId/checklists` | Tambah checklist item |
| PATCH | `/api/spaces/:id/cards/:cardId/checklists/:itemId` | Toggle checklist |
| DELETE | `/api/spaces/:id/cards/:cardId/checklists/:itemId` | Hapus checklist |
| POST | `/api/spaces/:id/cards/:cardId/attachments` | Upload file / tambah link |
| DELETE | `/api/spaces/:id/cards/:cardId/attachments/:attId` | Hapus attachment |
| POST | `/api/spaces/:id/cards/:cardId/comments` | Tambah komentar |
| PUT | `/api/spaces/:id/cards/:cardId/comments/:cmtId` | Edit komentar |
| DELETE | `/api/spaces/:id/cards/:cardId/comments/:cmtId` | Hapus komentar |
| GET | `/api/spaces/:id/stream` | SSE stream per-Space (jwt-cookie) |
| GET | `/api/spaces/:id/announcements` | List pengumuman |
| POST | `/api/spaces/:id/announcements` | Buat pengumuman |
| PUT | `/api/spaces/:id/announcements/:annId` | Update pengumuman |
| DELETE | `/api/spaces/:id/announcements/:annId` | Hapus pengumuman |
| GET | `/api/spaces/:id/documents` | List dokumen (tanpa content) |
| POST | `/api/spaces/:id/documents` | Buat dokumen baru |
| GET | `/api/spaces/:id/documents/:docId` | Detail dokumen (dengan content) |
| PUT | `/api/spaces/:id/documents/:docId` | Update dokumen (auto-save) |
| DELETE | `/api/spaces/:id/documents/:docId` | Hapus dokumen |
| POST | `/api/spaces/:id/documents/upload-image` | Upload gambar editor (multipart field `image`, max 5MB, image/*, disimpan backend `uploads/documents/`, serve via `/uploads/**` proxy) |
| GET | `/uploads/documents/:filename` | Serve gambar dokumen (statis dari public/uploads) |

---

## Export Data

- **Excel**: `xlsx` library - semua data + 25 kolom termasuk NIK, Tempat Lahir, Alamat, Departement -> `.xlsx`
- **PDF**: `jspdf` + `jspdf-autotable` - landscape A4 -> `.pdf`
- **Kolom export Excel**: No. Induk, Nama, NIK, Status, Gender, Tempat Lahir, Tgl. Lahir, Alamat, Tgl. Gabung, Email, HP, Pendidikan, Lokasi, Jabatan, Level, Departement, Status Pajak, No. Kontrak Aktif, Tgl. Mulai/Selesai Kontrak, Status Kontrak, Foto, Dibuat, Diperbarui

---


---

## Deployment Production

**Target**: https://kokarsi-sankyu.web.id
**Stack tambahan**: Cloudflare Tunnel (cloudflared)

## Arsitektur
```
Internet ? Cloudflare ? Tunnel ? Windows Machine
                                      |
  kokarsi-sankyu.web.id               |
  +- /uploads/* ? :3001 (backend)     | Static files (foto, dokumen)
  +- /*         ? :3000               | Nuxt SSR
                   +- /api/* ? :3001  | Server-side proxy (Nitro)
                   +- /uploads/* ? :3001 | Proxy Nuxt (routeRules)
```

### File Deployment
| File | Keterangan |
|------|-----------|
| deploy/start.ps1 | Startup script ? jalankan 4 service sekaligus |
| ~/.cloudflared/config.yml | Tunnel config (Tunnel ID: 483d9bfc-f094-4d30-a344-9c3019120a13) |
| ~/.cloudflared/cert.pem | Certificate Cloudflare |
| ~/.cloudflared/483d9bfc-...json | Tunnel credentials |
| docker-compose.db.yml | PostgreSQL container |

### Konfigurasi nuxt.config.ts
```
routeRules: {
  '/api/**': {
    cors: {
      origin: process.env.NUXT_ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }
  },
  // '/uploads/documents/**' dilayani dari public/uploads (lokal, gambar editor dokumen)
  '/uploads/**': { proxy: 'http://localhost:3001/uploads/**' }  // upload lain -> backend
}
```
CORS tidak lagi wildcard ? gunakan env `NUXT_ALLOWED_ORIGINS` untuk production (contoh: `https://kokarsi-sankyu.web.id`).

### PM2 Process Manager
Backend dan frontend production dijalankan via PM2 (bukan `Start-Process` langsung):
- Config: `ecosystem.config.cjs` di root project
- Env frontend di-inject dari `.env` root via `env_file`
- Auto-restart jika crash (max 10 restarts, delay 3s)
- Log: `logs/frontend-out.log`, `logs/backend-err.log`, dll

```powershell
pm2 list                    # status proses
pm2 logs kokarsi-frontend   # logs frontend
pm2 restart kokarsi-backend # restart backend setelah compile
pm2 startup && pm2 save     # auto-start saat Windows boot
```

### Email Notifikasi (Maileroo)
Cron job berjalan setiap hari **jam 00:01 WIB** ? update status kontrak + kirim email ke semua user.
- Service: ackend/src/contract-cron/contract-cron.service.ts
- Config: MAILEROO_API_KEY, MAILEROO_FROM_EMAIL, MAILEROO_FROM_NAME di ackend/.env
- Email dikirim ke semua UserAccount yang terdaftar di sistem

### Hari Libur Nasional (api.co.id)
Data hari libur diambil otomatis dari `api.co.id` setiap tahun baru di-cache:
- Service: `backend/src/holidays/holidays.service.ts`
- Config: `HOLIDAY_API_KEY=` di `backend/.env` (wajib diisi, lihat `.env.example`)
- Cache: in-memory, TTL 24 jam per tahun; refetch otomatis jika expired
- Fail-silent: jika `HOLIDAY_API_KEY` tidak diset, kalender tetap tampil normal tanpa data libur
- Endpoint: `GET /api/holidays?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Data otomatis update per tahun (tidak perlu perubahan kode)
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
| Template Excel dropdown tidak muncul | Template dihasilkan oleh backend (Node.js), bukan frontend ? generate ulang via backend endpoint `/api/employees/import-template` |
| Logo sidebar tidak tampil | Logo menggunakan **relative path** (bukan prefix localhost:3001). Pastikan proxy /uploads/** di 
uxt.config.ts sudah aktif dan Nuxt sudah di-build ulang |
| Email profil akun kosong | `MasterAdmin` tidak punya field email. Hanya `user_account` (Pengelola) yang punya email. Perlu logout + login ulang setelah update auth.service.ts |
| Kontrak PHK/RESIGN masih bisa buat kontrak baru | Guard `checkTerminationLockout()` di `contracts.service.ts`, frontend juga fetch `employmentStatus` di AddContractModal |
| Edit kontrak dengan scan dokumen selalu error 400 | State Lock compare string vs Date object ? sekarang sudah difix dengan normalisasi ke ISO string sebelum compare |
| Unduh dokumen kontrak scan 404 | Gunakan path relatif `documentUrl` ? sudah di-proxy Nuxt via /uploads/** ? http://localhost:3001/uploads/**. Jangan pakai prefix http://localhost:3001 di frontend |
| Download/preview PDF kontrak error 400 "File PDF tidak ditemukan" | Bug: path `uploads/uploads/...` duplikat karena `resolve(uploadRoot, target)` padahal target sudah `/uploads/...`. Fix: gunakan `resolve(process.cwd(), target)` di `contracts.controller.ts:downloadPdf` |
| Upload foto karyawan error 500 "Expected Uint8Array or Buffer" | Bug: `file.buffer` undefined karena diskStorage. Fix: baca file dari disk via `readFileSync(file.path)` sebelum validasi magic bytes |
| Upload foto/logo error "Cannot POST /api/api/employees/.../photo" | Bug: double `/api` di Nitro proxy routes. Cek `server/api/employees/[id]/photo.post.ts` ? path tidak boleh duplikat BACKEND yang sudah berisi `/api` |
| Frontend error "ENOENT: no such file .../app/server/utils/backend" | Jangan `import { BACKEND } from '~/server/utils/backend'` di Nitro routes ? alias `~` menunjuk ke `app/`. Nitro auto-import semua exports dari `server/utils/backend.ts` tanpa perlu import eksplisit |
| Hapus karyawan error 500 FK violation `employee_status_history_employeeId_fkey` | Bug: `remove()` tidak hapus `employeeStatusHistory` + `employeeOffboarding` sebelum delete. Fix: gunakan transaksi `deleteMany` keduanya dulu |
| Buat kontrak error 500 "UniqueConstraintViolation on contractNo" | Nomor kontrak sudah ada di database. Gunakan nomor kontrak yang berbeda. Backend sudah mengembalikan pesan ramah P2002 |
| Dashboard chart SP tidak update setelah tambah SP baru | Cache dashboard TTL 5 menit. Cache di-invalidate otomatis saat mutasi data (create/update/delete SP/kontrak/karyawan). Jika masih stale, tunggu 5 menit atau restart backend |
| Backend start error "JWT_SECRET environment variable is required" | `backend/.env` tidak ada atau `JWT_SECRET` tidak diset. Copy dari `backend/.env.example` dan isi nilai yang diperlukan |
| Buat kontrak karyawan baru error 403 Forbidden | Status karyawan di DB `RESIGN`/`PHK` tapi tidak ada `EmployeeOffboarding` record (data stale). `checkTerminationLockout()` sekarang auto-reset status ke `KONTRAK_EXPIRED` jika tidak ada offboarding record |
| Perpanjang kontrak error "UniqueConstraintViolation on contractNo" | Nomor kontrak perpanjangan sama dengan kontrak yang sudah ada. Gunakan nomor kontrak yang berbeda ? backend mengembalikan pesan ramah |
| Hapus karyawan error FK violation `employee_documents_employeeId_fkey` | Bug: `remove()` tidak hapus `employeeDocument` sebelum delete. Fix: tambah `tx.employeeDocument.deleteMany()` di transaksi hapus karyawan |
| Section Sertifikasi & Ijin di detail karyawan tampil data semua karyawan | Bug: Nitro proxy `server/api/employee-documents/index.ts` tidak meneruskan query param `employeeId` ke backend. Fix: tambah `if (query.employeeId) params.set('employeeId', ...)` |
| Form Perpanjang Legal Koperasi ? field Nama Dokumen bisa diubah | Bug: `FormModal.vue` mode `renew` tidak mengunci field `documentName`. Fix: gunakan `v-if="isRenewMode"` untuk render div read-only, `v-else` untuk `UInput` biasa |
| Email notifikasi cron tidak terkirim untuk dokumen yang kadaluarsa hari ini | Bug: query `expiringSoon` menggunakan `now` (termasuk jam/menit) bukan `startOfDay(now)`. Fix: ganti ke `todayStart = startOfDay(now)` di `contract-cron.service.ts` |
| Email notifikasi gagal batch jika ada UserAccount dengan email null/kosong | Bug: `findMany` tidak filter email null sebelum dikirim ke Maileroo API. Fix: tambah `.filter(u => u.email && u.email.trim() !== '')` di semua 4 fungsi `sendXxxNotification` di `maileroo.service.ts` |
| Maileroo menolak pengirim `noreply@localhost` (default fallback) | Bug: `MAILEROO_FROM_EMAIL` dan `MAILEROO_FROM_NAME` tidak ada di `.env.example` sehingga developer tidak tahu harus set env var ini. Fix: tambahkan ke `backend/.env.example` dengan nilai contoh |
| Bell icon notifikasi tidak bisa dibuka (TypeError: notifications.filter is not a function) | Bug: `notifications.service.ts findAll()` mengembalikan `{ notifications, unreadCount }` object tapi composable `useNotifications.ts` mengexpect array `AppNotification[]` langsung. Fix: ubah `findAll()` agar kembalikan array langsung via `this.prisma.notification.findMany(...)` tanpa wrapper object |
| Dokumen AKAN_EXPIRED tidak muncul di notifikasi bell | Bug: `generateNotifications()` hanya scan dokumen yang `expiryDate` tepat jatuh di H-90/60/30/7/0. Dokumen yang status-nya sudah diubah ke `AKAN_EXPIRED` oleh cron tetapi tanggalnya tidak tepat di trigger point tidak terdeteksi. Fix: tambah catch-all pass yang scan berdasarkan status (`AKAN_EXPIRED`, `AKAN_HABIS`, `AKAN_BERAKHIR`) dengan `triggerDay = -1` sebagai sentinel |
| Pencarian global tidak menemukan Sertifikasi & Ijin / Kontrak Vendor / Legal Koperasi | Bug: `server/api/search.get.ts` hanya fan-out ke 3 endpoint (employees, contracts, warning-letters). Fix: perluas ke 6 endpoint + tambah 3 group baru di `fetchGroups()` di `default.vue` dengan deep-link `?openId=` untuk auto-buka drawer detail |
| Notifikasi kontrak tidak muncul setelah edit tanggal (catch-all query by DB status) | Bug: catch-all pass di `generateNotifications()` query `WHERE status = 'AKAN_HABIS'` tapi DB status belum di-update (cron jalan sekali sehari). Fix: ubah query berdasarkan `endDate` dalam 90 hari ke depan ? tidak bergantung DB status |
| Notifikasi kontrak pesan "X hari lagi" tidak update saat tanggal diubah lagi | Bug: `@@unique([sourceType, sourceId, triggerDay=-1])` menyebabkan P2002 di-skip, notifikasi lama tidak diupdate. Fix: ganti `create` dengan `upsert` di catch-all pass |
| Edit kontrak error "Bad Request" tanpa detail pesan | Bug: Nitro proxy `server/api/contracts/[id].ts` menggunakan `statusMessage: res.statusText` ("Bad Request") bukan pesan custom dari NestJS body. Fix: ekstrak `(res._data as any)?.message` dan letakkan di `data.message` agar `e?.data?.message` di frontend bisa membaca pesan yang benar |
| Klik notifikasi KONTRAK_KARYAWAN mengarah ke halaman list kontrak bukan karyawan spesifik | Bug: deeplink disimpan sebagai `/kontrak?status=AKAN_HABIS`. Fix: ubah deeplink ke `/karyawan/${c.employee.id}` dengan tambah `id: true` ke employee select di `generateNotifications()` |
| Akte Dokumen create error P2022 "column nomorAkte does not exist" | Bug: migration SQL menggunakan camelCase column names tanpa quotes ï¿½ PostgreSQL lowercased jadi `nomorakte`. Fix: tambah `@map()` di schema (e.g. `nomorAkte @map("nomor_akte")`), drop dan recreate tabel dengan snake_case columns |
| Edit Akte Dokumen tidak populate data existing | Bug: `watch(() => props.open, ...)` tidak menyertakan `{ immediate: true }` ï¿½ saat komponen di-mount dengan `open = true` (via `v-if="editTarget"`), watcher tidak trigger. Fix: tambah `{ immediate: true }` ke watch options |
| Pagination Akte Dokumen mepet dengan table (tidak konsisten dengan halaman lain) | Bug: container pagination menggunakan `mt-4 px-1` tanpa border separator, dan `UTable` tidak memakai `:ui` styling. Fix: ganti ke `border-t border-default pt-4 mt-auto`, tambah `:ui` prop ke `UTable`, pakai `:loading` bawaan UTable, ganti `:page` ? `:default-page` di UPagination |
| VitePress GitHub Pages CI/CD gagal ï¿½ pnpm esbuild build scripts diblokir | Bug: `pnpm@11.10.0` memblokir esbuild build scripts secara global. Fix: ganti ke `npm install` + `npx vitepress build` di workflow agar tidak terpengaruh pnpm workspace/build-scripts policy |
| Halaman dokumentasi 404 di `https://rifkyawalulhuda.github.io/aplikasi-karyawan-kokarsi/` | Bug: VitePress mencari `index.md` di root `documentation/` tapi konten ada di `documentation/id/`. Fix: tambah `srcDir: 'id'` di `config.ts` dan hapus semua prefix `/id/` dari nav/sidebar links |
| Header dokumentasi menampilkan dua "Kokarsi" ï¿½ broken image alt + siteTitle | Bug: `logo: { alt: 'Kokarsi' }` file tidak ada ? broken image menampilkan alt text + `siteTitle: 'Kokarsi Docs'`. Fix: hapus `logo` property, ubah `siteTitle` ke `'Kokarsi'` |
| File upload user ter-track di git repo | Bug: `backend/uploads/` tidak ada di `.gitignore` sehingga PDF/gambar user ter-commit ke repo. Fix: tambah `backend/uploads/` ke `.gitignore`, untrack semua file via `git rm -r --cached backend/uploads/`, buat `.gitkeep` di setiap subfolder |
| File fisik tidak terhapus saat data dihapus dari sistem | Bug: semua service `remove()` hanya delete DB record tanpa hapus file fisik di `uploads/`. Fix: (A) tambah `deleteUploadedFile()` di setiap `remove()` method via shared utility `file-cleanup.util.ts`; (B) tambah cron `cleanupOrphanedFiles()` setiap jam 02:00 WIB yang scan disk vs DB dan hapus orphaned files |
| Log cron notifikasi spam di backend setiap 5 menit | Bug: `refreshNotifications()` dan intermediate step logs di `syncContractStatuses()` terlalu verbose. Fix: hapus `logger.debug` dari `refreshNotifications()`, downgrade step headers ke `logger.debug`, notifikasi result hanya log jika `created > 0 || resolved > 0` |
| Kalender 401 Unauthorized saat SSR | `$fetch` di `loadItems`/`saveEvent`/`removeEvent` tidak meneruskan cookie saat SSR ï¿½ ganti dengan `useRequestFetch()` yang sudah di-inisialisasi di script setup |
| Form Tambah/Edit Agenda tumpang tindih dengan modal detail | `openCreate()` dan `openEdit()` tidak menutup modal detail sebelum membuka form ï¿½ fix: set `selectedDate.value = null` di kedua fungsi sebelum `formOpen.value = true` |
| Baris terakhir kalender terpotong di bulan yang berakhir Minggu | `rangeEnd` formula `(7 - date.getDay()) % 7` menghasilkan 0 jika hari = Minggu ï¿½ fix: `day === 0 ? 7 : (7 - day)` |
| Pengaturan jam notifikasi agenda selalu kembali ke jam 7 | `UpdateGeneralSettingsDto` tidak punya field `agendaNotificationMorningHour` ï¿½ NestJS ValidationPipe men-strip field yang tidak terdaftar sebelum sampai ke service |
| `CalendarService.overlaps()` membingungkan | Method memiliki 4 parameter tapi hanya menggunakan 2 (`rangeStart`, `rangeEnd`) ï¿½ hapus 2 parameter tidak terpakai (`startDate`, `endDate`) |
| Space: drag & drop card tidak berfungsi | HTML5 DnD membutuhkan `e.dataTransfer.setData()` di `dragstart` agar `drop` event bisa fire. Arsitektur slot-based (drag handler di dalam slot KanbanColumn) memblokir event propagation ï¿½ fix: render card langsung di KanbanBoard, kolom sebagai drop target langsung |
| Space: TiptapEditor hydration mismatch | Tiptap adalah browser-only library (`useEditor` tidak bisa jalan di SSR) ï¿½ fix: rename `TiptapEditor.vue` ? `TiptapEditor.client.vue` agar Nuxt skip SSR rendering |
| Space: Document editor blank setelah navigasi | `router.push('/spaces/:id/docs/:docId')` konflik dengan Nuxt 4 nested routing (`[id].vue` + `[id]/docs/[docId].vue`) ï¿½ fix: gunakan inline modal editor di `SpaceDocsView.vue`, hapus standalone page files |
| Space: AddMember error 500 "Prisma Int[] push undefined" | `AddMemberDto` tidak punya `@IsInt()/@Type(() => Number)` validator, `memberId` tiba sebagai string ï¿½ fix: tambah validator + build array baru daripada `{ push: value }` |
| Space: Announcement dropdown tidak muncul | CSS `hidden group-hover:flex` tidak bekerja karena parent tidak punya class `group` dan scoped CSS terbatas ï¿½ fix: hapus class `hidden`, dropdown trigger selalu visible |
| Space: Document loading forever setelah click | `await useFetch` di top-level page memblokir SSR navigation ï¿½ fix: hapus `await`, tambah loading/error state di template |
| Space: Semua route Space 404 setelah restart backend | Backend perlu di-restart setelah `SpaceAnnouncementsController` dan `SpaceDocumentsController` ditambahkan ke `SpacesModule` |
| `SpacesTiptapEditorClient` tidak dikenali sebagai component | Nuxt 4 strip `.client` suffix dari nama auto-import ï¿½ `TiptapEditor.client.vue` ? `SpacesTiptapEditor`, bukan `SpacesTiptapEditorClient` |
| Space: Tombol Expand modal tidak membuka halaman full-page | Route `/spaces/:id/docs/:docId` nested tidak bisa tampil karena parent `[id].vue` tidak render `<NuxtPage />`. Fix: pakai route flat `/spaces/[id]-docs-[docId].vue` |
| Space: Upload gambar editor 404 "Cannot POST .../upload-image" | Endpoint backend `/spaces/:id/documents/upload-image` harus ada di `space-documents.controller.ts`; Nitro proxy `upload-image.post.ts` memakai `proxyRequest` ke backend. Pastikan backend di-compile & restart |
| Space: Gambar dokumen tidak tampil di production | Jangan simpan di `public/uploads/documents/` (Nuxt prod hanya serve snapshot `.output/public/`). Simpan di backend `uploads/documents/` via endpoint `upload-image`, akses via proxy `/uploads/**` |
| Space: Upload gambar gagal "field image tidak ditemukan" | Pastikan `FormData` memakai nama field `image`, bukan nama lain |
| Foto profil tidak tampil setelah upload | Backend harus di-compile (`npx tsc`) + di-restart; upload via Nitro proxy `auth/profile/photo.post.ts` yang memakai `proxyRequest` (jangan `readBody` yang memecah binary) |
| Foto profil upload 401/403 | Pastikan pengguna sudah login (cookie `auth_token` ada); endpoint `POST /api/auth/profile/photo` memakai guard `jwt` |
| Foto profil piranti yang sudah login tidak berubah | Cookie `auth_admin` diupdate via `auth.setPhotoUrl()` di frontend; jika masih lama, logout + login ulang |
| Notifikasi agenda/space hanya sampai 1 user | SourceType harus menyertakan userId (`agenda_morning_${userId}`, `space_card_assign_${userId}`) agar UNIQUE `(sourceType, sourceId, triggerDay)` tidak bentrok antar penerima |
| Notifikasi expiry tidak per-user (semua user lihat sama) | Kolom `userId`+`userType` di `Notification` (nullable); `generateNotifications()` membuat salinan per akun aktif (master_admin + user_account) |
| Notifikasi tidak muncul di salah satu akun | Pastikan backend di-compile + restart, dan frontend mengirim `userId/userType` (dari `auth.admin.id` + `accountType`) di query `GET /notifications` |
| Hari libur tidak tampil di kalender | Set `HOLIDAY_API_KEY=` di `backend/.env` lalu restart backend; tanpa API key fitur fail-silent (kalender tetap normal) |
| Hari libur 2027+ tidak ada | Data bergantung ketersediaan dari `api.co.id` — data tahun depan biasanya tersedia setelah pemerintah mengumumkan SKB Cuti Bersama; cache per-tahun refetch otomatis setiap 24 jam |
| Kalender: agenda bertumpuk saling menutupi | Fix sudah diimplementasikan (`timedLayoutFor` dengan algoritma cluster+greedy); jika masih overlap, pastikan file `kalender/index.vue` sudah di-build terbaru |






