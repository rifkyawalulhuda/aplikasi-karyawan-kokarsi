# Panduan Deploy - Aplikasi Karyawan Kokarsi PT. Sankyu

> Dokumen ini menjelaskan cara deploy aplikasi ke mesin baru, baik menggunakan Docker maupun PostgreSQL native.

---

## Prasyarat

Install software berikut di mesin baru:

| Software | Versi | Download |
|----------|-------|---------|
| Node.js | 24.x | https://nodejs.org |
| pnpm | terbaru | `npm install -g pnpm` |
| PM2 | terbaru | `npm install -g pm2` |
| Cloudflared | terbaru | `winget install --id Cloudflare.cloudflared` |
| Docker Desktop | terbaru | https://www.docker.com/products/docker-desktop (jika mode docker) |
| PostgreSQL | 16.x | https://www.postgresql.org/download/windows/ (jika mode native) |

---

## Copy File dari Mesin Lama

Copy seluruh folder berikut ke mesin baru:

```
E:\Github\aplikasi-karyawan-kokarsi\
  ├── .output\                  # Frontend build (hasil pnpm build)
  ├── backend\
  │   ├── dist\                 # Backend compiled
  │   ├── uploads\              # Foto karyawan & dokumen kontrak
  │   ├── prisma\               # Schema database
  │   ├── node_modules\
  │   └── .env                  # Konfigurasi environment backend
  ├── node_modules\
  ├── .env                      # Konfigurasi environment frontend (production)
  ├── ecosystem.config.cjs      # PM2 process config
  ├── docker-compose.db.yml     # Hanya jika mode Docker
  └── deploy\                   # Script deployment
```

Copy juga folder Cloudflare Tunnel:

```
C:\Users\<USERNAME>\.cloudflared\
  ├── cert.pem
  ├── config.yml
  └── 483d9bfc-f094-4d30-a344-9c3019120a13.json
```

---

## Konfigurasi

### 1. Sesuaikan `backend\.env`

**Mode Docker** (port 5435):
```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan"
JWT_SECRET="isi-dengan-random-string-minimal-32-karakter"
PORT=3001
MAILEROO_API_KEY=your-api-key
FONT_DIR=C:/Windows/Fonts
```

**Mode Native** (port 5432 default PostgreSQL):
```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5432/kokarsi_karyawan"
JWT_SECRET="isi-dengan-random-string-minimal-32-karakter"
PORT=3001
```

Jika port PostgreSQL di mesin baru berbeda, sesuaikan angka port-nya.

### 2. Sesuaikan `.env` di root (Frontend production)

Buat file `.env` di root project (copy dari `.env.example`):
```env
NODE_ENV=production
BACKEND_URL=http://localhost:3001/api
BACKEND_ROOT=http://localhost:3001
NUXT_ALLOWED_ORIGINS=https://kokarsi-sankyu.web.id,http://localhost:3000
NUXT_PUBLIC_SITE_URL=https://kokarsi-sankyu.web.id
```

> **Penting:** File `.env` root ini **wajib ada** agar frontend tidak crash saat startup. PM2 akan inject env ini otomatis ke proses frontend via `ecosystem.config.cjs`.

### 3. Sesuaikan `~\.cloudflared\config.yml`

Buka file `C:\Users\<USERNAME>\.cloudflared\config.yml` dan update path `credentials-file` sesuai username Windows di mesin baru:

```yaml
tunnel: 483d9bfc-f094-4d30-a344-9c3019120a13
credentials-file: C:\Users\<USERNAME_BARU>\.cloudflared\483d9bfc-f094-4d30-a344-9c3019120a13.json

ingress:
  - hostname: kokarsi-sankyu.web.id
    path: /uploads/.*
    service: http://localhost:3001
  - hostname: kokarsi-sankyu.web.id
    service: http://localhost:3000
  - service: http_status:404
```

Ganti `<USERNAME_BARU>` dengan username Windows di mesin baru. Cek dengan perintah:
```powershell
echo $env:USERNAME
```

---

## Setup Database

### Mode A: Docker (Recommended)

Tidak perlu setup database manual. Docker akan otomatis membuat database saat pertama kali dijalankan.

```powershell
# Test Docker berjalan
docker --version
docker compose -f docker-compose.db.yml up -d
```

### Mode B: PostgreSQL Native

#### 1. Install PostgreSQL 16

