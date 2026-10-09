/**
 * Pure resolver helpers — tanpa dependency NestJS/Prisma agar bisa di-unit-test
 * dan dipakai dari modul mana pun tanpa wiring DB.
 */

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Nama bulan Inggris untuk kolom EN PKWT.
 *
 * Master (`PKWT DRIVER 2026.pdf`) masih mencetak bulan Indonesia di kolom kanan
 * (`Sukabumi, 20 Mei 1980`), jadi ini SENGAJA menyimpang dari master: kolom
 * Inggris tidak boleh memuat kata Indonesia. Alasan yang sama dipakai untuk
 * label `Name`/`Gender` di blok identitas — lihat `identityBlocks` di
 * `default-template-definition.ts`.
 */
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Nama hari Inggris — pasangan `DAYS_ID` untuk kolom EN PKWT. */
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

/**
 * "31 August 2026" — pasangan Inggris dari `formatIndonesianDate`.
 *
 * Dipakai HANYA untuk kolom EN; lihat `MONTHS_EN` soal penyimpangan dari master.
 */
export function formatEnglishDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`
}

/** "Senin" */
export function getIndonesianDayName(d: Date): string {
  return DAYS_ID[d.getDay()]
}

/** "Monday" — pasangan Inggris dari `getIndonesianDayName`. */
export function getEnglishDayName(d: Date): string {
  return DAYS_EN[d.getDay()]
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
 * "01 September 2026 - 31 March 2027" — pasangan Inggris dari `deriveTermRange`.
 *
 * `{{contract.termRange}}` dipakai di kolom EN juga (Pasal 2 ayat 1 versi
 * Inggris: "This agreement is effective since {{contract.termRange}}."), jadi
 * tanpa varian ini bulan Indonesia bocor ke naskah Inggris.
 */
export function deriveTermRangeEn(start: Date, end: Date): string {
  return `${pad2(start.getDate())} ${MONTHS_EN[start.getMonth()]} ${start.getFullYear()} - ${pad2(end.getDate())} ${MONTHS_EN[end.getMonth()]} ${end.getFullYear()}`
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

/**
 * "Monday, 31 August 2026" — pasangan Inggris dari `deriveHariTanggal`.
 *
 * Dipakai HANYA untuk kolom EN PKWT; lihat `MONTHS_EN` soal penyimpangan dari
 * master. Tanpa varian ini, kolom kanan mencetak nama hari/bulan Indonesia di
 * tengah naskah Inggris.
 */
export function deriveHariTanggalEn(d: Date): string {
  return `${getEnglishDayName(d)}, ${formatEnglishDate(d)}`
}

/** Format rupiah sederhana "Rp 4.500.000" */
export function formatRupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`
}

/**
 * Label untuk enum `Gender` (`MALE`/`FEMALE`).
 *
 * Nilai mentah kolom `Employee.gender` adalah enum Prisma, sehingga mencetaknya
 * apa adanya menghasilkan `MALE` di tengah naskah. Karena PKWT itu BILINGUAL —
 * `languages.id` dan `languages.en` dirender berdampingan — satu nilai tidak
 * cukup: kolom kiri harus "Laki-laki" sementara kolom kanan "Male". Peta per
 * bahasa inilah jawabannya.
 *
 * Label ID sengaja SAMA dengan konvensi UI lain (`SummaryCards.vue`,
 * `useExport.ts`, `CvDocument.vue`) supaya satu karyawan tidak pernah tampil
 * dengan dua label berbeda antar dokumen.
 *
 * Nilai di luar peta dikembalikan apa adanya — bukan dilempar — agar data lama
 * yang tidak terduga tetap tercetak dan tidak menggagalkan pembuatan kontrak.
 */
const GENDER_LABELS: Record<DocumentLanguage, Record<string, string>> = {
  ID: { MALE: 'Laki-laki', FEMALE: 'Perempuan' },
  EN: { MALE: 'Male', FEMALE: 'Female' },
}

