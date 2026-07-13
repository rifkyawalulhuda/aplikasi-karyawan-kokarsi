# Notifikasi

Sistem notifikasi mengingatkan pengguna tentang dokumen dan kontrak yang akan atau sudah habis masa berlakunya.

## Bell Icon

Di sidebar kiri terdapat ikon lonceng (🔔). Saat ada notifikasi baru:
- Badge **merah** = ada notifikasi CRITICAL (H-7 atau H-0)
- Badge **kuning** = ada notifikasi WARNING (H-90, H-60, H-30)
- **Animasi bounce** saat notifikasi baru masuk secara real-time

## Membuka Notifikasi

Klik ikon lonceng untuk membuka panel notifikasi yang menampilkan:
- Daftar notifikasi terbaru (max 10)
- Setiap item menampilkan: kategori, pesan, waktu relatif
- **Dot biru** = belum dibaca

## Kategori Notifikasi

| Kategori | Icon | Keterangan |
|----------|------|-----------|
| **Kontrak Karyawan** | 📄 | Kontrak yang akan/sudah habis |
| **Sertifikasi & Ijin** | 🏅 | Dokumen karyawan yang akan/sudah expired |
| **Kontrak Vendor** | 🏢 | Kontrak vendor/customer yang akan/sudah habis |
| **Legal Koperasi** | ✍️ | Dokumen legal yang akan/sudah berakhir |

## Tingkat Urgensi

| Tingkat | Warna | Trigger |
|---------|-------|---------|
| **WARNING** | Kuning | H-90, H-60, H-30 sebelum kadaluarsa |
| **CRITICAL** | Merah | H-7 dan H-0 (hari kadaluarsa) |

## Klik Notifikasi

Klik baris notifikasi untuk:
- Menandai sebagai **sudah dibaca**
- **Langsung navigate** ke halaman terkait:
  - Notifikasi Kontrak Karyawan → halaman detail karyawan
  - Notifikasi lainnya → halaman list dengan filter status

## Halaman Notifikasi Lengkap

Klik **Lihat Semua Notifikasi** di panel untuk membuka halaman `/notifications` yang menampilkan:
- Semua notifikasi aktif
- Filter berdasarkan kategori, tingkat urgensi, dan status baca
- Stats: total, belum dibaca, kritis, peringatan
- Tombol **Tandai Semua Dibaca**

## Cara Kerja Real-time (SSE)

Notifikasi menggunakan **Server-Sent Events (SSE)** — koneksi persisten dari browser ke server. Saat cron job menghasilkan notifikasi baru, browser langsung menerima update tanpa perlu refresh halaman.

## Trigger Notifikasi

Notifikasi di-generate otomatis pada:
1. **Cron harian 00:01 WIB** — scan semua dokumen
2. **Setiap 5 menit** — refresh untuk modul legal, vendor, sertifikasi
3. **Saat update kontrak karyawan** — real-time setelah edit/tambah/perpanjang

## Trigger Manual (Developer)

Untuk testing, gunakan browser console:
```javascript
const res = await fetch('/api/notifications/trigger', { method: 'POST', credentials: 'include' })
const data = await res.json()
console.log(data) // { created: N, resolved: N }
```

## Menandai Sudah Dibaca

- **Satu notifikasi**: klik item di panel
- **Semua notifikasi**: klik tombol "Tandai Semua Dibaca" di panel atau halaman notifikasi