Download installer dari https://www.postgresql.org/download/windows/ dan install dengan pengaturan default.

Tambahkan PostgreSQL ke PATH Windows:
- Buka **System Properties** → **Environment Variables**
- Di **System variables**, pilih `Path` → **Edit**
- Tambahkan: `C:\Program Files\PostgreSQL\16\bin`

Verifikasi:
```powershell
psql --version
pg_dump --version
```

#### 2. Buat User dan Database

Buka PowerShell sebagai Administrator, lalu jalankan:

```powershell
# Login sebagai postgres superuser
psql -U postgres

# Di dalam psql, jalankan perintah berikut:
CREATE USER kokarsi WITH PASSWORD 'kokarsi2026';
CREATE DATABASE kokarsi_karyawan OWNER kokarsi;
GRANT ALL PRIVILEGES ON DATABASE kokarsi_karyawan TO kokarsi;
\q
```

#### 3. Konfigurasi Autentikasi (pg_hba.conf)

Buka file `C:\Program Files\PostgreSQL\16\data\pg_hba.conf` dan pastikan baris berikut ada:

```
# TYPE  DATABASE          USER      ADDRESS     METHOD
host    kokarsi_karyawan  kokarsi   127.0.0.1/32  md5
host    kokarsi_karyawan  kokarsi   ::1/128       md5
```

Restart PostgreSQL service setelah edit:
```powershell
Restart-Service postgresql-x64-16
```

#### 4. Test Koneksi

```powershell
psql -U kokarsi -d kokarsi_karyawan -h localhost -c "SELECT version();"
# Masukkan password: kokarsi2026
```

#### 5. Restore Data (Opsional)

Jika ingin membawa data dari mesin lama:

```powershell
# Di mesin lama, backup dulu
.\deploy\backup.ps1

# Copy folder backup ke mesin baru, lalu restore
.\deploy\restore.ps1 -Mode native
```

Atau restore manual dari file SQL:
```powershell
psql -U kokarsi -d kokarsi_karyawan -h localhost -f "E:\Backup\kokarsi\backup_TANGGAL\kokarsi_karyawan.sql"
```

---

## Deploy Database Prisma & Seed (Mesin Baru)

Langkah ini dilakukan **setelah database siap** (Docker atau Native) dan **sebelum menjalankan aplikasi**.
Gunakan `migrate deploy` — bukan `migrate dev` — di mesin production/baru.

> **Perbedaan penting:**
> - `prisma migrate dev` — untuk **development** saja, bisa membuat migrasi baru
> - `prisma migrate deploy` — untuk **production/mesin baru**, hanya menerapkan migrasi yang sudah ada

### 1. Masuk ke Folder Backend

```powershell
cd E:\Github\aplikasi-karyawan-kokarsi\backend
```

### 2. Install Dependencies Backend

```powershell
npm install
```

### 3. Generate Prisma Client

```powershell
npx prisma generate
```

> **Catatan penting — `prisma.config.ts`:** Project ini menggunakan `prisma.config.ts` yang perlu membaca `DATABASE_URL` dari `.env`. Pastikan sudah menjalankan `npm install` agar `dotenv` tersedia, karena file ini secara eksplisit memuat `.env` melalui `dotenv`. Tanpa ini, Prisma akan menggunakan **port fallback hardcoded** (`5435`) meskipun `.env` sudah diubah.

### 4. Terapkan Semua Migrasi

```powershell
npx prisma migrate deploy
```

Perintah ini akan menerapkan semua migrasi di folder `backend\prisma\migrations\` secara berurutan ke database yang dikonfigurasi di `backend\.env` (`DATABASE_URL`).

Output sukses:
```
Applying migration `20240101_init`...
Applying migration `20240215_add_notifications`...
...
All migrations have been successfully applied.
```

> **Jika ada error `P2022: column does not exist` setelah migrate deploy:** Beberapa kolom di schema mungkin ditambahkan langsung ke `schema.prisma` tanpa file migrasi yang tercatat. Dalam kasus ini, gunakan `prisma db push` sebagai gantinya:
> ```powershell
> npx prisma db push
> ```
> `db push` membandingkan schema langsung dengan database dan membuat semua kolom yang belum ada, tanpa memerlukan file migrasi. Gunakan ini jika `migrate deploy` menghasilkan error kolom tidak ditemukan saat seed.

### 5. Jalankan Seed (Data Awal)

```powershell
npm run prisma:seed
```

Atau langsung via ts-node:

```powershell
npx ts-node prisma/seed.ts
```

Seed akan mengisi data awal yang dibutuhkan aplikasi:
- Tipe kontrak default (PKWT, MITRA)
- Tipe status pajak default
- Admin default (`EMP001` / `admin123`)
- Master data lookup lainnya

> **Catatan:** Jika ada error "user already exists" saat seed, berarti seed pernah dijalankan sebelumnya. Ini normal dan bisa diabaikan.

### 6. Verifikasi (Opsional)

Buka Prisma Studio untuk memastikan data sudah masuk:

```powershell
npx prisma studio
# Buka browser ke http://localhost:5555
```

### Urutan Lengkap (Copy-Paste)

```powershell
cd E:\Github\aplikasi-karyawan-kokarsi\backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

