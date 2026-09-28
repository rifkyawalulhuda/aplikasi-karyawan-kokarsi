# Rencana Remediasi OWASP Top 10

Dokumen ini merangkum rencana perbaikan berdasarkan audit keamanan yang dilakukan pada sesi ini. Fokusnya adalah menutup risiko keamanan aplikasi secara bertahap tanpa menganggap perubahan kode sebagai bukti bahwa konfigurasi deployment dan database produksi sudah benar.

## Status Audit

### Temuan yang sudah diimplementasikan sebagian

- JWT memiliki `jti`, `tokenVersion`, dan masa berlaku 30 menit.
- Validasi session melakukan lookup akun ke database, memeriksa `isActive`, memeriksa `tokenVersion`, dan mengambil role terbaru dari database.
- Perubahan password meng-increment `tokenVersion` sehingga token lama tidak valid.
- Logout melakukan revoke session dengan menaikkan `tokenVersion`.
- Token tidak lagi dikembalikan ke browser pada response login Nuxt dan cookie tetap `HttpOnly`.
- Throttle login aktif kembali dengan batas 5 request per 60 detik.
- DTO login menolak identifier atau password kosong.
- `ValidationPipe` menggunakan `forbidNonWhitelisted: true`.
- Upload foto profil sudah memiliki validasi tipe file berbasis isi/magic bytes; cakupan semua endpoint upload masih harus diaudit.
- Activity log sudah tersedia pada sejumlah operasi perubahan data.

### Blocker operasional yang ditemukan

- Database aktif belum memiliki kolom `isActive` pada `master_admin` dan `user_accounts`. Akibatnya login dan validasi JWT gagal dengan Prisma `P2022`.
- Migration `20260928090000_add_auth_session_controls` sudah ada di repository, tetapi belum terbukti sudah diterapkan pada database yang dipakai backend.
- Dokumentasi deployment masih menyebut kredensial seed lama (`admin123` dan `pengelola123`), sedangkan seed sekarang membutuhkan `SEED_ADMIN_PASSWORD` dan `SEED_PENGELOLA_PASSWORD`.
- `backend/src/calendar/calendar.service.spec.ts` sebelumnya tidak mengikuti constructor `CalendarService` yang sudah membutuhkan `NotificationsService`, dan fixture kalender perlu menyertakan `startTime`. Perubahan test harus menjadi quality gate, bukan workaround untuk menutupi error runtime.
- Full test suite belum dapat dinyatakan lulus sampai test kalender diperbaiki dan seluruh suite dijalankan ulang.

### Di luar cakupan perubahan saat ini

- F-01: otorisasi role yang tidak konsisten pada endpoint mutasi belum dianggap selesai.
- MFA, refresh-token rotation, CSRF protection, security headers/CSP, dependency remediation, resource authorization menyeluruh, dan hardening SSE/upload belum tuntas.

## Prioritas Pemulihan Segera

Urutan ini harus dikerjakan sebelum menyatakan hardening auth siap digunakan pada environment bersama atau production.

### P0. Pulihkan database aktif

1. Pastikan `DATABASE_URL` backend menunjuk ke database yang benar dan bukan database lokal/fallback port yang keliru.
2. Hentikan backend atau keluarkan dari traffic selama perubahan schema.
3. Dari folder `backend`, jalankan:

   ```powershell
   npm install
   npx prisma generate
   npx prisma migrate deploy
   ```

4. Verifikasi kolom berikut benar-benar ada pada database aktif:
   - `master_admin.isActive`
   - `master_admin.tokenVersion`
   - `user_accounts.isActive`
   - `user_accounts.tokenVersion`
5. Jika migration history drift atau migration tidak dapat diterapkan, jangan langsung menjalankan `db push` pada production. Ambil backup, dokumentasikan drift, dan lakukan prosedur recovery yang disetujui.
6. Restart backend, lalu uji login, request terproteksi, logout, dan login ulang.

**Kriteria selesai:** tidak ada lagi error Prisma `P2022`; `npx prisma migrate status` menunjukkan database up to date; smoke test auth lulus.

### P0. Perbaiki quality gate test

