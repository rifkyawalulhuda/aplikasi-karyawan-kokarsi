import type { Contract, ContractStatus, Employee } from '~/types'

/**
 * Bentuk dokumen karyawan yang dipakai halaman detail. Sengaja struktural
 * (bukan import tipe) karena daftar dokumen datang dari endpoint terpisah
 * `/api/employee-documents` dengan bentuk yang tidak di-share di `~/types`.
 */
export interface EmployeeDocumentLike {
  id?: number
  documentNumber?: string
  expiryDate?: string
  status?: string
  notes?: string | null
  fileUrl?: string
  documentType?: {
    id?: number
    name?: string
    documentType?: string
    issuer?: string
  } | null
}

export interface CurrentContractInfo {
  contractNo: string | null
  status: ContractStatus | null
  startDate: string | null
  endDate: string | null
  /** null bila tidak ada kontrak berjalan (RESIGN/PHK/EXPIRED). */
  daysRemaining: number | null
  totalDays: number | null
  elapsedDays: number | null
  /** 0..1 — porsi masa kontrak yang sudah berjalan. */
  progress: number
  expired: boolean
  isLive: boolean
}

export interface EmployeeMetrics {
  tenureDays: number
  tenureLabel: string
  tenureFrozen: boolean
  current: CurrentContractInfo
  sp: { count: number, total: number, highestLevel: number | null }
  certs: { total: number, active: number, expiring: number, expired: number }
}

const DAY_MS = 86_400_000

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Selisih hari kalender (b - a), bebas jam/timezone-offset. */
function diffDays(b: Date, a: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

function tenureLabel(from: Date, to: Date): string {
  const days = Math.max(0, diffDays(to, from))
  if (days < 31) return `${days} hari`

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  months = Math.max(0, months)

  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years <= 0) return `${months} bln`
  if (rem === 0) return `${years} th`
  return `${years} th ${rem} bln`
}

/**
 * Kontrak yang mewakili keadaan saat ini.
 * Prioritas: AKTIF → AKAN_HABIS → kontrak terbaru (by startDate).
 */
function pickCurrentContract(contracts: Contract[]): Contract | null {
  if (!contracts.length) return null

  const live = contracts.filter(c => c.status === 'AKTIF' || c.status === 'AKAN_HABIS')
  if (live.length) {
    return live.find(c => c.status === 'AKTIF')
      ?? live.find(c => c.status === 'AKAN_HABIS')
      ?? null
  }

  return [...contracts].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0] ?? null
}

/**
 * Hitung seluruh metrik ringkas karyawan (masa kerja, sisa kontrak, SP, sertifikat).
 *
 * Aturan produk:
 * - Masa kerja "dibekukan" saat offboarding (RESIGN/PHK → terminationDate) dan
 *   saat kontrak habis (KONTRAK_EXPIRED → akhir kontrak terakhir). Tidak pernah negatif.
 * - Sisa kontrak hanya dihitung bila kontrak saat ini berstatus AKTIF/AKAN_HABIS.
 *   Untuk status lain, `daysRemaining` bernilai null (tile menampilkan tanggal berakhir).
 */
export function computeEmployeeMetrics(
  employee: Employee,
  documents: EmployeeDocumentLike[] = [],
  now: Date = new Date()
): EmployeeMetrics {
  const contracts = employee.contracts ?? []
  const letters = employee.warningLetters ?? []

  const current = pickCurrentContract(contracts)
  const isLive = employee.employmentStatus === 'AKTIF'
    && (current?.status === 'AKTIF' || current?.status === 'AKAN_HABIS')

  const contractStart = toDate(current?.startDate)
  const contractEnd = toDate(current?.endDate)

  let daysRemaining: number | null = null
  let totalDays: number | null = null
  let elapsedDays: number | null = null
  let progress = 0

  if (isLive && contractStart && contractEnd) {
    totalDays = Math.max(1, diffDays(contractEnd, contractStart))
    elapsedDays = Math.min(totalDays, Math.max(0, diffDays(now, contractStart)))
    daysRemaining = diffDays(contractEnd, now)
    progress = Math.min(1, Math.max(0, elapsedDays / totalDays))
  }

  // Masa kerja dibekukan untuk karyawan yang sudah tidak aktif.
  let tenureEnd = now
  let tenureFrozen = false
  if (employee.employmentStatus === 'RESIGN' || employee.employmentStatus === 'PHK') {
    tenureEnd = toDate(employee.offboarding?.terminationDate) ?? now
    tenureFrozen = true
  } else if (employee.employmentStatus === 'KONTRAK_EXPIRED') {
    tenureEnd = contractEnd ?? now
    tenureFrozen = true
  }

  const joinDate = toDate(employee.joinDate)
  const tenureDays = joinDate ? Math.max(0, diffDays(tenureEnd, joinDate)) : 0
  const tenureText = joinDate ? tenureLabel(joinDate, tenureEnd) : '—'

  const activeLetters = letters.filter((letter) => {
    const validUntil = toDate(letter.validUntil)
    return validUntil ? validUntil.getTime() >= now.getTime() : true
  })

  const certs = { total: documents.length, active: 0, expiring: 0, expired: 0 }
  for (const doc of documents) {
    if (doc.status === 'EXPIRED') certs.expired += 1
    else if (doc.status === 'AKAN_EXPIRED') certs.expiring += 1
    else certs.active += 1
  }

  return {
    tenureDays,
    tenureLabel: tenureText,
    tenureFrozen,
    current: {
      contractNo: current?.contractNo ?? null,
      status: current?.status ?? null,
      startDate: current?.startDate ?? null,
      endDate: current?.endDate ?? null,
      daysRemaining,
      totalDays,
      elapsedDays,
      progress,
      expired: daysRemaining !== null && daysRemaining < 0,
      isLive
    },
    sp: {
      count: activeLetters.length,
      total: letters.length,
      highestLevel: activeLetters.reduce((max, l) => Math.max(max, l.warningLevel), 0) || null
    },
    certs
  }
}

export function formatDateId(value?: string | null): string {
  const d = toDate(value)
  return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'
}

export function formatDateShortId(value?: string | null): string {
  const d = toDate(value)
  return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}
