/**
 * Katalog field SYSTEM (dan field dinamis bawaan) yang dikenal sistem.
 *
 * Dipisah dari `template-fields.service.ts` supaya data murni ini dapat diimpor
 * (mis. oleh unit test) TANPA ikut memuat `PrismaService` yang membuka koneksi
 * database saat modul di-import. `TemplateFieldsService.ensureSystemFields()`
 * memakai daftar ini sebagai seed idempotent.
 *
 * Kontrak penting: SETIAP placeholder SYSTEM yang dipakai definisi dokumen
 * bawaan HARUS ada di sini. `publish()` menolak versi yang memuat field SYSTEM
 * tak terdaftar (`validateFieldDefinitions`), sehingga entri yang hilang membuat
 * publish gagal dengan 400. Lihat regresi di `default-template-definition.spec.ts`.
 */
export interface SystemFieldSeed {
  key: string
  label: string
  dataType: 'TEXT' | 'NUMBER' | 'DATE'
  sourceType: 'SYSTEM'
}

export const SYSTEM_FIELD_SEEDS: SystemFieldSeed[] = [
  // Contract
  { key: 'contract.contractNo', label: 'Nomor Kontrak', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'contract.startDate', label: 'Tanggal Mulai', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.endDate', label: 'Tanggal Selesai', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.signedDate', label: 'Tanggal Tanda Tangan', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'contract.baseCompensation', label: 'Kompensasi Dasar', dataType: 'NUMBER', sourceType: 'SYSTEM' },
  { key: 'contract.termRange', label: 'Rentang Periode (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'contract.duration', label: 'Durasi Kontrak (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  // Employee
  { key: 'employee.fullName', label: 'Nama Lengkap Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.employeeNo', label: 'Nomor Induk Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.nik', label: 'NIK Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.birthPlace', label: 'Tempat Lahir', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.birthDate', label: 'Tanggal Lahir', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'employee.address', label: 'Alamat Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.jobRole', label: 'Jabatan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  // Dipakai PASAL 12 (PEMBERITAHUAN) sebagai alamat PIHAK KEDUA. Tanpa entri
  // katalog di sini, publish versi template yang memuat {{employee.phoneNumber}}
  // / {{employee.email}} ditolak `validateFieldDefinitions` dengan
  // "Field system ... tidak terdaftar di katalog".
  { key: 'employee.phoneNumber', label: 'Nomor Telepon Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'employee.email', label: 'E-mail Karyawan', dataType: 'TEXT', sourceType: 'SYSTEM' },
  // Doc & settings
  { key: 'doc.docDate', label: 'Tanggal Dokumen', dataType: 'DATE', sourceType: 'SYSTEM' },
  { key: 'doc.hariTanggal', label: 'Hari & Tanggal Tanda Tangan (auto)', dataType: 'TEXT', sourceType: 'SYSTEM' },
  { key: 'settings.cooperativeChairmanName', label: 'Nama Ketua Koperasi', dataType: 'TEXT', sourceType: 'SYSTEM' },
]

/**
 * Field dinamis (CONTRACT_INPUT) bawaan. Berbeda dari `SYSTEM_FIELD_SEEDS`,
 * field ini diisi manual di form kontrak dan bukan data turunan sistem.
 */
export interface ContractInputFieldSeed {
  key: string
  label: string
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'
  sourceType: 'CONTRACT_INPUT'
  options?: unknown
}

export const CONTRACT_INPUT_FIELD_SEEDS: ContractInputFieldSeed[] = [
  { key: 'ktp_issued_date', label: 'Tanggal Terbit KTP Mitra', dataType: 'DATE', sourceType: 'CONTRACT_INPUT' },
]
