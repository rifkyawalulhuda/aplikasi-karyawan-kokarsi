# Dok. Karyawan

Modul Dok. Karyawan adalah pusat pengelolaan dokumen pribadi karyawan seperti KTP, SIM, NPWP, Kartu Keluarga, Paspor, BPJS, Ijazah, dan Sertifikat Kompetensi.

## Mengakses Halaman

Klik **Dokumen Karyawan → Dok. Karyawan** di sidebar.

## Daftar Karyawan

Tabel menampilkan satu baris per karyawan yang memiliki dokumen:
- **Karyawan** — Foto avatar, nama lengkap, dan nomor induk
- **Jumlah Dokumen** — Total dokumen yang sudah diinput
- **Status** — Status dokumen terparah (Aktif, Akan Expired, atau Expired)
- **Aksi** — Tombol "Lihat Dokumen" untuk membuka drawer detail

## Tambah Dokumen

Klik **Tambah Dokumen** di pojok kanan atas untuk menambah dokumen. Pilih karyawan terlebih dahulu, lalu isi detail dokumen.

## Drawer Detail Karyawan

Klik **Lihat Dokumen** atau nama karyawan untuk membuka drawer detail yang berisi:

### Section Dokumen Pribadi
Menampilkan dokumen identitas karyawan (KTP, SIM, NPWP, dll):
- Tipe dokumen
- Nomor dokumen
- Masa berlaku (atau "Tidak ada masa berlaku" untuk dokumen seperti KTP dan NPWP)
- Status
- Catatan
- Tombol unduh file, edit, dan hapus

Klik **Tambah** di pojok kanan section untuk menambah dokumen baru.

### Section Sertifikasi & Ijin
Menampilkan dokumen dari modul Sertifikasi & Ijin secara read-only. Untuk mengelola dokumen ini, gunakan halaman [Sertifikasi & Ijin](/panduan-pengguna/sertifikasi-ijin).

## Tambah / Edit Dokumen

Form tambah/edit dokumen memiliki field:
- **Tipe Dokumen** — Dipilih dari master data (hanya tipe kategori "Dokumen Pribadi")
- **Nomor Dokumen** — Nomor identitas dokumen
- **Masa Berlaku** — Opsional. Kosongkan untuk dokumen tanpa masa berlaku (KTP, NPWP, Kartu Keluarga, dll)
- **Catatan** — Keterangan tambahan (opsional)
- **File Dokumen** — Upload file PDF/JPG/PNG, maksimal 10MB (opsional)

::: tip Aturan Duplikat
Setiap karyawan hanya dapat memiliki satu dokumen per tipe. Tipe yang sudah ada ditandai dengan tanda ✓ dan tidak dapat dipilih kembali.
:::

## Status Dokumen

| Status | Keterangan |
|--------|-----------|
| **Aktif** | Masih berlaku atau tidak memiliki masa berlaku |
| **Akan Expired** | Akan habis dalam ≤ 30 hari |
| **Expired** | Sudah kadaluarsa |

## Notifikasi Kadaluarsa

Dokumen dengan masa berlaku (SIM, Paspor, Sertifikat Kompetensi, dll) akan memicu notifikasi di bell icon sidebar:
- **H-90, H-60, H-30** — Warning (kuning)
- **H-7, H-0** — Critical (merah)

Lihat [Notifikasi](/panduan-pengguna/notifikasi) untuk detail.

## Master Tipe Dokumen

Tipe dokumen dikelola melalui **Pengaturan → Master Data → Jenis Dokumen**. Setiap tipe memiliki field **Kategori**:
- **Dokumen Pribadi** — Muncul di dropdown Dok. Karyawan (KTP, SIM, NPWP, dll)
- **Sertifikasi & Ijin** — Muncul di dropdown Sertifikasi & Ijin

Lihat [Pengaturan](/panduan-pengguna/pengaturan) untuk menambah tipe dokumen baru.
