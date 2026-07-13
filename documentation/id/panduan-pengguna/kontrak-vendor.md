# Kontrak Customer/Vendor

Modul Kontrak Customer/Vendor mengelola dokumen kontrak kerjasama bisnis dengan perusahaan customer dan vendor.

## Mengakses Halaman

Klik **Dokumen Legal → Kontrak Customer/Vendor** di sidebar.

## Daftar Kontrak

Tabel menampilkan:
- **Perusahaan** — Nama perusahaan customer/vendor
- **Kategori** — Customer atau Vendor
- **Nama Dokumen** — Judul kontrak
- **Jenis** — Tipe dokumen (Kontrak, Perjanjian, Addendum, dll.)
- **Status** — Aktif, Akan Berakhir, Expired, Tidak Aktif

## Tambah Kontrak

1. Klik **Tambah Kontrak**
2. Pilih kategori (Customer/Vendor)
3. Pilih atau tambah perusahaan
4. Isi data kontrak:
   - Nama dan nomor dokumen
   - Jenis dokumen
   - Tanggal dibuat
   - Apakah butuh perpanjangan?
   - Tanggal mulai dan berakhir (jika butuh perpanjangan)
   - Mother Agreement (jika turunan dari kontrak lain)
   - Lokasi dan keterangan
5. Upload file (opsional)
6. Klik **Simpan**

## Lihat Detail

Klik **⋮** → **Lihat Detail** untuk membuka drawer yang menampilkan:
- Informasi lengkap kontrak
- **Mother Agreement** — Jika ada, ditampilkan sebagai link yang bisa diklik untuk membuka detail kontrak induk
- **Perpanjangan Dari** — Kontrak yang diperpanjang
- **Diperpanjang Ke** — Kontrak baru hasil perpanjangan
- Preview dan download file

## Mother Agreement

Kontrak bisa memiliki hierarki:
- **Mother Agreement** — Kontrak induk (PKS/MOU utama)
- **Turunan** — Addendum, Amendment, atau kontrak detail

Klik nama Mother Agreement di drawer detail untuk langsung membuka detail kontrak tersebut.

## Perpanjang Kontrak

Kontrak **Akan Berakhir** atau **Expired** dapat diperpanjang:
1. Klik **⋮** → **Perpanjang**
2. Isi data kontrak baru
3. Klik **Simpan**

Kontrak lama akan berubah status menjadi **Sudah Diperpanjang** dan ada link ke kontrak baru.

## Status Kontrak

| Status | Keterangan |
|--------|-----------|
| **Aktif** | Kontrak berjalan normal |
| **Akan Berakhir** | Berakhir dalam ≤ 30 hari |
| **Expired** | Sudah berakhir |
| **Tidak Aktif** | Tidak butuh perpanjangan / nonaktif |
| **Sudah Diperpanjang** | Sudah diperpanjang dengan kontrak baru |

## Pencarian Global

Kontrak Vendor dapat ditemukan via pencarian global di header. Klik hasil pencarian untuk langsung membuka drawer detail kontrak tersebut.
