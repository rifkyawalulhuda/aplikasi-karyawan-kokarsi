# Panduan Deploy ke Server Lubuntu

> Dokumen langkah demi langkah untuk deploy Aplikasi Karyawan Kokarsi PT. Sankyu dari mesin Windows development ke server Lubuntu (Linux).

---

## Arsitektur

```
Internet ── Cloudflare ── Tunnel ── Lubuntu Server
    │                                    │
    │  kokarsi-sankyu.web.id             │
    ├── /uploads/* ──► localhost:3001    │ ← Backend (NestJS)
    └── /* ─────────► localhost:3000     │ ← Frontend (Nuxt)
                          │              │
                          └── proxy ─────► localhost:3001/api/*
```

---

## Prasyarat di Server Lubuntu

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js 24.x

```bash
# Install via NodeSource
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node -v   # v24.x.x
npm -v
```

### 3. Install pnpm

```bash
sudo npm install -g pnpm

# Verifikasi
pnpm -v
```

### 4. Install PM2

```bash
sudo npm install -g pm2

# Verifikasi
pm2 -v
```

### 5. Install Docker (untuk PostgreSQL)

```bash
# Install Docker
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker

# Agar bisa menjalankan docker tanpa sudo
sudo usermod -aG docker $USER
# Logout lalu login lagi agar group生效

# Verifikasi
docker --version
docker compose version
```

### 6. Install Cloudflared

```bash
# Download cloudflared untuk Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verifikasi
cloudflared --version
```

### 7. Install Build Essentials (untuk bcrypt dan native modules)

```bash
sudo apt install -y build-essential python3
```

---

## Langkah Deploy

### Step 1: Copy Project dari Windows ke Server

Di mesin **Windows**, buat arsip project:

```powershell
# Di Windows (PowerShell), buka folder project
cd E:\Github\aplikasi-karyawan-kokarsi

# Build frontend dulu (pastikan sudah jalan)
pnpm build

# Build backend
cd backend
npm install
npm run build
cd ..

# Buat file .env production di root
Copy-Item .env.example .env
# Edit .env isi value production (lihat Step 3)
```

Copy ke server menggunakan `scp` atau `rsync`:

```powershell
# Opsi A: scp (dari Windows ke Lubuntu)
scp -r E:\Github\aplikasi-karyawan-kokarsi user@SERVER_IP:/home/user/kokarsi

# Opsi B: rsync (lebih fleksibel)
rsync -avz --progress E:\Github\aplikasi-karyawan-kokarsi/ user@SERVER_IP:/home/user/kokarsi/
```

> **Tips:** Jika project sangat besar, exclude folder yang tidak perlu:
> ```powershell
> rsync -avz --progress --exclude 'node_modules' --exclude '.output' --exclude 'backend/dist' E:\Github\aplikasi-karyawan-kokarsi/ user@SERVER_IP:/home/user/kokarsi/
> ```

### Step 2: Setup di Server Lubuntu

SSH ke server:

```bash
ssh user@SERVER_IP
```

Install dependencies dan build:

```bash
cd ~/kokarsi

# Install dependencies frontend
pnpm install

# Install dependencies backend
cd backend
npm install
cd ..

# Build frontend
pnpm build

# Build backend
cd backend
npm run build
cd ..
```

### Step 3: Konfigurasi Environment Variables

#### 3a. Frontend `.env` (root project)

```bash
cd ~/kokarsi
cp .env.example .env
nano .env
```

Isi dengan:

```env
NODE_ENV=production
BACKEND_URL=http://localhost:3001/api
NUXT_ALLOWED_ORIGINS=https://kokarsi-sankyu.web.id,http://localhost:3000
NUXT_PUBLIC_SITE_URL=https://kokarsi-sankyu.web.id
```

#### 3b. Backend `.env`

```bash
cd ~/kokarsi/backend
cp .env.example .env
nano .env
```

Isi dengan (sesuaikan password dan JWT_SECRET):

```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5432/kokarsi_karyawan"
JWT_SECRET="<generate-random-string-minimal-32-char>"
PORT=3001
MAILEROO_API_KEY=your-api-key
MAILEROO_FROM_EMAIL=noreply@kokarsi-sankyu.web.id
MAILEROO_FROM_NAME=Kokarsi System
FONT_DIR=/usr/share/fonts/truetype
```

