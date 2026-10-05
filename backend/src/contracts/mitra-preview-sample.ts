/**
 * Nilai contoh (dummy) untuk pratinjau dokumen MITRA di editor template.
 *
 * Editor template belum terikat kontrak/karyawan mana pun, jadi pratinjau harus
 * memakai data contoh. Nilai di sini juga dipakai harness validasi layout
 * (`scripts/validate-kemitraan-layout.ts`) agar pratinjau menghasilkan PDF yang
 * sama dengan berkas yang diukur terhadap master.
 *
 * Nilai sengaja "wajar" (bukan PII karyawan nyata) dan mencakup SEMUA placeholder
 * yang dipakai template MITRA, sehingga tidak ada `...............` (fallback
 * field kosong) yang muncul hanya karena data contoh kurang.
 */
export const MITRA_PREVIEW_VALUES: Record<string, string> = {
  // Kontrak
  'contract.contractNo': '220/KUKP-SII/2026',
  'contract.startDate': '31 Agustus 2026',
  'contract.endDate': '31 Agustus 2027',
  'contract.signedDate': '31 Agustus 2026',
  'contract.termRange': '1 September 2026 - 31 Agustus 2027',
  'contract.baseCompensation': 'Rp 6.000.000',
  'contract.duration': '12 (dua belas) bulan',
  // Karyawan / mitra
  'employee.fullName': 'M. Ikhsan Umar',
  'employee.employeeNo': 'KOK-0001',
  'employee.nik': '3214031603910001',
  // Blok identitas PIHAK KEDUA memuat baris `Jenis Kelamin`. Tanpa nilai di
  // sini, `{{employee.gender}}` yang disisipkan admin lewat editor tampil
  // sebagai `...............` di Pratinjau — padahal generate kontrak asli
  // sudah benar (`genderLabel()` → "Laki-laki"). Nilai mengikuti label ID yang
  // sama dengan PKWT_PREVIEW_VALUES agar satu enum tak punya dua label.
  'employee.gender': 'Laki-laki',
  'employee.birthPlace': 'Purwakarta',
  'employee.birthDate': '16 Maret 1991',
  'employee.address': 'KP Kertajaya Rt/Rw 12/06 Desa Sukajadi Kec. Pondok Salam Purwakarta',
  'employee.phoneNumber': '081234567890',
  'employee.email': 'ikhsan@example.com',
  'employee.jobRole': 'Driver',
  // Dokumen & pengaturan
  'doc.hariTanggal': 'Senin, 31 Agustus 2026',
  'doc.docDate': '31 Agustus 2026',
  'settings.cooperativeChairmanName': 'Hari Suhono',
  // Field dinamis (CONTRACT_INPUT)
  'custom.ktp_issued_date': '08 Agustus 2024',
}
