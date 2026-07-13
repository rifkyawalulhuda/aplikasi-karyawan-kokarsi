# Pendahuluan

Aplikasi **Manajemen Karyawan Kokarsi PT. Sankyu** adalah sistem HR internal berbasis web yang dirancang khusus untuk **Koperasi Karyawan PT. Sankyu**.

## Apa yang Bisa Dilakukan

Sistem ini mengelola seluruh siklus hidup data karyawan secara terpusat:

- **Data Karyawan** — CRUD lengkap, import bulk, foto profil, offboarding
- **Kontrak Karyawan** — Buat/edit/perpanjang PKWT & MITRA, generate PDF otomatis
- **Dokumen Karyawan** — Surat Peringatan (SP1/SP2/SP3), Sertifikasi & Ijin
- **Dokumen Legal** — Kontrak Customer/Vendor, Legal Koperasi, Akte Dokumen
- **Notifikasi** — Pengingat masa berlaku real-time via SSE
- **Dashboard** — Statistik & visualisasi data karyawan
- **Pengaturan** — Logo, nama organisasi, tampilan login

## Dua Peran Pengguna

| Peran | Deskripsi | Akses |
|-------|-----------|-------|
| **Master Admin** | Pengelola penuh sistem | Semua fitur termasuk master data, user management, tampilan login |
| **Pengelola Koperasi** | Operator data harian | CRUD karyawan & dokumen, tanpa akses pengaturan sistem |

::: tip
Untuk detail lengkap perbedaan akses per fitur, lihat [Peran & Akses](/referensi/peran-akses).
:::

## URL Aplikasi

| Environment | URL |
|-------------|-----|
| **Production** | `https://kokarsi-sankyu.web.id` |
| **Frontend (lokal)** | `http://localhost:3000` |
| **Backend API (lokal)** | `http://localhost:3001/api` |

## Tech Stack

```
Frontend    : Nuxt 4 + Vue 3 + Nuxt UI v4 + Tailwind CSS
Backend     : NestJS + Prisma ORM + JWT Auth
Database    : PostgreSQL 16
Infra       : Docker + PM2 + Cloudflare Tunnel
Notifikasi  : SSE (Server-Sent Events) + Maileroo Email API
```

## Mulai dari Mana?

- Jika Anda **pengguna aplikasi** → [Panduan Pengguna](/panduan-pengguna/login)
- Jika Anda **developer / IT** yang ingin deploy → [Prasyarat](/memulai/prasyarat)
- Jika Anda ingin **development lokal** → [Instalasi & Development](/memulai/instalasi-dev)
