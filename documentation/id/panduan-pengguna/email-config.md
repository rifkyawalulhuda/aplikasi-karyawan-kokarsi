# Email Config

::: warning Admin Only
Hanya **Master Admin** yang dapat mengakses tab ini melalui **Pengaturan → Email Config**.
:::

Fitur Email Config memungkinkan Admin mengatur notifikasi email otomatis yang dikirim sistem setiap hari saat kontrak atau dokumen mendekati atau sudah melewati masa berlakunya.

## Mengaktifkan / Menonaktifkan Notifikasi Email

Gunakan toggle **Aktifkan Notifikasi Email** di bagian atas tab untuk menyalakan atau mematikan seluruh notifikasi email.

- **Aktif**: sistem akan mengirim email pengingat sesuai jadwal yang dikonfigurasi.
- **Nonaktif**: tidak ada email yang dikirim. Status kontrak/dokumen tetap diperbarui otomatis di sistem, dan notifikasi in-app (bell icon) tetap berjalan seperti biasa.

::: tip
Menonaktifkan email tidak menghentikan sinkronisasi status. Kontrak yang jatuh tempo tetap berubah statusnya menjadi `AKAN_HABIS` atau `EXPIRED` di sistem.
:::

## Hari Pengingat (Semua Modul)

Bagian ini menentukan **berapa hari sebelum masa berlaku habis** sistem akan mengirim email pengingat.

Pengaturan ini berlaku untuk semua modul berikut:
- Kontrak Karyawan
- Dokumen/Sertifikasi & Ijin
- Kontrak Vendor/Customer
- Legal Koperasi

**Default**: 90, 60, 30, 7, dan 0 hari sebelum jatuh tempo.

### Contoh skenario

Jika Anda mengatur window `[30, 7, 0]`, maka untuk setiap kontrak atau dokumen yang akan habis:
- Email dikirim saat **30 hari** tersisa
- Email dikirim lagi saat **7 hari** tersisa
- Email dikirim lagi pada **hari H** (hari jatuh tempo)

Sistem tidak akan mengirim email yang sama dua kali untuk periode yang sama — jika email H-30 sudah terkirim, tidak akan dikirim ulang keesokan harinya.

### Menambah hari pengingat baru

1. Masukkan angka hari di kolom input (contoh: `14` untuk 14 hari sebelum jatuh tempo)
2. Klik tombol **Tambah** atau tekan **Enter**
3. Badge baru akan muncul di daftar

### Menghapus hari pengingat

Klik ikon **×** di sebelah badge yang ingin dihapus.

::: warning
Jika daftar hari pengingat dikosongkan, tidak ada email pengingat yang akan dikirim (selain notifikasi EXPIRED).
:::

## Penerima Email

Daftar akun user yang akan menerima email notifikasi. Hanya akun yang memiliki alamat email terdaftar yang akan mendapat kiriman.

### Menambah penerima

Klik nama user di daftar untuk mengaktifkannya sebagai penerima. Nama yang sudah aktif akan tampil dengan tanda centang.

### Menghapus penerima

Klik nama user yang sudah aktif untuk menonaktifkannya.

::: warning
User yang tidak memiliki email di profil akun mereka tidak akan menerima notifikasi meskipun dipilih sebagai penerima.
:::

## Menyimpan Konfigurasi

Klik tombol **Simpan** di bagian bawah halaman. Sistem akan menampilkan dialog konfirmasi sebelum menyimpan.

Perubahan konfigurasi akan berlaku pada **cron berikutnya** (setiap hari pukul 00:01 WIB).

## Kapan Email Dikirim?

| Kondisi | Kapan dikirim | Frekuensi |
|---|---|---|
| Kontrak/dokumen mendekati jatuh tempo | Sesuai hari pengingat yang dikonfigurasi | Sekali per window per record |
| Kontrak/dokumen sudah melewati jatuh tempo | Saat pertama kali terdeteksi EXPIRED | Sekali per record |

Email tidak akan dikirim dobel untuk window yang sama — jika pengiriman gagal (misal server email down), sistem akan mencoba kembali pada run cron berikutnya.

## Lihat Juga

- [Notifikasi In-App](/panduan-pengguna/notifikasi) — bell icon dan halaman notifikasi
- [Teknis: Sistem Notifikasi Email](/teknis/email-notification) — arsitektur dan alur teknis untuk developer
