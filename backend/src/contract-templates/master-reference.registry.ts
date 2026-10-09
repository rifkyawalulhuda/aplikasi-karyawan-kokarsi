/**
 * Master Reference Registry — allowlist sumber master data yang boleh
 * dipakai sebagai placeholder kontrak. Admin TIDAK BISA memilih tabel/kolom
 * database bebas; hanya source key yang terdaftar di sini yang valid.
 *
 * Setiap sumber mendefinisikan:
 *  - prismaModel: nama model Prisma yang dipakai resolver
 *  - label: nama tampilan untuk editor frontend
 *  - fields: kolom yang boleh dibaca (allowlist per-field)
 *  - searchable: kolom untuk pencarian di picker
 */

export interface MasterFieldConfig {
  key: string
  label: string
  /** tipe nilai output — untuk format & snapshot */
  outputType: 'TEXT' | 'NUMBER' | 'DATE' | 'CURRENCY'
}

export interface MasterSourceConfig {
  /** nama model Prisma */
  prismaModel: string
  label: string
  fields: MasterFieldConfig[]
  searchable: string[]
}

export const MASTER_REFERENCE_REGISTRY: Record<string, MasterSourceConfig> = {
  EMPLOYEE: {
    prismaModel: 'employee',
    label: 'Karyawan',
    fields: [
      { key: 'fullName', label: 'Nama Lengkap', outputType: 'TEXT' },
      { key: 'nik', label: 'NIK Karyawan', outputType: 'TEXT' },
      { key: 'employeeNo', label: 'Nomor Induk Karyawan', outputType: 'TEXT' },
      { key: 'memberNo', label: 'Nomor Anggota', outputType: 'TEXT' },
      { key: 'birthPlace', label: 'Tempat Lahir', outputType: 'TEXT' },
      { key: 'birthDate', label: 'Tanggal Lahir', outputType: 'DATE' },
      { key: 'address', label: 'Alamat', outputType: 'TEXT' },
      { key: 'gender', label: 'Jenis Kelamin', outputType: 'TEXT' },
      { key: 'educationLevel', label: 'Pendidikan', outputType: 'TEXT' },
      { key: 'joinDate', label: 'Tanggal Bergabung', outputType: 'DATE' },
      { key: 'employmentStatus', label: 'Status Kepegawaian', outputType: 'TEXT' },
      // relasi
      { key: 'jobRole.name', label: 'Jabatan', outputType: 'TEXT' },
      { key: 'jobLevel.name', label: 'Level Jabatan', outputType: 'TEXT' },
      { key: 'department.name', label: 'Departemen', outputType: 'TEXT' },
      { key: 'workLocation.name', label: 'Lokasi Kerja', outputType: 'TEXT' },
      { key: 'taxStatus.name', label: 'Status Pajak', outputType: 'TEXT' },
    ],
    searchable: ['fullName', 'employeeNo', 'nik'],
  },
  JOB_ROLE: {
    prismaModel: 'jobRole',
    label: 'Jabatan',
    fields: [{ key: 'name', label: 'Nama Jabatan', outputType: 'TEXT' }],
    searchable: ['name'],
  },
  DEPARTMENT: {
    prismaModel: 'department',
    label: 'Departemen',
    fields: [{ key: 'name', label: 'Nama Departemen', outputType: 'TEXT' }],
    searchable: ['name'],
  },
  WORK_LOCATION: {
    prismaModel: 'workLocation',
    label: 'Lokasi Kerja',
    fields: [{ key: 'name', label: 'Nama Lokasi', outputType: 'TEXT' }],
    searchable: ['name'],
  },
  CONTRACT_TYPE: {
    prismaModel: 'contractType',
    label: 'Jenis Kontrak',
    fields: [{ key: 'name', label: 'Nama Jenis', outputType: 'TEXT' }],
    searchable: ['name'],
  },
}

/** Konfigurasi sistem yang tidak berasal dari master data, diambil dari settings */
export const SYSTEM_SOURCE_FIELDS: MasterFieldConfig[] = [
  { key: 'cooperativeChairmanName', label: 'Nama Ketua Koperasi', outputType: 'TEXT' },
]

/** Sumber yang eksplisit TIDAK BOLEH diakses (dokumentasi & guard) */
export const BLOCKED_SOURCES = [
  'userAccount',
  'activityLog',
  'notification',
  'calendarEvent',
  'employeeStatusHistory',
  'masterAdmin',
]

export function isValidMasterSource(source: string): boolean {
  return Object.prototype.hasOwnProperty.call(MASTER_REFERENCE_REGISTRY, source)
}

export function isValidMasterField(source: string, fieldKey: string): boolean {
  const cfg = MASTER_REFERENCE_REGISTRY[source]
  if (!cfg) return false
  return cfg.fields.some(f => f.key === fieldKey)
}

export function getMasterFieldConfig(source: string, fieldKey: string): MasterFieldConfig | undefined {
  const cfg = MASTER_REFERENCE_REGISTRY[source]
  if (!cfg) return undefined
  return cfg.fields.find(f => f.key === fieldKey)
}
