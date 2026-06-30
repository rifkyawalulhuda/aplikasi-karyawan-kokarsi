# PROPOSAL PENGEMBANGAN APLIKASI
## MANAJEMEN DATA KARYAWAN & KONTRAK
**KOPERASI KARYAWAN PT. SANKYU**

**Versi**: 1.0  
**Tanggal**: 20 Mei 2026  
**Disusun oleh**: Grok (xAI) – Tim Pengembang

---

**Cover Page**

*(Gambar ilustrasi modern: Dashboard aplikasi dengan tema biru-hijau profesional, logo Koperasi Karyawan PT. Sankyu, dan icon karyawan + kontrak)*

**PROPOSAL PENAWARAN**

**PENGEMBANGAN APLIKASI WEB MANAJEMEN DATA KARYAWAN & KONTRAK KOPERASI**

Saatnya Koperasi Karyawan PT. Sankyu dikelola dengan **Profesional, Lebih Mudah, Rapi, dan Cepat** melalui sistem digital modern.

---

## 1. PENDAHULUAN

Koperasi Karyawan PT. Sankyu membutuhkan sistem informasi yang handal untuk mengelola data karyawan secara terpusat, termasuk manajemen dokumen kontrak, status kepegawaian (MITRA / KONTRAK), dan pelacakan masa berlaku kontrak secara otomatis.

Saat ini, pengelolaan data masih manual (Excel/spreadsheet), yang berisiko human error, sulit dicari, dan tidak memiliki sistem notifikasi otomatis untuk kontrak yang akan habis.

Kami menawarkan solusi **Aplikasi Web Custom** yang dirancang khusus sesuai kebutuhan Koperasi Karyawan PT. Sankyu, dengan teknologi modern, database yang aman, dan antarmuka yang mudah digunakan oleh **Master Admin**.

---

## 2. PRODUK & DESKRIPSI APLIKASI

**Nama Aplikasi**: Sankyu HR – Sistem Manajemen Data Karyawan & Kontrak

**Jenis Aplikasi**: Web-based Application (akses via browser desktop & tablet)

**Tujuan Utama**:
- Mencatat dan mengelola seluruh data master karyawan secara digital
- Mengelola kontrak karyawan (upload dokumen PDF, tracking masa berlaku)
- Memberikan dashboard ringkasan & notifikasi otomatis kepada Master Admin
- Menghasilkan laporan yang rapi dan profesional

Aplikasi ini **khusus dibuat untuk internal use** Koperasi Karyawan PT. Sankyu dan hanya dapat diakses oleh **Master Admin**.

---

## 3. MANFAAT

- **Efisiensi Tinggi**: Data karyawan & kontrak tersimpan terpusat, pencarian < 5 detik
- **Mengurangi Human Error**: Validasi otomatis & riwayat perubahan
- **Notifikasi Otomatis**: Peringatan 30 hari & 7 hari sebelum kontrak habis
- **Keamanan Data**: Password hash, role-based access (hanya Master Admin)
- **Profesional**: Laporan & dokumen siap cetak dengan format rapi
- **Skalabilitas**: Siap untuk 5.000+ karyawan
- **Hemat Biaya Jangka Panjang**: Tidak perlu beli software siap pakai yang tidak sesuai kebutuhan

---

## 4. FITUR APLIKASI (MVP)

### 4.1 Fitur Data Master Karyawan
- CRUD lengkap data karyawan (employeeNo, fullName, employmentStatus, birthDate, gender, joinDate, email, phoneNumber, fotoKaryawan)
- Dropdown master data: Work Location, Job Role, Job Level, Tax Status, Education Level
- Upload foto karyawan

### 4.2 Fitur Manajemen Kontrak
- Tambah kontrak baru + upload dokumen PDF
- Riwayat kontrak per karyawan
- Status kontrak otomatis (Aktif / Akan Habis / Expired)
- Notifikasi otomatis via dashboard

### 4.3 Fitur Dashboard & Reporting (Khusus Master Admin)
- Ringkasan total karyawan aktif, MITRA vs KONTRAK
- Grafik distribusi job level & lokasi
- Daftar kontrak yang akan habis dalam 30 hari
- Filter & pencarian powerful

### 4.4 Fitur Pendukung
- Manajemen Master Data Lookup (Setting)
- Audit Log perubahan data
- Export data ke Excel
- Responsive design (bisa diakses via HP/Tablet)

---

## 5. SPESIFIKASI TEKNIS

**Platform & Teknologi Modern**:
- **Frontend**: Nuxt 3 (Vue 3) + Nuxt UI + Tanstack Table v8 + Vite
- **Backend**: NestJS + Prisma ORM
- **Database**: PostgreSQL (aman & powerful)
- **Infrastructure**: Docker + Cloudflare Tunnel + Xubuntu Linux
- **Keamanan**: JWT Authentication, Password Hash (Argon2), Role-based Access Control

