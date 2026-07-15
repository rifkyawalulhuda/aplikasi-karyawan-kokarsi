# Troubleshooting

Kumpulan masalah umum dan solusinya berdasarkan pengalaman development dan deployment.

## Backend & Database

### P1017 ConnectionClosed — Tidak bisa login

**Gejala:** `Internal Server Error` saat login, log backend menunjukkan `P1017 ConnectionClosed`

**Penyebab:** Docker container PostgreSQL tidak berjalan.

**Solusi:**
```powershell
# Cek status container
docker ps --filter "name=kokarsi"

# Start container jika mati
docker compose -f docker-compose.db.yml up -d

# Tunggu healthy, lalu restart backend
pm2 restart kokarsi-backend
```

---

### P2022 Column Not Found — Error saat input data

**Gejala:** `PrismaClientKnownRequestError: The column X does not exist`

**Penyebab:** Migration SQL menggunakan camelCase tanpa `@map()`, PostgreSQL lowercased nama kolom.

**Solusi:** Tambah `@map()` di schema Prisma dan recreate tabel dengan snake_case columns.

---

### Prisma Migration Drift

**Gejala:** `npx prisma migrate dev` gagal dengan pesan schema drift.

**Solusi (tanpa hapus data):**
```bash
# Generate SQL untuk perubahan baru saja
cd backend
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script

# Buat migration manual
$ts = Get-Date -Format "yyyyMMddHHmmss"
New-Item -ItemType Directory -Path "prisma/migrations/${ts}_nama_migration"
# Tulis SQL ke migration.sql
npx prisma migrate resolve --applied ${ts}_nama_migration
```

---

## Frontend

### Form Edit Tidak Populate Data

**Gejala:** Buka form edit, field kosong padahal data sudah ada.

**Penyebab:** `watch(() => props.open, ...)` tidak punya `{ immediate: true }`, sehingga tidak trigger saat komponen di-mount dengan `open = true`.

**Solusi:**
```typescript
watch(() => props.open, (val) => {
  if (!val) return
  // populate form...
}, { immediate: true })  // ← tambahkan ini
```

---

### Error "Bad Request" Tanpa Detail Pesan

**Gejala:** Toast error hanya menampilkan "Gagal memperbarui" tanpa pesan detail.

**Penyebab:** Nitro proxy menggunakan `statusMessage: res.statusText` alih-alih pesan dari NestJS body.

**Solusi di Nitro proxy:**
```typescript
if (res.status >= 400) {
  const errMessage = (res._data as any)?.message ?? res.statusText
  throw createError({
    statusCode: res.status,
    statusMessage: errMessage,
    data: { message: errMessage },
  })
}
```

---

### Hydration Mismatch di Browser Console

**Gejala:** Warning `Hydration node mismatch` di Chrome DevTools.

**Penyebab:** Data yang di-render SSR berbeda dengan client-side (misal: data dari database yang berubah, atau kondisi yang bergantung pada waktu).

**Solusi:** Gunakan `<ClientOnly>` untuk komponen yang berbeda antara SSR dan client, atau tambahkan `key` yang stabil.

---

## Notifikasi & SSE

### Bell Icon Tidak Muncul Notifikasi

**Gejala:** Klik notifikasi trigger tidak menghasilkan notifikasi.

**Penyebab 1:** Tidak ada dokumen yang tanggalnya jatuh pada H-90/60/30/7/0.

**Solusi:** Gunakan catch-all pass dengan trigger manual:
```javascript
// Di browser console
const res = await fetch('/api/notifications/trigger', { method: 'POST', credentials: 'include' })
console.log(await res.json())
```

**Penyebab 2:** Catch-all query by DB status, tapi status DB belum di-update.

**Solusi:** Catch-all sekarang query by `endDate` range (bukan status), jadi tidak perlu menunggu cron.

---

### `notifications.filter is not a function`

**Gejala:** Bell icon tidak bisa dibuka, error di console.

**Penyebab:** Backend `findAll()` mengembalikan `{ notifications, unreadCount }` tapi frontend expect array langsung.

**Solusi:** `findAll()` di `notifications.service.ts` harus return array langsung:
```typescript
async findAll(limit = 10) {
  return this.prisma.notification.findMany({  // ← langsung return array
    where: { resolvedAt: null },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
}
```

---

## Dok. Karyawan

### Dropdown Tipe Dokumen Kosong di Form Tambah

**Gejala:** Dropdown tipe dokumen di form Tambah/Edit Dok. Karyawan kosong atau tidak menampilkan tipe yang diharapkan.

**Penyebab:** Tipe dokumen belum ditambahkan atau kategori tipe dokumen belum diset ke "Dokumen Pribadi".

**Solusi:**
1. Buka **Pengaturan → Master Data → Jenis Dokumen**
2. Pastikan tipe dokumen (KTP, SIM, dll) sudah ada
3. Pastikan field **Kategori** diset ke **Dokumen Pribadi** (bukan Sertifikasi & Ijin)
4. Jika belum ada, klik Tambah Data dan set kategori yang sesuai

---

### Data Dok. Karyawan Muncul di Halaman Sertifikasi & Ijin

**Gejala:** Dokumen yang diinput di Dok. Karyawan ikut tampil di tabel Sertifikasi & Ijin.

**Penyebab:** Kategori tipe dokumen salah (masih CERTIFICATION bukan PERSONAL).

**Solusi:**
1. Buka **Pengaturan → Master Data → Jenis Dokumen**
2. Edit tipe dokumen yang bersangkutan
3. Ubah **Kategori** dari "Sertifikasi & Ijin" menjadi "Dokumen Pribadi"
4. Simpan — data akan otomatis terfilter dengan benar

---

### File Upload Gagal (Melebihi Batas Ukuran)

**Gejala:** Upload file dokumen gagal dengan pesan error ukuran.

**Penyebab:** File melebihi batas maksimal 10MB.

**Solusi:** Kompres file PDF atau gambar terlebih dahulu sebelum upload. Format yang didukung: PDF, JPG, PNG.

---

## Export Excel

### Export Gagal / File Rusak

**Penyebab:** Library XLSX tidak di-load atau data kosong.

**Solusi:**
1. Pastikan ada data di tabel sebelum export
2. Cek apakah `useExport()` composable di-import dengan benar
3. Cek browser console untuk error

---

## Deployment

### PM2 Process Tidak Ditemukan

**Gejala:** `pm2 restart kokarsi-backend` → `Process or Namespace not found`

**Penyebab:** PM2 belum pernah dijalankan atau process sudah dihapus.

**Solusi:**
```powershell
.\deploy\start.ps1  # Jalankan ulang semua service
```

---

### Cloudflare Tunnel Tidak Connect

**Gejala:** Website tidak bisa diakses dari luar.

**Solusi:**
```powershell
# Cek status tunnel
cloudflared tunnel info kokarsi-tunnel

# Jalankan tunnel manual dengan debug
cloudflared tunnel run kokarsi-tunnel --loglevel debug
```

---

### Backend Build Error TypeScript

**Gejala:** `npm run build` gagal dengan TypeScript errors.

**Solusi umum:**
```bash
# Regenerate Prisma client dulu
cd backend
npx prisma generate

# Lalu build ulang
npm run build
```

Jika masih error, cek pesan TypeScript dan perbaiki type mismatch.
