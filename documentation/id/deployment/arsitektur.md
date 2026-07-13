# Arsitektur Deployment

## Diagram Sistem

```
Internet (User Browser)
        │
        ▼
┌──────────────────────┐
│   Cloudflare CDN     │  kokarsi-sankyu.web.id
│   + DDoS Protection  │
└──────────┬───────────┘
           │
           ▼ (HTTPS → encrypted tunnel)
┌──────────────────────┐
│  Cloudflare Tunnel   │  cloudflared daemon
│  (kokarsi-tunnel)    │
└──────────┬───────────┘
           │
           ▼ (local)
┌──────────────────────────────────────────┐
│            Windows Machine               │
│                                          │
│  /* ──────► localhost:3000 (Nuxt)        │
│             │                            │
│             └── /api/* proxy ──►         │
│                                          │
│  /uploads/* ─► localhost:3001 (NestJS)   │
│                                          │
│  localhost:3001 ◄──► localhost:5435      │
│     (NestJS)          (PostgreSQL)       │
└──────────────────────────────────────────┘
```

## Penjelasan Komponen

| Komponen | Port | Teknologi | Dikelola oleh |
|----------|------|-----------|---------------|
| **Frontend** | 3000 | Nuxt 4 (Node.js) | PM2 (`kokarsi-frontend`) |
| **Backend API** | 3001 | NestJS (Node.js) | PM2 (`kokarsi-backend`) |
| **Database** | 5435 | PostgreSQL 16 | Docker container |
| **Tunnel** | - | Cloudflare Tunnel | Windows process |

## Alur Request

1. User buka `https://kokarsi-sankyu.web.id`
2. Request masuk ke Cloudflare CDN
3. Cloudflare Tunnel forward ke `localhost:3000`
4. Nuxt (frontend) serve halaman HTML
5. Request API (`/api/*`) di-proxy Nuxt ke `localhost:3001`
6. NestJS proses request, query PostgreSQL di port 5435
7. Response dikembalikan ke user

## Kenapa Cloudflare Tunnel?

- **Tanpa IP publik** — Mesin tidak perlu IP statis
- **HTTPS otomatis** — SSL dihandle Cloudflare
- **Aman** — Koneksi keluar dari mesin, tidak ada port terbuka ke internet

## Mode Deployment

| Mode | Database | Rekomendasi |
|------|----------|-------------|
| **Docker** | PostgreSQL di container | ✅ Production |
| **Native** | PostgreSQL terinstal di OS | Alternatif |

Pilih salah satu mode di halaman berikutnya.
