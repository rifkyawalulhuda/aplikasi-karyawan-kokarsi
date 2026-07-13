---
layout: home

hero:
  name: Kokarsi Docs
  text: Aplikasi Manajemen Karyawan
  tagline: Dokumentasi lengkap untuk Koperasi Karyawan PT. Sankyu — panduan pengguna, deployment, dan referensi teknis.
  actions:
    - theme: brand
      text: Mulai Cepat
      link: /id/memulai/pendahuluan
    - theme: alt
      text: Panduan Pengguna
      link: /id/panduan-pengguna/login
    - theme: alt
      text: Deployment
      link: /id/deployment/arsitektur

features:
  - icon: 👥
    title: Manajemen Karyawan
    details: CRUD data karyawan lengkap, import bulk via Excel, offboarding, riwayat status, dan detail per karyawan.
  - icon: 📄
    title: Manajemen Kontrak
    details: Buat, edit, perpanjang kontrak PKWT/MITRA, generate PDF otomatis, dan pantau masa berlaku.
  - icon: 🔔
    title: Notifikasi Real-time
    details: Pengingat masa berlaku dokumen via SSE (Server-Sent Events), bell icon di sidebar, dan halaman notifikasi lengkap.
  - icon: 📊
    title: Dashboard
    details: Statistik karyawan, distribusi kontrak, trend rekrutmen & offboarding, semua dalam satu halaman.
  - icon: 🗂️
    title: Dokumen Legal
    details: Kelola Kontrak Vendor/Customer, Legal Koperasi, dan Akte Dokumen dengan fitur upload file dan detail drawer.
  - icon: 🚀
    title: Deployment Mudah
    details: Jalankan via Docker + PM2 + Cloudflare Tunnel, dengan script otomatis start.ps1.
---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | Nuxt 4, Vue 3, Nuxt UI v4, Tailwind CSS, TanStack Table |
| **Backend** | NestJS, Prisma ORM, Passport JWT |
| **Database** | PostgreSQL 16 |
| **Infrastruktur** | Docker, PM2, Cloudflare Tunnel |
| **Email** | Maileroo API |

## Akses Cepat

- [Panduan Login & Akun](/id/panduan-pengguna/login)
- [Cara Deploy ke Mesin Baru](/id/deployment/docker)
- [Environment Variables](/id/teknis/environment-variables)
- [Perbedaan Role Admin vs Pengelola](/id/referensi/peran-akses)
- [Troubleshooting](/id/referensi/troubleshooting)