1. Pastikan `CalendarService` di-instansiasi dengan mock `NotificationsService`.
2. Lengkapi fixture `calendarEvent` dengan `startTime` dan field yang dibutuhkan `normalizeAgenda`.
3. Jalankan test terarah:

   ```powershell
   cd backend
   npm test -- --runInBand src/calendar/calendar.service.spec.ts
   npm test -- --runInBand src/auth/auth.service.spec.ts
   ```

4. Jalankan full suite:

   ```powershell
   npm test -- --runInBand
   npm run build
   ```

**Kriteria selesai:** tidak ada error TypeScript pada test kalender, seluruh test backend lulus, dan build backend berhasil.

### P0. Sinkronkan dokumentasi deployment dan secret

1. Hapus semua contoh password nyata/lama dari dokumentasi deployment.
2. Dokumentasikan environment variable wajib:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SEED_ADMIN_PASSWORD`
   - `SEED_PENGELOLA_PASSWORD`
3. Tambahkan prosedur verifikasi migration sebelum seed dan sebelum service menerima traffic.
4. Pastikan secret hanya berasal dari secret manager atau environment deployment, bukan dari repository, log, seed output, atau screenshot.

**Kriteria selesai:** pencarian repository tidak menemukan `admin123`, `pengelola123`, atau password contoh yang dapat dipakai langsung; deployment checklist mencerminkan perilaku seed aktual.

## Pemetaan OWASP Top 10

## A01:2021 Broken Access Control

**Risiko:** beberapa endpoint mutasi dan resource nested masih perlu audit konsistensi role serta kepemilikan resource. F-01 secara eksplisit belum selesai.

**Rencana:**

- Inventaris semua controller mutasi: create, update, delete, upload, cancel, purge, dan endpoint file.
- Buat matriks akses berdasarkan `accountType`, `role`, dan ownership/resource membership.
- Pisahkan guard autentikasi dari authorization policy; jangan mengandalkan role dari payload JWT tanpa validasi session.
- Audit resource Space, card, checklist, comment, attachment, notification, SSE, dokumen, dan file download untuk IDOR.
- Validasi ownership atau membership di service sebelum setiap operasi by-id.
- Tambahkan test negatif untuk setiap role yang tidak boleh melakukan mutasi.

**Kriteria selesai:** setiap endpoint mutasi memiliki policy yang terdokumentasi, test unauthorized/forbidden tersedia, dan F-01 ditutup dengan bukti test endpoint.

## A02:2021 Cryptographic Failures

**Risiko:** konfigurasi secret, cookie, TLS, password seed, backup, dan data pribadi dapat menyebabkan kebocoran meskipun JWT sudah diperketat.

**Rencana:**

- Validasi `JWT_SECRET` minimum length dan tolak secret default/lemah saat startup production.
- Pastikan cookie auth memakai `HttpOnly`, `Secure` pada production, `SameSite=Strict`, path yang tepat, dan expiry konsisten 30 menit.
- Audit `DATABASE_URL`, backup PostgreSQL, upload, log, dan activity log agar tidak menyimpan password/token.
- Pastikan koneksi database production menggunakan TLS sesuai provider.
- Tetapkan kebijakan rotasi JWT secret dan prosedur invalidate semua token saat rotasi.
- Enkripsi backup dan batasi akses file backup.

**Kriteria selesai:** secret validation aktif, cookie attributes diverifikasi melalui browser/integration test, dan backup tidak dapat dibaca tanpa kredensial yang sesuai.

## A03:2021 Injection

**Risiko:** query Prisma relatif aman terhadap SQL injection, tetapi raw query, filter dinamis, file metadata, dan input yang diteruskan ke shell atau parser masih perlu verifikasi.

**Rencana:**

- Inventaris penggunaan `$queryRaw`, `$executeRaw`, `exec`, `spawn`, dan interpolasi query.
- Ganti raw SQL interpolasi dengan parameterized query.
- Terapkan DTO validation untuk pagination, sort, filter, date range, enum, ID, dan upload metadata.
- Batasi ukuran input string, jumlah array `assignedUserIds`, dan kedalaman/ukuran payload JSON.
- Tambahkan test payload injection untuk endpoint search, filter, export, dan upload.

**Kriteria selesai:** tidak ada raw query berisiko; input invalid menghasilkan `400`, bukan error database `500`; test injection lulus.

## A04:2021 Insecure Design

**Risiko:** session revocation sudah ditambahkan, tetapi desain authorization, upload, SSE, notification, dan deep-link belum seluruhnya memiliki threat model.

**Rencana:**

- Buat threat model singkat untuk auth, upload, Space, notification/SSE, dan dokumen.
- Tetapkan security invariants: akun nonaktif tidak boleh login, token lama tidak boleh diterima, user hanya melihat resource yang berhak, dan file private tidak boleh diakses tanpa auth.
- Definisikan fail-closed behavior untuk dependency/migration/configuration yang tidak tersedia.
- Tambahkan rate limit terpisah untuk login, password change, upload, dan endpoint mahal.
- Hindari fire-and-forget untuk operasi security-critical; error activity log boleh non-fatal, revoke session tidak boleh diabaikan.

**Kriteria selesai:** threat model direview, invariants memiliki test, dan endpoint kritis memiliki fallback fail-closed.

## A05:2021 Security Misconfiguration

**Risiko:** database aktif belum termigrasi, dokumentasi secret stale, dan konfigurasi headers/CORS/deployment belum tervalidasi end-to-end.

**Rencana:**

- Tambahkan startup check untuk `DATABASE_URL`, `JWT_SECRET`, dan environment production.
- Terapkan migration pada pipeline deployment dengan fail-fast sebelum aplikasi menerima traffic.
- Konfigurasi Helmet/security headers: CSP yang sesuai, `X-Content-Type-Options`, `Referrer-Policy`, frame protection, dan HSTS bila seluruh akses HTTPS.
- Batasi CORS ke origin yang diketahui; jangan gunakan wildcard bersama credentials.
- Pastikan error production tidak mengembalikan stack trace, SQL detail, path lokal, atau secret.
- Audit Docker, PM2, reverse proxy, upload directory, file permissions, dan exposed port.

**Kriteria selesai:** security header dan CORS diverifikasi dengan integration test, migration menjadi deployment gate, dan response error production tidak membocorkan detail internal.

## A06:2021 Vulnerable and Outdated Components

**Risiko:** dependency yang rentan atau tidak diperlukan dapat mengalahkan hardening aplikasi.

**Rencana:**

- Jalankan audit dependency backend dan frontend dari lockfile.
- Prioritaskan vulnerability runtime production dan dependency yang memproses file/PDF/image.
- Hapus dependency tidak terpakai dan update major version hanya melalui test/build terarah.
- Pin versi yang sudah diverifikasi dan aktifkan pemeriksaan berkala pada CI.

**Kriteria selesai:** tidak ada vulnerability critical/high yang belum memiliki keputusan risiko tertulis; build dan test tetap lulus setelah update.

## A07:2021 Identification and Authentication Failures

**Status:** mitigasi inti sudah ada, tetapi perlu deployment dan runtime verification.

**Rencana:**

- Terapkan migration auth controls pada database aktif.
- Uji login valid/invalid, akun nonaktif, token expired, token version lama, logout, dan password change.
- Verifikasi tidak ada JWT pada response browser, localStorage, sessionStorage, atau store client.
- Audit semua proxy Nitro agar token hanya dibaca server-side dan tidak diteruskan ke response/frontend.
- Tambahkan CSRF protection untuk cookie-authenticated state-changing requests.
- Rencanakan MFA untuk akun privileged dan refresh-token rotation bila session jangka panjang dibutuhkan.

**Kriteria selesai:** integration test auth lulus pada database migrasi baru dan browser inspection tidak menemukan token yang dapat diakses JavaScript.

## A08:2021 Software and Data Integrity Failures

**Risiko:** migration manual, migration drift, seed credential, dan dependency/build artifact dapat menghasilkan deployment tidak konsisten.

**Rencana:**

- Tetapkan migration policy: setiap schema change wajib memiliki migration reviewed dan diuji pada database kosong serta database upgrade.
- Tambahkan checksum/migration status verification pada deployment.
- Dilarang mengubah migration yang sudah applied; buat migration baru untuk koreksi.
- Verifikasi lockfile, package integrity, build artifact, dan source revision yang dideploy.
- Pisahkan seed development dari bootstrap production; seed production tidak boleh membuat password default.
- Dokumentasikan recovery untuk database drift sebelum memakai `db push`.

**Kriteria selesai:** deployment dapat direproduksi dari repository, migration drift terdeteksi sebelum release, dan seed production membutuhkan secret eksternal.

## A09:2021 Security Logging and Monitoring Failures

**Risiko:** activity log tersedia, tetapi error auth, revoke, upload, authorization denial, migration failure, dan anomaly login belum tentu memiliki event yang dapat ditindaklanjuti.

**Rencana:**

- Log event security tanpa password, JWT, cookie value, atau data pribadi berlebihan.
- Catat login sukses/gagal, logout, password change, account disable, authorization denial, upload reject, dan file access denial.
- Tambahkan correlation/request ID dan actor type/id yang sudah dimasking sesuai kebutuhan.
- Buat alert untuk login brute force, banyak `401/403`, error migration/schema, dan lonjakan upload reject.
- Tetapkan retention dan akses terbatas untuk activity/security log.
- Pastikan logging tidak mengubah operasi security-critical menjadi sukses palsu.

**Kriteria selesai:** event matrix tersedia, log dapat dicari berdasarkan request/actor/time, dan alert dasar diuji dengan simulated failure.

## A10:2021 Server-Side Request Forgery

**Risiko:** fitur email, URL file, integrasi eksternal, dan konfigurasi endpoint perlu dipastikan tidak menerima URL arbitrer dari user.

**Rencana:**

- Inventaris semua HTTP client dan input URL dari database, form, atau query string.
- Gunakan allowlist host/scheme untuk integrasi eksternal.
- Tolak `file://`, loopback, private IP, link-local, metadata IP cloud, redirect berantai, dan hostname yang resolve ke alamat terlarang.
- Batasi timeout, response size, redirect count, dan egress network service.
- Tambahkan test SSRF untuk IPv4/IPv6, DNS rebinding scenario, encoded host, dan redirect.