### Troubleshooting

| Error | Penyebab | Solusi |
|-------|---------|--------|
| `P1001: Can't reach database server at localhost:5435` | `prisma.config.ts` tidak membaca `.env` dengan benar, fallback ke port hardcoded `5435` | Pastikan sudah menjalankan `npm install` agar `dotenv` tersedia, lalu jalankan ulang `npx prisma generate` sebelum migrate |
| `P1001: Can't reach database server` (port beda) | Database belum jalan | Pastikan Docker/PostgreSQL sudah running di port yang sesuai |
| `P3009: migrate found failed migrations` | Migrasi gagal sebelumnya | Jalankan `npx prisma migrate resolve --rolled-back <nama_migrasi>` |
| `Environment variable not found: DATABASE_URL` | `.env` tidak ada | Copy dari `.env.example` dan isi `DATABASE_URL` |
| `Cannot find module 'ts-node'` | Dependencies belum install | Jalankan `npm install` dulu |

> **Penting — port mismatch:** Project ini menggunakan `prisma.config.ts` yang membaca `DATABASE_URL` via `dotenv`. Jika port di `.env` sudah diubah tapi Prisma masih menggunakan port lama, pastikan `npm install` sudah dijalankan agar `dotenv` tersedia sebagai dependency.

---

## Jalankan Aplikasi

Backend dan frontend sekarang dijalankan via **PM2** (process manager) yang memberikan auto-restart, logging, dan monitoring.

### Mode Docker

```powershell
cd E:\Github\aplikasi-karyawan-kokarsi
.\deploy\start.ps1
```

### Mode Native

```powershell
cd E:\Github\aplikasi-karyawan-kokarsi
.\deploy\start.ps1 -Mode native
```

### Stop Aplikasi

```powershell
# Mode Docker
.\deploy\start.ps1 -Stop

# Mode Native
.\deploy\start.ps1 -Stop -Mode native
```

---

## Manajemen PM2

Setelah aplikasi berjalan via `start.ps1`, Anda bisa menggunakan perintah PM2 langsung:

```powershell
# Lihat status semua proses
pm2 list

# Monitor realtime (CPU, memory, logs)
pm2 monit

# Lihat logs frontend
pm2 logs kokarsi-frontend

# Lihat logs backend
pm2 logs kokarsi-backend

# Restart frontend saja (misal setelah pnpm build)
pm2 restart kokarsi-frontend

# Restart backend saja (misal setelah compile)
pm2 restart kokarsi-backend

# Restart semua
pm2 restart ecosystem.config.cjs
```

### Auto-start saat Windows Boot (Opsional)

Jalankan sekali sebagai **Administrator** untuk mendaftarkan PM2 ke Windows Task Scheduler:

```powershell
# Install pm2-windows-startup
npm install -g pm2-windows-startup
pm2-startup install

# Save daftar proses yang sedang berjalan
pm2 save
```

Setelah ini, PM2 akan otomatis start saat Windows boot dan menjalankan semua proses yang tersimpan.

---

## Setup Backup Otomatis

Jalankan sekali sebagai **Administrator**:

### Mode Docker

```powershell
# Backup setiap hari jam 02:00, simpan di E:\Backup\kokarsi
.\deploy\setup-backup-schedule.ps1

# Custom jam dan folder
.\deploy\setup-backup-schedule.ps1 -Hour 3 -BackupDir "D:\Backup\kokarsi"
```

### Mode Native

