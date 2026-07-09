# PRD - Aplikasi Manajemen Data Karyawan  
**Koperasi Karyawan PT. Sankyu**

**Versi Dokumen**: 1.4 (Revisi)  
**Tanggal**: 9 Juli 2026  
**Penulis**: AnNahl Web Media  
**Status**: Draft untuk Review

---

## 1. Executive Summary

Aplikasi web **Manajemen Data Karyawan Koperasi Karyawan PT. Sankyu** adalah sistem HR internal yang dibuat **khusus untuk Koperasi Karyawan PT. Sankyu**.

Sistem ini akan mengelola seluruh data master karyawan secara terpusat, termasuk manajemen dokumen kontrak, status kepegawaian otomatis, proses offboarding, pelacakan masa berlaku kontrak, dan upload foto karyawan.

**Tujuan Utama**:
- Menggantikan proses manual (Excel) menjadi sistem digital yang terintegrasi
- Meningkatkan akurasi data dan kepatuhan ketenagakerjaan
- Memberikan visibilitas real-time kepada **Admin** dan **Pengelola Koperasi** terhadap status dan masa berlaku kontrak seluruh karyawan

**Target MVP**: 3–4 bulan pertama

---

## 2. Product Vision & Goals

### Vision
Menjadi sistem manajemen data karyawan internal yang andal dan mudah digunakan **khusus untuk Koperasi Karyawan PT. Sankyu**.

### Goals
- **GOAL-01**: 100% data karyawan PT. Sankyu tercatat secara digital dalam 1 sistem
- **GOAL-02**: Mengurangi waktu pencarian & pengelolaan data karyawan dari jam menjadi < 30 detik
- **GOAL-03**: Memberikan notifikasi otomatis 30 hari & 7 hari sebelum kontrak habis
- **GOAL-04**: Dashboard ringkasan lengkap yang dapat diakses oleh **Admin** dan **Pengelola Koperasi**

---

## 3. Target Users

| Peran           | Deskripsi                                      | Kebutuhan Utama                                      |
|-----------------|------------------------------------------------|------------------------------------------------------|
| **Master Admin**| Peran penuh yang mengelola seluruh sistem | CRUD karyawan, upload dokumen kontrak & foto, update status, monitoring kontrak, dashboard, master data, user internal |
| **Pengelola Koperasi**| Peran operasional untuk data karyawan dan kontrak | CRUD karyawan, monitoring kontrak, dashboard, tanpa akses master data dan user internal |

> **Catatan Penting**:  
> Saat ini ada dua peran internal: **Master Admin** dan **Pengelola Koperasi**.  
> Tidak ada portal karyawan (self-service) dan tidak ada akses untuk Owner / Manajemen di fase MVP.

---

## 4. Key Features (MVP Scope)

### 4.1 Master Data Karyawan
- CRUD lengkap data karyawan sesuai skema database revisi
- Field wajib: `employeeNo`, `fullName`, `birthDate`, `gender`, `joinDate`, `email`, `phoneNumber`, `fotoKaryawan`
- Dropdown lookup untuk: `workLocation`, `jobRole`, `jobLevel`, `taxStatus`, `educationLevel`
- Upload foto karyawan (Picture Upload)
- `employmentStatus` tidak diinput manual; dihitung otomatis menjadi `AKTIF`, `KONTRAK_EXPIRED`, `RESIGN`, atau `PHK`

### 4.2 Manajemen Kontrak Karyawan
- Tambah kontrak baru untuk karyawan
- Upload dokumen kontrak (PDF, max 10MB)
- Field kontrak: `contractNo`, `startDate`, `endDate`, `contractType`
- Status kontrak dihitung otomatis dari status karyawan + `endDate`:
  - `AKTIF` jika sisa > 30 hari
  - `AKAN_HABIS` jika sisa <= 30 hari
  - `EXPIRED` jika tanggal sudah lewat
  - `SELESAI` jika karyawan sudah offboarding (`RESIGN` / `PHK`)
