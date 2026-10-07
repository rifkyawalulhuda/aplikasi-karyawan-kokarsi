# Template Kontrak

Template kontrak menentukan struktur dan konten dokumen PDF yang di-generate untuk setiap kontrak karyawan.

Konten template disusun dari **blok** (paragraf, pasal, daftar, tabel, tanda tangan, dst.) dan dikelola lewat sistem **versi** — disunting sebagai **draft**, dipratinjau, lalu **dipublish**. Teks di dalam blok mendukung **pemformatan inline** (tebal, miring, garis bawah) dan **perataan**.

## Mengakses Halaman

**Pengaturan → Template Kontrak** (Admin Only)

::: warning Admin Only
Hanya **Master Admin** yang dapat mengelola template kontrak.
:::

## Daftar Template

Setiap kartu template menampilkan:

- **Nama** template dan **kode** uniknya
- Badge **vN** — nomor versi yang sedang diterbitkan
- Badge **Draf** — template memiliki draft yang belum diterbitkan
- Badge **Nonaktif** — template dinonaktifkan
- Status penerbitan: *"Diterbitkan {tanggal}"* atau *"Belum ada versi yang diterbitkan"*
- **Jabatan**, **Jumlah Kontrak**, dan **Tipe Kontrak** terkait
- Tombol **Kelola Konten Template** untuk membuka editor

Template bawaan (default) untuk setiap keluarga **dibuat otomatis** saat halaman dimuat, sehingga Anda bisa langsung menyuntingnya.

### Mencari & Menyaring

| Kontrol | Keterangan |
|---|---|
| Kotak pencarian | Cari berdasarkan nama, kode, template key, atau jabatan |
| Filter status | Semua, Aktif, Nonaktif, **Punya draft**, **Belum diterbitkan** |
| Urutkan | Keluarga, Nama, Pemakaian, Terbaru diterbitkan |

## Tambah Template

1. Klik **Tambah Template**
2. Isi form:
   - **Kode** — Kode unik template (min. 3 karakter)
   - **Nama Template** — Nama tampilan
   - **Keluarga** — `PKWT` atau `MITRA`
   - **Template Key** — Pilih dari dropdown (lihat tabel di bawah)
   - **Tipe Kontrak** & **Jabatan** (opsional)
   - **Deskripsi** & **Catatan** (opsional)
   - **Template aktif** — nonaktifkan bila template tidak dipakai lagi
3. Klik **Simpan**

::: info Template Key
Template Key menentukan struktur pasal dan role karyawan pada dokumen PDF.
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
dapat digunakan oleh beberapa template dengan nama berbeda, namun struktur dokumen PDF yang
dihasilkan akan identik — kecuali kontennya dikustomisasi.
:::

## Kelola Konten Template

Klik **Kelola Konten Template** pada kartu untuk membuka editor. Editor terdiri dari tiga bagian:

| Bagian | Isi |
|---|---|
| **Kiri** | Daftar versi (v1, v2, …) beserta status dan ringkasan perubahan |
| **Tengah** | Editor blok — tempat menyusun dan menyunting isi dokumen |
| **Kanan** | Panel **Field dinamis** (sisip placeholder) dan kartu **Validasi template** |

### Versi Template

Setiap versi memiliki salah satu status berikut:

| Status | Keterangan |
|---|---|
| `DRAFT` | Versi yang sedang disunting. Perubahan belum berlaku pada kontrak baru. |
| `PUBLISHED` | Versi aktif. Kontrak baru yang memakai template ini akan memakai versi ini. |
| `ARCHIVED` | Versi lama yang sudah digantikan. Tetap tersimpan sebagai riwayat. |

Aksi yang tersedia pada panel versi:

- **Draft baru** — membuat draft baru dari versi `PUBLISHED` terakhir. Gunakan ini untuk mulai mengubah template.
- **Rollback ke versi ini** — mengaktifkan kembali versi `ARCHIVED` sebagai `PUBLISHED` (tersedia pada versi berstatus `ARCHIVED`).
- **Hapus versi** — menghapus versi `DRAFT` atau `ARCHIVED` (tersedia pada versi dengan status tersebut).

::: warning Versi PUBLISHED bersifat immutable
Versi yang sudah dipublish **tidak dapat disunting langsung**. Buat **Draft baru**, sunting, lalu **Publish**.
Kontrak yang sudah dibuat tetap memakai snapshot versi saat kontrak itu dibuat, sehingga tidak pernah berubah.
:::