Generate JWT_SECRET:

```bash
openssl rand -hex 32
```

### Step 4: Setup Database PostgreSQL via Docker

```bash
cd ~/kokarsi

# Buat folder uploads agar tidak hilang saat container rebuild
mkdir -p backend/uploads

# Jalankan PostgreSQL via Docker
docker compose -f docker-compose.db.yml up -d

# Cek status
docker ps
```

### Step 5: Run Prisma Migrate & Seed

```bash
cd ~/kokarsi/backend

# Generate Prisma Client
npx prisma generate

# Terapkan semua migrasi
npx prisma migrate deploy

# Jalankan seed data awal
npm run prisma:seed
```

Jika `migrate deploy` error kolom tidak ditemukan, gunakan:

```bash
npx prisma db push
```

### Step 6: Konfigurasi PM2

```bash
cd ~/kokarsi

# Buat logs directory
mkdir -p logs

# Jalankan dengan PM2
pm2 start ecosystem.config.cjs

# Cek status
pm2 list
```

Output yang diharapkan:

```
┌─────┬──────────────────┬──────┬────────┬──────┬─────────┐
│ id  │ name             │ mode │ ↺      │ status│ cpu    │
├─────┼──────────────────┼──────┼────────┼──────┼─────────┤
│ 0   │ kokarsi-backend  │ fork │ 0      │ online│ 0%     │
│ 1   │ kokarsi-frontend │ fork │ 0      │ online│ 0%     │
└─────┴──────────────────┴──────┴────────┴──────┴─────────┘
```

### Step 7: Setup Cloudflare Tunnel

#### 7a. Login ke Cloudflare

```bash
cloudflared tunnel login
# Browser URL akan muncul — buka di browser Windows/Mac lalu authorize
```

#### 7b. Buat Named Tunnel

```bash
cloudflared tunnel create kokarsi-tunnel
# Catat Tunnel ID dari output
```

#### 7c. Buat DNS Route

```bash
cloudflared tunnel route dns kokarsi-tunnel kokarsi-sankyu.web.id
```

#### 7d. Buat Config

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Isi dengan:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<USERNAME>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: kokarsi-sankyu.web.id
    path: /uploads/.*
    service: http://localhost:3001
  - hostname: kokarsi-sankyu.web.id
    service: http://localhost:3000
  - service: http_status:404
```

Ganti `<TUNNEL_ID>` dan `<USERNAME>` dengan nilai yang sesuai.

#### 7e. Jalankan Tunnel via PM2

```bash
pm2 start cloudflared -- tunnel run kokarsi-tunnel --name kokarsi-tunnel
pm2 save
```

### Step 8: Setup Auto-start saat Server Boot

```bash
# Generate startup script PM2
pm2 startup

# Jalankan perintah yang ditampilkan PM2 (output berisi sudo ...)
# Contoh:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u user --hp /home/user

# Save current process list
pm2 save
```

### Step 9: Setup Backup Database Otomatis

```bash
# Buat script backup
mkdir -p ~/backups/kokarsi
nano ~/backups/backup-kokarsi.sh
```

Isi:

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/$USER/backups/kokarsi"
mkdir -p "$BACKUP_DIR"

docker exec kokarsi-postgres pg_dump -U kokarsi kokarsi_karyawan | gzip > "$BACKUP_DIR/kokarsi_$TIMESTAMP.sql.gz"

# Hapus backup lebih dari 30 hari
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

```bash
chmod +x ~/backups/backup-kokarsi.sh

# Tambah cron job (backup jam 2 pagi setiap hari)
crontab -e
```

Tambahkan baris:

```
0 2 * * * /home/<USERNAME>/backups/backup-kokarsi.sh
```

---

## Verifikasi Deploy

| # | Cek | Perintah / URL | Expected |
|---|-----|---------------|----------|
| 1 | PM2 status | `pm2 list` | 3 proses online (backend, frontend, tunnel) |
| 2 | Backend health | `curl http://localhost:3001/api` | Response JSON |
| 3 | Frontend | `curl http://localhost:3000` | HTML response |
| 4 | Login page | Buka `https://kokarsi-sankyu.web.id` | Halaman login muncul |
| 5 | Login | `EMP001` / `admin123` | Berhasil masuk dashboard |
| 6 | Foto karyawan | Klik menu Karyawan | Foto tampil |
| 7 | Dokumen kontrak | Klik menu Kontrak → Download | File PDF terdownload |

