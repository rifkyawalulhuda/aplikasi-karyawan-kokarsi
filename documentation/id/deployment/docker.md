# Deployment Docker

Mode deployment yang **direkomendasikan** untuk production menggunakan Docker untuk database PostgreSQL.

## Prasyarat

- Node.js 24.x, pnpm, PM2, Docker Desktop sudah terinstal
- File aplikasi sudah di-copy ke mesin target
- Lihat [Prasyarat](/id/memulai/prasyarat) untuk detail

## Langkah 1: Setup File Konfigurasi

### Backend `.env`

Buat `backend/.env`:

```env
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan"
JWT_SECRET=your-secret-key-min-32-chars
PORT=3001
MAILEROO_API_KEY=your-api-key
MAILEROO_FROM_EMAIL=noreply@yourdomain.com
MAILEROO_FROM_NAME=Kokarsi System
```

## Langkah 2: Build Aplikasi

```powershell
# Di root folder aplikasi
pnpm install
pnpm build

# Build backend
cd backend
pnpm install
npm run build
cd ..
```

## Langkah 3: Jalankan Semua Service

Gunakan script otomatis:

```powershell
.\deploy\start.ps1
```

Script ini akan:
1. Start PostgreSQL Docker container
2. Tunggu hingga DB healthy
3. Jalankan database migration
4. Start frontend via PM2
5. Start backend via PM2
6. Start Cloudflare Tunnel

## Langkah 4: Verifikasi

```powershell
# Cek status PM2
pm2 list

# Cek status Docker
docker ps --filter "name=kokarsi"
```

Output yang diharapkan:
```
┌────┬─────────────────────┬─────────┬──────────┐
│ id │ name                │ status  │ uptime   │
├────┼─────────────────────┼─────────┼──────────┤
│ 0  │ kokarsi-backend     │ online  │ 1m       │
│ 1  │ kokarsi-frontend    │ online  │ 1m       │
└────┴─────────────────────┴─────────┴──────────┘
```

## Manajemen Service

### Stop semua service
```powershell
.\deploy\start.ps1 -Stop
```

### Restart service tertentu
```powershell
pm2 restart kokarsi-backend
pm2 restart kokarsi-frontend
```

### Lihat logs
```powershell
pm2 logs kokarsi-backend
pm2 logs kokarsi-frontend
```

### Restart otomatis setelah reboot Windows

```powershell
pm2 startup
pm2 save
```

## Database Management

### Backup database
```powershell
.\deploy\backup.ps1
```

### Restore database
```powershell
.\deploy\restore.ps1
```

### Jalankan migration manual
```powershell
cd backend
npx prisma migrate deploy
```

## Troubleshooting

**Docker container tidak start:**
```powershell
docker compose -f docker-compose.db.yml logs kokarsi-postgres
```

**PM2 process crash:**
```powershell
pm2 logs kokarsi-backend --lines 50
pm2 logs kokarsi-frontend --lines 50
```

**Database migration gagal:**
```powershell
cd backend
npx prisma migrate status
npx prisma migrate deploy
```
