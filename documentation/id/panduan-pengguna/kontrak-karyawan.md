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

## Menu Aksi (Klik Kanan)

Aksi per kontrak dibuka lewat **klik kanan** pada baris kontrak (klik kiri membuka Riwayat Kontrak). Menu yang tampil:

| Aksi | Keterangan |
|------|-----------|
| **Riwayat Karyawan** | Buka popup riwayat kontrak karyawan |
| **Perpanjang Kontrak** | Muncul bila kontrak dapat diperpanjang |
| **Preview Dokumen** | Lihat pratinjau dokumen PDF |
| **Generate Dokumen** | Buat/perbarui dokumen PDF |
| **Edit Kontrak** | Ubah data kontrak |
| **Unduh PDF** | Unduh dokumen PDF yang sudah di-generate |
| **Hapus Kontrak** | Hapus kontrak (khusus Admin dengan izin hapus) |

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

1. **Klik kanan** pada baris kontrak
2. Pilih **Edit Kontrak**
3. Ubah data yang diperlukan
4. Klik **Simpan**

::: warning Kontrak Ditandatangani
Jika kontrak sudah memiliki dokumen yang ditandatangani, field tanggal, kompensasi, dan data karyawan **tidak dapat diubah**. Hapus dokumen terlebih dahulu jika perlu.
:::

## Perpanjang Kontrak

1. Kontrak dengan status **Akan Habis** atau **Expired** dapat diperpanjang
2. **Klik kanan** pada baris kontrak → **Perpanjang Kontrak**
3. Isi data kontrak baru (tanggal mulai/berakhir baru)
4. Klik **Perpanjang**

Kontrak lama akan berubah status menjadi **Sudah Diperpanjang**.

## Generate Dokumen PDF

1. **Klik kanan** pada baris kontrak → **Generate Dokumen**
2. Sistem akan membuat dokumen berdasarkan template
3. Pilih **Unduh PDF** untuk mengunduh

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

**Klik kiri** pada baris kontrak untuk membuka popup **Riwayat Kontrak** karyawan tersebut. Popup menampilkan seluruh kontrak — termasuk yang sudah expired atau selesai — beserta ringkasan kontrak aktif dan rentang karier. Kontrak yang sudah diperpanjang ditandai badge **Sudah Diperpanjang**.

Di dalam popup, setiap kartu kontrak memiliki:

- **Tombol utama** — **Preview** atau **Perpanjang** (kontekstual sesuai status kontrak).
- **Menu klik kanan** — **klik kanan** pada kartu untuk membuka aksi lain: **Preview**, **Perpanjang**, **Unduh Dokumen**, **Unduh PDF**, **Generate Dokumen**, dan **Edit Kontrak**.

::: tip Generate tanpa menutup popup
Memilih **Generate Dokumen** dari menu klik kanan **tidak menutup** popup Riwayat Kontrak, sehingga Anda dapat memicu beberapa aksi berturut-turut.
:::

## Status Kontrak

| Status | Keterangan |
|--------|-----------|
| **Aktif** | Kontrak berjalan, tidak akan habis dalam 30 hari |
| **Akan Habis** | Kontrak berakhir dalam ≤ 30 hari |
| **Expired** | Kontrak sudah berakhir |
| **Selesai** | Kontrak selesai dengan normal |
| **Dibatalkan** | Kontrak dibatalkan |
| **Sudah Diperpanjang** | Kontrak ini telah diperpanjang dengan kontrak baru |
