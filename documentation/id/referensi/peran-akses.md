# Peran & Akses

Aplikasi memiliki dua peran pengguna internal: **Master Admin** dan **Pengelola Koperasi**.

## Perbandingan Akses

| Fitur | Master Admin | Pengelola Koperasi |
|-------|:-----------:|:-----------------:|
| **Data Karyawan** | | |
| Lihat daftar karyawan | ✅ | ✅ |
| Tambah karyawan | ✅ | ✅ |
| Edit karyawan | ✅ | ✅ |
| Hapus karyawan | ✅ | ✅ |
| Import bulk Excel | ✅ | ✅ |
| Export data karyawan | ✅ | ✅ |
| Offboarding | ✅ | ✅ |
| **Kontrak** | | |
| Lihat semua kontrak | ✅ | ✅ |
| Tambah kontrak | ✅ | ✅ |
| Edit kontrak | ✅ | ✅ |
| Perpanjang kontrak | ✅ | ✅ |
| Generate PDF | ✅ | ✅ |
| **Surat Peringatan** | | |
| CRUD Surat Peringatan | ✅ | ✅ |
| Export Excel | ✅ | ✅ |
| **Sertifikasi & Ijin** | | |
| CRUD Sertifikasi & Ijin | ✅ | ✅ |
| Export Excel | ✅ | ✅ |
| **Dokumen Legal** | | |
| CRUD Kontrak Vendor | ✅ | ✅ |
| CRUD Legal Koperasi | ✅ | ✅ |
| CRUD Akte Dokumen | ✅ | ✅ |
| **Notifikasi** | | |
| Lihat notifikasi | ✅ | ✅ |
| **Dashboard** | | |
| Akses dashboard | ✅ | ✅ |
| **Pengaturan** | | |
| Pengaturan Umum (logo, nama org.) | ✅ | ✅ |
| Profil Akun & Keamanan | ✅ | ✅ |
| **Tampilan Login** | ✅ | ❌ |
| **Master Data** | ✅ | ❌ |
| **Template Kontrak** | ✅ | ❌ |
| **Manajemen User** | ✅ | ❌ |

## Membuat Akun Pengelola

Hanya **Master Admin** yang dapat membuat akun baru:

1. Buka **Pengaturan → User**
2. Klik **Tambah User**
3. Isi nama, NIK, email, username, dan password
4. Pilih role: **Pengelola Koperasi** atau **Admin**
5. Klik **Simpan**

## Credential Akun

| Jenis | Login menggunakan |
|-------|-----------------|
| Master Admin | **No. Induk Karyawan** (contoh: `EMP001`) |
| Pengelola Koperasi | **Username** (contoh: `pengelola1`) |

## Reset Password

Administrator dapat reset password pengguna lain melalui **Pengaturan → User → Edit**.

Pengguna dapat mengganti password sendiri melalui **Pengaturan → Keamanan**.
