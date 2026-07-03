# Plan: Implementasi Template PDF Kontrak 1:1 dengan Sampel

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Generator PDF kontrak menghasilkan output yang mirip 1:1 dengan sampel legal asli di `docs/sample-legal-doc/pdf/`.

## Analisis Perbedaan Sampel vs Generator Saat Ini

### PKWT (Kesepakatan Kerja Waktu Tertentu)

| Aspek | Sampel Asli | Generator Saat Ini | Gap |
|-------|-------------|-------------------|-----|
| **Judul** | 2 baris bilingual: "KESEPAKATAN KERJA WAKTU TERTENTU" + "STATED PERIODS LABOUR AGREEMENT" | 1 baris dari definition.title | Perlu bilingual title |
| **Sub-judul** | "No. : 174/KUKP-SII/VII/2026" | `No. : {contractNo}` | ✅ Sudah OK |
| **Font body** | Times New Roman 10-11pt | Courier 10.5pt | **Ganti ke Times-Roman** |
| **Layout** | 2 kolom paralel (ID kiri, EN kanan) dengan border box | 2 kolom paralel + border box | ✅ Sudah OK |
| **Pembukaan** | "Pada hari ini, Kamis, tanggal 02, Juli 2026, yang bertanda tangan di bawah ini:" | Mirip | ✅ Sudah OK |
| **Identitas Pihak I** | "I. Koperasi Karyawan PT. Sankyu Indonesia International – Unit Jakarta, di Jl. Kawasan... yang diwakili oleh Bpk HARI SUHONO" | Hanya "berkedudukan di {location}" | Perlu wakil + alamat detail |
| **Identitas Pihak II** | "II. Nama : IBAD UBAIDILLAH\nTgl. Lahir : Sukabumi, 20 Mei 1980\nJenis Kelamin : Laki-Laki\nAlamat : Perumahan..." | Nama/Tgl Lahir/NIK/Alamat | Perlu **Jenis Kelamin** (gender) |
| **Section heading** | Bilingual: "Pasal 1 / Article 1" + subtitle "Maksud Kesepakatan / Agreement Purpose" | Hanya "Pasal X - Subtitle" | Perlu format bilingual per heading |
| **Paragraf per pasal** | 2 kolom: paragraf ID di kiri, paragraf EN di kanan, numbered | Numbered paragraphs | ✅ Sudah OK |
| **Closing paragraph** | "Demikian Kesepakatan Kerja untuk Waktu Tertentu ini dibuat tanpa adanya desakan dari salah satu pihak, dibuat dalam rangkap dua dan bermeterai cukup." | Ada di closingParagraphs | ✅ Sudah OK |
| **Signature block** | Date: "Bekasi, 02 Juli, 2026"\nHeader: "KOPERASI KARYAWAN PT SANKYU INDONESIA INTERNATIONAL\nUNIT KANTOR PUSAT"\nLeft: "Karyawan/employee" + nama\nRight: "Pengusaha/Perusahaan" + nama | Date + firstPartyLabel/secondPartyLabel + nama | Perlu header koperasi di atas signature |

### MITRA (Perjanjian Kemitraan)

| Aspek | Sampel Asli | Generator Saat Ini | Gap |
|-------|-------------|-------------------|-----|
| **Judul** | "PERJANJIAN KEMITRAAN" | "PERJANJIAN KEMITRAAN" | ✅ Sudah OK |
| **Sub-judul** | "Nomor: ..../KUKP-SII/...../202...\nTanggal ……………" | "Nomor: {contractNo}\nTanggal {signedDate}" | ✅ Sudah OK |
| **Layout** | **Single column** full width | **2 kolom sequential** | **UBAH ke single column** |
| **Font** | Times New Roman 12pt | Times-Roman 12pt | ✅ Sudah OK |
| **Preambule** | Sangat detail: identitas koperasi lengkap (akta pendirian, keputusan kementerian, alamat, wakil), identitas mitra (KTP, lahir, alamat), 3 poin "menerangkan" | Hanya 2 poin identitas sederhana | **Tambah preambule lengkap** |
| **Pasal 1** | "RUANG LINGKUP" - 6 sub-poin detail tentang pekerjaan driver | Dari definition.sections | Konten per template key sudah OK |
| **Pasal 2-15** | 15 pasal lengkap: Jangka Waktu, Hak & Kewajiban, Imbalan Jasa, Evaluasi, Kerahasiaan, Keadaan Memaksa, Wanprestasi, Ganti Rugi, Pengalihan, Pengakhiran, Pemberitahuan, Penyelesaian Perselisihan, Perubahan, Lain-lain | Dari definition.sections | Konten per template key sudah OK |
| **Signature** | "PIHAK PERTAMA\nKOPERASI PT. SANKYU INT'L\n\nHari Suhono\n(Ketua Koperasi)" / "PIHAK KEDUA\n\nEko Rizal Sholehudin\n(Mitra)" | firstPartyLabel / secondPartyLabel + nama | Perlu detail label + jabatan |

## Task Implementasi

### Task 1: Perbaiki PKWT — Font dan Heading Bilingual
**File:** `backend/src/contracts/contract-document.service.ts`

