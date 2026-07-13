# Arsitektur Sistem

## Overview

Aplikasi ini menggunakan arsitektur **full-stack monorepo** dengan pemisahan jelas antara frontend dan backend.

```
aplikasi-karyawan-kokarsi/
├── app/                    # Frontend Nuxt 4
│   ├── components/         # Komponen Vue (per modul)
│   ├── composables/        # Composables (useExport, useNotifications, dll)
│   ├── layouts/            # Layout default dengan sidebar
│   └── pages/              # Halaman per route
├── backend/                # Backend NestJS
│   ├── src/
│   │   ├── auth/           # JWT Auth + Cookie Strategy
│   │   ├── employees/      # Modul karyawan
│   │   ├── contracts/      # Modul kontrak
│   │   ├── notifications/  # Sistem notifikasi SSE
│   │   ├── akte-dokumen/   # Akte dokumen
│   │   ├── legal-koperasi/ # Legal koperasi
│   │   └── ...             # Modul lainnya
│   └── prisma/             # Schema & migrations
├── server/                 # Nitro proxy routes
│   └── api/                # Proxy ke backend NestJS
└── documentation/          # Dokumentasi VitePress ini
```

## Request Flow

```
Browser
  │
  ▼
Nuxt Frontend (port 3000)
  │  • SSR / CSR
  │  • Auto-import composables
  │  • Cookie-based auth
  │
  ├─ /api/* → Nitro Server Proxy
  │              │
  │              ▼
  │           NestJS Backend (port 3001)
  │              │
  │              ▼
  │           Prisma ORM
  │              │
  │              ▼
  │           PostgreSQL (port 5435)
  │
  └─ /uploads/* → Static files dari backend
```

## Komponen Utama

### Frontend (Nuxt 4)

| Komponen | Deskripsi |
|----------|-----------|
| **Layouts** | `default.vue` — sidebar navigation, bell notifikasi, search |
| **Pages** | Route per modul (`/karyawan`, `/kontrak`, `/dokumen-legal/*`) |
| **Components** | Per modul: FormModal, DetailDrawer, tabel |
| **Composables** | `useExport`, `useNotifications`, `useAppSettings`, `useAuthStore` |
| **Server/API** | Nitro proxy — forward request ke backend dengan cookie auth |

### Backend (NestJS)

| Modul | Endpoint |
|-------|---------|
| Auth | `POST /auth/login`, `PUT /auth/change-password` |
| Employees | `GET/POST/PUT/DELETE /employees` |
| Contracts | `GET/POST/PUT/DELETE /contracts`, `POST /contracts/:id/renew` |
| WarningLetters | `GET/POST/PUT/DELETE /warning-letters` |
| EmployeeDocuments | `GET/POST/PUT/DELETE /employee-documents` |
| VendorContracts | `GET/POST/PUT/DELETE /vendor-contracts` |
| LegalKoperasi | `GET/POST/PUT/DELETE /legal-koperasi`, renew |
| AkteDokumen | `GET/POST/PUT/DELETE /akte-dokumen`, upload file |
| Notifications | `GET /notifications`, `GET /notifications/stream` (SSE) |
| ContractCron | Scheduled jobs (00:01 WIB daily, setiap 5 menit) |

## Sistem Notifikasi (SSE)

```
Contract Updated/Created/Renewed
  │ (fire-and-forget)
  ▼
NotificationsService.generateNotifications()
  │
  ├─ Pass 1: Exact date match (H-90/60/30/7/0)
  └─ Pass 2: Catch-all (scan by endDate range)
       │
       ▼
  broadcast(count) → All connected SSE clients
       │
       ▼
  Browser EventSource (useNotifications.ts)
       │
       ▼
  Bell icon badge update (real-time)
```

## Database Schema Overview

Lihat [Database Schema](/teknis/database-schema) untuk detail lengkap.

## Auth Flow

```
Login request (employeeNo + password)
  │
  ▼
AuthService.validateAdmin() → validate password hash
  │
  ▼
JWT token generated → set as HttpOnly cookie "auth_token"
  │
  ▼
All subsequent requests: cookie forwarded via Nitro proxy
  │
  ▼
Backend: @UseGuards(AuthGuard('jwt')) validates cookie
  │
  └─ SSE endpoint: @UseGuards(AuthGuard('jwt-cookie'))
     (reads from cookie, not Authorization header)
```
