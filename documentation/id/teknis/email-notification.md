# Sistem Notifikasi Email

## Overview

Notifikasi email otomatis dikirim via **Maileroo API** (HTTP REST, bukan SMTP tradisional) setiap hari pukul **00:01 WIB** oleh `ContractCronService`. Konfigurasi disimpan di tabel `AppSetting` dan `EmailNotificationRecipient` di database, sehingga Admin dapat mengubahnya dari UI tanpa restart server.

## Arsitektur

```
Cron harian 00:01 WIB
  │
  ▼
ContractCronService.syncContractStatuses()
  │
  ├─ Baca config dari DB
  │    ├─ emailNotificationEnabled  (AppSetting)
  │    ├─ emailNotificationWindows  (AppSetting)  → triggerWindows: [90,60,30,7,0]
  │    └─ EmailNotificationRecipient → daftar penerima
  │
  ├─ Sinkronisasi status (selalu jalan, terlepas email on/off)
  │    ├─ Kontrak Karyawan   → AKTIF / AKAN_HABIS / EXPIRED
  │    ├─ Dokumen Karyawan   → AKTIF / AKAN_EXPIRED / EXPIRED
  │    ├─ Vendor/Customer    → AKTIF / AKAN_BERAKHIR / EXPIRED
  │    └─ Legal Koperasi     → AKTIF / AKAN_BERAKHIR / EXPIRED
  │
  └─ Kirim email (hanya jika emailEnabled && recipients.length > 0)
       │
       ├─ Loop per triggerWindow (mis. 90, 60, 30, 7, 0)
       │    ├─ Query: record dengan expiryDate = hari ini + N hari (range 1 hari)
       │    ├─ Filter: hasSent(sourceType, id, window) = false
       │    ├─ sendEmail via Maileroo API
       │    └─ recordSent(sourceType, id, window)  ← hanya jika sent=true
       │
       └─ EXPIRED: hasSent(sourceType, id, -1) → sendEmail → recordSent(-1)
```

## Modul yang Dicakup

| Modul | `sourceType` | Status "Akan" | `triggerDay` | Status EXPIRED | `triggerDay` |
|---|---|---|---|---|---|
| Kontrak Karyawan | `contract` | `AKAN_HABIS` | nilai window | `EXPIRED` | `-1` |
| Dokumen Karyawan | `employee_document` | `AKAN_EXPIRED` | nilai window | `EXPIRED` | `-1` |
| Vendor/Customer | `vendor_contract` | `AKAN_BERAKHIR` | nilai window | `EXPIRED` | `-1` |
| Legal Koperasi | `legal_koperasi` | `AKAN_BERAKHIR` | nilai window | `EXPIRED` | `-1` |

## Pola Deduplication

Deduplication mencegah email yang sama dikirim dua kali. Mekanismenya menggunakan tabel `EmailNotificationSentLog` dengan unique key `(sourceType, sourceId, triggerDay)`.

```
EmailNotificationSentLog
├─ sourceType  VARCHAR(50)  — kategori modul ('contract', 'employee_document', dll)
├─ sourceId    INT          — ID record di tabel masing-masing
├─ triggerDay  INT          — hari window (90/60/30/7/0) atau -1 untuk EXPIRED
└─ sentAt      DATETIME     — waktu pengiriman
```

**Sentinel `triggerDay = -1`** dipakai untuk EXPIRED di semua modul (dikirim sekali saja saat pertama kali expired).

Contoh: kontrak ID=5 dengan window [30, 7]:
- H-30: `hasSent('contract', 5, 30)` → false → kirim → `recordSent('contract', 5, 30)`
- H-7: `hasSent('contract', 5, 7)` → false → kirim → `recordSent('contract', 5, 7)`
- H-0: `hasSent('contract', 5, 0)` → false → kirim → `recordSent('contract', 5, 0)`
- EXPIRED: `hasSent('contract', 5, -1)` → false → kirim → `recordSent('contract', 5, -1)`

Jika email gagal terkirim (`sent = false`), `recordSent` **tidak dipanggil**, sehingga run berikutnya akan mencoba lagi.

## Pola Kirim → Catat → Commit

Urutan yang benar untuk menjamin tidak ada email yang hilang saat terjadi kegagalan:

```
1. findMany kandidat (query berbasis expiryDate, BUKAN status)
2. updateMany status (commit status — selalu jalan)
3. sendEmail via Maileroo
4. IF sent == true: recordSent() ← hanya di sini
```