- `DIBATALKAN` jika kontrak dibatalkan manual
- Riwayat kontrak per karyawan (history) tersedia dalam mode read-only dari halaman Data Karyawan dan halaman Kontrak
- Notifikasi otomatis kontrak akan habis (30 hari & 7 hari sebelumnya)
- Tersedia **master template kontrak** untuk keluarga `PKWT` dan `MITRA`
- Sistem dapat melakukan **preview dokumen kontrak** sebelum unduh/generate final
- Sistem dapat menghasilkan **PDF native** langsung dari kode (pdfkit), tanpa template DOCX atau LibreOffice
- Sample legal asli (`.doc`) hanya digunakan sebagai referensi visual untuk layout PDF, tidak lagi sebagai template runtime
- **PKWT**: 2 kolom paralel bilingual (ID/EN), 11 pasal, font Times New Roman, terminologi Perusahaan/Karyawan, data dinamis (tanggal mulai/akhir, nominal upah), signature table box dengan border
- **MITRA**: single column full-width, preambule detail (akta pendirian, identitas mitra), signature di halaman terpisah
- Multi-page layout: title block hanya di halaman 1, border kolom menyesuaikan tinggi konten (no blank gap)
- **Auto-generate nomor kontrak**: format `{seq}/KK/KUKP/SII/{bulan_romawi}/{tahun}`, running number 3 digit reset per tahun, bulan/tahun mengikuti Tanggal Mulai kontrak. Tidak ada input manual nomor kontrak.
- **Contract State Machine**: status DRAFT (belum final) → AKTIF → AKAN_HABIS (≤30 hari) → EXPIRED. Cron job harian 00:01 WIB untuk auto-shift status.
- **Contract Renewal Flow**: perpanjangan via endpoint renew terpisah, parent harus AKAN_HABIS atau EXPIRED
- **Contract Guards**: Anti-Overlap (blokir jika ada kontrak aktif berjalan), SP3 Lockout (blokir jika SP3 aktif), State Lock (blokir edit field kunci jika sudah ditandatangani)
- **Contract History Chain**: field parentContractId untuk audit trail renewal
- **Contract Summary Mode**: halaman kontrak tampil 1 baris per karyawan (kontrak representatif)
- **Preview nomor kontrak**: form menampilkan nomor yang akan digenerate (readonly), update saat tanggal mulai berubah

### 4.3 Status & Validitas
- Filter & search karyawan berdasarkan status (`AKTIF` / `KONTRAK_EXPIRED` / `RESIGN` / `PHK`)
- Indikator visual masa berlaku kontrak (hijau = aktif, kuning = <30 hari, merah = expired)
- Offboarding karyawan (`RESIGN` / `PHK`) dengan tanggal efektif dan catatan
- Detail offboarding dapat dilihat oleh Admin dan Pengelola dari halaman detail karyawan global

### 4.4 Admin & Setting
- Manajemen user internal (`master_admin`)
- Master User untuk pembuatan akun internal Admin / Pengelola Koperasi
- Pengelolaan master data lookup (work location, job role, departement, dll) hanya untuk **Master Admin**
- Audit log sederhana (siapa yang mengubah data kapan)
- Konfirmasi hapus data menggunakan toast bawaan UI sebelum aksi delete dijalankan
- Pengaturan Umum: Nama Ketua Koperasi, Nama Organisasi, Logo Organisasi (upload JPG/PNG/WEBP/SVG, max 2MB)
- Import Data Karyawan Bulk via Excel template (dengan dropdown validasi data master, all-or-nothing transaction)
- Login Image: upload gambar latar halaman login (kiri/kanan)

### 4.5 Dashboard (Internal)
- Total karyawan aktif
- Jumlah karyawan `AKTIF`, `KONTRAK_EXPIRED`, `RESIGN`, dan `PHK`
- Kontrak yang akan habis dalam 30 hari
- Grafik distribusi job level & lokasi kerja

### 4.6 Surat Peringatan (SP)
- CRUD Surat Peringatan dengan eskalasi SP1 → SP2 → SP3
- Rule eskalasi: SP1 aktif → default SP2, SP2 aktif → hanya SP3, SP3 aktif → blokir pembuatan SP baru sampai masa berlaku habis
- Generate PDF surat peringatan otomatis (pdfkit, kop surat + logo PT. Sankyu)
- Upload file dokumen SP (scan/dokumen fisik, PDF/gambar, max 10MB)
- **Auto-generate nomor surat**: format `{seq}/SP/KUKP/SII/{bulan_romawi}/{tahun}`, running number 3 digit reset per tahun, bulan/tahun mengikuti Tanggal Surat
- Preview nomor surat otomatis di form (read-only, update saat tanggal surat berubah)
- Field: Nomor Surat (auto), Karyawan, Jenis Pelanggaran (array), Level SP (1/2/3), Tanggal Surat, Berlaku Sampai (auto +6 bulan), Pengurus Koperasi

