# Cloudflare Tunnel

Cloudflare Tunnel menghubungkan aplikasi lokal ke internet tanpa membuka port atau memiliki IP publik.

## Prasyarat

- Cloudflared sudah terinstal: `winget install --id Cloudflare.cloudflared`
- Akun Cloudflare dengan domain yang terdaftar

## Setup Awal (Sekali)

### 1. Login ke Cloudflare

```powershell
cloudflared tunnel login
```

Browser akan terbuka, login dan pilih domain yang akan digunakan.

### 2. Buat Tunnel

```powershell
cloudflared tunnel create kokarsi-tunnel
```

Catat **Tunnel ID** yang dihasilkan.

### 3. Buat Konfigurasi

Buat file `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<USERNAME>\.cloudflared\<TUNNEL_ID>.json

ingress:
  # Uploads/file statics langsung dari backend
  - hostname: kokarsi-sankyu.web.id
    path: /uploads
    service: http://localhost:3001

  # Semua request lain ke frontend Nuxt
  - hostname: kokarsi-sankyu.web.id
    service: http://localhost:3000

  # Catch-all (wajib ada)
  - service: http_status:404
```

### 4. Routing DNS

```powershell
cloudflared tunnel route dns kokarsi-tunnel kokarsi-sankyu.web.id
```

## Menjalankan Tunnel

Tunnel dijalankan otomatis via `start.ps1`:

```powershell
.\deploy\start.ps1
```

Atau jalankan manual:

```powershell
cloudflared tunnel run kokarsi-tunnel
```

## Memindahkan ke Mesin Baru

Copy folder ini ke mesin baru:

```
C:\Users\<USERNAME>\.cloudflared\
├── cert.pem
├── config.yml
└── <TUNNEL_ID>.json
```

::: warning
Jangan bagikan file `<TUNNEL_ID>.json` — ini adalah credentials tunnel Anda.
:::

## Troubleshooting

**Tunnel tidak connect:**
```powershell
cloudflared tunnel info kokarsi-tunnel
cloudflared tunnel run kokarsi-tunnel --loglevel debug
```

**DNS belum propagate:**
```powershell
nslookup kokarsi-sankyu.web.id
```

**Cek status tunnel di Cloudflare Dashboard:**
Buka `dash.cloudflare.com` → Zero Trust → Tunnels
