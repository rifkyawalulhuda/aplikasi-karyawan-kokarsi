# Kontrak Karyawan

Modul Kontrak mengelola semua kontrak kerja karyawan, termasuk pembuatan, perpanjangan, dan generate dokumen PDF.

## Mengakses Halaman

Klik **Kontrak** di sidebar kiri.

## Daftar Kontrak

Tabel menampilkan ringkasan kontrak aktif per karyawan:
- **Karyawan** — Nama dan nomor induk
- **No. Kontrak** — Nomor kontrak otomatis
- **Tipe** — PKWT atau MITRA
- **Masa Berlaku** — Tanggal mulai dan berakhir
- **Status** — Aktif, Akan Habis (≤30 hari), Expired

## Tambah Kontrak Baru

1. Klik **Tambah Kontrak**
2. Pilih karyawan
3. Isi data kontrak:
   - Tipe kontrak (PKWT/MITRA)
   - Tanggal mulai & berakhir
   - Template dokumen
   - Posisi & lokasi (untuk PDF)
   - Kompensasi dasar
4. Isi **field tambahan** bila template yang dipilih memilikinya (lihat di bawah)
5. Klik **Simpan**

Nomor kontrak di-generate otomatis dengan format: `{seq}/KK/KUKP/SII/{bulan_romawi}/{tahun}`

## Field Tambahan (Dinamis)

Beberapa template memiliki **field dinamis** yang harus diisi saat membuat kontrak — mis. "Tanggal Terbit KTP Mitra". Field ini muncul di form kontrak dan nilainya disisipkan ke dokumen PDF lewat placeholder `&#123;&#123;custom.kunci&#125;&#125;`.

::: warning Field wajib
Field yang ditandai **Wajib diisi** pada template harus diisi sebelum kontrak dapat dibuat. Sistem akan menolak penyimpanan sampai field tersebut diisi.
:::

Daftar field yang tersedia diatur oleh admin pada [Template Kontrak](/panduan-pengguna/template-kontrak#field-dinamis).

## Edit Kontrak

1. Klik ikon **⋮** pada baris kontrak
2. Pilih **Edit**
3. Ubah data yang diperlukan
4. Klik **Simpan**

::: warning Kontrak Ditandatangani
Jika kontrak sudah memiliki dokumen yang ditandatangani, field tanggal, kompensasi, dan data karyawan **tidak dapat diubah**. Hapus dokumen terlebih dahulu jika perlu.
:::

## Perpanjang Kontrak

1. Kontrak dengan status **Akan Habis** atau **Expired** dapat diperpanjang
2. Klik **⋮** → **Perpanjang**
3. Isi data kontrak baru (tanggal mulai/berakhir baru)
4. Klik **Perpanjang**

Kontrak lama akan berubah status menjadi **Sudah Diperpanjang**.

## Generate Dokumen PDF

1. Klik **⋮** → **Generate PDF**
2. Sistem akan membuat dokumen berdasarkan template
3. Klik **Unduh PDF** untuk download

::: tip Template Kontrak
Konten dokumen PDF (judul, pasal, narasi) ditentukan oleh template yang dipilih saat membuat kontrak.
Untuk mengkustomisasi teks pasal dan narasi template, lihat [Template Kontrak](/panduan-pengguna/template-kontrak).
:::

::: info Snapshot versi template
Dokumen memakai **snapshot versi template** pada saat kontrak dibuat. Bila template dipublish ulang
setelahnya, kontrak lama **tidak berubah**. Pratinjau pada editor template memakai mesin render yang sama
dengan Generate PDF, sehingga hasil pratinjau 1:1 dengan dokumen final.
:::

## Riwayat Kontrak

Klik **Lihat Riwayat** untuk melihat semua kontrak karyawan termasuk yang sudah expired atau selesai. Kontrak yang sudah diperpanjang ditandai dengan badge **Sudah Diperpanjang**.

## Status Kontrak

| Status | Keterangan |
|--------|-----------|
| **Aktif** | Kontrak berjalan, tidak akan habis dalam 30 hari |
| **Akan Habis** | Kontrak berakhir dalam ≤ 30 hari |
| **Expired** | Kontrak sudah berakhir |
| **Selesai** | Kontrak selesai dengan normal |
| **Dibatalkan** | Kontrak dibatalkan |
| **Sudah Diperpanjang** | Kontrak ini telah diperpanjang dengan kontrak baru |
