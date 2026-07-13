# Data Karyawan

Modul Data Karyawan adalah pusat pengelolaan seluruh informasi karyawan Kokarsi PT. Sankyu.

## Mengakses Halaman

Klik **Data Karyawan** di sidebar kiri.

## Daftar Karyawan

Halaman menampilkan tabel dengan kolom:
- **Karyawan** — Foto, nama lengkap, dan nomor induk
- **Status** — Status kepegawaian (Aktif, Kontrak Expired, Resign, PHK)
- **Kontrak** — Nomor & status kontrak aktif
- **Lokasi** — Lokasi kerja
- **Bergabung** — Tanggal mulai kerja

### Filter & Pencarian

- **Pencarian** — Cari berdasarkan nama, nomor induk, NIK, atau email
- **Filter Status** — Filter berdasarkan status kepegawaian
- **Sorting** — Klik header kolom untuk mengurutkan data

## Tambah Karyawan

1. Klik tombol **Tambah Karyawan** (pojok kanan atas)
2. Isi formulir data karyawan:
   - Nama lengkap, nomor induk, NIK
   - Tanggal lahir, tempat lahir, jenis kelamin
   - Pendidikan terakhir
   - Jabatan (Job Role & Level)
   - Departemen, lokasi kerja, status pajak
   - Tanggal bergabung, alamat, email, telepon
3. Upload foto (opsional) — format JPG/PNG/WEBP, max 5MB
4. Klik **Simpan**

## Edit Karyawan

1. Klik ikon **⋮** pada baris karyawan yang ingin diedit
2. Pilih **Edit**
3. Ubah data yang diperlukan
4. Klik **Simpan Perubahan**

::: warning Kontrak Ditandatangani
Karyawan yang memiliki kontrak dengan dokumen ditandatangani tidak dapat diubah field tertentu (tanggal, kompensasi). Hapus dokumen terlebih dahulu jika perlu mengubah field tersebut.
:::

## Detail Karyawan

Klik baris karyawan atau klik **Lihat Detail** untuk membuka halaman detail yang mencakup:
- **Profil** — Biodata lengkap, foto, status kepegawaian
- **Kontrak** — Riwayat semua kontrak karyawan
- **Surat Peringatan** — Riwayat SP yang diterima
- **Sertifikasi & Ijin** — Dokumen sertifikasi dan ijin karyawan
- **Offboarding** — Informasi resign/PHK (jika ada)

## Import Bulk via Excel

1. Klik dropdown **⋮** di header halaman
2. Pilih **Import Karyawan**
3. Download template Excel
4. Isi data karyawan sesuai format template
5. Upload file Excel
6. Review hasil import

::: tip Template
Download template terlebih dahulu — template sudah berisi contoh data dan validasi format tanggal (dd/mm/yyyy).
:::

## Export Data

1. Klik tombol **Export** di header halaman
2. Pilih format:
   - **Export Excel** — Semua data karyawan
   - **Export PDF** — Laporan dalam format PDF

## Offboarding (Resign/PHK)

1. Buka detail karyawan
2. Klik tombol **Offboarding** (pojok kanan atas)
3. Pilih jenis: **Resign** atau **PHK**
4. Isi tanggal dan alasan
5. Konfirmasi

::: warning
Offboarding akan mengubah status karyawan dan menutup semua kontrak aktif. Tindakan ini dapat dibatalkan hanya oleh Admin.
:::

## Hapus Karyawan

1. Klik ikon **⋮** pada baris karyawan
2. Pilih **Hapus**
3. Konfirmasi penghapusan

::: danger
Menghapus karyawan akan menghapus **semua data terkait** termasuk kontrak, SP, sertifikasi, dan riwayat status. Tindakan ini **tidak dapat dibatalkan**.
:::