**Standar Keamanan**:
Mengikuti standar OWASP Top 10 (Injection, Broken Authentication, XSS, CSRF, dll).

**Additional Services**:
- Free Maintenance 3 Bulan
- Training Penggunaan untuk Master Admin (Online + Offline)
- Modul Panduan Penggunaan
- Backup Data Harian

---

## 6. ESTIMASI BIAYA & PAKET

**Paket Pengembangan Full Custom (MVP)**

| Komponen                          | Keterangan                                      | Harga          |
|-----------------------------------|-------------------------------------------------|----------------|
| Pengembangan Aplikasi Web         | Full MVP (Master Data + Kontrak + Dashboard)   | Rp 48.000.000 |
| Setup Database & Migrasi Data     | Termasuk import data awal dari Excel            | Termasuk      |
| Hosting & Domain Setup            | 1 Tahun pertama (Cloudflare + Server)           | Termasuk      |
| Training & Dokumentasi            | 2x Training + Panduan PDF                       | Termasuk      |
| Maintenance 3 Bulan               | Bug fix + minor adjustment                      | Termasuk      |
| **Total Investasi**               | **Sekali Bayar (Lifetime License)**             | **Rp 48.000.000** |

*Biaya belum termasuk PPN 11%  
*Harga sudah termasuk 1 tahun hosting & domain

**Biaya Opsional (Setelah Go-Live)**:
- Maintenance Tahunan: Rp 6.000.000 / tahun
- Penambahan Fitur Baru: On Call (Rp 1.500.000 – 4.000.000 / fitur)
- Kunjungan Onsite: On Call

---

## 7. ESTIMASI WAKTU PENGEMBANGAN

| Tahap                          | Durasi     | Keterangan |
|--------------------------------|------------|----------|
| Kick-off & Requirement Final   | 3 Hari     | - |
| Desain Database & Backend      | 10 Hari    | - |
| Frontend Development           | 12 Hari    | - |
| Integrasi & Testing            | 7 Hari     | - |
| Training & UAT                 | 5 Hari     | - |
| Go-Live & Handover             | 3 Hari     | - |
| **Total**                      | **± 40 Hari Kerja** | **± 8 Minggu** |

---

## 8. ROADMAP & MILESTONE

1. **Minggu 1-2**: Foundation & Database
2. **Minggu 3-5**: Master Data Karyawan + Foto Upload
3. **Minggu 6-8**: Modul Kontrak + Notifikasi
4. **Minggu 9-10**: Dashboard & Reporting
5. **Minggu 11-12**: Polish, Testing, Training
6. **Minggu 13**: Go-Live

---

## 9. KENAPA MEMILIH KAMI?

- **Custom 100%** sesuai skema database & kebutuhan PT. Sankyu (bukan software siap pakai)
- Teknologi **modern & scalable** (bukan PHP lama)
- Fokus pada **manajemen kontrak & status karyawan** (fitur utama yang Anda butuhkan)
- Tim berpengalaman dalam pengembangan aplikasi HR & Koperasi
- Transparan & komunikatif selama proses development

---

## 10. KONTAK & LANGKAH SELANJUTNYA

Kami siap melakukan presentasi live dan diskusi lebih detail mengenai kebutuhan spesifik Koperasi Karyawan PT. Sankyu.

**Hubungi Kami**:
- Email: [your-email@domain.com]
- WhatsApp: [Nomor WA]
- Website: [jika ada]

**Langkah Selanjutnya**:
1. Review proposal ini
2. Meeting online / offline untuk finalisasi requirement
3. Penandatanganan kontrak & pembayaran DP 40%
4. Mulai development

---

**Disetujui oleh**:

**Koperasi Karyawan PT. Sankyu**  
___________________________  
Nama & Jabatan  
Tanggal: _______________

**Tim Pengembang**  
Grok (xAI)  
Tanggal: 20 Mei 2026

---

*Proposal ini berlaku selama 30 hari sejak tanggal diterbitkan.*

---

**Lampiran**:
- PRD Lengkap (Versi 1.1)
- Diagram Database (Draw.io)
- Tech Stack Diagram
- Contoh Mockup Halaman (akan disediakan setelah approval)

---

**Smartcoop?**  
Proposal ini **bukan** software siap pakai seperti Smartcoop.  
Ini adalah **aplikasi custom** yang dibuat 100% sesuai kebutuhan Koperasi Karyawan PT. Sankyu dengan teknologi terkini dan fitur kontrak yang lebih spesifik.

Siap memulai? Mari kita wujudkan sistem HR digital yang profesional untuk PT. Sankyu! 🚀