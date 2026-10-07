/**
 * Model & pemetaan hasil pencarian global (command palette).
 *
 * Backend mengembalikan `SearchHit` yang NETRAL (tanpa URL); pemetaan ke rute
 * milik frontend ada di sini. Dengan begitu deep-link tidak bocor ke lapisan
 * data, dan mengubah rute halaman tidak menyentuh backend.
 */

export interface SearchHit {
  id: number
  type: string
  title: string
  subtitle?: string
  meta?: string[]
  code?: string
  email?: string
  phone?: string
  employeeId?: number
  employeeName?: string
  contractNo?: string
}

export interface SearchCategoryResult {
  items: SearchHit[]
  hasMore: boolean
}

export interface SearchResponse {
  q: string
  limit: number
  categories: Record<string, SearchCategoryResult>
}

export type SearchCategoryKey
  = | 'employees'
    | 'contracts'
    | 'warningLetters'
    | 'certifications'
    | 'dokKaryawan'
    | 'vendorContracts'
    | 'legalKoperasi'
    | 'akteDokumen'
    | 'generalArchives'

export interface SearchCategoryMeta {
  key: SearchCategoryKey
  label: string
  icon: string
  /** Warna chip kategori pada daftar hasil. */
  color: string
}

/**
 * Urutan kategori = urutan blok di tab "Semua".
 *
 * Karyawan sengaja pertama (entitas pusat); kontrak & dokumen menyusul sebagai
 * konteks turunannya. Ini keputusan produk yang sudah dikonfirmasi, bukan
 * urutan alfabetis.
 */
export const SEARCH_CATEGORIES: SearchCategoryMeta[] = [
  { key: 'employees', label: 'Karyawan', icon: 'i-lucide-user', color: 'primary' },
  { key: 'contracts', label: 'Kontrak', icon: 'i-lucide-file-text', color: 'info' },
  { key: 'warningLetters', label: 'Surat Peringatan', icon: 'i-lucide-alert-triangle', color: 'warning' },
  { key: 'certifications', label: 'Sertifikasi & Ijin', icon: 'i-lucide-file-badge', color: 'success' },
  { key: 'dokKaryawan', label: 'Dok. Karyawan', icon: 'i-lucide-id-card', color: 'neutral' },
  { key: 'vendorContracts', label: 'Kontrak Vendor', icon: 'i-lucide-building-2', color: 'info' },
  { key: 'legalKoperasi', label: 'Legal Koperasi', icon: 'i-lucide-file-signature', color: 'neutral' },
  { key: 'akteDokumen', label: 'Akte Dokumen', icon: 'i-lucide-scroll-text', color: 'neutral' },
  { key: 'generalArchives', label: 'Arsip Umum', icon: 'i-lucide-archive', color: 'neutral' }
]

const CATEGORY_BY_KEY = new Map(SEARCH_CATEGORIES.map(category => [category.key, category]))

export function categoryMeta(key: string): SearchCategoryMeta {
  return CATEGORY_BY_KEY.get(key as SearchCategoryKey)
    ?? { key: key as SearchCategoryKey, label: key, icon: 'i-lucide-square', color: 'neutral' }
}

/** Rute detail sebuah hasil. `null` bila tipe tidak dikenal (tidak dapat dibuka). */
export function searchHitRoute(hit: SearchHit): string | null {
  switch (hit.type) {
    case 'employee': return `/karyawan/${hit.id}`
    case 'contract': return `/kontrak?openId=${hit.id}`
    case 'warningLetter': return `/dokumen/surat-peringatan?openId=${hit.id}`
    case 'certification': return `/dokumen/sertifikasi-ijin?openId=${hit.id}`
    case 'dokKaryawan': return `/dokumen/dok-karyawan?openId=${hit.id}`
    case 'vendorContract': return `/dokumen-legal/kontrak-vendor?openId=${hit.id}`
    case 'legalKoperasi': return `/dokumen-legal/legal-koperasi?openId=${hit.id}`
    case 'akteDokumen': return `/dokumen-legal/akte-dokumen?openId=${hit.id}`
    case 'generalArchive': return `/dokumen-legal/arsip-umum?openId=${hit.id}`
    default: return null
  }
}

/** Ikon tipe untuk daftar hasil (fallback ikon kategori). */
export function searchHitIcon(hit: SearchHit): string {
  switch (hit.type) {
    case 'employee': return 'i-lucide-user'
    case 'contract': return 'i-lucide-file-text'
    case 'warningLetter': return 'i-lucide-alert-triangle'
    case 'certification': return 'i-lucide-file-badge'
    case 'dokKaryawan': return 'i-lucide-id-card'
    case 'vendorContract': return 'i-lucide-building-2'
    case 'legalKoperasi': return 'i-lucide-file-signature'
    case 'akteDokumen': return 'i-lucide-scroll-text'
    case 'generalArchive': return 'i-lucide-archive'
    default: return 'i-lucide-square'
  }
}

/**
 * Kunci unik sebuah hasil, dipakai untuk recent/pin & dedupe.
 *
 * Sengaja memuat `type` supaya id yang sama pada tabel berbeda tidak bertabrakan.
 */
export function searchHitKey(hit: Pick<SearchHit, 'type' | 'id'>): string {
  return `${hit.type}:${hit.id}`
}

/** Nilai yang bisa disalin cepat dari sebuah hasil (prioritas: code → NIK/nomor). */
export function searchHitCopyValue(hit: SearchHit): string | null {
  if (hit.code) return hit.code
  return null
}

/** Hitungan total hasil dari respons terpadu (untuk badge tab "Semua"). */
export function countHits(response: SearchResponse | null): number {
  if (!response) return 0
  return Object.values(response.categories).reduce((total, category) => total + (category.items?.length ?? 0), 0)
}
