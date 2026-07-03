# Rencana Penyesuaian UI/UX Halaman Detail Karyawan Global

## Ringkasan
Pendekatan terbaik untuk penyesuaian baru ini adalah mengganti ide “detail offboarding terpisah” menjadi **1 halaman detail karyawan global** yang bisa dibuka untuk semua karyawan, apa pun statusnya.

Halaman ini menjadi pusat informasi tunggal untuk:
- biodata lengkap karyawan
- status kepegawaian saat ini
- detail offboarding jika status `RESIGN` atau `PHK`
- ringkasan dan riwayat kontrak
- informasi master-data yang terhubung

Dengan begitu:
- admin/pengelola tidak perlu lompat antar modal
- user punya pola navigasi yang konsisten
- detail `PHK/Resign` tetap ada, tapi menjadi salah satu section di halaman profil karyawan, bukan fitur terpisah

## Pendekatan UI/UX
### 1. Gunakan halaman detail penuh, bukan modal
Buat route detail khusus, rekomendasi:
- `/karyawan/[id]`

Ini lebih cocok daripada modal/drawer karena:
- informasi karyawan sekarang sudah cukup banyak
- ada riwayat kontrak, status, offboarding, dan data master
- user bisa membaca dengan nyaman, terutama untuk audit dan pengecekan admin/pengelola

### 2. Struktur halaman detail global
Halaman detail dibagi menjadi section yang jelas dan ringkas:

#### A. Header profil
Tampilkan paling atas:
- foto karyawan
- nama lengkap
- NIK / employeeNo
- email / no HP
- badge status kepegawaian
- tombol aksi cepat:
  - `Edit Data`
  - `Offboarding` jika masih aktif / kontrak expired
  - `Kembali`

#### B. Ringkasan utama
Gunakan card ringkas 2 kolom / 3 kolom untuk:
- status kepegawaian
- lokasi kerja
- jabatan
- departement
- level jabatan
- tanggal bergabung
- pendidikan
- status pajak

#### C. Section status kerja
Bagian ini jadi pusat status bisnis:
- jika `AKTIF`:
  - tampilkan kontrak terbaru aktif
  - tanggal mulai / selesai
  - tipe kontrak
- jika `KONTRAK_EXPIRED`:
  - tampilkan kontrak terakhir + info bahwa kontrak sudah habis
- jika `RESIGN` / `PHK`:
  - tampilkan panel offboarding lengkap:
    - jenis offboarding
    - tanggal efektif
    - alasan/catatan
    - diproses oleh
    - waktu input
    - dampak: semua kontrak non-`DIBATALKAN` berstatus `SELESAI`

#### D. Section riwayat kontrak
Gunakan timeline / list card seperti yang sekarang sudah ada, tapi dipindah ke halaman detail:
- urut terbaru ke lama
- badge status kontrak
- tipe kontrak
- tanggal mulai-selesai
- dokumen kontrak bila ada

#### E. Section audit status
Ringkas, read-only:
- riwayat perubahan status dari `employee_status_history`
- minimal tampil:
  - status lama
  - status baru
  - tanggal perubahan
  - oleh siapa
  - catatan

Ini penting supaya detail `PHK/Resign` tidak hanya terlihat sebagai “state saat ini”, tapi juga punya jejak perubahan.

## Perubahan Implementasi
### Backend
Gunakan endpoint detail employee sebagai sumber utama halaman:
- `GET /employees/:id`

Pastikan response employee detail sudah memuat:
- relasi data master existing
- `contracts`
- `offboarding`
- `statusHistory`

Jika endpoint saat ini belum memuat `statusHistory`, tambahkan ke detail response.
Tidak perlu endpoint detail offboarding terpisah untuk v1 jika semua data bisa dibawa dari detail employee.

### Frontend
Buat halaman baru:
- `app/pages/karyawan/[id].vue`

Komponen yang disarankan:
- `EmployeeProfileHeader`
- `EmployeeSummaryCards`
- `EmployeeEmploymentPanel`
- `EmployeeContractTimeline`
- `EmployeeStatusHistoryList`

Rekomendasi implementasi UX:
- dari tabel Data Karyawan, nama karyawan atau menu aksi `Lihat Detail` membuka halaman ini
- dari halaman Kontrak, nama karyawan juga bisa link ke detail yang sama
- modal riwayat kontrak lama bisa dipertahankan sementara, tapi arah jangka menengah sebaiknya dialihkan ke halaman detail global agar UX tidak dobel

## Entry Point UI
Tambahkan akses ke halaman ini dari:
- tabel `Data Karyawan`:
  - klik nama karyawan
  - aksi row `Lihat Detail`
- tabel `Manajemen Kontrak`:
  - klik nama karyawan
  - tombol kecil `Lihat Profil`

Rekomendasi:
- jadikan nama karyawan clickable
- tetap sediakan aksi `Lihat Detail` di dropdown agar discoverable

## Test Plan
- Semua karyawan bisa membuka halaman detail
- Karyawan `AKTIF` menampilkan ringkasan kontrak aktif
- Karyawan `KONTRAK_EXPIRED` menampilkan info kontrak terakhir yang expired
- Karyawan `RESIGN` menampilkan panel offboarding lengkap
- Karyawan `PHK` menampilkan panel offboarding lengkap
- Riwayat kontrak tampil konsisten dengan status `SELESAI` setelah offboarding
- Riwayat perubahan status tampil benar dari `employee_status_history`
- Link dari halaman karyawan dan halaman kontrak sama-sama mengarah ke detail global yang benar

## Asumsi
- Halaman detail global menjadi sumber utama untuk melihat seluruh detail karyawan
- Detail `PHK/Resign` tidak lagi dibuat sebagai fitur berdiri sendiri, tetapi section di halaman detail
- Untuk v1, data read-only cukup; edit tetap dilakukan lewat modal/form existing
- Modal riwayat kontrak lama boleh tetap ada sementara, tetapi halaman detail global adalah pola UX utama ke depan
