# Surat Peringatan

Modul Surat Peringatan mengelola dokumen peringatan karyawan (SP1, SP2, SP3).

## Mengakses Halaman

Klik **Dokumen Karyawan → Surat Peringatan** di sidebar.

## Daftar Surat Peringatan

Tabel menampilkan:
- **Karyawan** — Nama dan jabatan
- **Nomor Surat** — Nomor otomatis (format: `{seq}/SP/KUKP/SII/{bulan_romawi}/{tahun}`)
- **Level SP** — SP 1, SP 2, atau SP 3
- **Tanggal** — Tanggal surat diterbitkan
- **Berlaku Sampai** — Tanggal berakhirnya SP
- **Pengurus** — Nama yang memproses

## Tambah Surat Peringatan

1. Klik **Tambah Surat**
2. Pilih karyawan
3. Isi formulir:
   - Level SP (1, 2, atau 3)
   - Jenis pelanggaran
   - Tanggal surat
   - Tanggal berlaku sampai
   - Upload file SP (opsional, PDF/gambar max 10MB)
4. Klik **Simpan**

Nomor surat di-generate otomatis.

## Edit Surat Peringatan

1. Klik **⋮** → **Edit** pada baris SP
2. Ubah data yang diperlukan
3. Klik **Simpan**

## Download Surat

Klik **⋮** → **Unduh File** untuk membuka/mengunduh file SP yang sudah diupload.

## Export Excel dengan Filter Tahun

1. Klik tombol **Export** di navbar
2. Pilih tahun yang ingin diekspor (contoh: 2026, 2025, dll.)
3. Atau pilih **Export Semua Tahun**
4. File Excel akan otomatis terdownload

## Generate PDF

1. Klik **⋮** → **Generate PDF**
2. Sistem membuat dokumen SP berdasarkan template
3. Klik **Unduh PDF**

## Eskalasi SP

Sistem mendukung eskalasi SP1 → SP2 → SP3. Setiap level berdiri sendiri, tidak ada link otomatis antar level — pengguna yang menentukan level saat membuat SP.

## Status SP di Detail Karyawan

Di halaman detail karyawan, section **Surat Peringatan** menampilkan semua SP yang pernah diterima karyawan tersebut beserta statusnya (aktif atau sudah berakhir berdasarkan tanggal `validUntil`).
