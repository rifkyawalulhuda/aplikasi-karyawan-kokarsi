# Struktur Organisasi

Modul Struktur Organisasi menampilkan dan mengelola **bagan kepengurusan koperasi** per **periode** — mulai dari pengurus, unit usaha, sampai masa jabatan dan statusnya. Bagan dapat dipan/zoom, digeser antar-atasan, dicetak, dan diekspor.

## Mengakses Halaman

Klik **Struktur Organisasi** di sidebar kiri (di bawah Data Karyawan).

::: warning Hak akses
Semua pengguna dapat **melihat** bagan. Hanya **Master Admin** yang dapat **menambah, mengubah, memindahkan, dan menghapus** periode maupun jabatan.
:::

## Konsep: Periode Kepengurusan

Struktur disusun per **periode** (mis. *"2024–2027"*). Satu periode memiliki daftar jabatan yang tersusun hierarkis (atasan–bawahan). Pilih periode aktif pada dropdown **periode** di toolbar; periode dengan tanda **• Aktif** adalah periode yang sedang berjalan.

## Tampilan Bagan & Tabel

Halaman memiliki dua tampilan, dipilih lewat tab di kanan toolbar:

| Tab | Keterangan |
|---|---|
| **Bagan** | Bagan hierarki interaktif berbentuk kartu yang saling terhubung |
| **Tabel** | Daftar jabatan dalam bentuk tabel datar (mudah dicari & diurutkan) |

### Tampilan Bagan

Setiap kartu menampilkan **nama**, **foto**, **jabatan**, **unit usaha**, dan **status**. Klik kartu untuk membuka panel detail, atau gunakan kontrol berikut:

| Kontrol | Fungsi |
|---|---|
| **Seret latar** | Menggeser (pan) bagan |
| **Scroll / cubit** | Zoom masuk-keluar di titik kursor |
| **＋ / − / persentase** | Zoom in, zoom out, dan kembalikan ke 100% |
| **Ikon "sesuaikan ke layar"** | Membuat seluruh bagan muat di layar (fit) |
| **Ikon panah pada kartu** | Meringkas (collapse) atau membuka anak bawahan |
| **Seret kartu ke kartu lain** | Memindahkan jabatan menjadi bawahan kartu tujuan |
| **Seret kartu ke area kosong** | Menjadikan jabatan sebagai akar (tanpa atasan) |

::: tip Posisi bagan tersimpan otomatis
Zoom, posisi (pan), dan kartu yang diringkas **disimpan per periode** di browser Anda, jadi tampilan tetap sama saat halaman dibuka kembali.
:::

### Tampilan Tabel

Tabel menampilkan kolom **Nama**, **Jabatan**, **Unit Usaha**, **Atasan**, **Masa Jabatan**, dan **Status**. Klik baris untuk membuka detail. Kolom pencarian menyaring berdasarkan nama, jabatan, atau unit usaha.

## Atur Tampilan Bagan

Tombol **Tampilan** (hanya pada tab Bagan) membuka panel pengaturan:

- **Latar belakang** — tema **Terang**, **Gelap**, **Kertas**, **Blueprint**, atau **Kustom** (warna sendiri).
- **Pola** — **Tanpa pola**, **Garis**, **Titik**, atau **Diagonal**, dengan pengatur **ukuran pola**.
- **Tampilkan di kartu** — nyalakan/matikan **Foto**, **Jabatan**, **Unit Usaha**, dan **Status**. Nama selalu tampil.

Pengaturan ini juga tersimpan di browser Anda.

## Mengelola Periode

### Tambah Periode

1. Klik **Periode** di toolbar
2. Isi **Nama** periode, **Tanggal Mulai**, dan **Tanggal Selesai** (opsional)
3. Tandai **Aktif** bila periode ini sedang berjalan
4. Klik **Simpan**

### Edit / Hapus Periode

1. Klik ikon **⚙️ (Kelola periode)** di samping dropdown periode
2. Pilih **Edit Periode** atau **Hapus Periode**

::: danger Hapus periode
Menghapus periode akan menghapus **seluruh jabatan** di dalamnya secara permanen.
:::

## Mengelola Jabatan

### Tambah Jabatan

1. Klik **Tambah Jabatan** (menambah jabatan pada level teratas)
2. Isi formulir:

| Field | Keterangan |
|---|---|
| **Ambil dari Data Karyawan** | Opsional — hubungkan jabatan ke karyawan agar nama & foto terisi otomatis |
| **Nama** | Nama pejabat (wajib) |
| **Jabatan** | Mis. Ketua, Manajer, Kasir (wajib) |
| **Unit Usaha / Divisi** | Unit tempat jabatan bernaung |
| **Atasan** | Jabatan induk dalam hierarki |
| **Nomor SK** & **Tanggal SK** | Data Surat Keputusan (opsional) |
| **Masa Jabatan Mulai / Selesai** | Periode menjabat |
| **Status** | Status jabatan |
| **Urutan Tampil** | Angka kecil tampil lebih dulu di antara saudara selevel |
| **Foto** | Unggah foto pejabat (opsional) |
| **Keterangan** | Catatan tambahan |

3. Klik **Simpan**

Untuk menambah **bawahan langsung** sebuah jabatan, buka detailnya lalu pilih **Tambah Bawahan**.

### Pindahkan Jabatan

Seret kartu jabatan ke kartu lain pada **tampilan Bagan**. Sistem mencegah pemindahan yang menciptakan siklus (atasan dipindah ke bawah bawahannya sendiri).

### Hapus Jabatan

Buka detail jabatan → **Hapus**. Jabatan yang masih memiliki bawahan **tidak dapat dihapus** — pindahkan atau hapus bawahannya lebih dulu.

## Status Jabatan

Status dihitung otomatis dari **Masa Jabatan Selesai**:

| Status | Keterangan |
|---|---|
| **Aktif** | Masa jabatan masih berjalan (> 30 hari) atau tanpa tanggal selesai |
| **Akan Berakhir** | Masa jabatan berakhir dalam ≤ 30 hari |
| **Expired** | Masa jabatan sudah berakhir |
| **Tidak Aktif** | Status yang ditetapkan manual |

## Cetak Bagan

Klik **Cetak** di kanan atas untuk membuka pilihan:

- **Cetak A4 · 1 halaman** — bagan diskalakan otomatis agar muat dalam satu halaman A4
- **Cetak A3 · bagan besar** — untuk bagan lebar (satu halaman A3)

Orientasi (potret/lanskap) dipilih otomatis sesuai bentuk bagan. Seluruh cabang selalu terbuka saat dicetak, dan elemen kartu mengikuti pengaturan **Tampilan** yang aktif.

## Export Excel

Klik **Export** untuk mengunduh seluruh jabatan periode terpilih sebagai file `.xlsx`, memuat kolom: No, Nama, Jabatan, Unit Usaha, Atasan, No. SK, Tanggal SK, Masa Jabatan Mulai/Selesai, Status, dan Keterangan.

## Pencarian Global

Hasil pencarian global yang mengarah ke sebuah jabatan membuka halaman ini langsung pada jabatan tersebut (bagan otomatis dipusatkan dan detailnya dibuka).
