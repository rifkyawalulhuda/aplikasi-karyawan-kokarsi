# Database Schema

## Overview Tabel

Aplikasi menggunakan PostgreSQL dengan Prisma ORM. Berikut tabel-tabel utama beserta relasinya.

## Tabel Karyawan

### `employees`
Data master karyawan.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `employeeNo` | VARCHAR | Nomor induk karyawan (unique) |
| `fullName` | VARCHAR | Nama lengkap |
| `nik` | VARCHAR | NIK KTP |
| `birthDate` | DATE | Tanggal lahir |
| `gender` | ENUM | MALE/FEMALE |
| `educationLevel` | ENUM | SMA/D3/S1/S2 |
| `joinDate` | DATE | Tanggal bergabung |
| `employmentStatus` | ENUM | AKTIF/KONTRAK_EXPIRED/RESIGN/PHK |
| `fotoKaryawan` | VARCHAR | Path foto |
| `workLocationId` | INT | FK ke `work_locations` |
| `jobRoleId` | INT | FK ke `job_roles` |
| `jobLevelId` | INT | FK ke `job_levels` |
| `departmentId` | INT | FK ke `departments` |
| `taxStatusId` | INT | FK ke `tax_statuses` |

## Tabel Kontrak

### `contracts`
Kontrak kerja karyawan.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `employeeId` | INT | FK ke `employees` |
| `contractNo` | VARCHAR | Nomor kontrak (unique) |
| `startDate` | DATE | Tanggal mulai |
| `endDate` | DATE | Tanggal berakhir |
| `status` | ENUM | AKTIF/AKAN_HABIS/EXPIRED/SELESAI/DIBATALKAN/DRAFT |
| `contractTypeId` | INT | FK ke `contract_types` |
| `templateId` | INT | FK ke `contract_templates` |
| `parentContractId` | INT | Self-reference untuk renewal chain |
| `documentUrl` | VARCHAR | Path dokumen ditandatangani |
| `generatedPdfUrl` | VARCHAR | Path PDF yang di-generate |

## Tabel Dokumen Karyawan

### `employee_documents` (Dok. Karyawan & Sertifikasi & Ijin)

Tabel yang dipakai bersama oleh modul Dok. Karyawan (PERSONAL) dan Sertifikasi & Ijin (CERTIFICATION). Pemisahan berdasarkan kategori `documentType`.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `employeeId` | INT | FK ke `employees` |
| `documentTypeId` | INT | FK ke `document_types` |
| `documentNumber` | VARCHAR | Nomor dokumen |
| `expiryDate` | DATE? | Tanggal kadaluarsa (nullable — opsional untuk KTP/NPWP/KK) |
| `status` | ENUM | AKTIF/AKAN_EXPIRED/EXPIRED |
| `fileUrl` | VARCHAR | Path file upload |
| `notes` | TEXT | Catatan |

### `warning_letters` (Surat Peringatan)

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `employeeId` | INT | FK ke `employees` |
| `letterNumber` | VARCHAR | Nomor surat (auto-generate) |
| `warningLevel` | INT | 1, 2, atau 3 |
| `violationType` | JSON | Array jenis pelanggaran |
| `letterDate` | DATE | Tanggal surat |
| `validUntil` | DATE | Berlaku sampai |
| `documentUrl` | VARCHAR | Path file SP |

## Tabel Dokumen Legal

### `vendor_contracts` (Kontrak Vendor/Customer)

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `companyId` | INT | FK ke `companies` |
| `category` | ENUM | CUSTOMER/VENDOR |
| `documentName` | VARCHAR | Nama dokumen |
| `documentNumber` | VARCHAR | Nomor dokumen |
| `documentType` | ENUM | DOKUMEN_KONTRAK/PERJANJIAN/dll |
| `status` | ENUM | AKTIF/AKAN_BERAKHIR/EXPIRED/TIDAK_AKTIF |
| `endDate` | DATE | Tanggal berakhir |
| `motherAgreementId` | INT | Self-reference untuk hierarki |
| `renewedFromId` | INT | FK kontrak yang diperpanjang |

### `legal_koperasi`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `category` | ENUM | IZIN/SERTIFIKAT/KEBIJAKAN/dll |
| `documentName` | VARCHAR | Nama dokumen |
| `documentNumber` | VARCHAR | Nomor dokumen |
| `publisher` | VARCHAR | Penerbit |
| `needsRenewal` | BOOL | Apakah butuh perpanjangan |
| `endDate` | DATE | Tanggal berakhir |
| `status` | ENUM | AKTIF/AKAN_BERAKHIR/EXPIRED/TIDAK_AKTIF |
| `renewedFromId` | INT | Self-reference (unique) untuk renewal |

### `akte_dokumen`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `tanggal` | DATE | Tanggal akte |
| `notaris` | VARCHAR | Nama notaris |
| `nomor_akte` | VARCHAR | Nomor akte |
| `judul_akte` | VARCHAR | Judul akte |
| `nomor_sk` | VARCHAR | Nomor SK (opsional) |
| `tanggal_sk` | DATE | Tanggal SK (opsional) |
| `keterangan` | TEXT | Catatan |
| `file_url` | VARCHAR | Path file |

## Tabel Notifikasi

### `notifications`

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | INT | Primary key |
| `category` | ENUM | KONTRAK_KARYAWAN/SERTIFIKASI_IJIN/KONTRAK_VENDOR/LEGAL_KOPERASI |
| `severity` | ENUM | WARNING/CRITICAL |
| `sourceType` | VARCHAR | Tipe sumber (contract, employee_document, dll) |
| `sourceId` | INT | ID record sumber |
| `triggerDay` | INT | Berapa hari sebelum expired (-1 = catch-all) |
| `deeplink` | VARCHAR | URL navigasi saat klik |
| `isRead` | BOOL | Status baca |
| `resolvedAt` | DATETIME | Waktu di-resolve (null = aktif) |
| `expiryDate` | DATE | Tanggal expired sumber |

**Unique constraint:** `(sourceType, sourceId, triggerDay)`

## Tabel Master Data

| Tabel | Keterangan |
|-------|-----------|
| `work_locations` | Lokasi kerja |
| `job_roles` | Jabatan |
| `job_levels` | Level jabatan |
| `departments` | Departemen |
| `tax_statuses` | Status pajak |
| `contract_types` | Tipe kontrak |
| `contract_templates` | Template dokumen kontrak |
| `document_types` | Tipe dokumen sertifikasi |
| `companies` | Perusahaan vendor/customer |
| `app_settings` | Pengaturan aplikasi |
| `user_accounts` | Akun pengguna (Pengelola Koperasi) |
| `master_admins` | Akun Master Admin (FK ke employees) |
