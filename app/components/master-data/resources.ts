/**
 * Registry pusat Master Data.
 *
 * Semua kategori (Site, Departement, Pekerjaan, Level Jabatan, Tipe Kontrak,
 * Status Pajak, Dokumen, Perusahaan, Bank) didefinisikan di sini: label, ikon,
 * field form, dan kolom tabel/kartu. Halaman `settings/master-data.vue` serta
 * komponen di folder ini membaca definisi ini sehingga tidak ada lagi
 * percabangan `v-if` per kategori maupun cast `as unknown as`.
 */

export type ResourceKey
  = 'work-locations'
    | 'departments'
    | 'job-roles'
    | 'job-levels'
    | 'contract-types'
    | 'tax-status'
    | 'document-types'
    | 'companies'
    | 'banks'

export interface MasterRow {
  id: number
  name: string
  [key: string]: unknown
}

export type MasterFieldType = 'text' | 'textarea' | 'select' | 'email' | 'tel'

export interface MasterFieldOption {
  label: string
  value: string
}

export interface MasterField {
  key: string
  label: string
  type?: MasterFieldType
  required?: boolean
  placeholder?: string
  description?: string
  options?: MasterFieldOption[]
  defaultValue?: string
}

export type MasterColumnVariant = 'primary' | 'muted' | 'text' | 'badge' | 'contact'

export interface MasterListColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  variant?: MasterColumnVariant
  /** Pemetaan nilai → warna badge Nuxt UI (untuk variant 'badge'). */
  badgeColorMap?: Record<string, string>
  /** Pemetaan nilai → label tampil (untuk variant 'badge'). */
  badgeLabelMap?: Record<string, string>
}

export interface ResourceDef {
  key: ResourceKey
  label: string
  singular: string
  icon: string
  description: string
  /** Kategori dokumen dipakai filter ?category saat memuat. */
  loadPath: string
  fields: MasterField[]
  listColumns: MasterListColumn[]
  searchFields: string[]
  exportSheet: string
}

const DOCUMENT_TYPE_OPTIONS: MasterFieldOption[] = [
  { label: 'Sertifikat', value: 'SERTIFIKAT' },
  { label: 'Lisensi', value: 'LISENSI' },
  { label: 'Izin', value: 'IZIN' },
  { label: 'Rahasia', value: 'RAHASIA' },
  { label: 'Lainnya', value: 'LAINNYA' }
]

const DOCUMENT_CATEGORY_OPTIONS: MasterFieldOption[] = [
  { label: 'Dokumen Pribadi (KTP, SIM, NPWP, dll)', value: 'PERSONAL' },
  { label: 'Sertifikasi & Ijin', value: 'CERTIFICATION' }
]

const NAME_COLUMN = (label: string): MasterListColumn => ({ key: 'name', label, sortable: true, variant: 'primary' })

function simpleResource(
  key: ResourceKey,
  label: string,
  singular: string,
  icon: string,
  description: string,
  nameLabel: string
): ResourceDef {
  return {
    key,
    label,
    singular,
    icon,
    description,
    loadPath: `/api/lookups/${key}`,
    fields: [{ key: 'name', label: nameLabel, required: true, placeholder: `mis. ${nameLabel}` }],
    listColumns: [NAME_COLUMN(nameLabel)],
    searchFields: ['name'],
    exportSheet: label
  }
}

