/**
 * Pure resolver helpers — tanpa dependency NestJS/Prisma agar bisa di-unit-test
 * dan dipakai dari modul mana pun tanpa wiring DB.
 */

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const NUMBER_WORDS_ID: Record<number, string> = {
  0: 'nol', 1: 'satu', 2: 'dua', 3: 'tiga', 4: 'empat', 5: 'lima',
  6: 'enam', 7: 'tujuh', 8: 'delapan', 9: 'sembilan', 10: 'sepuluh',
  11: 'sebelas',
}

/** 12 → "dua belas", 20 → "dua puluh", 105 → "seratus lima" (cukup untuk durasi kontrak). */
export function numberToIndonesianWords(n: number): string {
  if (n < 0) return `minus ${numberToIndonesianWords(-n)}`
  if (n <= 11) return NUMBER_WORDS_ID[n] ?? String(n)
  if (n < 20) return `${NUMBER_WORDS_ID[n - 10]} belas`
  if (n < 100) {
    const tens = Math.floor(n / 10)
    const rest = n % 10
    return rest === 0 ? `${NUMBER_WORDS_ID[tens]} puluh` : `${NUMBER_WORDS_ID[tens]} puluh ${NUMBER_WORDS_ID[rest]}`
  }
  if (n === 100) return 'seratus'
  if (n < 200) return `seratus ${numberToIndonesianWords(n - 100)}`
  if (n < 1000) {
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    return rest === 0 ? `${NUMBER_WORDS_ID[hundreds]} ratus` : `${NUMBER_WORDS_ID[hundreds]} ratus ${numberToIndonesianWords(rest)}`
  }
  return String(n)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "31 Agustus 2026" */
export function formatIndonesianDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
}

/** "Senin" */
export function getIndonesianDayName(d: Date): string {
  return DAYS_ID[d.getDay()]
}

function isLastDayOfMonth(d: Date): boolean {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return next.getDate() === 1
}

/**
 * "01 September 2026 - 31 Maret 2027"
 */
export function deriveTermRange(start: Date, end: Date): string {
  return `${pad2(start.getDate())} ${MONTHS_ID[start.getMonth()]} ${start.getFullYear()} - ${pad2(end.getDate())} ${MONTHS_ID[end.getMonth()]} ${end.getFullYear()}`
}

/**
 * "7 (tujuh) bulan" — hitung bulan inklusif.
 * 1 Sep 2026 → 31 Mar 2027 = 7 bulan (Sep s.d. Mar). Konsisten, tidak bisa
 * terjadi inkonsistensi 6-vs-7 seperti pada sample PDF lama.
 * Durasi < 1 bulan jatuh ke hari: "19 (sembilan belas) hari".
 */
export function deriveDuration(start: Date, end: Date): string {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (isLastDayOfMonth(e)) months += 1

  if (months >= 1) {
    return `${months} (${numberToIndonesianWords(months)}) bulan`
  }

  const days = Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000))
  return `${days} (${numberToIndonesianWords(days)}) hari`
}

/** "hari Senin tanggal 31 bulan Agustus tahun 2026" — sesuai format sample MITRA. */
export function deriveHariTanggal(d: Date): string {
  return `hari ${getIndonesianDayName(d)} tanggal ${d.getDate()} bulan ${MONTHS_ID[d.getMonth()]} tahun ${d.getFullYear()}`
}

/** Format rupiah sederhana "Rp 4.500.000" */
export function formatRupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
}

export interface ResolvedValue {
  value: any
  displayValue: string
}

export interface ResolveContext {
  /** data kontrak yang sudah dibentuk (sebelum insert) */
  contract: {
    contractNo: string
    startDate: Date
    endDate: Date
    signedDate?: Date | null
    baseCompensation?: number | null
  }
  /** row employee + relasi yang relevan */
  employee?: any
  /** nilai input custom dari dto.templateData — key tanpa prefix "custom." */
  templateData?: Record<string, any>
  /** settings koperasi */
  settings?: Record<string, any>
}

