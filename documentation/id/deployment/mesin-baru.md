# Deploy ke Mesin Baru

Panduan lengkap untuk memindahkan atau menginstal ulang aplikasi ke mesin Windows baru.

::: tip Gunakan pnpm, bukan npm
Project ini menggunakan `pnpm` sebagai package manager. Jangan gunakan `npm install` di root project — gunakan `pnpm install`.
:::

## 1. Prasyarat

Install software berikut di mesin baru:

| Software | Versi | Perintah install |
|----------|-------|-----------------|
| Node.js | 24.x | https://nodejs.org |
| pnpm | terbaru | `npm install -g pnpm` |
| PM2 | terbaru | `npm install -g pm2` |
| PostgreSQL | 16.x | https://www.postgresql.org/download/windows/ |
| Cloudflared | terbaru | `winget install --id Cloudflare.cloudflared` |

## 2. Copy Project

Copy seluruh folder project ke mesin baru, termasuk:

```
aplikasi-karyawan-kokarsi/
  ├── .output/                  # Frontend build (hasil pnpm build)
  ├── backend/
  │   ├── dist/                 # Backend compiled
  │   ├── uploads/              # Foto karyawan & dokumen
  │   ├── prisma/               # Schema + migrations + seed
  │   ├── node_modules/
  │   └── .env
  ├── node_modules/
  ├── .env                      # Root env (production)
  ├── ecosystem.config.cjs      # PM2 config (path otomatis, tidak perlu diedit)
  └── deploy/                   # Script deployment
```

Copy juga folder Cloudflare Tunnel:
```
C:\Users\<USERNAME>\.cloudflared\
  ├── cert.pem
  ├── config.yml
  └── <tunnel-id>.json
```

## 3. Konfigurasi

### `backend/.env`

```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5434/kokarsi_karyawan"
JWT_SECRET="isi-dengan-random-string-minimal-32-karakter"
PORT=3001
FONT_DIR=C:/Windows/Fonts
```

::: warning Sesuaikan port
Ganti `5434` dengan port PostgreSQL aktual di mesin baru. Cek di pgAdmin atau di saat instalasi PostgreSQL.
:::

### `.env` di root project

```env
NODE_ENV=production
BACKEND_URL=http://localhost:3001/api
BACKEND_ROOT=http://localhost:3001
NUXT_ALLOWED_ORIGINS=https://kokarsi-sankyu.web.id
```

## 4. Setup Database

Buka pgAdmin atau psql dan jalankan:

```sql
CREATE USER kokarsi WITH PASSWORD 'kokarsi2026';
CREATE DATABASE kokarsi_karyawan OWNER kokarsi;
GRANT ALL PRIVILEGES ON DATABASE kokarsi_karyawan TO kokarsi;
```

## 5. Migrasi & Seed Database

::: warning Install dulu sebelum Prisma
`backend/prisma.config.ts` menggunakan `dotenv` untuk membaca `DATABASE_URL` dari `.env`. Jika `npm install` belum dijalankan, Prisma akan menggunakan port fallback hardcoded (`5435`) meskipun `.env` sudah diisi port yang benar.
:::

```powershell
cd backend
npm install                    # pastikan dotenv tersedia
npx prisma generate            # generate Prisma Client
npx prisma migrate deploy      # terapkan semua migrations
```

Jika muncul error `P2022: column does not exist`, gunakan `db push`:

```powershell
npx prisma db push             # sinkronkan schema langsung ke database
```

Kemudian jalankan seed:

```powershell
npx ts-node prisma/seed.ts
```

Seed mengisi data awal:
- Master data lookup (lokasi, jabatan, status pajak, dll)
- Akun admin: `employeeNo=EMP001` / `password=admin123`
- Akun admin user: `username=admin.kokarsi` / `password=admin123`
- Akun pengelola: `username=pengelola1` / `password=pengelola123`
- Template kontrak default (PKWT, MITRA)

## 6. Jalankan Aplikasi

```powershell
# Klik dua kali atau jalankan dari terminal
.\deploy\START-NATIVE.bat
```

Atau langsung via PowerShell:

```powershell
cd aplikasi-karyawan-kokarsi
.\deploy\start.ps1 -Mode native
```

## 7. Setup Backup Otomatis

Jalankan sekali sebagai **Administrator** (klik kanan → Run as administrator):

```
deploy\SETUP-BACKUP-SCHEDULE-NATIVE.bat
```

Backup akan berjalan otomatis setiap hari jam 02:00. Backup disimpan di `C:\Backup\kokarsi`, backup lama > 7 hari dihapus otomatis.

Verifikasi task terdaftar:
```powershell
Get-ScheduledTask -TaskName "KokarsiDatabaseBackup" | Get-ScheduledTaskInfo
```

## 8. Checklist Deploy

- [ ] Node.js 24, pnpm, PM2, PostgreSQL terinstall
- [ ] Cloudflared terinstall
- [ ] Folder project sudah dicopy (termasuk `ecosystem.config.cjs`)
- [ ] Folder `~\.cloudflared\` sudah dicopy
- [ ] `backend\.env` sudah diisi dengan port PostgreSQL yang benar dan `JWT_SECRET`
- [ ] `.env` di root project sudah dibuat
- [ ] Database dan user PostgreSQL sudah dibuat
- [ ] `npm install` di `backend/` sudah dijalankan
- [ ] `prisma generate` sudah dijalankan
- [ ] `prisma migrate deploy` (atau `prisma db push`) berhasil
- [ ] Seed berhasil dijalankan
- [ ] Aplikasi bisa diakses di `http://localhost:3000`
- [ ] Backup terjadwal sudah di-setup

## Troubleshooting Umum

### Port masih 5435 meski `.env` sudah diubah

`prisma.config.ts` tidak membaca `.env` karena `dotenv` belum terinstall.

**Solusi:** Jalankan `npm install` di folder `backend/` terlebih dahulu, lalu jalankan ulang perintah Prisma.

### Error seed: `positionLabel` / `workLocationLabel` tidak dikenal

Field tersebut sudah dihapus dari schema `Contract`. Seed mungkin menggunakan versi lama.

**Solusi:** Buka `backend/prisma/seed.ts` dan hapus baris yang menggunakan field tersebut dari blok `prisma.contract.upsert()`.

### Error hapus karyawan: FK violation `master_admin_employeeNo`

Karyawan yang dihapus terdaftar sebagai Master Admin.

**Solusi:** Pastikan backend sudah di-compile ulang (`npx tsc -p tsconfig.json`) dan di-restart (`pm2 restart kokarsi-backend`). Versi terbaru sudah memperbaiki bug ini.

### `pg_dump` gagal: "no password supplied"

**Solusi:** Gunakan script backup bawaan project yang sudah membaca password dari `.env` secara otomatis:
```powershell
.\deploy\BACKUP-NATIVE.bat
```