### Tombol Utama Editor

| Tombol | Fungsi |
|---|---|
| **Pratinjau** | Menjalankan validasi backend dan menampilkan PDF (lihat [Pratinjau & Validasi](#pratinjau-validasi)) |
| **Simpan** / **Simpan draft** | Menyimpan perubahan draft. Muncul badge **Belum disimpan** bila ada perubahan yang belum tersimpan |
| **Publish** | Menerbitkan draft menjadi versi `PUBLISHED` (versi lama otomatis menjadi `ARCHIVED`) |

Isi kolom **Ringkasan perubahan** untuk mencatat apa yang berubah; ringkasan ini muncul di riwayat versi.

### Bahasa

Gunakan tombol **Indonesia** / **English** untuk berpindah bahasa.

- **PKWT** — bilingual (Indonesia + English), keduanya wajib diisi.
- **MITRA** — hanya Indonesia.

## Editor Blok

Isi dokumen disusun dari blok. Klik **Tambah blok** untuk memilih tipe blok:

| Tipe Blok | Deskripsi |
|---|---|
| **Paragraf** | Satu blok teks biasa |
| **Pasal** | Judul pasal + beberapa paragraf uraian |
| **Daftar** | Poin bernomor, huruf, atau bullet |
| **Tabel** | Baris dan kolom, mis. rincian upah |
| **Tanda Tangan** | Blok tanda tangan dua pihak |
| **Judul Dokumen** | Judul utama di tengah halaman |
| **Subjudul** | Baris kecil di bawah judul (hanya MITRA) |
| **Ganti Halaman** | Memaksa halaman baru di PDF |

Setiap blok dapat **digeser (drag)** untuk mengubah urutan, **diduplikat**, **dihapus**, atau **diciutkan** (collapse). Klik blok untuk memilihnya — blok terpilih menjadi target penyisipan field dinamis.

::: warning Blok wajib
Setiap bahasa harus memiliki minimal satu blok konten **dan** tepat satu blok **Tanda Tangan**. Publish akan ditolak bila salah satu tidak ada.
:::

::: info Judul dokumen pada PKWT
Template **PKWT** (dua kolom ID/EN) tidak memakai blok **Subjudul**. Kop dokumen memiliki dua baris judul: baris pertama = blok **Judul Dokumen** pada tab **Indonesia**, baris kedua = blok **Judul Dokumen** pada tab **English**. Jadi cukup satu blok Judul di tiap bahasa — tidak ada blok Subjudul yang perlu diisi.
:::

::: info Judul pasal maks. 2 baris
Judul pasal dirancang maksimal **2 baris** (mis. `PASAL 1` di baris pertama, `RUANG LINGKUP` di baris kedua). Tekan Enter untuk memisah baris. Batas ini menjaga paginasi PDF agar judul tidak terpisah dari uraiannya.
:::

## Pemformatan Teks (Tebal / Miring / Garis Bawah)

Setiap field teks memiliki toolbar **B / I / U** di atasnya. Pilih sebagian teks lalu klik tombol, atau gunakan pintasan keyboard:

| Tombol | Pintasan | Penulisan |
|---|---|---|
| **B** (Tebal) | `Ctrl+B` | `**tebal**` |
| **I** (Miring) | `Ctrl+I` | `*miring*` |
| **U** (Garis bawah) | `Ctrl+U` | `__garis bawah__` |

Anda juga dapat mengetikkan penandanya langsung di dalam teks. Di bawah field akan muncul **pratinjau perkiraan** dari teks berformat tersebut.

::: tip Acuan akhir adalah Pratinjau PDF
Pratinjau inline di editor hanya perkiraan. Gunakan tombol **Pratinjau** untuk melihat hasil akhir PDF yang sesungguhnya.
:::

### Di Mana Pemformatan Bisa Dipakai

| Lokasi | Tebal/Miring/Garis Bawah |
|---|---|
| Paragraf | ✅ |
| Uraian pasal | ✅ |
| Judul pasal (`PASAL 1`) | ❌ |
| Judul dokumen & subjudul | ❌ |
| Item daftar | ❌ |
| Sel tabel | ❌ |

::: warning Publish ditolak bila penanda di lokasi yang tidak didukung
Menuliskan `**`, `*`, atau `__` di **judul pasal**, **judul/subjudul dokumen**, **item daftar**, atau **sel tabel** akan **menolak publish** dengan pesan yang menyebut lokasinya. Ini mencegah penanda tercetak sebagai teks mentah di dokumen legal.
:::

::: info Penanda tanpa pasangan
Penanda yang tidak memiliki pasangan (mis. satu `*` saja) **tidak** dibuang dan **tidak** memblokir publish — ia dicetak apa adanya sebagai teks biasa. Placeholder seperti `&#123;&#123;custom.ktp_issued_date&#125;&#125;` juga tidak pernah salah tafsir karena bersifat opaque.
:::

## Perataan Teks

Blok **Paragraf** dan **Pasal** memiliki empat tombol perataan (radio, saling eksklusif):

| Tombol | Keterangan |
|---|---|
| **Rata kiri** | Teks rata kiri |
| **Rata tengah** | Teks rata tengah |
| **Rata kanan** | Teks rata kanan |
| **Rata kiri-kanan** | Teks justified (default untuk paragraf & uraian pasal) |

- Pada blok **Paragraf**, grup perataan berada langsung di dalam field teks.
- Pada blok **Pasal**, grup **Perataan** mengatur seluruh uraian pasal, dan grup terpisah **Perataan judul** mengatur judul pasalnya saja.

::: info Perilaku default
Bila tidak ada perataan yang dipilih, teks memakai perilaku bawaan sistem: **justified** untuk paragraf dan uraian pasal. Untuk judul pasal, default mengikuti keluarga template — **rata tengah** untuk MITRA dan **rata kiri** untuk PKWT.
:::

## Spasi Antar Blok

Setiap blok konten memiliki kontrol **Spasi antar blok** — jarak vertikal **tambahan** di bawah blok tersebut, di atas jarak bawaan dokumen. Berguna untuk merenggangkan antar-pasal atau memberi napas pada bagian tertentu.

| Tombol | Efek |
|---|---|
| **Rapat** | Tanpa jarak tambahan (0 pt) |
| **Normal** | Jarak bawaan dokumen (tidak menyetel apa pun) |
| **Renggang** | Tambah 12 pt |
| **Ekstra** | Tambah 20 pt |
| **Kustom** | Atur sendiri, bilangan bulat **0–40 pt** |

- Nilai bersifat **tambahan** — jarak bawaan blok tetap dipakai.
- Bila blok berada tepat di puncak kolom/halaman baru (karena blok sebelumnya sudah penuh), jarak **tidak** diterapkan agar tidak menyisakan ruang kosong di atas.
- Blok yang dapat diatur:
  - **MITRA** (Perjanjian Kemitraan): **Paragraf**, **Pasal**, **Daftar**, **Tabel**, **Judul Dokumen**, dan **Subjudul**.
  - **PKWT** (Kesepakatan Kerja Waktu Tertentu): **Paragraf**, **Pasal**, dan **Daftar** (blok yang benar-benar mengalir ke kolom; judul/subjudul jadi kop dan tabel tidak dirender di kolom).
- Pada **PKWT** (dua kolom ID/EN yang terkunci per baris), bila jarak disetel hanya di salah satu bahasa atau berbeda antar bahasa, nilai **terbesar** yang dipakai — jarak tetap terasa.
- **Tanda Tangan** dan **Ganti Halaman** tidak memiliki kontrol ini.
- Saat sebuah blok memiliki jarak tambahan, kepala kartunya menampilkan penanda, mis. **+12 pt**.

::: info Tidak mengubah kontrak lama
Menambah spasi dapat menggeser paginasi PDF — sistem menghitung ulang jumlah halaman dan posisi tanda tangan secara otomatis. Kontrak yang **sudah dibuat** tidak terpengaruh karena memakai snapshot versi saat dibuat; perubahan berlaku untuk **kontrak baru** atau setelah versi template di-publish ulang.
:::

## Field Dinamis

Panel **Field dinamis** (kanan) berisi daftar placeholder yang dapat disisipkan ke blok. Klik field untuk menyisipkannya ke **blok yang sedang dipilih**.

Field terdiri dari dua jenis:

| Jenis | Sumber | Contoh |
|---|---|---|
| **Otomatis** | Diambil dari data karyawan/kontrak | `&#123;&#123;employee.fullName&#125;&#125;`, `&#123;&#123;contract.contractNo&#125;&#125;` |
| **Dinamis** | Diisi manual saat membuat kontrak | `&#123;&#123;custom.ktp_issued_date&#125;&#125;` |

### Kelola Field

Klik **Kelola** untuk mengatur field mana saja yang diaktifkan (di-bind) untuk template ini. Field yang **belum di-bind** tidak dapat disisipkan dan akan menggagalkan publish bila tetap dipakai di teks.

Klik **Baru** untuk membuat field dinamis baru. Setiap field memiliki:

| Kolom | Keterangan |
|---|---|
| Kunci (key) | Nama teknis field, dipakai di placeholder `&#123;&#123;custom.kunci&#125;&#125;` |
| Label | Nama yang tampil di form kontrak |
| Tipe | Teks, Angka, Tanggal, atau Pilihan |
| Wajib diisi | Bila dicentang, kontrak **tidak bisa dibuat** sebelum field ini diisi |

::: warning Field wajib memblokir pembuatan kontrak
Mencentang **Wajib diisi** berarti server akan menolak pembuatan kontrak sampai
field tersebut diisi. Centang hanya untuk data yang benar-benar harus ada di
dokumen (mis. nomor KTP mitra), bukan data opsional.
:::

### Mencari field ini dipakai di blok mana

Blok di editor tampil **tertutup** secara default, jadi sulit mengetahui sebuah
field sudah dipakai di bagian mana saja. Klik ikon **kaca pembesar bertanda centang**
di panel "Field dinamis" untuk membuka pencarian pemakaian.

| Bagian | Keterangan |
|---|---|
| Kotak pencarian | Saring berdasarkan nama atau kunci field |
| Badge "Dinamis" / "Otomatis" | Field input manual vs field otomatis dari data karyawan/kontrak |
| Badge "Belum di-bind" | Field dipakai di teks tetapi belum dipakai template ini — **penerbitan akan gagal** |
| Badge "Dipakai di bahasa EN/ID" | Field tidak ada di bahasa yang sedang dibuka, tetapi dipakai di bahasa lain |
| Tombol "Blok 12 · paragraf 3" | **Klik untuk membuka blok itu dan menggulir ke sana** |

Hasil pencarian mengikuti **draft yang sedang dibuka**; bila tidak ada draft
(mode baca), yang dipindai adalah versi yang sedang dipilih.

::: info Placeholder di luar katalog
Placeholder yang muncul di teks tetapi tidak terdaftar di katalog field
ditampilkan sebagai peringatan di bagian atas pencarian. Perbaiki sebelum
menerbitkan versi.
:::

::: info Field Master Reference belum didukung
Tipe **Master Reference** (mengambil nilai otomatis dari data karyawan/jabatan)
belum bisa dipakai di dokumen kontrak. Versi template yang memuatnya akan
**ditolak saat diterbitkan** dengan pesan yang jelas — ubah field tersebut
menjadi input manual, atau hapus dari daftar field.
:::

## Pratinjau & Validasi

Klik **Pratinjau** untuk menjalankan validasi backend dan menampilkan pratinjau dokumen. Pratinjau memakai **mesin render yang sama** dengan tombol Generate Kontrak, sehingga hasilnya 1:1 dengan PDF final.

Kartu **Validasi template** menampilkan ringkasan:

| Baris | Keterangan |
|---|---|
| **Status** | Valid / Tidak valid |
| **Placeholder** | Jumlah placeholder yang terdeteksi |
| **Blok** | Jumlah blok pada versi bahasa yang aktif |
| **Blok berformat** | Jumlah blok yang memakai pemformatan teks |

::: tip Publish hanya bisa bila template valid
Bila validasi menemukan masalah (mis. placeholder tak terdaftar, penanda di lokasi terlarang, atau blok wajib yang hilang), publish akan ditolak dengan pesan yang menyebut blok/lokasinya.
:::

## Hapus Template

Klik ikon **⋮** pada kartu template → **Hapus** → konfirmasi penghapusan.

::: warning Template Dalam Penggunaan
Template yang sudah dipakai oleh satu atau lebih kontrak aktif **tidak dapat dihapus**.
Sistem akan menampilkan jumlah kontrak yang menggunakan template tersebut.
:::

## Lihat Juga

- [Kontrak Karyawan](/panduan-pengguna/kontrak-karyawan) — membuat kontrak dan generate PDF
- [Template Kontrak (Teknis)](/teknis/template-kontrak-rendering) — model konten, pemformatan inline, perataan, dan alur render