1. Ganti font PKWT dari `Courier`/`Courier-Bold` ke `Times-Roman`/`Times-Bold` di `buildPkwtIndonesianBlocks()` dan `buildPkwtEnglishBlocks()`
2. Ubah format heading section menjadi bilingual:
   - Baris 1: "Pasal X" (left) + "Article X" (right) — bold 11pt
   - Baris 2: "Subtitle ID" (left) + "Subtitle EN" (right) — bold italic 10pt
3. Tambahkan mapping subtitle EN untuk setiap pasal di `pkwtEnglishSectionMap` (sudah ada tapi perlu ditambah key subtitle)

### Task 2: Perbaiki PKWT — Identitas Pihak + Jenis Kelamin
**File:** `backend/src/contracts/contract-document.service.ts`

1. Tambahkan field `gender` ke identity block di `buildPkwtIndonesianBlocks()`:
   - `Jenis Kelamin : {Laki-Laki/Perempuan}`
2. Tambahkan field `gender` ke identity block di `buildPkwtEnglishBlocks()`:
   - `Gender : {Male/Female}`
3. Pastikan `gender` tersedia dari `payload.employee.gender` (sudah ada di schema Prisma)

### Task 3: Perbaiki PKWT — Signature Block
**File:** `backend/src/contracts/contract-document.service.ts`

1. Tambahkan header koperasi di atas signature:
   ```
   KOPERASI KARYAWAN PT SANKYU INDONESIA INTERNATIONAL
   UNIT KANTOR PUSAT
   ```
2. Ubah label: "Karyawan/employee" (kiri) dan "Pengusaha/Perusahaan" (kanan)
3. Format date: "Bekasi, {DD} {Month}, {YYYY}" (tanpa "tanggal")

### Task 4: Perbaiki MITRA — Ubah Layout ke Single Column
**File:** `backend/src/contracts/contract-document.service.ts`

1. Ubah `renderMitraPdf()` dari 2 kolom sequential (`renderSequentialColumns`) ke **single column** full width
2. Buat method baru `renderSingleColumnPdf()` yang:
   - Draw corporate header (tanpa logo? cek lagi — sampel MITRA juga ada logo)
   - Draw title block
   - Render semua blocks full width (x=68, width=459) tanpa kolom/border
3. Hapus border box di layout MITRA

### Task 5: Perbaiki MITRA — Preambule Detail
**File:** `backend/src/contracts/contract-document.service.ts`

1. Tambahkan preambule lengkap di `buildMitraBlocks()`:
   - Poin 1: Identitas koperasi lengkap (akta, keputusan kementerian, alamat, wakil)
   - Poin 2: Identitas mitra (KTP/NIK, lahir, alamat)
   - Poin 3: "Kemudian PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut Para Pihak"
   - 3 poin "menerangkan" (ruang lingkup koperasi, mitra sebagai penyedia jasa, kesepakatan kerjasama)
2. Tambahkan paragraph "Sehubungan dengan hal-hal tersebut diatas, Para Pihak sepakat..."

### Task 6: Perbaiki MITRA — Signature Block
**File:** `backend/src/contracts/contract-document.service.ts`

1. Format signature MITRA:
   - Kiri: "PIHAK PERTAMA\nKOPERASI PT. SANKYU INT'L\n\n{processedByName}\n(Ketua Koperasi)"
   - Kanan: "PIHAK KEDUA\n\n{employee.fullName}\n(Mitra)"
2. Tambahkan closing paragraph: "Demikian Perjanjian ini dibuat dalam 2 (dua) rangkap serta bermeterai cukup..."

### Task 7: Register Font Times New Roman
**File:** `backend/src/contracts/contract-document.service.ts`

1. Pastikan font Times New Roman di-register di `createPdfBuffer()`:
   ```ts
   doc.registerFont('Times-Roman', 'C:/Windows/Fonts/times.ttf')
   doc.registerFont('Times-Bold', 'C:/Windows/Fonts/timesbd.ttf')
   doc.registerFont('Times-Italic', 'C:/Windows/Fonts/timesi.ttf')
   doc.registerFont('Times-BoldItalic', 'C:/Windows/Fonts/timesbi.ttf')
   ```
2. Ganti semua referensi font `Courier` ke `Times-Roman` di PKWT blocks

### Task 8: Verify & Test
1. `npx tsc -p tsconfig.json` di backend — exit 0
2. Test generate PKWT → bandingkan visual dengan `PKWT DRIVER 2026.pdf`
3. Test generate MITRA → bandingkan visual dengan `KONTRAK KERJA MITRA DRIVER OPS.pdf`
4. Pastikan layout, font, spacing, dan struktur 1:1 dengan sampel

## Asumsi
- Font Times New Roman tersedia di `C:/Windows/Fonts/` (sudah dipastikan dari PDF SP)
- Data employee.gender sudah tersedia di database
- Konten pasal-pasal per template key sudah benar di `contract-document-definitions.ts`
- Perubahan hanya di `contract-document.service.ts` (layout/rendering), bukan di definisi konten
