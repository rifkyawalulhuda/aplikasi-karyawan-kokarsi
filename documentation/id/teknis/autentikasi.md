# Autentikasi

## Overview

Sistem menggunakan **JWT (JSON Web Token)** yang disimpan sebagai **HttpOnly cookie** bernama `auth_token`.

## Login Flow

```
POST /api/auth/login
{ employeeNo: "EMP001", password: "..." }
          │
          ▼
AuthService.validateAdmin()
  - Cari MasterAdmin by employeeNo
  - Verify password dengan argon2
          │
          ▼
Jika valid → JWT token di-generate
  - payload: { sub: id, role, accountType }
  - expires: sesuai konfigurasi
          │
          ▼
Set cookie "auth_token" (HttpOnly, SameSite=Lax)
Response: { role, fullName, employeeNo }
```

## Dua Tipe Akun

| Akun | Tabel | Login Identifier |
|------|-------|-----------------|
| **Master Admin** | `master_admins` (link ke `employees`) | `employeeNo` |
| **Pengelola Koperasi** | `user_accounts` | `username` |

Kedua tipe akun di-handle oleh endpoint yang sama (`POST /api/auth/login`).

## JWT Strategy

### Standard JWT (`jwt`)
Digunakan untuk semua endpoint REST API biasa.

```typescript
// Ekstrak token dari Authorization header
// Bearer <token>
```

Semua controller menggunakan `@UseGuards(AuthGuard('jwt'))`.

### Cookie JWT (`jwt-cookie`)
Digunakan **khusus untuk SSE endpoint** (`GET /notifications/stream`).

```typescript
// Ekstrak token dari cookie "auth_token"
// Karena EventSource browser tidak bisa set custom headers
```

Hanya endpoint SSE yang menggunakan `@UseGuards(AuthGuard('jwt-cookie'))`.

## Nitro Proxy Auth

Frontend menggunakan Nitro proxy untuk semua request ke backend. Cookie `auth_token` di-forward otomatis oleh Nitro:

```typescript
// server/api/example.ts
const token = getCookie(event, 'auth_token') ?? ''
const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

return $fetch(`${BACKEND}/endpoint`, {
  headers: authHeader,
})
```

## Logout

```
DELETE /api/auth/logout (atau clear cookie di frontend)
→ Cookie "auth_token" dihapus
→ User redirect ke halaman login
```

## Role-Based Access

Dua role tersedia:

| Role | Akses |
|------|-------|
| `ADMIN` | Semua fitur + master data + user management + tampilan login |
| `PENGELOLA_KOPERASI` | CRUD karyawan & dokumen, tanpa akses admin-only features |

Frontend menggunakan `auth.canManageMasterData` computed untuk mengecek role:

```typescript
const canManageMasterData = computed(() =>
  auth.admin?.role === 'ADMIN'
)
```

## Ganti Password

```
PUT /api/auth/change-password
{ oldPassword, newPassword }
→ Verify old password
→ Hash new password (argon2)
→ Update di database
```

## Session

Tidak ada server-side session. Token JWT bersifat stateless — validasi dilakukan setiap request dengan memverifikasi signature JWT menggunakan `JWT_SECRET`.
