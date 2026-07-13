# Sertifikasi & Ijin

Modul Sertifikasi & Ijin mengelola dokumen sertifikasi profesi dan ijin operasional karyawan.

## Mengakses Halaman

Klik **Dokumen Karyawan → Sertifikasi & Ijin** di sidebar.

## Daftar Dokumen

Tabel menampilkan:
- **Karyawan** — Nama dan nomor induk
- **Nama Dokumen** — Jenis sertifikasi/ijin
- **Nomor Dokumen** — Nomor sertifikat/ijin
- **Penerbit** — Instansi penerbit
- **Berlaku Sampai** — Tanggal kadaluarsa
- **Status** — Aktif, Akan Expired, atau Expired

## Status Dokumen

| Status | Keterangan |
|--------|-----------|
| **Aktif** | Masih berlaku, tidak akan habis dalam 30 hari |
| **Akan Expired** | Akan habis dalam ≤ 30 hari |
| **Expired** | Sudah kadaluarsa |

## Tambah Dokumen

1. Klik **Tambah Dokumen**
2. Pilih karyawan
3. Pilih tipe dokumen dari Master Dokumen
4. Isi nomor dokumen dan tanggal kadaluarsa
5. Upload file (opsional)
6. Klik **Simpan**

## Lihat Detail

Klik **⋮** → **Lihat Detail** untuk membuka drawer detail yang menampilkan:
- Informasi lengkap dokumen
- Indikator sisa hari berlaku (merah/kuning/normal)
- Preview dan download file (PDF atau gambar)
- Tombol Edit dan Perpanjang

## Perpanjang Dokumen

Dokumen dengan status **Akan Expired** atau **Expired** dapat diperpanjang:

1. Klik **⋮** → **Perpanjang**
2. Masukkan nomor dokumen baru dan tanggal kadaluarsa baru
3. Upload file baru (opsional)
4. Klik **Simpan**

## Export Excel

Klik tombol **Export** → **Export Excel** untuk mengunduh semua data ke file Excel.

## Master Dokumen

Tipe dokumen dikelola melalui **Pengaturan → Master Data**. Setiap tipe dokumen memiliki:
- Nama dokumen
- Jenis (Sertifikat, Lisensi, Ijin, Rahasia, Lainnya)
- Penerbit default

## Notifikasi Kadaluarsa

Sistem otomatis mengirim notifikasi saat dokumen mendekati kadaluarsa:
- **H-90, H-60, H-30** — Warning (kuning)
- **H-7, H-0** — Critical (merah)

Notifikasi muncul di bell icon sidebar secara real-time. Lihat [Notifikasi](/panduan-pengguna/notifikasi) untuk detail.
