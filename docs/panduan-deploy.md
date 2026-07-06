# Panduan Deploy - Aplikasi Karyawan Kokarsi PT. Sankyu

> Dokumen ini menjelaskan cara deploy aplikasi ke mesin baru, baik menggunakan Docker maupun PostgreSQL native.

---

## Prasyarat

Install software berikut di mesin baru:

| Software | Versi | Download |
|----------|-------|---------|
| Node.js | 24.x | https://nodejs.org |
| pnpm | terbaru | `npm install -g pnpm` |
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
  │   └── .env                  # Konfigurasi environment
  ├── node_modules\
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
```

**Mode Native** (port 5432 default PostgreSQL):
```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5432/kokarsi_karyawan"
```

Jika port PostgreSQL di mesin baru berbeda, sesuaikan angka port-nya.

### 2. Sesuaikan `~\.cloudflared\config.yml`

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

## Jalankan Aplikasi

### Mode Docker

```powershell
cd E:\Github\aplikasi-karyawan-kokarsi
.\deploy\START.bat

# Atau langsung via PowerShell
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
.\deploy\STOP.bat

# Mode Native
.\deploy\start.ps1 -Stop -Mode native
```

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

---

## Checklist Deploy

- [ ] Node.js 24 terinstall
- [ ] pnpm terinstall (`npm install -g pnpm`)
- [ ] Cloudflared terinstall (`winget install --id Cloudflare.cloudflared`)
- [ ] Docker Desktop atau PostgreSQL native terinstall
- [ ] Folder project sudah di-copy
- [ ] Folder `~\.cloudflared\` sudah di-copy
- [ ] `config.yml` sudah diupdate dengan username Windows baru
- [ ] `backend\.env` sudah diupdate dengan port yang benar
- [ ] Database sudah dibuat (mode native)
- [ ] Aplikasi bisa diakses di `http://localhost:3000`
- [ ] `https://kokarsi-sankyu.web.id` bisa diakses dari luar
- [ ] Backup otomatis sudah di-setup