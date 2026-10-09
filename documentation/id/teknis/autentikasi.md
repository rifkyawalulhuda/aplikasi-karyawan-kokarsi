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

## Session (Sliding Session dengan Refresh Token)

Sistem menggunakan **dua token JWT** sejak implementasi sliding session:

| Token | Cookie | Masa berlaku | Secret | Fungsi |
|-------|--------|--------------|--------|--------|
| Access token | `auth_token` (HttpOnly) | `JWT_ACCESS_EXPIRES_IN` (default **15 menit**) | `JWT_SECRET` | Otorisasi setiap request |
| Refresh token | `refresh_token` (HttpOnly) | `JWT_REFRESH_EXPIRES_IN` (default **7 hari**) | `JWT_REFRESH_SECRET` (fallback `JWT_SECRET`) | Memperpanjang sesi saat aktif |

### Alur sliding session

```
Login        → backend terbitkan access_token + refresh_token (type claim berbeda)
Request API  → middleware Nitro (server/middleware/auth-refresh.ts) cek exp access token
               ├─ masih valid  → lanjut seperti biasa
               └─ hampir habis → POST {BACKEND}/auth/refresh (pakai refresh_token)
                                 → backend validasi tipe + tokenVersion + isActive
                                 → terbitkan pasangan token BARU (rotasi)
                                 → cookie diperbarui, request dilanjutkan
Client idle  → plugin client (app/plugins/auth-refresh.client.ts) POST /api/auth/refresh
               tiap 10 menit + saat tab kembali aktif
Logout/Ganti password → tokenVersion di-increment → SEMUA refresh token langsung dicabut
```

### Catatan keamanan

- Refresh token **tidak pernah** dikembalikan di response body — hanya via cookie HttpOnly.
- Claim `type: 'access' | 'refresh'` + secret terpisah: refresh token tidak bisa diputar ulang sebagai access token (divalidasi di `JwtStrategy` & `CookieJwtStrategy`).
- Endpoint `POST /auth/refresh` dan `POST /auth/revoke` di-throttle (10 req/menit).
- Keterbatasan: refresh token bersifat stateless (tidak disimpan di DB), jadi tidak ada *reuse detection* per-token — revocation dilakukan per-akun via `tokenVersion`.

## Ganti Password

```
PUT /api/auth/change-password
{ oldPassword, newPassword }
→ Verify old password
→ Hash new password
→ Update di database + increment tokenVersion (cabut semua sesi)
```

## Session (lama — stateless)

Tidak ada server-side session table. Validasi tetap stateless per-request: verifikasi signature JWT + cek `tokenVersion` & `isActive` akun di database via `validateSession()`.
