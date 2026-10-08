import type { Contract } from '~/types'

const DAY_MS = 86_400_000

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Selisih hari kalender (b - a), bebas jam/timezone. */
function diffDays(b: Date, a: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

/**
 * Label rentang waktu dalam bahasa manusia, mis. "2 th 3 bln", "45 hari".
 * Dipakai untuk durasi tiap kontrak.
 */
export function formatSpan(from: Date, to: Date): string {
  const days = Math.max(0, diffDays(to, from))
  if (days <= 0) return '—'
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

export interface ContractSegment {
  contract: Contract
  status: string
  /** Posisi & lebar relatif terhadap rentang karier (0..100). */
  leftPct: number
  widthPct: number
  durationDays: number
  durationLabel: string
  /** Hanya untuk kontrak berjalan; null bila tidak relevan. */
  daysRemaining: number | null
  isCurrent: boolean
}

export interface TimelineGap {
  leftPct: number
  widthPct: number
  days: number
}

export interface ContractTimeline {
  segments: ContractSegment[]
  gaps: TimelineGap[]
  years: { year: number, leftPct: number }[]
  /** Posisi penanda "hari ini" (0..100), null bila di luar rentang. */
  nowPct: number | null
  start: Date | null
  end: Date | null
  totalDays: number
}

/**
 * Susun rentang karier: satu track waktu dengan segmen per kontrak (panjang
 * proporsional durasi) dan celah antar-kontrak yang terlihat.
 */
export function buildContractTimeline(contracts: Contract[], now: Date = new Date()): ContractTimeline {
  const valid = contracts
    .map(contract => ({ contract, start: toDate(contract.startDate), end: toDate(contract.endDate) }))
    .filter((item): item is { contract: Contract, start: Date, end: Date } => !!item.start && !!item.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (!valid.length) {
    return { segments: [], gaps: [], years: [], nowPct: null, start: null, end: null, totalDays: 0 }
  }

  const start = valid[0]!.start
  const end = valid.reduce((max, item) => (item.end.getTime() > max.getTime() ? item.end : max), valid[0]!.end)
  const spanMs = Math.max(DAY_MS, end.getTime() - start.getTime())

  const pct = (date: Date) => ((date.getTime() - start.getTime()) / spanMs) * 100

  const segments: ContractSegment[] = valid.map(({ contract, start: s, end: e }) => {
    const durationDays = Math.max(0, diffDays(e, s))
    const isCurrent = contract.status === 'AKTIF' || contract.status === 'AKAN_HABIS'
    return {
      contract,
      status: contract.status,
      leftPct: pct(s),
      widthPct: ((e.getTime() - s.getTime()) / spanMs) * 100,
      durationDays,
      durationLabel: formatSpan(s, e),
      daysRemaining: isCurrent ? Math.max(0, diffDays(e, now)) : null,
      isCurrent
    }
  })

  const gaps: TimelineGap[] = []
  for (let i = 1; i < valid.length; i++) {
    const prevEnd = valid[i - 1]!.end
    const nextStart = valid[i]!.start
    if (nextStart.getTime() > prevEnd.getTime()) {
      const gapDays = diffDays(nextStart, prevEnd)
      if (gapDays > 0) {
        gaps.push({ leftPct: pct(prevEnd), widthPct: ((nextStart.getTime() - prevEnd.getTime()) / spanMs) * 100, days: gapDays })
      }
    }
  }

  const years: { year: number, leftPct: number }[] = []
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const p = pct(new Date(y, 0, 1))
    years.push({ year: y, leftPct: Math.max(0, Math.min(100, p)) })
  }

  const nowPct = now.getTime() >= start.getTime() && now.getTime() <= end.getTime() ? pct(now) : null

  return { segments, gaps, years, nowPct, start, end, totalDays: Math.round(spanMs / DAY_MS) }
}

/**
 * Peta status kontrak yang sudah dihitung backend (`resolveContractStatus`)
 * ke label + warna badge Nuxt UI.
 */
export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
}

export const CONTRACT_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'neutral',
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral'
}

/** Warna latar segmen pada track rentang karier. */
export const CONTRACT_STATUS_BAR: Record<string, string> = {
  DRAFT: 'bg-accented',
  AKTIF: 'bg-success',
  AKAN_HABIS: 'bg-warning',
  EXPIRED: 'bg-error',
  SELESAI: 'bg-info',
  DIBATALKAN: 'bg-accented'
}

/** Kontrak yang mewakili keadaan saat ini: AKTIF → AKAN_HABIS → paling baru. */
export function pickCurrentContract(contracts: Contract[]): Contract | null {
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

export function formatContractDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value)
}

/** Selisih hari dari sekarang ke `endDate` (negatif bila sudah lewat). */
export function daysUntil(endDate?: string | null, now: Date = new Date()): number | null {
  const end = toDate(endDate)
  if (!end) return null
  return diffDays(end, now)
}