/** Bahasa kolom yang sedang dirender. Default `ID` (mayoritas dokumen satu kolom). */
export type DocumentLanguage = 'ID' | 'EN'

export function genderLabel(raw: unknown, language: DocumentLanguage = 'ID'): string | undefined {
  if (raw == null || raw === '') return undefined
  const map = GENDER_LABELS[language] ?? GENDER_LABELS.ID
  return map[String(raw)] ?? String(raw)
}

export interface ResolvedValue {
  value: any
  displayValue: string
  /**
   * Label untuk kolom bahasa Inggris, HANYA bila teksnya memang berbeda dari
   * `displayValue`. Kosong berarti kolom EN memakai `displayValue` yang sama —
   * perilaku lama untuk semua field.
   *
   * Dipisah dari `displayValue` (bukan di-resolve dua kali per bahasa) supaya
   * `resolvedTemplateData` yang sudah tersimpan di kontrak lama tetap sah:
   * snapshot tanpa field ini otomatis jatuh ke perilaku lama, tanpa migrasi.
   */
  displayValueEn?: string
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
      return {
        value: contract.startDate.toISOString(),
        displayValue: formatIndonesianDate(contract.startDate),
        displayValueEn: formatEnglishDate(contract.startDate),
      }
    case 'contract.endDate':
      return {
        value: contract.endDate.toISOString(),
        displayValue: formatIndonesianDate(contract.endDate),
        displayValueEn: formatEnglishDate(contract.endDate),
      }
    case 'contract.termRange':
      return {
        value: deriveTermRange(contract.startDate, contract.endDate),
        displayValue: deriveTermRange(contract.startDate, contract.endDate),
        displayValueEn: deriveTermRangeEn(contract.startDate, contract.endDate),
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
      return {
        value: contract.signedDate.toISOString(),
        displayValue: formatIndonesianDate(contract.signedDate),
        displayValueEn: formatEnglishDate(contract.signedDate),
      }
    case 'doc.docDate': {
      // Tanggal dokumen = tanggal tanda tangan jika ada, else tanggal mulai
      const docDate = contract.signedDate ?? contract.startDate
      return {
        value: docDate.toISOString(),
        displayValue: formatIndonesianDate(docDate),
        displayValueEn: formatEnglishDate(docDate),
      }
    }
    case 'doc.hariTanggal': {
      const d = contract.signedDate ?? contract.startDate
      return {
        value: deriveHariTanggal(d),
        displayValue: deriveHariTanggal(d),
        displayValueEn: deriveHariTanggalEn(d),
      }
    }
    default:
      break
  }

  // ── employee.* ──
  if (key.startsWith('employee.')) {
    if (!employee) return undefined
    const path = key.slice('employee.'.length)
    // `gender` adalah enum Prisma (`MALE`/`FEMALE`) yang labelnya HARUS berbeda
    // per kolom: "Laki-laki" di kolom Indonesia, "Male" di kolom Inggris.
    // `displayValueEn` HANYA diisi bila labelnya benar-benar berbeda, sehingga
    // field lain tetap satu nilai seperti sebelumnya.
    // Tanpa cabang eksplisit ini, jalur generik di bawah mencetak enum mentahnya.
    if (path === 'gender') {
      const id = genderLabel(employee.gender, 'ID')
      if (id == null) return undefined
      const en = genderLabel(employee.gender, 'EN')
      const out: ResolvedValue = { value: employee.gender, displayValue: id }
      if (en != null && en !== id) out.displayValueEn = en
      return out
    }
    const raw = path.split('.').reduce((acc: any, part) => (acc == null ? undefined : acc[part]), employee)
    if (raw == null) return undefined
    if (raw instanceof Date) {
      // Tanggal karyawan (mis. `employee.birthDate`) ikut kolom EN, jadi
      // varian Inggrisnya wajib ada — kalau tidak, "2 Juli 1996" tercetak di
      // tengah naskah Inggris.
      return {
        value: raw.toISOString(),
        displayValue: formatIndonesianDate(raw),
        displayValueEn: formatEnglishDate(raw),
      }
    }
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
