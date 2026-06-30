# PRD - Aplikasi Manajemen Data Karyawan  
**Koperasi Karyawan PT. Sankyu**

**Versi Dokumen**: 1.1 (Revisi)  
**Tanggal**: 20 Mei 2026  
**Penulis**: AnNahl Web Media  
**Status**: Draft untuk Review

---

## 1. Executive Summary

Aplikasi web **Manajemen Data Karyawan Koperasi Karyawan PT. Sankyu** adalah sistem HR internal yang dibuat **khusus untuk Koperasi Karyawan PT. Sankyu**.

Sistem ini akan mengelola seluruh data master karyawan secara terpusat, termasuk manajemen dokumen kontrak, status kepegawaian (MITRA / KONTRAK), pelacakan masa berlaku kontrak, dan upload foto karyawan.

**Tujuan Utama**:
- Menggantikan proses manual (Excel) menjadi sistem digital yang terintegrasi
- Meningkatkan akurasi data dan kepatuhan ketenagakerjaan
- Memberikan visibilitas real-time kepada **Master Admin** terhadap status dan masa berlaku kontrak seluruh karyawan

**Target MVP**: 3–4 bulan pertama

---

## 2. Product Vision & Goals

### Vision
Menjadi sistem manajemen data karyawan internal yang andal dan mudah digunakan **khusus untuk Koperasi Karyawan PT. Sankyu**.

### Goals
- **GOAL-01**: 100% data karyawan PT. Sankyu tercatat secara digital dalam 1 sistem
- **GOAL-02**: Mengurangi waktu pencarian & pengelolaan data karyawan dari jam menjadi < 30 detik
- **GOAL-03**: Memberikan notifikasi otomatis 30 hari & 7 hari sebelum kontrak habis
- **GOAL-04**: Dashboard ringkasan lengkap yang hanya dapat diakses oleh **Master Admin**

---

## 3. Target Users

| Peran           | Deskripsi                                      | Kebutuhan Utama                                      |
|-----------------|------------------------------------------------|------------------------------------------------------|
| **Master Admin**| Satu-satunya peran yang mengelola seluruh sistem | CRUD karyawan, upload dokumen kontrak & foto, update status, monitoring kontrak, dashboard |

> **Catatan Penting**:  
> Saat ini **hanya Master Admin** yang akan menggunakan aplikasi ini.  
> Tidak ada portal karyawan (self-service) dan tidak ada akses untuk Owner / Manajemen di fase MVP.

---

## 4. Key Features (MVP Scope)

### 4.1 Master Data Karyawan
- CRUD lengkap data karyawan sesuai skema database revisi
- Field wajib: `employeeNo`, `fullName`, `employmentStatus`, `birthDate`, `gender`, `joinDate`, `email`, `phoneNumber`, `fotoKaryawan`
- Dropdown lookup untuk: `workLocation`, `jobRole`, `jobLevel`, `taxStatus`, `educationLevel`
- Upload foto karyawan (Picture Upload)

### 4.2 Manajemen Kontrak Karyawan
- Tambah kontrak baru untuk karyawan
- Upload dokumen kontrak (PDF, max 10MB)
- Field kontrak: `contractNo`, `startDate`, `endDate`, `contractType`
- Status kontrak dihitung otomatis dari `endDate`:
  - `AKTIF` jika sisa > 30 hari
  - `AKAN_HABIS` jika sisa <= 30 hari
  - `EXPIRED` jika tanggal sudah lewat
  - `DIBATALKAN` jika kontrak dibatalkan manual
- Riwayat kontrak per karyawan (history) tersedia dalam mode read-only dari halaman Data Karyawan dan halaman Kontrak
- Notifikasi otomatis kontrak akan habis (30 hari & 7 hari sebelumnya)

### 4.3 Status & Validitas
- Filter & search karyawan berdasarkan status (MITRA / KONTRAK)
- Indikator visual masa berlaku kontrak (hijau = aktif, kuning = <30 hari, merah = expired)
- Bulk update status karyawan

### 4.4 Admin & Setting
- Manajemen user Master Admin (`master_admin`)
- Pengelolaan master data lookup (work location, job role, dll)
- Audit log sederhana (siapa yang mengubah data kapan)
- Konfirmasi hapus data menggunakan toast bawaan UI sebelum aksi delete dijalankan

### 4.5 Dashboard (Khusus Master Admin)
- Total karyawan aktif
- Jumlah karyawan MITRA vs KONTRAK
- Kontrak yang akan habis dalam 30 hari
- Grafik distribusi job level & lokasi kerja

---

## 5. User Stories (Prioritas Tinggi)

**US-01** (Master Admin)  
Sebagai Master Admin, saya ingin menambahkan data karyawan baru beserta kontrak pertamanya dan foto karyawan, agar data langsung lengkap.

**US-02** (Master Admin)  
Sebagai Master Admin, saya ingin melihat daftar semua karyawan dengan filter status (MITRA/KONTRAK) dan status kontrak (aktif/akan habis/expired) beserta foto karyawan.

**US-03** (Master Admin)  
Sebagai Master Admin, saya ingin mendapatkan notifikasi otomatis ketika ada kontrak yang akan habis dalam 30 hari.

**US-04** (Master Admin)  
Sebagai Master Admin, saya ingin mengubah status karyawan dari KONTRAK menjadi MITRA dan mencatat riwayat perubahannya.

**US-05** (Master Admin)  
Sebagai Master Admin, saya ingin melihat riwayat semua kontrak yang pernah dimiliki oleh satu karyawan.

**US-06** (Master Admin)  
Sebagai Master Admin, saya ingin mendapatkan toast konfirmasi sebelum menghapus data karyawan, kontrak, atau master data, agar tidak salah hapus.

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
  changed_by INTEGER REFERENCES master_admin(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

---

## 7. Technical Architecture

### Tech Stack (sesuai diagram revisi)

**Frontend**
- Nuxt 3 (Vue 3)
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
| FR-06 | Dashboard ringkasan khusus Master Admin                                    | P1        |
| FR-07 | Export data karyawan ke Excel                                              | P2        |
| FR-08 | Audit log perubahan data                                                   | P2        |
| FR-09 | Toast konfirmasi sebelum hapus data karyawan, kontrak, dan master data     | P1        |

---

## 9. Non-Functional Requirements

- **Keamanan**: Password hash (argon2), JWT, **hanya akses Master Admin**
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
| **M4: Dashboard**         | Minggu 9-10 | Dashboard khusus Master Admin                         |
| **M5: Polish & Testing**  | Minggu 11-12| Bug fix, UI/UX improvement, UAT                       |
| **Go-Live**               | Minggu 13   | Deployment ke production                              |

---

## 12. Success Metrics (KPI)

- 100% data karyawan PT. Sankyu sudah masuk ke sistem dalam 1 bulan pertama
- Rata-rata waktu input data karyawan baru < 3 menit
- 0 kasus kontrak terlewat dalam 6 bulan pertama
- Master Admin puas dengan sistem (NPS ≥ 9/10)

---

## 13. Risiko & Asumsi

**Asumsi**:
- Data karyawan PT. Sankyu sudah tersedia dalam format Excel/CSV
- Hanya ada 1–2 orang Master Admin yang akan menggunakan sistem
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
Dokumen ini adalah **versi 1.1** (revisi sesuai permintaan).  
Fokus utama: **Hanya untuk Master Admin** di **Koperasi Karyawan PT. Sankyu**.

---

**Disetujui oleh**:
- User: ___________________________     Tanggal: ___________
- Developer: AnNahl Web Media             Tanggal: 20 Mei 2026

---
