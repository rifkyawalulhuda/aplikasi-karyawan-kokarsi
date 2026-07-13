# Dashboard

Dashboard adalah halaman utama yang menampilkan ringkasan dan statistik data karyawan secara real-time.

## Mengakses Dashboard

Dashboard dapat diakses dari menu **Dashboard** di sidebar kiri, atau dengan mengklik logo aplikasi.

## Komponen Dashboard

### Stat Cards

Di bagian atas dashboard terdapat 6 kartu statistik utama:

| Kartu | Keterangan |
|-------|-----------|
| **Total Karyawan** | Jumlah seluruh karyawan terdaftar |
| **Status Aktif** | Karyawan dengan kontrak aktif |
| **Kontrak Expired** | Karyawan tanpa kontrak aktif |
| **Resign** | Karyawan yang sudah resign |
| **PHK** | Karyawan yang sudah PHK |
| **Kontrak Akan Habis** | Kontrak yang berakhir dalam 30 hari |

::: tip Loading State
Saat data sedang dimuat, kartu akan menampilkan animasi skeleton (kedip-kedip). Ini normal — data akan muncul setelah loading selesai.
:::

### Grafik Status Karyawan

Donut chart yang menampilkan distribusi status kepegawaian (Aktif, Kontrak Expired, Resign, PHK).

### Distribusi Lokasi & Level

Progress bar yang menampilkan distribusi karyawan per lokasi kerja dan per level jabatan.

### Distribusi SP (Surat Peringatan)

Donut chart SP1, SP2, SP3 yang masih aktif.

### Distribusi Kontrak

Donut chart perbandingan kontrak PKWT vs MITRA.

### Distribusi Jenis Kelamin & Pendidikan

Visualisasi gender dan tingkat pendidikan seluruh karyawan.

### Trend Rekrutmen

Bar chart jumlah karyawan yang bergabung per tahun (5 tahun terakhir).

### Trend Offboarding

Bar chart jumlah karyawan yang Resign dan PHK per tahun (5 tahun terakhir).

### Distribusi Departemen

Bar chart jumlah karyawan per departemen.

## Error State

Jika backend tidak berjalan atau terjadi kesalahan koneksi, dashboard akan menampilkan pesan error dengan tombol untuk refresh halaman.

## Refresh Data

Data dashboard di-cache selama **5 menit** untuk performa optimal. Cache akan di-invalidate otomatis saat ada perubahan data (tambah/edit/hapus karyawan, kontrak, atau SP).

Untuk refresh manual, reload halaman browser (`F5` atau `Ctrl+R`).
