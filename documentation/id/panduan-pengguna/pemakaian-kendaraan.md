# Pemakaian Kendaraan

Modul Pemakaian Kendaraan mencatat pemakaian kendaraan operasional koperasi, mulai dari jadwal, driver, sampai tujuan.

Catatan pemakaian bersifat **permanen**. Data yang sudah tersimpan tidak bisa diedit atau dihapus, hanya bisa dibatalkan.

## Mengakses Halaman

Klik **Operasional → Pemakaian Kendaraan** di sidebar.

## Daftar Pemakaian

Tabel menampilkan:

- **Tanggal dan Jam** — waktu pemakaian dalam zona WIB
- **No. Polisi** — kendaraan yang dipakai
- **Driver** — nama pengemudi
- **Destination** — tujuan pemakaian
- **User** — yang menggunakan kendaraan
- **Requester** — yang mengajukan permintaan
- **Status** — badge **Batal** jika sudah dibatalkan, atau tanda `-` jika masih berlaku
- **Aksi** — tombol **Batal** untuk pemakaian yang masih aktif, atau info pembatalan (nama, peran, dan waktu) untuk yang sudah batal

## Tambah Pemakaian

1. Klik **Tambah Data**
2. Isi formulir:
   - **Tanggal** — tanggal pemakaian
   - **Jam** — jam pemakaian
   - **No. Polisi** — pilih kendaraan
   - **Driver** — nama driver
   - **Destination** — tujuan
   - **User** — pengguna kendaraan
   - **Requester** — pemohon
3. Klik **Simpan**

::: info
Pilihan kendaraan dibatasi pada dua unit operasional:

- **Xenia B 2845 FON**
- **Grand max B 9043 FCM**
:::

Tanggal dan jam yang diisi akan disimpan dengan offset zona WIB (+07:00).

## Batalkan Pemakaian

1. Klik **Batal** pada baris yang ingin dibatalkan
2. Konfirmasi pembatalan

Setelah dibatalkan, baris akan menampilkan status **Batal** beserta nama, peran, dan waktu pembatalan, sedangkan tombol **Batal** hilang.

::: danger
Pembatalan bersifat permanen. Data yang sudah dibatalkan tidak dapat dikembalikan dan tidak dapat dibatalkan ulang.
:::

## Filter & Pencarian

Gunakan kolom pencarian dan filter di atas tabel:

- **Pencarian** — mencari berdasarkan driver, tujuan, user, atau requester
- **Status** — **Semua Status**, **Terjadwal**, atau **Batal**
- **Rentang Tanggal** — pilih tanggal mulai dan (opsional) tanggal akhir

Tombol **Reset** mengembalikan semua filter ke kondisi awal.

## Urutan Data

Secara bawaan tabel diurutkan dengan pola hibrida:

- Pemakaian **hari ini** selalu tampil paling atas
- Sisa data diurutkan berdasarkan tanggal

Semua kolom juga bisa diurutkan manual dengan klik judul kolomnya.

## Export Excel

1. Klik **Export**
2. Pilih periode:
   - **Semua** — seluruh data
   - **Bulan** — pilih bulan dan tahun
3. Klik **Export Excel**

## Dashboard

Ringkasan pemakaian kendaraan tampil juga di halaman Dashboard:

- **KPI** — total pemakaian, terjadwal, dan batal
- **Jadwal pemakaian** — daftar jadwal pada periode terpilih, dikelompokkan per hari
- **Pemakaian per Kendaraan** — jumlah pemakaian tiap unit kendaraan
- **Tab Hari Ini / 7 Hari ke Depan** — untuk berpindah periode ringkasan

Klik **Lihat Semua Pemakaian** pada bagian ini untuk membuka halaman Pemakaian Kendaraan.
