# Prasyarat

Sebelum melakukan instalasi atau deployment, pastikan semua software berikut sudah terinstal.

## Software yang Diperlukan

| Software | Versi | Keterangan |
|----------|-------|------------|
| **Node.js** | 24.x LTS | Runtime JavaScript |
| **pnpm** | terbaru | Package manager |
| **PM2** | terbaru | Process manager untuk production |
| **Docker Desktop** | terbaru | Untuk mode database Docker (rekomendasi) |
| **PostgreSQL** | 16.x | Hanya jika mode native (tanpa Docker) |
| **Git** | terbaru | Version control |

## Instalasi Software

### Node.js 24

Download dari [nodejs.org](https://nodejs.org) dan pilih versi **24.x LTS**.

Verifikasi:
```bash
node --version   # v24.x.x
npm --version
```

### pnpm

```bash
npm install -g pnpm
pnpm --version
```

### PM2

```bash
npm install -g pm2
pm2 --version
```

### Docker Desktop (Rekomendasi)

Download dari [docker.com](https://www.docker.com/products/docker-desktop).

Verifikasi:
```bash
docker --version
docker compose version
```

::: info Mode Database
Aplikasi ini mendukung dua mode database:
- **Docker** (rekomendasi) — PostgreSQL berjalan di container Docker
- **Native** — PostgreSQL terinstal langsung di OS

Lihat [panduan deployment](/id/deployment/arsitektur) untuk perbandingan lebih detail.
:::

## Akses Repositori

Pastikan Anda memiliki akses ke repositori:

```
https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi
```

Clone repositori:
```bash
git clone https://github.com/rifkyawalulhuda/aplikasi-karyawan-kokarsi.git
cd aplikasi-karyawan-kokarsi
```

## Port yang Digunakan

| Port | Service |
|------|---------|
| `3000` | Frontend (Nuxt) |
| `3001` | Backend (NestJS) |
| `5435` | PostgreSQL (Docker mode) |

Pastikan port-port ini tidak digunakan oleh aplikasi lain.
