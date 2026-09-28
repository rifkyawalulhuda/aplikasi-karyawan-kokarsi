# Environment Variables

Daftar semua environment variables yang diperlukan aplikasi.

## Backend (`backend/.env`)

### Database

| Variable | Wajib | Default | Keterangan |
|----------|-------|---------|-----------|
| Konfigurasi koneksi database | ✅ | - | Simpan sebagai secret environment backend |

Jangan menuliskan connection string atau password database di repository maupun dokumentasi. Gunakan secret manager atau environment deployment.

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

Simpan username, password, database name, dan konfigurasi koneksi PostgreSQL sebagai secret environment deployment. Jangan menuliskan nilai credential aktual di repository maupun dokumentasi.

::: danger
Gunakan password kuat yang dikelola melalui secret manager dan rotasi sebelum deploy ke production.
:::
