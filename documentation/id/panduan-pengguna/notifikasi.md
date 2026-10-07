# Notifikasi

Sistem notifikasi mengingatkan pengguna tentang dokumen dan kontrak yang akan atau sudah habis masa berlakunya.

## Bell Icon

Di sidebar kiri terdapat ikon lonceng. Saat ada notifikasi baru:
- Badge **merah** = ada notifikasi CRITICAL (H-7 atau H-0)
- Badge **kuning** = ada notifikasi WARNING (H-90, H-60, H-30)
- **Animasi bounce** saat notifikasi baru masuk secara real-time

Warna badge dihitung dari **ringkasan seluruh notifikasi aktif**, bukan hanya beberapa item teratas, sehingga notifikasi kritis selalu terlihat.

## Panel Notifikasi

Klik ikon lonceng untuk membuka panel di sisi kanan (layar kecil: penuh layar).

**Header** berisi:
- Jumlah notifikasi belum dibaca
- **Tandai semua dibaca**
- **Mode pilih** (aksi massal)
- **Preferensi notifikasi**
- Menu lain: buka halaman notifikasi, hapus semua

**Tab cepat**: Semua · Belum dibaca · Kritis

**Chip kategori** dengan jumlah notifikasi per kategori — klik untuk memfilter, klik lagi untuk melepas.

**Pencarian** menyaring notifikasi berdasarkan judul dan pesan.

**Daftar** dikelompokkan berdasarkan waktu:
- Disematkan (selalu di atas)
- Hari ini
- Kemarin
- 7 hari terakhir
- Lebih lama

Setiap item menampilkan ikon kategori, judul, pesan, label kategori, **hitung mundur kedaluwarsa** (mis. "Kadaluarsa 5 hari lagi" / "Lewat 3 hari"), dan waktu relatif.

**Aksi per item** (muncul saat hover, selalu tampil di layar sentuh):
- **Sematkan** — menaruh notifikasi di grup "Disematkan"
- **Tandai dibaca / belum dibaca**
- **Singkirkan** — menyembunyikan notifikasi, dapat diurungkan lewat tombol **Urungkan** pada notifikasi toast

Gunakan **Muat lebih banyak** untuk memuat item berikutnya. Panel juga mendukung navigasi keyboard (↑/↓ untuk berpindah, Enter untuk membuka).

## Mode Pilih (Aksi Massal)

Klik ikon **Mode pilih** di header panel (atau tombol **Pilih** di halaman notifikasi) untuk:
- Memilih beberapa notifikasi sekaligus
- **Pilih semua** per grup waktu
- Menandai dibaca atau menyingkirkan semua yang dipilih dalam satu tindakan

## Preferensi Notifikasi

Buka lewat ikon gerigi di header panel. Pengaturan disimpan per pengguna:

| Pengaturan | Keterangan |
|-----------|-----------|
| **Kategori** | Nonaktifkan kategori yang tidak ingin diterima. Notifikasi kategori ini **tidak akan dibuat** untuk Anda. |
| **Jam tenang** | Menahan notifikasi non-kritis pada rentang jam tertentu (default 21:00–07:00). Notifikasi **kritis tetap masuk**. |
| **Suara** | Memutar nada singkat saat notifikasi baru masuk (default nonaktif). |
| **Notifikasi sistem** | Menampilkan pemberitahuan dari sistem operasi saat aplikasi terbuka. Membutuhkan izin browser. |

> Notifikasi sistem hanya tampil saat aplikasi terbuka. Izin dapat diminta saat Anda mengaktifkan opsi ini.

## Kategori Notifikasi

| Kategori | Keterangan |
|----------|-----------|
| **Kontrak Karyawan** | Kontrak yang akan/sudah habis |
| **Sertifikasi & Ijin** | Dokumen karyawan yang akan/sudah expired |
| **Kontrak Vendor** | Kontrak vendor/customer yang akan/sudah habis |
| **Legal Koperasi** | Dokumen legal yang akan/sudah berakhir |
| **Arsip Umum** | Arsip umum yang akan/sudah berakhir |
| **Agenda** | Pengingat agenda/kalender |
| **Space** | Aktivitas pada papan Space |

## Tingkat Urgensi

| Tingkat | Warna | Trigger |
|---------|-------|---------|
| **WARNING** | Kuning | H-90, H-60, H-30 sebelum kadaluarsa |
| **CRITICAL** | Merah | H-7 dan H-0 (hari kadaluarsa) |

## Klik Notifikasi

Klik item notifikasi untuk:
- Menandai sebagai **sudah dibaca**
- **Langsung navigate** ke halaman terkait:
  - Notifikasi Kontrak Karyawan → halaman detail karyawan
  - Notifikasi lainnya → halaman list dengan filter status

## Halaman Notifikasi Lengkap

Buka `/notifications` (atau klik **Lihat semua notifikasi** di panel) untuk melihat:
- Ringkasan: total aktif, belum dibaca, kritis, peringatan
- Pencarian dan filter kategori, tingkat, serta status belum dibaca
- Daftar lengkap yang dikelompokkan berdasarkan waktu
- Aksi per item (sematkan, baca/belum dibaca, singkirkan)
- Mode pilih untuk aksi massal
- **Tandai Semua Dibaca**, preferensi, dan hapus semua

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

- **Satu notifikasi**: klik item di panel, atau gunakan aksi hover "Tandai dibaca"
- **Beberapa notifikasi**: gunakan Mode pilih
- **Semua notifikasi**: klik tombol "Tandai Semua Dibaca" di panel atau halaman notifikasi

## Menyingkirkan Notifikasi

Tombol **Singkirkan** (ikon ×) menyembunyikan notifikasi dari daftar tanpa menghapus datanya. Notifikasi yang disingkirkan tidak akan muncul kembali meski cron berjalan, dan dapat dikembalikan lewat tombol **Urungkan** pada notifikasi toast. Tombol **Hapus Semua** menyingkirkan seluruh notifikasi aktif sekaligus.