### 4.7 Master Dokumen
- Master data tipe dokumen sebagai referensi untuk Sertifikasi & Ijin
- CRUD Master Dokumen di halaman Master Data (tab baru, Admin only)
- Field: Nama Dokumen, Jenis Dokumen (dropdown: Sertifikat/Lisensi/Izin/Rahasia/Lainnya), Penerbit
- Menjadi sumber dropdown di form Sertifikasi & Ijin

### 4.8 Sertifikasi & Ijin Karyawan
- CRUD dokumen karyawan berdasarkan Master Dokumen
- Status otomatis: AKTIF (masa berlaku > 30 hari), AKAN_EXPIRED (≤30 hari), EXPIRED (sudah lewat)
- Upload file dokumen terkait (PDF/gambar, max 10MB)
- Tombol Perpanjang untuk dokumen yang AKAN_EXPIRED atau EXPIRED
- Notifikasi email otomatis saat status berubah ke AKAN_EXPIRED atau EXPIRED (cron harian 00:01 WIB)
- Section read-only di halaman Detail Karyawan (timeline scrollable + link Lihat Semua)
- Field: Karyawan, Nama Dokumen (dari Master Dokumen), Nomor Dokumen, Jenis (autofill), Penerbit (autofill), Masa Berlaku (datepicker), Catatan, File Upload, Status (otomatis)

---

## 5. User Stories (Prioritas Tinggi)

**US-01** (Master Admin)  
Sebagai Master Admin, saya ingin menambahkan data karyawan baru beserta kontrak pertamanya dan foto karyawan, agar data langsung lengkap.

**US-02** (Master Admin)  
Sebagai Master Admin, saya ingin melihat daftar semua karyawan dengan filter status (`AKTIF`/`KONTRAK_EXPIRED`/`RESIGN`/`PHK`) dan status kontrak (aktif/akan habis/expired/selesai) beserta foto karyawan.

**US-03** (Master Admin)  
Sebagai Master Admin, saya ingin mendapatkan notifikasi otomatis ketika ada kontrak yang akan habis dalam 30 hari.

**US-04** (Master Admin)  
Sebagai Master Admin, saya ingin memproses offboarding karyawan sebagai `RESIGN` atau `PHK` dan mencatat riwayat perubahannya.

**US-05** (Master Admin)  
Sebagai Master Admin, saya ingin melihat riwayat semua kontrak yang pernah dimiliki oleh satu karyawan.

**US-06** (Master Admin)  
Sebagai Master Admin, saya ingin mendapatkan toast konfirmasi sebelum menghapus data karyawan, kontrak, atau master data, agar tidak salah hapus.

**US-07** (Pengelola Koperasi)  
Sebagai Pengelola Koperasi, saya ingin mengelola data karyawan dan status kontrak, tetapi tidak bisa membuat atau mengedit Master Data, agar pembagian kewenangan tetap jelas.

**US-10** (Admin & Pengelola)  
Sebagai Admin atau Pengelola Koperasi, saya ingin membuka halaman detail karyawan global agar bisa melihat biodata, status kepegawaian, detail offboarding, dan riwayat kontrak dalam satu tempat.

**US-08** (Master Admin)  
Sebagai Master Admin, saya ingin membuat dan mengelola akun internal dengan role Admin atau Pengelola Koperasi, agar akses sistem bisa diatur lebih rapi.

**US-09** (Master Admin)  
Sebagai Master Admin, saya ingin mengelola master data Departement, agar struktur organisasi dan referensi data karyawan lebih rapi.

---

## 6. Database Schema (Initial + Proposed)

### 6.1 Tabel Existing (dari Diagram Draw.io Revisi)

- `employees` (sebelumnya `employes`)
- `"fotoKaryawan" Picture Upload`
- `work_locations`
- `tax_status`
- `job_roles`
- `job_levels`
- `master_admin`

### 6.2 Tabel Baru yang Direkomendasikan (untuk Fitur Kontrak)

