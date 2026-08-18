# Log Aktivitas

::: warning Admin Only
Hanya **Master Admin** yang dapat mengakses halaman ini.
:::

Halaman Log Aktivitas mencatat setiap perubahan data yang dilakukan di seluruh modul — tambah, edit, dan hapus — untuk keperluan audit dan pelacakan ketidaksesuaian data.

## Mengakses Log Aktivitas

Klik **Pengaturan → Log Aktivitas** di sidebar.

## Kolom Log

| Kolom | Keterangan |
|-------|------------|
| Tanggal | Tanggal kejadian (dd Mmm yyyy) |
| Jam | Waktu kejadian (HH:mm) |
| Aksi | **Buat**, **Edit**, atau **Hapus** |
| Modul | Nama modul yang terpengaruh (contoh: Karyawan, Kontrak) |
| Data | Identitas data yang diubah (contoh: `Ahmad Subarjo (KRY-001)`) |
| Detail | Informasi kontekstual tambahan (contoh: `Bergabung: 01 Jan 2025 \| Status: AKTIF`) |
| Dilakukan Oleh | Nama user yang melakukan aksi |
| Role | Role user (`ADMIN` atau `PENGELOLA_KOPERASI`) |

## Memfilter Log

1. Pilih **Modul** dari dropdown — kosongkan untuk semua modul
2. Pilih **Aksi** — Buat, Edit, atau Hapus — kosongkan untuk semua aksi
3. Ketik nama user di field **Cari nama user** (opsional)
4. Pilih rentang tanggal **Dari** dan **s/d** (opsional)
5. Klik **Terapkan** untuk menerapkan filter
6. Klik **Reset** untuk menghapus semua filter dan kembali ke tampilan penuh

::: tip
Filter dapat dikombinasikan. Misalnya, pilih Modul **Karyawan** + Aksi **Hapus** + rentang tanggal untuk melihat semua penghapusan data karyawan dalam periode tertentu.
:::

## Export Excel

Klik tombol **Export Excel** di sudut kanan navbar untuk mengunduh log ke file `.xlsx`.

- File berisi **9 kolom**: No, Tanggal, Jam, Aksi, Modul, Data, Detail, Dilakukan Oleh, Role
- Export menghormati **filter aktif** — hanya data yang ditampilkan yang di-export
- Header row di-**freeze** sehingga tetap terlihat saat scroll ke bawah
- Nama file otomatis menyertakan tanggal export (contoh: `log-aktivitas-2026-08-18.xlsx`)

## Pengaturan Retensi

Di bagian bawah halaman terdapat panel **Pengaturan Retensi Log**:

**Simpan log selama (hari)**
: Tentukan berapa lama log disimpan sebelum boleh dihapus secara manual. Default: **365 hari**. Klik **Simpan** untuk menyimpan perubahan.

**Hapus Log Lama**
: Pilih tanggal batas, lalu klik tombol hapus untuk menghapus semua log sebelum tanggal tersebut secara permanen.

::: danger Tidak dapat dibatalkan
Penghapusan log bersifat **permanen**. Export log ke Excel terlebih dahulu jika data log masih dibutuhkan untuk keperluan arsip atau audit.
:::

## Skenario Penggunaan

### Investigasi perubahan data mencurigakan

1. Filter berdasarkan **Modul** dan rentang tanggal yang dicurigai
2. Perhatikan kolom **Detail** untuk konteks perubahan
3. Catat **Dilakukan Oleh** untuk mengetahui siapa yang melakukan perubahan
4. Export ke Excel untuk dokumentasi laporan

### Audit berkala

1. Set rentang tanggal sesuai periode audit (misalnya satu bulan)
2. Export semua log tanpa filter sebagai rekam jejak lengkap
3. Simpan file Excel sebagai arsip audit

### Memantau aktivitas modul tertentu

1. Filter berdasarkan **Modul** (misalnya: User)
2. Terapkan filter tanpa batasan tanggal untuk melihat seluruh riwayat
3. Kolom **Detail** menampilkan konteks seperti `Role: ADMIN | Username: john.doe`