---

## Perintah PM2 yang Sering Dipakai

```bash
# Lihat status
pm2 list

# Lihat logs
pm2 logs kokarsi-backend
pm2 logs kokarsi-frontend
pm2 logs kokarsi-tunnel

# Restart semua
pm2 restart ecosystem.config.cjs

# Restart satu proses
pm2 restart kokarsi-backend

# Stop semua
pm2 stop ecosystem.config.cjs

# Monitor realtime
pm2 monit

# Save & restore process list
pm2 save
pm2 resurrect
```

---

## Update Aplikasi

Jika ada update dari Git:

```bash
cd ~/kokarsi

# Pull update
git pull origin main

# Rebuild frontend
pnpm build

# Rebuild backend
cd backend
npm install
npm run build
cd ..

# Jalankan migrasi baru jika ada
cd backend
npx prisma migrate deploy
cd ..

# Restart semua
pm2 restart ecosystem.config.cjs
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `pm2: command not found` | Install: `sudo npm install -g pm2` |
| `pnpm: command not found` | Install: `sudo npm install -g pnpm` |
| Backend error `JWT_SECRET` | Pastikan `backend/.env` ada dan `JWT_SECRET` terisi |
| Database connection refused | Cek Docker: `docker ps`, restart: `docker compose -f docker-compose.db.yml restart` |
| `bcrypt` build error | Install build tools: `sudo apt install -y build-essential python3` |
| Cloudflared tunnel error | Cek config: `cat ~/.cloudflared/config.yml`, pastikan credentials-file path benar |
| Frontend crash di PM2 | Cek log: `pm2 logs kokarsi-frontend`, pastikan `.env` root ada |
| Upload file tidak tampil | Pastikan folder `backend/uploads` ada dan tidak di-gitignore |
| Port sudah terpakai | Cek: `sudo lsof -i :3000` atau `sudo lsof -i :3001` |
| Migrate deploy error kolom | Gunakan `npx prisma db push` sebagai ganti |

---

## Checklist Deploy

- [ ] Server Lubuntu sudah terinstall dan terupdate
- [ ] Node.js 24.x terinstall
- [ ] pnpm terinstall
- [ ] PM2 terinstall
- [ ] Docker terinstall dan berjalan
- [ ] Cloudflared terinstall
- [ ] Build essentials terinstall (`build-essential python3`)
- [ ] Project sudah di-copy ke server
- [ ] `.env` frontend sudah dikonfigurasi
- [ ] `backend/.env` sudah dikonfigurasi (termasuk `JWT_SECRET`)
- [ ] PostgreSQL sudah berjalan via Docker
- [ ] Prisma migrate sudah dijalankan
- [ ] Seed data sudah dijalankan
- [ ] PM2 sudah menjalankan semua proses
- [ ] Cloudflare Tunnel sudah berjalan
- [ ] Aplikasi bisa diakses via `https://kokarsi-sankyu.web.id`
- [ ] Login berhasil
- [ ] Backup cron sudah disetup
- [ ] PM2 auto-start sudah dikonfigurasi

---

## Port yang Digunakan

| Port | Service |
|------|---------|
| 3000 | Nuxt Frontend (production) |
| 3001 | NestJS Backend API |
| 5432 | PostgreSQL (via Docker) |

---

## Firewall (Opsional)

Jika menggunakan UFW firewall:

```bash
# Izinkan SSH
sudo ufw allow 22/tcp

# Izinkan HTTP/HTTPS (jika pakai reverse proxy selain cloudflared)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

> **Catatan:** Cloudflare Tunnel tidak membutuhkan port terbuka di server — tunnel menghubungkan keluar ke Cloudflare, bukan sebaliknya.
