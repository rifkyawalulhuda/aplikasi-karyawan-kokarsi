/**
 * Nilai contoh (dummy) untuk pratinjau dokumen PKWT di editor template.
 *
 * Editor template belum terikat kontrak/karyawan mana pun, jadi pratinjau harus
 * memakai data contoh. Sama seperti `MITRA_PREVIEW_VALUES`, nilai di sini
 * sengaja "wajar" (bukan PII karyawan nyata) dan mencakup SEMUA placeholder yang
 * dipakai template PKWT, sehingga tidak ada fallback field kosong yang muncul
 * hanya karena data contoh kurang.
 *
 * PKWT bersifat BILINGUAL: `contentDefinition.languages.id` dan `.en` dirender
 * berdampingan. Sebagian besar nilai sama untuk kedua kolom; yang teksnya
 * memang berbeda antar bahasa punya variannya sendiri di
 * `PKWT_PREVIEW_VALUES_EN` di bawah.
 */
export const PKWT_PREVIEW_VALUES: Record<string, string> = {
  // Kontrak
  'contract.contractNo': '174/KUKP-SII/VII/2026',
  'contract.startDate': '2 Juli 2026',
  'contract.endDate': '1 Juli 2027',
  'contract.signedDate': '2 Juli 2026',
  'contract.termRange': '2 Juli 2026 - 1 Juli 2027',
  'contract.baseCompensation': 'Rp 5.500.000',
  'contract.duration': '12 (dua belas) bulan',
  // Karyawan
  'employee.fullName': 'Ibad Ubaidillah',
  'employee.employeeNo': 'KOK-0002',
  'employee.nik': '3214031603910002',
  'employee.birthPlace': 'Bekasi',
  'employee.birthDate': '2 Juli 1996',
  'employee.gender': 'Laki-laki',
  'employee.address': 'KP Kertajaya Rt/Rw 12/06 Desa Sukajadi Kec. Pondok Salam Purwakarta',
  'employee.phoneNumber': '081234567891',
  'employee.email': 'ibad@example.com',
  'employee.jobRole': 'Driver',
  // Data bank PIHAK KEDUA (Master Data Bank + No. Rekening karyawan).
  'employee.bank': 'Mandiri',
  'employee.bank.branch': 'Deltamas',
  'employee.bankAccountNumber': '1730011451375',
  // Dokumen & pengaturan
  'doc.hariTanggal': 'Kamis, 2 Juli 2026',
  'doc.docDate': '2 Juli 2026',
  'settings.cooperativeChairmanName': 'Hari Suhono',
  // Field dinamis (CONTRACT_INPUT). Katalog field GLOBAL (dipakai MITRA dan
  // PKWT), jadi picker editor PKWT juga menawarkan field ini — bila admin
  // menyisipkannya, pratinjau harus tetap menampilkan nilai, bukan titik-titik.
  'custom.ktp_issued_date': '08 Agustus 2024',
}

/**
 * Varian INGGRIS dari nilai contoh — HANYA untuk placeholder yang teksnya
 * berbeda antar kolom.
 *
 * Sengaja di-`spread` dari versi Indonesia alih-alih ditulis ulang penuh, supaya
 * kedua peta tidak mungkin lepas sinkron saat placeholder baru ditambahkan; yang
 * di-override hanya key yang memang bilingual. Dipakai kolom kanan pratinjau;
 * lihat `valuesEn` di `PkwtDocumentRenderOptions`.
 *
 * Isi override ini harus MENCERMINKAN `displayValueEn` resolver — kalau pratinjau
 * dan dokumen asli berbeda, editor akan menyetujui sesuatu yang tidak pernah
 * tercetak:
 *   - `employee.gender`   → `genderLabel(raw, 'EN')`
 *   - tanggal & rentang   → `formatEnglishDate` / `deriveTermRangeEn`
 */
export const PKWT_PREVIEW_VALUES_EN: Record<string, string> = {
  ...PKWT_PREVIEW_VALUES,
  'employee.gender': 'Male',
  'employee.birthDate': '2 July 1996',
  'contract.startDate': '2 July 2026',
  'contract.endDate': '1 July 2027',
  'contract.signedDate': '2 July 2026',
  'contract.termRange': '2 July 2026 - 1 July 2027',
  'doc.docDate': '2 July 2026',
}
