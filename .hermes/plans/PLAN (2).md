# Rencana Fitur Detail Offboarding (PHK / Resign)

## Ringkasan
Pendekatan UI/UX yang paling cocok untuk kondisi project sekarang adalah:

- tampilkan ringkasan offboarding langsung di halaman `Data Karyawan`
- buka detail lengkap lewat `drawer` atau `modal detail` read-only
- tampilkan detail yang sama juga di area riwayat karyawan, supaya admin/pengelola tidak perlu menebak alasan status `PHK` atau `Resign`

Kenapa ini paling cocok:
- data offboarding saat ini hanya 1 record aktif per karyawan (`employee_offboarding` unique per employee), jadi UX terbaik adalah “detail status saat ini”, bukan timeline kompleks
- admin butuh akses cepat dari tabel
- pengelola juga tetap bisa melihat, tanpa harus masuk ke form edit atau ke halaman lain

## Pendekatan UI/UX
### 1. Ringkasan di tabel Data Karyawan
Pada kolom `Status Kepegawaian`:
- badge `Resign` dan `PHK` dibuat clickable
- hover atau klik kecil menampilkan summary singkat:
  - jenis offboarding
  - tanggal efektif
  - potongan alasan singkat
- jika status `AKTIF` atau `KONTRAK_EXPIRED`, badge tetap biasa

Tujuannya:
- user bisa cepat tahu “ini kenapa PHK/Resign”
- tanpa membuat tabel terlalu ramai

### 2. Drawer detail offboarding
Saat user klik badge status atau aksi row `Lihat Detail Offboarding`, buka `drawer`/`modal` read-only berisi:
- nama karyawan
- NIK / employeeNo
- status akhir: `PHK` atau `Resign`
- tanggal efektif
- alasan/catatan lengkap
- diproses oleh siapa
- role pemroses
- waktu input data
- ringkasan dampak kontrak:
  - semua kontrak non-`DIBATALKAN` sudah menjadi `SELESAI`

Rekomendasi UX:
- gunakan `USlideover` jika tersedia di stack sekarang
- kalau mau konsisten dengan modal-modal lain yang sudah banyak dipakai, `UModal` juga aman
- rekomendasi utama: `slideover`, karena lebih nyaman untuk detail baca-only dan tidak terasa seperti form edit

### 3. Detail di riwayat karyawan
Di modal `Riwayat Kontrak Karyawan` yang sudah ada:
- tambahkan kartu info offboarding di bagian header jika status employee = `PHK` atau `Resign`
- tampilkan:
  - label status
  - tanggal efektif
  - alasan singkat
  - tombol `Lihat Detail`

Ini penting karena user yang sedang membuka riwayat kontrak biasanya juga sedang menelusuri alasan kenapa semua kontraknya `SELESAI`

## Perubahan Implementasi
### Backend
Tidak perlu schema baru jika hanya untuk lihat detail, karena data inti sudah ada:
- `employee.offboarding`
- `employeeStatusHistory`

Perubahan backend yang diperlukan:
- pastikan endpoint list/detail employee selalu mengembalikan `offboarding`
- jika belum cukup, tambahkan endpoint detail khusus:
  - `GET /employees/:id/offboarding`
- bentuk response minimal:
  - `terminationType`
  - `terminationDate`
  - `reason`
  - `processedByName`
  - `processedByRole`
  - `processedByKind`
  - `createdAt`
  - `updatedAt`

Rekomendasi:
- untuk v1, tidak perlu endpoint baru jika `findOne` dan list employee sudah cukup membawa `offboarding`
- endpoint khusus hanya perlu jika ingin lazy-load detail saat drawer dibuka

### Frontend
Tambahkan 2 komponen ringan:
- `OffboardingSummaryBadge`
  - dipakai di kolom status tabel
  - jika status `PHK/Resign`, badge bisa klik
- `OffboardingDetailPanel`
  - isi drawer/modal detail read-only

Integrasi utama:
- halaman `Data Karyawan`
  - klik badge atau aksi row membuka detail
- modal `Riwayat Kontrak Karyawan`
  - tampilkan kartu offboarding jika ada
- opsional:
  - halaman `Manajemen Kontrak` pada bagian riwayat karyawan juga bisa menampilkan banner “Karyawan ini sudah offboarding”

## Test Plan
- Karyawan `PHK` tampil badge status yang bisa dibuka detailnya
- Karyawan `Resign` tampil badge status yang bisa dibuka detailnya
- Drawer/modal menampilkan seluruh field offboarding dengan benar
- Karyawan `AKTIF` dan `KONTRAK_EXPIRED` tidak menampilkan detail offboarding
- Riwayat kontrak menampilkan kartu offboarding jika employee sudah `PHK/Resign`
- Role `ADMIN` dan `PENGELOLA_KOPERASI` sama-sama bisa melihat detail offboarding
- Search/filter existing tidak rusak setelah badge status dibuat clickable

## Asumsi
- Fitur ini fokus read-only, bukan edit atau cancel offboarding
- Hanya ada 1 data offboarding aktif per karyawan, sesuai schema saat ini
- Detail yang ingin dilihat admin/pengelola adalah status saat ini, bukan histori multi-event offboarding
- Untuk v1, tidak dibuat halaman baru; detail dibuka dari `Data Karyawan` dan `Riwayat Kontrak`