```sql
-- contracts
CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  contract_no VARCHAR(100) UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  contract_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'AKTIF',
  document_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- contract_documents
CREATE TABLE contract_documents (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  file_name VARCHAR(255),
  file_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- employee_status_history
CREATE TABLE employee_status_history (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id),
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  changed_by_id INTEGER,
  changed_by_name VARCHAR(255) NOT NULL,
  changed_by_role VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- employee_offboarding
CREATE TABLE employee_offboarding (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER UNIQUE REFERENCES employees(id),
  termination_type VARCHAR(20) NOT NULL,
  termination_date DATE NOT NULL,
  reason TEXT,
  processed_by_id INTEGER NOT NULL,
  processed_by_name VARCHAR(255) NOT NULL,
  processed_by_role VARCHAR(50) NOT NULL,
  processed_by_kind VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

#### Tabel Baru (Implementasi Lanjutan)

**document_types** — Master tipe dokumen
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT | Primary key |
| name | VARCHAR(255) | Nama dokumen |
| documentType | VARCHAR(50) | Jenis: SERTIFIKAT/LISENSI/IZIN/RAHASIA/LAINNYA |
| issuer | VARCHAR(255) | Nama penerbit |

**employee_documents** — Sertifikasi & Ijin karyawan
| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| id | INT | Primary key |
| employeeId | INT | FK ke employees |
| documentTypeId | INT | FK ke document_types |
| documentNumber | VARCHAR(100) | Nomor dokumen |
| expiryDate | DATE | Masa berlaku |
| notes | TEXT | Catatan (opsional) |
| fileUrl | VARCHAR(500) | Path file upload (opsional) |
| status | ENUM | AKTIF / AKAN_EXPIRED / EXPIRED |
| createdAt | DATETIME | Waktu dibuat |
| updatedAt | DATETIME | Waktu diupdate |

**warning_letters** — Surat Peringatan (field tambahan dari implementasi)
| Kolom baru | Tipe | Keterangan |
|------------|------|-----------|
| documentUrl | VARCHAR | Path file dokumen SP yang diupload (opsional) |

Juga update tabel **contracts** — field tambahan:
| Field baru | Tipe | Keterangan |
|------------|------|-----------|
| signedDate | DATE | Tanggal penandatanganan (opsional) |
| positionLabel | VARCHAR | Label posisi di dokumen PDF |
| workLocationLabel | VARCHAR | Label lokasi kerja di dokumen PDF |
| baseCompensation | INT | Nominal kompensasi/upah |
| templateId | INT | FK ke contract_templates |
| generatedPdfUrl | VARCHAR | Path hasil generate PDF |
| generatedAt | DATETIME | Tanggal generate PDF |
| parentContractId | INT | FK self-reference untuk renewal chain |

---

## 7. Technical Architecture

### Tech Stack (sesuai diagram revisi)

**Frontend**
- Nuxt 4 (Vue 3)
- Nuxt UI + Nuxt Dashboard Template
- Tanstack Table v8
- Vite

**Backend**
- NestJS
- Prisma ORM

**Database**
- PostgreSQL

**Infrastructure**
- Docker
- Cloudflare Tunnel
- Xubuntu Linux (server)

**Storage Dokumen & Foto**
- Local storage (MVP) → nanti bisa upgrade ke Cloudflare R2 / S3

---

## 8. Functional Requirements

| ID   | Requirement                                                                 | Prioritas |
|------|-----------------------------------------------------------------------------|-----------|
| FR-01 | CRUD lengkap data karyawan + upload foto karyawan                          | P0        |
| FR-02 | Upload & simpan dokumen kontrak (PDF)                                      | P0        |
| FR-03 | Sistem notifikasi kontrak akan habis (in-app + email)                      | P0        |
| FR-04 | Filter & pencarian karyawan yang powerful                                  | P0        |
| FR-05 | Riwayat kontrak per karyawan (read-only)                                   | P1        |
| FR-06 | Dashboard ringkasan untuk peran internal                                   | P1        |
| FR-07 | Export data karyawan ke Excel                                              | P2        |
| FR-08 | Audit log perubahan data                                                   | P2        |
| FR-09 | Toast konfirmasi sebelum hapus data karyawan, kontrak, dan master data     | P1        |
| FR-10 | Status kepegawaian dihitung otomatis dari kontrak dan offboarding          | P0        |
| FR-11 | Offboarding karyawan (`RESIGN` / `PHK`) dengan catatan dan audit trail     | P0        |
| FR-12 | Halaman detail karyawan global dengan biodata, offboarding, dan kontrak    | P1        |
| FR-13 | Preview dan generate dokumen kontrak otomatis berbasis template            | P1        |
| FR-14 | Generator PDF native langsung dari kode (pdfkit), tanpa dependency DOCX/LibreOffice | P1        |
| FR-15 | Layout PDF PKWT 1:1 dengan sample: 11 pasal bilingual, terminologi Perusahaan/Karyawan, font Times New Roman | P1        |
| FR-16 | Layout PDF MITRA: preambule detail, single column full-width | P1        |
| FR-17 | Signature block dengan table box border, nama uppercase+bold+underline | P1        |
| FR-18 | Multi-page layout fix: no blank gap di halaman 2+ | P1        |
| FR-19 | CRUD Surat Peringatan dengan eskalasi SP1→SP2→SP3, nomor auto-generate, generate PDF pdfkit, upload file dokumen SP | P1 |
| FR-20 | Master data tipe dokumen + CRUD Sertifikasi & Ijin karyawan, status otomatis, notifikasi email AKAN_EXPIRED/EXPIRED | P1 |
| FR-21 | Auto-generate nomor kontrak & SP dengan format running number 3 digit reset per tahun, preview di form sebelum submit | P1 |
| FR-22 | Form Perpanjang Legal Koperasi — field Nama Dokumen read-only (tidak dapat diubah saat perpanjang) | P1 |
| FR-23 | Cron email notifikasi Legal Koperasi & Kontrak Customer/Vendor: date boundary konsisten (`startOfDay`), filter user email null, konfigurasi `MAILEROO_FROM_EMAIL`/`MAILEROO_FROM_NAME` via env | P1 |

---

## 9. Non-Functional Requirements

- **Keamanan**: Password hash (argon2), JWT, akses berbasis peran internal
- **Performa**: Halaman list karyawan < 2 detik (server-side pagination + Tanstack Table)
- **Reliability**: Backup database otomatis harian
- **Scalability**: Siap untuk 5.000+ karyawan
- **Bahasa**: Full Bahasa Indonesia
- **Responsive**: Bisa diakses via desktop & tablet

---

## 10. Out of Scope (MVP)

- Portal karyawan / self-service
- Akses untuk Owner / Manajemen
- Payroll & slip gaji
- Absensi & kehadiran
- Performance review
- Mobile App native

---

## 11. Timeline & Milestones (Estimasi)

| Milestone                  | Durasi      | Deliverable                                           |
|---------------------------|-------------|-------------------------------------------------------|
| **M1: Foundation**        | Minggu 1-2  | Prisma schema + NestJS backend dasar                  |
| **M2: Master Data**       | Minggu 3-5  | CRUD Karyawan + Upload Foto + Lookup tables + Nuxt UI |
| **M3: Kontrak**           | Minggu 6-8  | Modul kontrak + upload dokumen + history + notifikasi |
| **M4: Dashboard**         | Minggu 9-10 | Dashboard khusus peran internal                       |
| **M5: Polish & Testing**  | Minggu 11-12| Bug fix, UI/UX improvement, UAT                       |
| **Go-Live**               | Minggu 13   | Deployment ke production                              |

---

## 12. Success Metrics (KPI)

- 100% data karyawan PT. Sankyu sudah masuk ke sistem dalam 1 bulan pertama
- Rata-rata waktu input data karyawan baru < 3 menit
- 0 kasus kontrak terlewat dalam 6 bulan pertama
- Pengguna internal puas dengan sistem (NPS ≥ 9/10)

---

## 13. Risiko & Asumsi

**Asumsi**:
- Data karyawan PT. Sankyu sudah tersedia dalam format Excel/CSV
- Hanya ada 1–2 orang pengguna internal yang akan menggunakan sistem
- Server (Xubuntu + Docker) sudah tersedia

**Risiko**:
- Kebiasaan pakai Excel → butuh training singkat
- Keterbatasan storage foto & dokumen di awal → rencanakan upgrade cloud storage di Phase 2

---

## 14. Lampiran

- Diagram Database (Draw.io Revisi) – sudah dilampirkan
- Tech Stack Diagram – sudah dilampirkan

---

**Catatan Akhir**:
Dokumen ini adalah **versi 1.4** (revisi sesuai permintaan).  
Fokus utama: **Peran internal Master Admin dan Pengelola Koperasi** di **Koperasi Karyawan PT. Sankyu**.

**Perubahan v1.4 (9 Juli 2026)**:
- FR-22: Form Perpanjang Legal Koperasi — field Nama Dokumen read-only saat mode renew
- FR-23: Bug fix cron email notifikasi — date boundary `startOfDay`, filter email null UserAccount, env vars `MAILEROO_FROM_EMAIL`/`MAILEROO_FROM_NAME`

---

**Disetujui oleh**:
- User: ___________________________     Tanggal: ___________
- Developer: AnNahl Web Media             Tanggal: 20 Mei 2026

---