**Mengapa commit status sebelum sendEmail?**
Status DB harus tetap ter-sync meskipun email gagal. Jika urutan dibalik (sendEmail dulu baru commit), kegagalan pengiriman membuat status tidak pernah berubah dan muncul di notifikasi in-app selamanya.

**Mengapa recordSent setelah sendEmail?**
Jika `recordSent` dipanggil sebelum pengiriman berhasil, dan pengiriman gagal, email tidak akan pernah dicoba lagi karena sudah dianggap terkirim.

## Konfigurasi DB (AppSetting)

| Key | Tipe | Default | Keterangan |
|---|---|---|---|
| `emailNotificationEnabled` | `string` (`'true'`/`'false'`) | `'true'` | Toggle on/off |
| `emailNotificationWindows` | `string` (CSV) | `'90,60,30,7,0'` | Hari pengingat, dipisah koma |

Dibaca via `EmailNotificationConfigService.getTriggerWindows()` dan `isEnabled()`.

## Query Seleksi Berbasis Tanggal

Untuk modul Dokumen/Vendor/Legal, email dikirim berdasarkan **exact date match** — bukan filter status. Ini memungkinkan multi-window pada modul yang statusnya hanya berubah sekali.

```typescript
// Untuk setiap window N:
const targetStart = startOfDay(today + N hari)
const targetEnd   = targetStart + 1 hari

// Query dokumen yang jatuh tempo persis hari itu:
expiryDate: { gte: targetStart, lt: targetEnd }
```

Kontrak Karyawan menggunakan pendekatan berbeda: filter `daysLeft === window` dari status `AKAN_HABIS` karena kontrak tetap dalam status itu selama beberapa hari.

## File Terkait

| File | Peran |
|---|---|
| `backend/src/contract-cron/contract-cron.service.ts` | Cron utama — orkestrasi semua modul |
| `backend/src/maileroo/maileroo.service.ts` | HTTP client ke Maileroo API |
| `backend/src/email-notification-config/email-notification-config.service.ts` | Read/write config dari DB, `hasSent`, `recordSent` |
| `backend/src/vendor-contracts/vendor-contracts.service.ts` | `syncExpiredStatuses(maxDays)`, `commitStatuses()` |
| `backend/src/legal-koperasi/legal-koperasi.service.ts` | `syncExpiredStatuses(maxDays)`, `commitStatuses()` |
| `app/components/settings/EmailConfigTab.vue` | UI konfigurasi (Admin) |

## Database Schema

```prisma
model EmailNotificationSentLog {
  id         Int      @id @default(autoincrement())
  sourceType String   @db.VarChar(50)
  sourceId   Int
  triggerDay Int
  sentAt     DateTime @default(now())

  @@unique([sourceType, sourceId, triggerDay])
  @@map("email_notification_sent_log")
}

model EmailNotificationRecipient {
  id            Int         @id @default(autoincrement())
  userAccountId Int
  userAccount   UserAccount @relation(...)
  createdAt     DateTime    @default(now())

  @@unique([userAccountId])
  @@map("email_notification_recipients")
}

// AppSetting keys yang relevan:
// emailNotificationEnabled  → 'true' | 'false'
// emailNotificationWindows  → '90,60,30,7,0'
```

## Environment Variables

Lihat [Environment Variables — Email (Maileroo)](/teknis/environment-variables#email-maileroo) untuk konfigurasi `MAILEROO_API_KEY`, `MAILEROO_FROM_EMAIL`, dan `MAILEROO_FROM_NAME`.

::: warning
Jika `MAILEROO_API_KEY` tidak diset di `.env`, cron tetap jalan tetapi email dilewati (skip) dengan log warning. Notifikasi in-app tidak terpengaruh.
:::

## Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Email tidak terkirim | `MAILEROO_API_KEY` tidak diset | Cek `backend/.env` |
| Email tidak terkirim | Toggle dimatikan di UI | Aktifkan di Pengaturan → Email Config |
| Email tidak terkirim | Tidak ada penerima terdaftar | Tambah penerima di Email Config |
| Email tidak terkirim | Penerima tidak punya email di profil | Update email di Pengaturan → User |
| Email dobel | `EmailNotificationSentLog` corrupt | Cek tabel, hapus record yang salah |
| Status tidak berubah | Cron tidak jalan | Cek PM2 logs: `pm2 logs kokarsi-backend` |
