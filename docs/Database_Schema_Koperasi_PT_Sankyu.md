# Database Schema - Koperasi Karyawan PT. Sankyu

**Versi**: 1.1 (Revisi sesuai diagram terbaru)  
**Tanggal**: 20 Mei 2026  
**Sumber**: Diagram Draw.io (DB Table)

---

## Ringkasan Struktur Database

Database ini dirancang untuk mengelola data karyawan koperasi dengan fokus pada:
- Data master karyawan
- Manajemen kontrak (akan ditambahkan di fase berikutnya)
- Lookup data pendukung (lokasi kerja, jabatan, dll)

**Total Tabel**: 6 tabel utama

---

## 1. Tabel Utama: `employees`

| Kolom              | Tipe Data                  | Keterangan                          | Constraint                  |
|--------------------|----------------------------|-------------------------------------|-----------------------------|
| id                 | SERIAL / INTEGER           | Primary Key (UniqueID)              | PK, Auto Increment          |
| employeeNo         | VARCHAR(100)               | Nomor Induk Karyawan                | PK, Unique, Not Null        |
| fullName           | VARCHAR(255)               | Nama Lengkap                        | Not Null                    |
| employmentStatus   | ENUM                       | Status Kepegawaian                  | 'MITRA', 'KONTRAK'          |
| taxStatus          | INTEGER                    | Status Pajak                        | FK → tax_status.id          |
| birthDate          | DATE                       | Tanggal Lahir                       | Not Null                    |
| gender             | ENUM                       | Jenis Kelamin                       | 'MALE', 'FEMALE'            |
| workLocationId     | INTEGER                    | Lokasi Kerja                        | FK → work_locations.id      |
| jobRoleId          | INTEGER                    | Jabatan / Role                      | FK → job_roles.id           |
| jobLevelId         | INTEGER                    | Level Jabatan                       | FK → job_levels.id          |
| educationLevel     | ENUM                       | Tingkat Pendidikan                  | 'SMA', 'D3', 'S1', 'S2'     |
| joinDate           | DATE                       | Tanggal Bergabung                   | Not Null                    |
| phoneNumber        | VARCHAR(50)                | Nomor Telepon                       | -                           |
| email              | VARCHAR(255)               | Alamat Email                        | Unique                      |
| fotoKaryawan       | TEXT / VARCHAR             | Path Foto Karyawan (Upload)         | -                           |

**Catatan**:
- Tabel ini adalah tabel utama untuk semua data karyawan.
- Kolom `fotoKaryawan` ditambahkan di revisi terbaru.

---

## 2. Tabel Lookup

### 2.1 `work_locations`

| Kolom | Tipe Data     | Keterangan          |
|-------|---------------|---------------------|
| id    | SERIAL        | Primary Key         |
| name  | VARCHAR(255)  | Nama Lokasi Kerja   |

### 2.2 `tax_status`

| Kolom | Tipe Data     | Keterangan          |
|-------|---------------|---------------------|
| id    | SERIAL        | Primary Key         |
| name  | VARCHAR(255)  | Nama Status Pajak   |

### 2.3 `job_roles`

| Kolom | Tipe Data     | Keterangan          |
|-------|---------------|---------------------|
| id    | SERIAL        | Primary Key         |
| name  | VARCHAR(255)  | Nama Jabatan/Role   |

### 2.4 `job_levels`

| Kolom | Tipe Data     | Keterangan          |
|-------|---------------|---------------------|
| id    | SERIAL        | Primary Key         |
| name  | VARCHAR(255)  | Nama Level Jabatan  |

---

## 3. Tabel Admin: `master_admin`

| Kolom      | Tipe Data      | Keterangan                          |
|------------|----------------|-------------------------------------|
| id         | SERIAL         | Primary Key                         |
| employeeNo | VARCHAR(100)   | Nomor Induk (sama dengan employees) |
| fullName   | VARCHAR(255)   | Nama Lengkap Admin                  |
| password   | VARCHAR(255)   | Password (Hash)                     |

**Catatan**: Tabel ini digunakan untuk login Master Admin.

---

## 4. Relasi (Foreign Key)

| Dari Tabel     | Kolom FK          | Ke Tabel          | Tipe Relasi     |
|----------------|-------------------|-------------------|-----------------|
| employees      | taxStatus         | tax_status        | Many to One     |
| employees      | workLocationId    | work_locations    | Many to One     |
| employees      | jobRoleId         | job_roles         | Many to One     |
| employees      | jobLevelId        | job_levels        | Many to One     |
| master_admin   | employeeNo        | employees         | One to One      |

---

## 5. Tabel yang Direkomendasikan Ditambahkan (Fase Selanjutnya)

Untuk fitur manajemen kontrak yang lengkap, disarankan menambahkan tabel berikut:

### `contracts`
- id (PK)
- employee_id (FK → employees)
- contract_no (VARCHAR, Unique)
- start_date (DATE)
- end_date (DATE)
- contract_type (VARCHAR)
- status (ENUM: 'AKTIF', 'AKAN_HABIS', 'EXPIRED', 'DIBATALKAN')
- document_url (TEXT) → path PDF
- created_at, updated_at

### `contract_documents`
- id (PK)
- contract_id (FK)
- file_name, file_url, uploaded_at

### `employee_status_history`
- id (PK)
- employee_id (FK)
- old_status, new_status
- changed_by (FK → master_admin)
- changed_at, notes

---

## 6. Tech Stack (dari Diagram)

**Frontend**
- Vue 3 + Nuxt 3
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
- Xubuntu Linux

---

**Catatan Akhir**:
- Nama tabel sudah diperbaiki dari `employes` → `employees`
- Semua relasi sudah jelas
- Siap untuk dibuatkan **Prisma Schema** (.prisma file)

---

*File ini dibuat otomatis dari diagram Draw.io yang dilampirkan.*