/**
 * Resolve satu placeholder key menjadi { value, displayValue }.
 * Mengembalikan undefined jika key tidak dikenal — caller yang memutuskan
 * apakah itu error (publish time) atau skip (legacy).
 */
export function resolvePlaceholderValue(key: string, ctx: ResolveContext): ResolvedValue | undefined {
  const { contract, employee, templateData, settings } = ctx

  // ── Auto-derive contract/doc ──
  switch (key) {
    case 'contract.contractNo':
      return { value: contract.contractNo, displayValue: contract.contractNo }
    case 'contract.startDate':
      return { value: contract.startDate.toISOString(), displayValue: formatIndonesianDate(contract.startDate) }
    case 'contract.endDate':
      return { value: contract.endDate.toISOString(), displayValue: formatIndonesianDate(contract.endDate) }
    case 'contract.termRange':
      return {
        value: deriveTermRange(contract.startDate, contract.endDate),
        displayValue: deriveTermRange(contract.startDate, contract.endDate),
      }
    case 'contract.duration':
      return {
        value: deriveDuration(contract.startDate, contract.endDate),
        displayValue: deriveDuration(contract.startDate, contract.endDate),
      }
    case 'contract.baseCompensation':
      if (contract.baseCompensation == null) return undefined
      return { value: contract.baseCompensation, displayValue: formatRupiah(contract.baseCompensation) }
    case 'contract.signedDate':
      if (!contract.signedDate) return undefined
      return { value: contract.signedDate.toISOString(), displayValue: formatIndonesianDate(contract.signedDate) }
    case 'doc.docDate': {
      // Tanggal dokumen = tanggal tanda tangan jika ada, else tanggal mulai
      const docDate = contract.signedDate ?? contract.startDate
      return { value: docDate.toISOString(), displayValue: formatIndonesianDate(docDate) }
    }
    case 'doc.hariTanggal': {
      const d = contract.signedDate ?? contract.startDate
      return { value: deriveHariTanggal(d), displayValue: deriveHariTanggal(d) }
    }
    default:
      break
  }

  // ── employee.* ──
  if (key.startsWith('employee.')) {
    if (!employee) return undefined
    const path = key.slice('employee.'.length)
    const raw = path.split('.').reduce((acc: any, part) => (acc == null ? undefined : acc[part]), employee)
    if (raw == null) return undefined
    if (raw instanceof Date) return { value: raw.toISOString(), displayValue: formatIndonesianDate(raw) }
    if (typeof raw === 'object' && raw.name != null) return { value: raw.id ?? raw.name, displayValue: String(raw.name) }
    return { value: raw, displayValue: String(raw) }
  }

  // ── custom.* — dari templateData (CONTRACT_INPUT) ──
  if (key.startsWith('custom.')) {
    if (!templateData) return undefined
    const ck = key.slice('custom.'.length)
    const raw = templateData[ck]
    if (raw == null) return undefined
    if (raw instanceof Date) return { value: raw.toISOString(), displayValue: formatIndonesianDate(raw) }
    return { value: raw, displayValue: String(raw) }
  }

  // ── settings.* ──
  if (key.startsWith('settings.')) {
    if (!settings) return undefined
    const sk = key.slice('settings.'.length)
    const raw = settings[sk]
    if (raw == null) return undefined
    return { value: raw, displayValue: String(raw) }
  }

  return undefined
}

/** Resolve semua placeholder di daftar key; unknown dikumpulkan. */
export function resolvePlaceholders(keys: string[], ctx: ResolveContext): {
  resolved: Record<string, ResolvedValue>
  unknown: string[]
} {
  const resolved: Record<string, ResolvedValue> = {}
  const unknown: string[] = []
  for (const key of keys) {
    const out = resolvePlaceholderValue(key, ctx)
    if (out) resolved[key] = out
    else unknown.push(key)
  }
  return { resolved, unknown }
}