**Kriteria selesai:** tidak ada fetch arbitrary dari input user atau seluruh fetch memiliki validator/allowlist dan test SSRF.

## Tahapan Pelaksanaan

### Tahap 1: Recovery dan baseline

- Terapkan migration auth ke database yang benar.
- Perbaiki `calendar.service.spec.ts`.
- Perbarui dokumentasi deployment dan secret.
- Jalankan backend build, full test, typecheck frontend, dan `git diff --check`.
- Jalankan smoke test browser untuk login, proxy request, logout, dan password change.

### Tahap 2: Access control dan transport

- Tutup F-01 dan audit IDOR pada Space, notification/SSE, file, dan deep-link.
- Terapkan CSRF, CORS restriction, security headers, dan error sanitization.
- Tambahkan integration tests berbasis role dan ownership.

### Tahap 3: Input, file, dan dependency

- Audit injection dan SSRF.
- Selesaikan upload hardening: MIME/magic bytes, extension normalization, size limit, storage isolation, download authorization, dan SVG/PDF handling.
- Remediasi dependency berdasarkan severity dan exposure.

### Tahap 4: Operasional dan monitoring

- Lengkapi security event logging, alert, retention, backup encryption, dan recovery drill.
- Tambahkan CI security gates untuk dependency, secret scanning, migration status, build, test, dan typecheck.
- Lakukan retest OWASP setelah seluruh P0/P1 ditutup.

## Definition Of Done

- Migration schema yang diperlukan sudah applied pada database target dan diverifikasi secara langsung.
- Full backend test, backend build, dan frontend typecheck lulus.
- Semua endpoint mutasi memiliki authorization test positif dan negatif.
- Auth cookie, CSRF, CORS, dan security headers diverifikasi melalui request/runtime test.
- Tidak ada secret atau token pada source, log, response browser, dan documentation.
- Temuan OWASP memiliki status `closed`, `accepted risk`, atau `deferred` dengan alasan dan owner yang jelas.
- Retest dilakukan pada environment yang menyerupai production, bukan hanya melalui unit test/mock.

## Perintah Verifikasi Baseline

```powershell
cd backend
npx prisma migrate status
npm test -- --runInBand
npm run build
cd ..
pnpm typecheck
git diff --check
```

Smoke test minimum setelah database migration:

1. Login dengan credential dari environment, bukan credential hardcoded.
2. Akses endpoint terproteksi menggunakan cookie.
3. Logout dan pastikan token/session sebelumnya ditolak.
4. Ubah password dan pastikan token lama ditolak.
5. Nonaktifkan akun uji dan pastikan login serta request aktif ditolak.
6. Verifikasi response login tidak mengandung `access_token` untuk browser client.
