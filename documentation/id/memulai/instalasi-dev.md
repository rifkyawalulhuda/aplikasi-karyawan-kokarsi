# Instalasi & Development

Panduan ini menjelaskan cara menjalankan aplikasi di lingkungan **development lokal**.

## 1. Clone Repository

```bash
git clone https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi.git
cd aplikasi-karyawan-kokarsi
```

## 2. Install Dependencies

```bash
# Install semua dependencies (frontend + root)
pnpm install

# Install dependencies backend
cd backend
pnpm install
cd ..
```

## 3. Setup Environment Variables

### Backend

Buat file `backend/.env` berdasarkan template:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Database
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan"

# JWT — generate dengan: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-random-secret-here

# Server
PORT=3001

# Email (Maileroo)
MAILEROO_API_KEY=your-maileroo-api-key
MAILEROO_FROM_EMAIL=noreply@yourdomain.com
MAILEROO_FROM_NAME=Kokarsi System

# Font path untuk PDF generator
# FONT_DIR=C:/Windows/Fonts
```

## 4. Jalankan Database

### Mode Docker (Rekomendasi)

```bash
docker compose -f docker-compose.db.yml up -d
```

Tunggu hingga container healthy:
```bash
docker ps --filter "name=kokarsi"
# STATUS: Up X minutes (healthy)
```

### Verifikasi koneksi

```bash
cd backend
npx prisma migrate status
```

Output yang diharapkan:
```
Database schema is up to date!
```

## 5. Jalankan Aplikasi

Buka **dua terminal** secara bersamaan:

**Terminal 1 — Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 — Frontend:**
```bash
pnpm dev
```

## 6. Akses Aplikasi

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api |

## Login Default

| Akun | Username/No. Induk | Password |
|------|--------------------|----------|
| Master Admin | `EMP001` | `admin123` |
| Admin User | `admin.kokarsi` | `admin123` |
| Pengelola | `pengelola1` | `pengelola123` |

::: warning
Ganti password default segera setelah login pertama kali!
:::

## Troubleshooting Development

**Port sudah dipakai:**
```bash
# Cek port 3000/3001
netstat -ano | findstr ":3000"
netstat -ano | findstr ":3001"
```

**Database tidak connect:**
```bash
# Pastikan Docker container running
docker ps --filter "name=kokarsi"

# Restart jika perlu
docker compose -f docker-compose.db.yml restart
```

**Reset database (hanya dev):**
```bash
cd backend
npx prisma migrate reset  # ⚠️ hapus semua data!
```
