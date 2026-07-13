# Environment Variables

Daftar semua environment variables yang diperlukan aplikasi.

## Backend (`backend/.env`)

### Database

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |

**Contoh:**
```
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan"
```

### Authentication

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| `JWT_SECRET` | ✅ | - | Secret key JWT, minimal 32 karakter |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Server

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| `PORT` | ❌ | `3001` | Port backend |

### Email (Maileroo)

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| `MAILEROO_API_KEY` | ❌ | - | API key Maileroo, diperlukan untuk email notifikasi |
| `MAILEROO_FROM_EMAIL` | ❌ | `noreply@localhost` | Email pengirim (gunakan domain valid!) |
| `MAILEROO_FROM_NAME` | ❌ | `System` | Nama pengirim |

::: warning Email Notifikasi
Jika `MAILEROO_API_KEY` tidak diset, notifikasi email akan dilewati (skip) tanpa error. Notifikasi in-app (bell icon) tetap bekerja.

Jangan gunakan `noreply@localhost` di production — Maileroo akan menolak email dengan domain tidak valid.
:::

### Font (PDF Generator)

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| `FONT_DIR` | ❌ | OS default | Path folder font untuk generator PDF |

**Contoh per OS:**
```
# Windows
FONT_DIR=C:/Windows/Fonts

# Linux/Docker
FONT_DIR=/usr/share/fonts/truetype
```

## Contoh File `backend/.env`

```env
# Database
DATABASE_URL="postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan"

# JWT
JWT_SECRET=your-random-secret-min-32-chars-here

# Server
PORT=3001

# Email (Maileroo)
MAILEROO_API_KEY=your-maileroo-api-key
MAILEROO_FROM_EMAIL=noreply@kokarsi-sankyu.com
MAILEROO_FROM_NAME=Kokarsi PT. Sankyu

# Font (opsional)
# FONT_DIR=C:/Windows/Fonts
```

## Template (`.env.example`)

File `backend/.env.example` tersedia sebagai template:
```bash
cp backend/.env.example backend/.env
# Edit sesuai kebutuhan
```

## Docker PostgreSQL Credentials

Credentials default Docker PostgreSQL (dari `docker-compose.db.yml`):

| Key | Value |
|-----|-------|
| Host | `localhost` |
| Port | `5435` |
| Database | `kokarsi_karyawan` |
| Username | `kokarsi` |
| Password | `kokarsi2026` |

::: danger
Ganti password default sebelum deploy ke production!
:::