```powershell
# Backup setiap hari jam 02:00
.\deploy\setup-backup-schedule.ps1 -Mode native -BackupDir "E:\Backup\kokarsi"

# Custom jam dan folder
.\deploy\setup-backup-schedule.ps1 -Mode native -Hour 3 -BackupDir "D:\Backup\kokarsi"
```

Verifikasi task terdaftar:
```powershell
Get-ScheduledTask -TaskName "KokarsiDatabaseBackup" | Get-ScheduledTaskInfo
```

---

## Ganti Port PostgreSQL

Jika ingin menggunakan port berbeda:

**1. Mode Docker** — edit `docker-compose.db.yml`:
```yaml
ports:
  - "PORT_BARU:5432"   # Ganti PORT_BARU dengan port yang diinginkan
```

**2. `backend\.env`** — sesuaikan port:
```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:PORT_BARU/kokarsi_karyawan"
```

**3. Restart Docker container:**
```powershell
docker compose -f docker-compose.db.yml down
docker compose -f docker-compose.db.yml up -d
```

---

## Setup Task Scheduler Manual (Opsional)

Jika ingin setup Task Scheduler tanpa script, buka **Task Scheduler** Windows:

1. **Task Scheduler** → **Create Task**
2. **General** tab:
   - Name: `KokarsiDatabaseBackup`
   - Run with highest privileges: ✓
3. **Triggers** tab → **New**:
   - Begin the task: On a schedule
   - Daily, pukul 02:00
4. **Actions** tab → **New**:
   - Program: `powershell.exe`
   - Arguments: `-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "E:\Github\aplikasi-karyawan-kokarsi\deploy\backup.ps1" -BackupDir "E:\Backup\kokarsi"`
5. **Settings** tab:
   - Run task as soon as possible after scheduled start is missed: ✓

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `cloudflared: tunnel not found` | Pastikan `config.yml` sudah diupdate dengan username Windows yang benar |
| `pg_dump: command not found` | Tambahkan `C:\Program Files\PostgreSQL\16\bin` ke PATH |
| Backend tidak bisa connect ke DB | Cek `DATABASE_URL` di `backend\.env` sudah sesuai port |
| Foto karyawan tidak tampil | Pastikan folder `backend\uploads\` sudah di-copy dari mesin lama |
| Task Scheduler tidak jalan | Jalankan `setup-backup-schedule.ps1` sebagai Administrator |
| Port conflict | Cek port yang digunakan: `netstat -ano | findstr :3000` atau `:3001` |
| Frontend close sendiri / crash | Pastikan `.env` di root ada dan terisi. Cek `pm2 logs kokarsi-frontend` untuk detail error |
| PM2 proses tidak muncul di `pm2 list` | Jalankan `.\deploy\start.ps1` dari folder root project |
| Frontend tidak restart otomatis saat boot | Jalankan `pm2 startup` dan `pm2 save` sebagai Administrator |
| `start.ps1 stuck di [1/4] Starting PostgreSQL` | Docker Desktop belum fully running. Tunggu icon Docker Desktop di system tray hijau/normal, lalu jalankan ulang |
| Backend error "JWT_SECRET environment variable is required" | `backend\.env` tidak ada atau kosong. Copy dari `backend\.env.example` dan isi nilai JWT_SECRET |

---

## Checklist Deploy

- [ ] Node.js 24 terinstall
- [ ] pnpm terinstall (`npm install -g pnpm`)
- [ ] PM2 terinstall (`npm install -g pm2`)
- [ ] Cloudflared terinstall (`winget install --id Cloudflare.cloudflared`)
- [ ] Docker Desktop atau PostgreSQL native terinstall
- [ ] Folder project sudah di-copy (termasuk `ecosystem.config.cjs`)
- [ ] Folder `~\.cloudflared\` sudah di-copy
- [ ] `config.yml` sudah diupdate dengan username Windows baru
- [ ] `backend\.env` sudah diupdate dengan port yang benar dan `JWT_SECRET` terisi
- [ ] `.env` di root project sudah dibuat (copy dari `.env.example`, isi `NUXT_ALLOWED_ORIGINS` dengan domain production)
- [ ] Database sudah dibuat (mode native)
- [ ] Aplikasi bisa diakses di `http://localhost:3000`
- [ ] `https://kokarsi-sankyu.web.id` bisa diakses dari luar
- [ ] Backup otomatis sudah di-setup
- [ ] PM2 auto-start sudah dikonfigurasi (`pm2 startup` + `pm2 save`)