export const RESOURCES: Record<ResourceKey, ResourceDef> = {
  'work-locations': simpleResource('work-locations', 'Site', 'Site', 'i-lucide-map-pin', 'Daftar site / lokasi kerja karyawan.', 'Nama Site'),
  'departments': simpleResource('departments', 'Departement', 'Departement', 'i-lucide-building-2', 'Daftar departement kerja karyawan.', 'Nama Departement'),
  'job-roles': simpleResource('job-roles', 'Pekerjaan', 'Pekerjaan', 'i-lucide-briefcase', 'Daftar pekerjaan / jabatan karyawan.', 'Nama Pekerjaan'),
  'job-levels': simpleResource('job-levels', 'Level Jabatan', 'Level Jabatan', 'i-lucide-layers', 'Daftar level jabatan karyawan.', 'Nama Level Jabatan'),
  'contract-types': simpleResource('contract-types', 'Tipe Kontrak', 'Tipe Kontrak', 'i-lucide-file-text', 'Daftar tipe kontrak kerja.', 'Nama Tipe Kontrak'),
  'tax-status': simpleResource('tax-status', 'Status Pajak', 'Status Pajak', 'i-lucide-receipt', 'Daftar status pajak karyawan.', 'Nama Status Pajak'),

  'document-types': {
    key: 'document-types',
    label: 'Dokumen',
    singular: 'Dokumen',
    icon: 'i-lucide-file-text',
    description: 'Kelola master tipe dokumen karyawan beserta kategori & penerbitnya.',
    loadPath: '/api/lookups/document-types',
    fields: [
      { key: 'name', label: 'Nama Dokumen', required: true, placeholder: 'mis. KTP' },
      { key: 'documentType', label: 'Tipe Dokumen', type: 'select', required: true, options: DOCUMENT_TYPE_OPTIONS, defaultValue: 'SERTIFIKAT' },
      { key: 'issuer', label: 'Penerbit', required: true, placeholder: 'mis. Dinas Kependudukan' },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: DOCUMENT_CATEGORY_OPTIONS, defaultValue: 'CERTIFICATION' }
    ],
    listColumns: [
      NAME_COLUMN('Nama Dokumen'),
      {
        key: 'documentType',
        label: 'Tipe',
        sortable: true,
        variant: 'badge',
        badgeColorMap: { SERTIFIKAT: 'info', LISENSI: 'success', IZIN: 'warning', RAHASIA: 'error', LAINNYA: 'neutral' }
      },
      { key: 'issuer', label: 'Penerbit', sortable: true, variant: 'muted' },
      {
        key: 'category',
        label: 'Kategori',
        sortable: true,
        variant: 'badge',
        badgeColorMap: { PERSONAL: 'primary', CERTIFICATION: 'warning' },
        badgeLabelMap: { PERSONAL: 'Dokumen Pribadi', CERTIFICATION: 'Sertifikasi & Ijin' }
      }
    ],
    searchFields: ['name', 'documentType', 'issuer', 'category'],
    exportSheet: 'Dokumen'
  },

  'companies': {
    key: 'companies',
    label: 'Perusahaan',
    singular: 'Perusahaan',
    icon: 'i-lucide-building-2',
    description: 'Kelola master data perusahaan (kontak & alamat).',
    loadPath: '/api/lookups/companies',
    fields: [
      { key: 'name', label: 'Nama Perusahaan', required: true, placeholder: 'mis. PT Sankyu Indonesia' },
      { key: 'address', label: 'Alamat', type: 'textarea', placeholder: 'Alamat lengkap' },
      { key: 'email', label: 'Email', type: 'email', placeholder: 'mis. info@perusahaan.co.id' },
      { key: 'phone', label: 'No. Kontak', type: 'tel', placeholder: 'mis. 021-1234567' }
    ],
    listColumns: [
      NAME_COLUMN('Nama Perusahaan'),
      { key: 'contact', label: 'Kontak', sortable: false, variant: 'contact' },
      { key: 'address', label: 'Alamat', sortable: true, variant: 'muted' }
    ],
    searchFields: ['name', 'address', 'email', 'phone'],
    exportSheet: 'Perusahaan'
  },

  'banks': {
    key: 'banks',
    label: 'Bank',
    singular: 'Bank',
    icon: 'i-lucide-landmark',
    description: 'Kelola master data bank & cabang untuk rekening karyawan.',
    loadPath: '/api/lookups/banks',
    fields: [
      { key: 'name', label: 'Nama Bank', required: true, placeholder: 'mis. Mandiri' },
      { key: 'branch', label: 'Cabang', placeholder: 'mis. Deltamas' }
    ],
    listColumns: [
      NAME_COLUMN('Nama Bank'),
      { key: 'branch', label: 'Cabang', sortable: true, variant: 'muted' }
    ],
    searchFields: ['name', 'branch'],
    exportSheet: 'Bank'
  }
}

export const RESOURCE_ORDER: ResourceKey[] = [
  'work-locations',
  'departments',
  'job-roles',
  'job-levels',
  'contract-types',
  'tax-status',
  'document-types',
  'companies',
  'banks'
]

export function getResource(key: ResourceKey): ResourceDef {
  return RESOURCES[key]
}

/** Kolom utama (judul) sebuah kategori, dengan fallback aman. */
export function primaryColumn(def: ResourceDef): MasterListColumn {
  return def.listColumns[0] ?? { key: 'name', label: def.singular }
}

/** Nilai teks sebuah kolom, dipakai untuk tabel, kartu, dan export. */
export function displayValue(col: MasterListColumn, row: MasterRow): string {
  if (col.variant === 'contact') {
    const email = row.email ? String(row.email) : ''
    const phone = row.phone ? String(row.phone) : ''
    return [email, phone].filter(Boolean).join(' / ') || '-'
  }
  const raw = row[col.key]
  if (raw == null || raw === '') return '-'
  const str = String(raw)
  if (col.variant === 'badge' && col.badgeLabelMap) return col.badgeLabelMap[str] ?? str
  return str
}

/** Cocokkan baris terhadap kata kunci pada field pencarian kategori. */
export function matchesSearch(def: ResourceDef, row: MasterRow, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  return def.searchFields.some(field => String(row[field] ?? '').toLowerCase().includes(q))
}

/** Baris siap-export (label kolom → teks) untuk kategori tertentu. */
export function toExportRows(def: ResourceDef, rows: MasterRow[]): Record<string, string | number>[] {
  return rows.map((row, index) => {
    const out: Record<string, string | number> = { No: index + 1 }
    for (const col of def.listColumns) out[col.label] = displayValue(col, row)
    return out
  })
}
