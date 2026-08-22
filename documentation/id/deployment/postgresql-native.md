# PostgreSQL Native (Tanpa Docker)

Mode ini menggunakan PostgreSQL yang terinstal langsung di sistem operasi, tanpa Docker.

::: tip Rekomendasi
Mode **Docker lebih direkomendasikan** untuk production. Gunakan mode native hanya jika Docker tidak tersedia di mesin target.
:::

## Instalasi PostgreSQL 16

Download dari [postgresql.org](https://www.postgresql.org/download/windows/) dan instal versi 16.x.

Selama instalasi, catat:
- **Port**: `5432` (default)
- **Username**: `postgres`
- **Password**: password yang Anda set

## Setup Database

Buka **pgAdmin** atau **psql** dan jalankan:

```sql
-- Buat user aplikasi
CREATE USER kokarsi WITH PASSWORD 'kokarsi2026';

-- Buat database
CREATE DATABASE kokarsi_karyawan OWNER kokarsi;

-- Berikan privileges
GRANT ALL PRIVILEGES ON DATABASE kokarsi_karyawan TO kokarsi;
```

## Konfigurasi `.env`

Update `backend/.env` untuk mode native:

```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5432/kokarsi_karyawan"
```

::: info Port Berbeda
Docker mode menggunakan port `5435`, native mode menggunakan port `5432` (default PostgreSQL).
:::

## Jalankan Aplikasi

```powershell
.\deploy\start.ps1 -Mode native
```

## Migration Database

```powershell
cd backend
npx prisma migrate deploy
```

::: warning Kolom Tidak Ditemukan setelah `migrate deploy`
Jika seed atau backend error dengan `P2022: column does not exist`, gunakan `prisma db push` sebagai gantinya:

```powershell
npx prisma db push
```

`db push` membandingkan schema langsung dengan database dan membuat semua kolom yang belum ada, tanpa memerlukan file migrasi. Gunakan ini jika `migrate deploy` menghasilkan error kolom tidak ditemukan.
:::

::: info `prisma.config.ts` dan `dotenv`
Project ini menggunakan `prisma.config.ts` yang membaca `DATABASE_URL` melalui `dotenv`. Pastikan `npm install` sudah dijalankan sebelum perintah Prisma agar `dotenv` tersedia — jika tidak, Prisma akan menggunakan port fallback hardcoded (`5435`) meskipun `.env` sudah diubah.
:::

## Seed Data Awal

```powershell
cd backend
npx ts-node prisma/seed.ts
```

Seed mengisi data awal: lookup master data, akun admin (`EMP001`/`admin123`), dan akun pengelola (`pengelola1`/`pengelola123`).

## Backup & Restore

### Backup via Script (Direkomendasikan)

```powershell
# Backup manual (membaca port & password otomatis dari backend/.env)
.\deploy\backup.ps1 -Mode native -BackupDir "C:\Backup\kokarsi"

# Atau gunakan file .bat
.\deploy\BACKUP-NATIVE.bat
```

### Setup Backup Terjadwal Otomatis

Jalankan sekali sebagai **Administrator**:

```powershell
# Klik kanan SETUP-BACKUP-SCHEDULE-NATIVE.bat → "Run as administrator"
.\deploy\SETUP-BACKUP-SCHEDULE-NATIVE.bat
```

Backup akan berjalan otomatis setiap hari jam 02:00. Backup lama > 7 hari dihapus otomatis.

### Restore

```powershell
.\deploy\restore.ps1 -Mode native -BackupDir "C:\Backup\kokarsi"
```

### Backup Manual dengan pg_dump

```powershell
# Ganti port sesuai konfigurasi (default 5432, Docker 5435)
$env:PGPASSWORD = "kokarsi2026"
pg_dump -U kokarsi -d kokarsi_karyawan -h localhost -p 5432 -f backup.sql
```
