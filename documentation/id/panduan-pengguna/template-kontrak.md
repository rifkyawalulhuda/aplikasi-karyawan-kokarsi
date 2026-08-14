# Template Kontrak

Template kontrak menentukan struktur dan konten dokumen PDF yang di-generate untuk setiap kontrak karyawan.

## Mengakses Halaman

**Pengaturan → Template Kontrak** (Admin Only)

::: warning Admin Only
Hanya **Master Admin** yang dapat mengelola template kontrak.
:::

## Daftar Template

Setiap kartu template menampilkan:
- Nama template, kode, dan keluarga (PKWT/MITRA)
- **Template Key** — kode internal yang menentukan konten dokumen
- Tipe kontrak dan jabatan terkait
- Status aktif/nonaktif
- Badge **Konten Dikustomisasi** jika narasi template sudah pernah diedit

## Tambah Template

1. Klik **Tambah Template**
2. Isi form:
   - **Kode** — Kode unik template (min. 3 karakter)
   - **Nama Template** — Nama tampilan
   - **Keluarga** — `PKWT` atau `MITRA`
   - **Template Key** — Pilih dari dropdown (lihat tabel di bawah)
   - Tipe Kontrak & Jabatan (opsional)
3. Klik **Simpan**

::: info Template Key
Template Key menentukan konten pasal dan klausul yang muncul di dokumen PDF.
Dropdown hanya menampilkan key yang valid sesuai keluarga yang dipilih.
:::

## Template Key yang Tersedia

| Template Key | Keluarga | Posisi |
|---|---|---|
| `PKWT_DRIVER` | PKWT | Driver |
| `PKWT_KASIR` | PKWT | Kasir |
| `PKWT_STAFF` | PKWT | Staff Admin |
| `PKWT_WAREHOUSE` | PKWT | Karyawan Gudang |
| `MITRA_DRIVER` | MITRA | Driver |
| `MITRA_KOMART` | MITRA | Kasir Kopmart |
| `MITRA_STAFF` | MITRA | Staff Admin |
| `MITRA_WAREHOUSE` | MITRA | Karyawan Gudang |

::: tip Memilih Template Key
Pilih Template Key yang sesuai dengan posisi jabatan karyawan. Template Key yang sama
dapat digunakan oleh beberapa template dengan nama berbeda, namun isi dokumen PDF yang
dihasilkan akan identik — kecuali kontennya dikustomisasi.
:::

## Edit Konten Template

Admin dapat mengubah **narasi/teks** di dalam dokumen PDF tanpa perlu mengubah kode backend.

1. Di kartu template, klik tombol **Edit Konten**
2. Modal editor terbuka dengan beberapa tab sesuai keluarga template

### Tab Teks Umum

Field yang dapat diedit:

| Field | PKWT | MITRA | Keterangan |
|---|---|---|---|
| Judul Dokumen | ✓ | ✓ | Judul di halaman pertama dokumen |
| Sub-judul | ✓ | — | Sub-judul bilingual (hanya PKWT) |
| Label Posisi / Peran | ✓ | ✓ | Muncul di Pasal 1 dan kalimat pembuka |

::: tip Label Posisi / Peran
Field ini dipakai di Pasal 1 dokumen PKWT ("untuk Pekerjaan Sebagai **[Label]**")
dan di kalimat pembuka MITRA ("untuk pekerjaan **[Label]** koperasi...").
:::

### Tab Pasal (Indonesia) / Pasal-pasal

Edit teks per pasal. Setiap pasal ditampilkan sebagai accordion yang bisa dibuka.

::: warning Placeholder Dinamis
Beberapa paragraf mengandung placeholder yang diisi otomatis dari data kontrak.
**Jangan hapus placeholder ini** agar data kontrak tetap muncul di dokumen:

| Placeholder | Keterangan |
|---|---|
| `__TERM_DATE__` | Tanggal berlaku kontrak |
| `__WAGE_AMOUNT__` | Nominal upah/kompensasi |
| `__MITRA_TERM__` | Jangka waktu (MITRA) |
| `__MITRA_IMBALAN__` | Nilai imbalan jasa (MITRA) |
| `__MITRA_ADDRESS__` | Alamat mitra (MITRA) |

Paragraf yang mengandung placeholder ditandai dengan badge peringatan kuning.
:::

### Tab Pasal (English) — Khusus PKWT

Edit teks terjemahan Inggris untuk dokumen PKWT yang bilingual (Indonesia kiri, Inggris kanan).

## Menyimpan & Reset

- **Simpan Perubahan** — Menyimpan semua perubahan ke database
- **Reset Tab ke Default** — Mengembalikan **tab aktif** ke teks bawaan sistem (tab lain tidak terpengaruh)
- Indikator **"X field diubah"** menunjukkan jumlah field yang belum tersimpan sejak modal dibuka

::: info Cara Kerja Override
Hanya field yang diubah yang tersimpan sebagai override. Field yang tidak diubah
tetap menggunakan teks bawaan sistem. Jika template di-reset, teks bawaan akan
digunakan kembali untuk tab tersebut.
:::

## Hapus Template

Klik **Hapus** di kartu template → konfirmasi penghapusan akan muncul.

::: warning Template Dalam Penggunaan
Template yang sudah dipakai oleh satu atau lebih kontrak aktif **tidak dapat dihapus**.
Sistem akan menampilkan jumlah kontrak yang menggunakan template tersebut.
:::
