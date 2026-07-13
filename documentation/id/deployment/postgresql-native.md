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

## Backup & Restore

### Backup Manual

```powershell
pg_dump -U kokarsi -d kokarsi_karyawan -F c -f backup.dump
```

### Restore

```powershell
pg_restore -U kokarsi -d kokarsi_karyawan backup.dump
```
