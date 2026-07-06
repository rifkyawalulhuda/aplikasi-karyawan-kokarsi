# Deployment Plan: Kokarsi PT. Sankyu

> Target: `https://kokarsi-sankyu.web.id`
>
> Stack: Nuxt 4 (production) + NestJS + PostgreSQL (Docker) + Cloudflare Tunnel

---

## Arsitektur

```
Internet ── Cloudflare ── Tunnel ── Windows Machine
    │                                    │
    │  kokarsi-sankyu.web.id             │
    ├── /uploads/* ──► localhost:3001    │ ← Backend (static files)
    └── /* ─────────► localhost:3000     │ ← Nuxt production server
                          │              │
                          └── proxy server-side → localhost:3001/api/*
```

**Alasan:**
- `/api/*` tetap lewat Nitro proxy (server-side, cookie auth tetap jalan)
- `/uploads/*` (foto, dokumen) langsung dari backend lewat tunnel

---

## Files Changed

| # | File | Action | Untuk |
|---|------|--------|-------|
| 1 | `app/composables/useAppSettings.ts` | Edit | Ganti prefix `http://localhost:3001` → relative |
| 2 | `app/pages/kontrak.vue` | Edit | Ganti `openDocument()` prefix |
| 3 | `app/pages/karyawan/index.vue` | Edit | Ganti prefix foto karyawan |
| 4 | `app/components/karyawan/EditModal.vue` | Edit | Ganti prefix foto |
| 5 | `app/components/karyawan/detail/ProfileHeader.vue` | Edit | Hapus `BACKEND` constant + prefix foto |
| 6 | `app/components/karyawan/detail/ContractTimeline.vue` | Edit | Ganti prefix link dokumen |
| 7 | `app/components/karyawan/detail/WarningLetterList.vue` | Edit | Ganti prefix link dokumen |
| 8 | `deploy/start.ps1` | **Baru** | Startup script Windows |
| 9 | `~/.cloudflared/config.yml` | **Baru** | Tunnel config |

---

## Step-by-Step

### Step 1: Ganti hardcode `http://localhost:3001` → relative path

Semua gambar/foto/dokumen harus pakai path relatif agar bisa diakses lewat domain publik.

| File | Cari | Ganti |
|------|------|-------|
| `useAppSettings.ts` | `` `http://localhost:3001${settings.value.appLogoUrl}` `` | `settings.value.appLogoUrl \|\| ''` |
| `kontrak.vue:169` | `const fullUrl = url.startsWith('/') ? \`http://localhost:3001${url}\` : url` | `const fullUrl = url` |
| `karyawan/index.vue:314` | `` `http://localhost:3001${row.original.fotoKaryawan}` `` | `row.original.fotoKaryawan` |
| `EditModal.vue:205` | `` `http://localhost:3001${props.employee?.fotoKaryawan}` `` | `props.employee?.fotoKaryawan` |
| `ProfileHeader.vue:44` | `` `${BACKEND}${employee.fotoKaryawan}` `` | `employee.fotoKaryawan` |
| `ContractTimeline.vue:83` | `` `http://localhost:3001${contract.documentUrl}` `` | `contract.documentUrl` |
| `WarningLetterList.vue:104` | `` `http://localhost:3001${letter.documentUrl}` `` | `letter.documentUrl` |

---

### Step 2: Install & setup cloudflared

```powershell
# Install
winget install --id Cloudflare.cloudflared

# Login ke Cloudflare (browser akan terbuka)
cloudflared tunnel login

# Buat named tunnel
cloudflared tunnel create kokarsi-tunnel
# → Output: Tunnel ID + credentials file di ~\.cloudflared\

# Edit config
notepad "$env:USERPROFILE\.cloudflared\config.yml"
```

**`~/.cloudflared/config.yml`:**
```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\Admin\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: kokarsi-sankyu.web.id
    path: /uploads/*
    service: http://localhost:3001
  - hostname: kokarsi-sankyu.web.id
    service: http://localhost:3000
  - service: http_status:404
```

**DNS Route:**
```powershell
cloudflared tunnel route dns kokarsi-tunnel kokarsi-sankyu.web.id
```

---

### Step 3: Build Frontend Production

```bash
pnpm build
```

Output: `.output/server/index.mjs`

---

### Step 4: Startup Script

`deploy/start.ps1` — menjalankan 4 service:
1. Docker PostgreSQL
2. Backend (`node dist/main.js`)
3. Frontend production (`node .output/server/index.mjs`)
4. Cloudflare Tunnel (`cloudflared tunnel run kokarsi-tunnel`)

Jalankan:
```powershell
.\deploy\start.ps1
```

Stop:
```powershell
.\deploy\start.ps1 -Stop
```

---

## Portability

Copy ke mesin baru:

```
.output/                    # Build frontend
backend/dist/               # Backend compiled
backend/.env                # Env vars
backend/prisma/schema.prisma
backend/node_modules/
node_modules/
docker-compose.db.yml
deploy/start.ps1
~/.cloudflared/             # Tunnel credentials
```

Install di mesin baru:
```powershell
winget install --id Cloudflare.cloudflared
# Docker Desktop
# Node.js 24
```

---

## Test Checklist

- [ ] `http://localhost:3000` — halaman login muncul
- [ ] `https://kokarsi-sankyu.web.id` — bisa diakses dari luar
- [ ] Login berhasil
- [ ] Foto karyawan tampil
- [ ] Dokumen kontrak bisa di-download
- [ ] Dashboard statistik muncul

---

## Rollback

```powershell
# Stop semua service
.\deploy\start.ps1 -Stop

# Kembali ke dev
pnpm dev
```
