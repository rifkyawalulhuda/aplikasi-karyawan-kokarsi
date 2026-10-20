/**
 * MITRA (Perjanjian Kemitraan) layout engine — master-faithful two-column renderer.
 *
 * Nilai geometris di bawah ini BUKAN asumsi: semuanya diukur langsung dari
 * master PDF `docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER OPS .pdf`
 * memakai pdfplumber (lihat docs/perjanjian-kemitraan-visual-spec.md).
 *
 * Prinsip pemisahan tanggung jawab:
 *  - CONTENT DATA      → resolvedTemplateData / templateSnapshot
 *  - DOCUMENT TEMPLATE → contract-document-definitions(.ts)
 *  - LAYOUT ENGINE     → modul ini (geometri + alur kolom + typography)
 *  - PDF RENDERING     → PDFDocument (dipakai oleh modul ini)
 *  - VALIDATION        → scripts/validate-kemitraan-layout.ts
 *
 * Modul ini hanya mengatur TATA LETAK. Ia tidak menciptakan, meringkas,
 * atau menulis ulang konten legal.
 */
import { computeColumnWidths, computeRowHeight, wrapCellLines } from './table-layout.helpers'
import { blockSpaceAfterPts } from './block-spacing'
import { hasInlineMarks, parseInlineRuns, runsToText, type InlineRun } from './inline-marks'
import {
  drawRunsLine,
  wrapRunsToLines,
  type InlineRunAlign,
  type RunFonts,
} from './inline-run-layout'
import PDFDocument from 'pdfkit'

/** Lebar dalam kolom (di dalam border & padding). */
function columnInnerWidth(col: 0 | 1): number {
  const G = MITRA_GEOMETRY
  return (col === 0 ? G.left.x1 - G.left.x0 : G.right.x1 - G.right.x0) - G.textPaddingLeft * 2
}

/** Geometri master (satuan: PDF point, origin kiri-atas). */
export const MITRA_GEOMETRY = {
  pageWidth: 595.5,
  pageHeight: 842.25,

  /** Dua kolom ber-border (0.75pt hitam). */
  left: { x0: 27.02, x1: 296.62 },
  right: { x0: 309.4, x1: 566.98 },

  firstPageBoxTop: 197.42,
  firstPageBoxBottom: 770.92,
  contPageBoxTop: 31.53,
  contPageBoxBottom: 761.17,

  borderWidth: 0.75,

  /** Aturan horizontal di bawah header (dua baris). */
  rules: {
    x0: 18.6,
    x1: 581.25,
    y1: 125.42,
    thickness1: 2.85,
    y2: 129.22,
    thickness2: 0.95,
  },

  /**
   * Posisi judul dokumen. Master: glyph judul pada y≈144.5 (jarak ≈19.06px dari
   * garis kop). Dinaikkan sedikit ke 145.5 agar memenuhi minimum 20px yang
   * diminta untuk keterbacaan.
   */
  titleTop: 145.5,
  numberTop: 159.5,
  dateTop: 173.5,

  logo: { x: 27.4, y: 18.2, width: 85.6, height: 85.95 },

  /**
   * Teks penutup (tempat/tanggal + organisasi) DI LUAR kotak, tepat di atas
   * tabel tanda tangan. Dipakai bersama PKWT; ukuran mengikuti tipografi MITRA
   * (Times New Roman, 9.75 pt) dan dipusatkan pada lebar halaman.
   */
  closing: {
    gapFromBox: 14,
    lineAdvance: 12,
    fontSize: 9.75,
    maxWidth: 500
  },

  font: {
    headerOrg: 14.27,
    headerAddress: 12,
    title: 12,
    body: 12,
    signature: 9.75,
  },

  /** Jarak teks dari tepi kolom (dalam border). */
  textPaddingLeft: 4.6,
  /**
   * Hanging indent untuk item bernomor ("1.", "a."): baris lanjutan menjorok
   * sejauh ini agar sejajar dengan huruf pertama setelah label, bukan di bawah
   * nomornya. Diukur dari master: label x0≈31.55, lanjutan x0≈45.05 → ~13.5pt.
   */
  listHangingIndent: 13.5,
  /** Tambahan leading agar tepat mendekati master (15.8pt utk 12pt). */
  lineGap: 2.0,
  /**
   * TIDAK DIPAKAI lagi oleh engine. Seluruh jarak vertikal diturunkan dari grid
   * baseline (`PITCH`) di `renderMitraPass` supaya baseline kolom KIRI dan
   * KANAN selalu sejajar. Dipertahankan sebagai dokumentasi nilai lama.
   */
  paragraphGap: 4,
  headingGapAfter: 4,
  /**
   * Batas atas pemendekan kotak halaman terakhir untuk memberi ruang tanda
   * tangan.
   *
   * Dulu dipakai sebagai pemendekan TETAP 210pt untuk setiap dokumen, dan itu
   * menyebabkan bug "gap halaman": teks yang seharusnya mengisi penuh halaman
   * terakhir tertarik ke halaman berikutnya, menyisakan ratusan pt kosong di
   * dalam kotak (terukur pada 015/KK/KUKP/SII/X/2026: kotak 761 → 551pt).
   *
   * Sekarang pemendekan dihitung `planMitraLayout` secara KONDISIONAL dan
   * sebesar kebutuhan nyata (`reserveShrink`). Konstanta ini tinggal menjadi
   * acuan historis/audit — tes memakainya untuk membuktikan pemendekan yang
   * dipakai selalu lebih kecil dari nilai lama.
   */
  signatureZoneHeight: 210,

  /**
   * Blok tanda tangan = TABEL BERGRARIS di BAWAH & DI LUAR kotak kolom.
   * Geometri diukur dari master (p8):
   *   - garis tepi kiri  x = 120.9
   *   - garis pemisah    x = 298.9
   *   - garis tepi kanan x = 468.6
   *   - jarak dari dasar kotak ke atas tabel ≈ 50pt
   *     (master `KONTRAK KERJA MITRA STAFF.pdf` hal. 8 mengukur ≈ 22.6pt; 50
   *     dipakai agar lebih lega. Jarak ini ikut dihitung `planMitraLayout`
   *     lewat `signatureGapNeeded`, jadi tidak pernah membuat tabel keluar
   *     batas halaman.)
   * Baris (tinggi pt): label, perusahaan, ruang tanda tangan, nama, jabatan.
   */
  signatureTable: {
    left: 120.9,
    divider: 298.9,
    right: 468.6,
    gapFromBox: 50,
    labelRowH: 14,
    companyRowH: 14,
    signSpaceRowH: 88,
    nameRowH: 16,
    roleRowH: 14,
  },

  /**
   * Tinggi kotak kolom mengikuti isi (DINAMIS): kotak berhenti di teks
   * terakhir + bantalan, dengan tinggi minimum agar visual tetap kokoh pada
   * dokumen pendek. Kedua kolom memakai titik bawah yang SAMA (max keduanya),
   * sesuai master.
   */
  boxPaddingBottom: 6,
  minBoxHeight: 120,
} as const

/**
 * CHROME — satu-satunya teks yang boleh di-hardcode: kop surat + label tetap
 * pada judul dan blok tanda tangan. Semua teks KONTRAK berasal dari Template
 * Kontrak (contentDefinition), tidak pernah dari sini.
 */
export const MITRA_HEADER_CHROME = {
  org: ['KOPERASI KARYAWAN', 'PT. SANKYU INDONESIA INTERNATIONAL', 'UNIT KANTOR PUSAT'],
  address: [
    'Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20',
    'GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330',
    'TELP. 021 - 50555340, FAX. 021- 50555341',
  ],
  numberPrefix: 'Nomor:',
  datePrefix: 'Tanggal',
  signature: {
    leftHeader: "KOPERASI PT. SANKYU INT'L",
    rightHeader: 'MITRA',
    /** Jabatan di bawah nama Ketua Koperasi (master: "(Ketua Koperasi)"). */
    leftRoleLabel: '(Ketua Koperasi)',
    /** Dipakai bila jabatan mitra belum terisi. */
    rightRoleFallback: '(Mitra)',
  },
} as const

export interface MitraLayoutOptions {
  values: Record<string, string>
  title: string
  numberLabel?: string
  dateLabel?: string
  logoPath?: string
  fonts: { regular: string; bold: string; italic: string; boldItalic?: string }
  /**
   * Bila true, halaman terakhir boleh dipendekkan agar blok tanda tangan muat
   * DI BAWAH kotak pada halaman yang sama (mencegah tanda tangan menimpa teks).
   *
   * Pemendekannya bersifat KONDISIONAL & MINIMUM: hanya dilakukan bila tanda
   * tangan memang tidak muat, dan hanya sebesar yang diperlukan. Lihat
   * `planMitraLayout`.
   */
  reserveSignatureZone?: boolean
  /**
   * Isi blok tanda tangan. HANYA dipakai `planMitraLayout` untuk mengukur tinggi
   * tabel secara akurat (panjang nama/jabatan memengaruhi word-wrap). Render
   * sesungguhnya tetap dilakukan pemanggil lewat `renderMitraSignature`.
   */
  signature?: MitraSignatureOptions
}

/**
 * Isi tabel tanda tangan. Satu sumber kebenaran untuk menggambar
 * (`renderMitraSignature`) DAN mengukur (`planMitraLayout`).
 */
export interface MitraSignatureOptions {
  /** Label pilar (teks statis). Default: 'PIHAK PERTAMA' / 'PIHAK KEDUA'. */
  leftLabel?: string
  rightLabel?: string
  /** Nama perusahaan/pihak (teks statis). Default dari chrome. */
  leftHeader: string
  rightHeader: string
  /** Nama ORANG (dari data kontrak) — bukan teks template. */
  leftName: string
  rightName: string
  /** Jabatan (teks statis). Default dari chrome. */
  leftRole: string
  rightRole: string
  /**
   * Baris teks penutup (tempat/tanggal + organisasi) yang dicetak DI LUAR
   * kotak, tepat di atas tabel tanda tangan. Kosong/`undefined` = perilaku lama.
   */
  closingLines?: string[]
}

/** Padding teks di dalam sel tabel tanda tangan (agar tidak menempel garis). */
const SIG_CELL_PAD = 4

/**
 * Susun baris tabel tanda tangan + hitung tinggi tiap baris.
 *
 * Tinggi bersifat DINAMIS: baris tumbuh mengikuti teks yang dibungkus
 * (word-wrap), jadi nama perusahaan/jabatan yang panjang menambah tinggi tabel.
 * Karena itu pengukuran harus memakai fungsi yang SAMA dengan penggambaran —
 * kalau tidak, keputusan "muat atau tidak" akan menyimpang dari hasil nyata.
 */
export function mitraSignatureRows(doc: any, o?: MitraSignatureOptions) {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES
  const T = G.signatureTable
  const leftW = T.divider - T.left
  const rightW = T.right - T.divider
  const textW = (w: number) => Math.max(w - SIG_CELL_PAD * 2, 8)

  /**
   * Fallback chrome untuk pemanggil yang hanya ingin MENGUKUR (mis. tes/alat)
   * dan tidak mengisi teks tanda tangan. `renderMitraSignature` sendiri selalu
   * menerima objek lengkap dari `renderMitraDocumentInto`.
   */
  const C = MITRA_HEADER_CHROME.signature
  const rows: Array<{ base: number; left: string; right: string; bold: boolean }> = [
    { base: T.labelRowH, left: o?.leftLabel?.trim() || 'PIHAK PERTAMA', right: o?.rightLabel?.trim() || 'PIHAK KEDUA', bold: false },
    { base: T.companyRowH, left: o?.leftHeader ?? C.leftHeader, right: o?.rightHeader ?? C.rightHeader, bold: false },
    { base: T.signSpaceRowH, left: '', right: '', bold: false },
    { base: T.nameRowH, left: o?.leftName ?? '', right: o?.rightName ?? '', bold: true },
    { base: T.roleRowH, left: o?.leftRole ?? C.leftRoleLabel, right: o?.rightRole ?? C.rightRoleFallback, bold: false },
  ]

  const heights = rows.map((row) => {
    if (!row.left && !row.right) return row.base
    doc.font(row.bold ? F.bold : F.regular).fontSize(G.font.signature)
    const hl = row.left ? doc.heightOfString(row.left, { width: textW(leftW), align: 'center' }) : 0
    const hr = row.right ? doc.heightOfString(row.right, { width: textW(rightW), align: 'center' }) : 0
    return Math.max(row.base, Math.max(hl, hr) + 6)
  })

  return { rows, heights, leftW, rightW, textW }
}

/** Tinggi total tabel tanda tangan (jumlah tinggi semua baris). */
export function mitraSignatureTableHeight(doc: any, o?: MitraSignatureOptions): number {
  return mitraSignatureRows(doc, o).heights.reduce((a, b) => a + b, 0)
}

/** Bungkus baris penutup selebar `closing.maxWidth` (pitch baris tetap seragam). */
function wrapMitraClosingLines(doc: any, lines: string[]): string[] {
  const G = MITRA_GEOMETRY
  if (lines.length === 0) return []
  doc.font(MITRA_FONT_NAMES.regular).fontSize(G.closing.fontSize)
  return lines.flatMap(line =>
    wrapCellLines(doc, line, G.closing.maxWidth, MITRA_FONT_NAMES.regular, G.closing.fontSize)
  )
}

/** Tinggi blok penutup (pt) untuk baris yang sudah dibungkus. */
export function mitraClosingHeight(wrappedLines: string[]): number {
  if (wrappedLines.length === 0) return 0
  const G = MITRA_GEOMETRY
  return (wrappedLines.length - 1) * G.closing.lineAdvance + G.closing.fontSize
}

/**
 * Tinggi total zona tanda tangan: jarak dari kotak + (opsional) teks penutup +
 * tabel. Dipakai `planMitraLayout` supaya reservasi memperhitungkan teks
 * penutup, bukan hanya tabel.
 */
export function mitraSignatureZoneHeight(doc: any, o?: MitraSignatureOptions): number {
  const G = MITRA_GEOMETRY
  const table = mitraSignatureTableHeight(doc, o)
  const wrapped = wrapMitraClosingLines(doc, o?.closingLines ?? [])
  if (wrapped.length === 0) return G.signatureTable.gapFromBox + table
  return G.closing.gapFromBox + mitraClosingHeight(wrapped) + table
}

/**
 * Gambar teks penutup DI LUAR kotak, dipusatkan pada lebar halaman.
 * `top` = glyph-top baris pertama.
 */
export function renderMitraClosing(
  doc: any,
  wrappedLines: string[],
  top: number,
  pageIndex: number,
): void {
  if (wrappedLines.length === 0) return
  const G = MITRA_GEOMETRY
  doc.switchToPage(pageIndex)
  doc.font(MITRA_FONT_NAMES.regular).fontSize(G.closing.fontSize).fillColor('#000000')
  wrappedLines.forEach((line, i) => {
    doc.text(line, 0, top + i * G.closing.lineAdvance, {
      width: G.pageWidth,
      align: 'center',
      lineBreak: false
    })
  })
}

export interface MitraBlock {
  type: string
  [key: string]: any
}

export const MITRA_FONT_NAMES = {
  regular: 'MitraTimes',
  bold: 'MitraTimesBold',
  italic: 'MitraTimesItalic',
  boldItalic: 'MitraTimesBoldItalic',
} as const

/**
 * Perataan teks MITRA.
 *
 * Alias dari `InlineRunAlign` supaya hanya ada SATU daftar nilai yang sah di
 * seluruh sistem (dipakai juga oleh `PkwtAlign` dan `BLOCK_ALIGN_VALUES` di
 * `template-schema.validator.ts`).
 */
export type MitraAlign = InlineRunAlign

/**
 * Font logical untuk jalur run (mark).
 *
 * Memakai NAMA LOGIS yang sudah didaftarkan `renderMitraPass()`, bukan path TTF.
 * `boldItalic` opsional: `timesbi.ttf` tidak selalu ada di semua paket
 * msttcorefonts, dan `runFont()` sudah menjatuhkannya ke `bold` bila kosong.
 */
export const MITRA_RUN_FONTS: RunFonts = {
  regular: MITRA_FONT_NAMES.regular,
  bold: MITRA_FONT_NAMES.bold,
  italic: MITRA_FONT_NAMES.italic,
  boldItalic: MITRA_FONT_NAMES.boldItalic,
}

/** `block.align` yang sah. Nilai lain (termasuk `undefined`) → perilaku lama. */
export function mitraBlockAlign(value: unknown): MitraAlign | undefined {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
    ? value
    : undefined
}

/**
 * Jarak vertikal TAMBAHAN di bawah satu blok (`block.spaceAfter`), satuan pt.
 *
 * Bersifat ADITIF di atas jarak bawaan renderer: nilai tak sah / `undefined` /
 * `<= 0` → `0` (tanpa jarak tambahan), sehingga template lama menghasilkan PDF
 * yang sama persis. Diterapkan hanya bila blok berikutnya masih berada di
 * kolom/halaman yang sama — lihat `renderMitraPass`.
 *
 * Normalisasi berasal dari modul bersama `contracts/block-spacing.ts` (dipakai
 * juga oleh validator dan engine PKWT).
 */
export const mitraBlockSpaceAfter = blockSpaceAfterPts

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g

/**
 * Pengganti placeholder yang datanya kosong.
 *
 * ATURAN: nama variabel TIDAK BOLEH pernah tercetak di PDF. Bila nilai tidak
 * ada, cetak garis titik-titik panjang — sama seperti master
 * (`2. Bpk, .................... Warga Negara Indonesia, lahir di .........`).
 */
export const MITRA_EMPTY_FALLBACK = '...............'

/** Ganti {{key}} → nilai; nilai kosong → titik-titik (bukan nama variabel). */
export function mitraInterpolate(text: string, values: Record<string, string>): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER, (_m, key: string) => {
    const v = values[key]
    return v === undefined || v === null || String(v).trim() === ''
      ? MITRA_EMPTY_FALLBACK
      : String(v)
  })
}

/**
 * Jaring pengaman terakhir sebelum teks digambar: buang sisa token mentah
 * yang mungkin lolos (`<<key>>`, `{{key}}`, `__TOKEN__`) agar nama variabel
 * tidak pernah muncul di PDF final.
 */
export function scrubRawTokens(text: string): string {
  if (!text) return ''
  return text
    .replace(/<<\s*[^<>]{1,80}\s*>>/g, MITRA_EMPTY_FALLBACK)
    .replace(/\{\{\s*[^{}]{1,80}\s*\}\}/g, MITRA_EMPTY_FALLBACK)
    .replace(/__[A-Z][A-Z0-9_]{2,40}__/g, MITRA_EMPTY_FALLBACK)
}

/** Prefix list: 1. / a. / • — dipertahankan agar numbering legal tidak berubah. */
export function listPrefix(style: string, index: number): string {
  if (style === 'numbered') return `${index + 1}.`
  if (style === 'alphabetic') return `${String.fromCharCode(97 + (index % 26))}.`
  return '\u2022'
}

/**
 * Paragraf yang diawali nomor/huruf ("1. ", "a. ") dirender dengan hanging
 * indent. SATU pola untuk renderer dan pengukur agar tinggi barisnya sama.
 */
const NUMBERED_ITEM_RE = /^(?:\d{1,2}|[a-z])\.\s/

/**
 * Lebar ruang penanda daftar (pt) untuk SATU blok.
 *
 * Penanda digambar terpisah di ruang ini, jadi lebarnya harus cukup untuk
 * penanda TERLEBAR di blok itu — "10. " jauh lebih lebar dari "1. ". Memakai
 * `listHangingIndent` saja membuat teks poin ke-10 menabrak penandanya.
 *
 * Semua item memakai lebar yang SAMA agar kolom teksnya rata.
 */
function mitraListTextIndent(doc: any, items: any[], style: string, base = 0): number {
  const G = MITRA_GEOMETRY
  doc.font(MITRA_FONT_NAMES.regular).fontSize(G.font.body)
  let widest = G.listHangingIndent
  items.forEach((_: unknown, i: number) => {
    const w = doc.widthOfString(`${listPrefix(style, base + i)} `)
    if (w > widest) widest = w
  })
  return widest
}

/**
 * Jarak baris grid MITRA (pt) untuk satu dokumen.
 *
 * SATU sumber angka untuk renderer DAN pengukur (`planMitraLayout`), supaya
 * titik potong kolom dihitung dengan tinggi yang sama dengan hasil gambar.
 */
function mitraPitch(doc: any): number {
  const G = MITRA_GEOMETRY
  doc.font(MITRA_FONT_NAMES.regular).fontSize(G.font.body)
  return doc.heightOfString('Xg', { lineGap: G.lineGap })
}

/**
 * Bungkus kata menjadi baris dengan lebar baris-pertama berbeda (hanging
 * indent). Dipakai renderer DAN pengukur agar jumlah baris tidak menyimpang.
 */
function wrapWordsToLines(
  doc: any,
  text: string,
  o: { font: string; size: number; firstWidth: number; restWidth: number },
): string[] {
  doc.font(o.font).fontSize(o.size)
  const spaceW = doc.widthOfString(' ')
  const widthOfWords = (ws: string[]) =>
    ws.reduce((a, w) => a + doc.widthOfString(w), 0) + Math.max(0, ws.length - 1) * spaceW

  const lines: string[] = []
  const words = text.split(/\s+/).filter(Boolean)
  let cur: string[] = []
  let curWidth = o.firstWidth
  for (const w of words) {
    const test = [...cur, w]
    if (widthOfWords(test) <= curWidth || cur.length === 0) {
      cur = test
    } else {
      lines.push(cur.join(' '))
      cur = [w]
      curWidth = o.restWidth
    }
  }
  if (cur.length) lines.push(cur.join(' '))
  return lines
}

/**
 * Posisi vertikal GLOBAL (pt) dari pasangan (halaman, y).
 *
 * Kolom mengalir lintas halaman, jadi tinggi satu blok tidak bisa dihitung
 * hanya dari selisih `y` — harus dijumlahkan dengan kapasitas halaman yang
 * dilewati. Origin global = puncak kotak halaman 0.
 */
function mitraPageCapacity(pageIdx: number): number {
  const G = MITRA_GEOMETRY
  return pageIdx === 0
    ? G.firstPageBoxBottom - G.firstPageBoxTop
    : G.contPageBoxBottom - G.contPageBoxTop
}

function mitraGlobalY(pageIdx: number, y: number): number {
  const G = MITRA_GEOMETRY
  const top = pageIdx === 0 ? G.firstPageBoxTop : G.contPageBoxTop
  let total = 0
  for (let p = 0; p < pageIdx; p++) total += mitraPageCapacity(p)
  return total + (y - top)
}

/**
 * Gambar SATU baris rata kanan-kiri dengan mendistribusikan sisa ruang ke
 * spasi antar-kata. Dipakai pada mode hanging indent karena PDFKit tidak
 * menerapkan justify ketika `lineBreak: false`.
 *
 * Kata terakhir digambar tanpa spasi tambahan sehingga tepi kanan tetap rapi.
 */
function drawJustifiedLine(
  doc: any,
  line: string,
  x: number,
  y: number,
  width: number,
  font: string,
  size: number,
): void {
  doc.font(font).fontSize(size)
  const words = line.split(' ').filter(Boolean)
  const natural = words.reduce((acc, w) => acc + doc.widthOfString(w), 0)
  const gaps = words.length - 1
  if (gaps <= 0) {
    doc.text(line, x, y, { width, align: 'left', lineBreak: false })
    return
  }
  const spaceWidth = (width - natural) / gaps
  // Gap negatif berarti baris lebih lebar dari kolom — jangan dipaksa justify
  // (akan menumpuk kata). Fallback ke penggambaran normal.
  if (!Number.isFinite(spaceWidth) || spaceWidth < 0) {
    doc.text(line, x, y, { width, align: 'left', lineBreak: false })
    return
  }
  let cx = x
  for (let i = 0; i < words.length; i++) {
    doc.text(words[i], cx, y, { lineBreak: false })
    cx += doc.widthOfString(words[i])
    if (i < words.length - 1) cx += spaceWidth
  }
}

export function formatMitraCell(value: string, format: string | undefined): string {
  if (format !== 'currency' && format !== 'number') return value
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  if (!/[0-9]/.test(cleaned)) return value
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return value
  if (format === 'currency') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }
  return new Intl.NumberFormat('id-ID').format(n)
}

/**
 * Pecah teks menjadi baris-baris yang muat pada `width`, memakai pengukuran
 * nyata PDFKit. Menghormati newline eksplisit. Tidak ada kata yang ditempel.
 */
/**
 * Render layout MITRA — SATU-SATUNYA pintu masuk.
 *
 * Dua fase:
 *  1. `planMitraLayout` mengukur engine pada dokumen scratch untuk memilih
 *     split stream dan halaman yang perlu disisihkan untuk tanda tangan.
 *  2. Render sungguhan ke `doc` memakai rencana itu.
 *
 * Memisahkan perencanaan dari penggambaran membuat hasilnya akurat tanpa
 * menebak, dan tetap idempoten: dokumen yang sama selalu menghasilkan tata
 * letak yang sama.
 */
export function renderMitraLayout(
  doc: any,
  blocks: MitraBlock[],
  opts: MitraLayoutOptions,
): void {
  const plan = planMitraLayout(blocks, opts)
  renderMitraPass(doc, blocks, opts, plan)
}

/**
 * Render satu kali dengan RENCANA yang sudah dihitung.
 *
 * Dipisahkan dari `renderMitraLayout` supaya `planMitraLayout` dapat
 * menjalankannya berulang pada dokumen SCRATCH untuk mengukur tinggi stream,
 * tanpa rekursi tak berujung.
 */
function renderMitraPass(
  doc: any,
  blocks: MitraBlock[],
  opts: MitraLayoutOptions,
  plan: MitraLayoutPlan,
): void {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES

  doc.registerFont(F.regular, opts.fonts.regular)
  doc.registerFont(F.bold, opts.fonts.bold)
  doc.registerFont(F.italic, opts.fonts.italic)
  // Bold-italic opsional: `timesbi.ttf` tidak selalu tersedia. Jatuh ke BOLD
  // (bukan italic) supaya teks yang diminta tebal tetap terlihat tebal.
  doc.registerFont(F.boldItalic, opts.fonts.boldItalic ?? opts.fonts.bold)

  /**
   * GRID BASELINE (pt) — jarak antar-baris body.
   *
   * Kolom KIRI dan KANAN mengalir sebagai dua stream INDEPENDEN, jadi tanpa
   * grid keduanya akan "berenang" dan baseline-nya tidak pernah sejajar.
   * Aturannya: SETIAP baris dan SETIAP jarak antar-blok harus kelipatan PITCH.
   * Dengan begitu baris ke-n kolom kiri selalu selevel dengan baris ke-n kolom
   * kanan, berapa pun isi masing-masing kolom.
   *
   * Nilainya diturunkan dari metrik font yang SAMA dengan `writeText`, bukan
   * konstanta, supaya tidak menyimpang bila font/ukuran body diubah.
   */
  doc.font(F.regular).fontSize(G.font.body)
  const PITCH = mitraPitch(doc)
  const BODY_ASCENT = ((doc as any)._font.ascender / 1000) * G.font.body

  /**
   * Metrik satu ukuran font agar barisnya tetap duduk di grid.
   *
   * `lineGap` dipilih supaya tinggi baris = PITCH. `baselineOffset` menggeser
   * titik gambar ke bawah/atas agar BASELINE (bukan atas kotak baris) jatuh
   * tepat di grid — penting untuk ukuran selain body (mis. subtitle 10pt),
   * yang ascent-nya lebih pendek.
   */
  const gridMetrics = (font: string, size: number) => {
    doc.font(font).fontSize(size)
    const natural = doc.heightOfString('Xg', { lineGap: 0 })
    const ascent = ((doc as any)._font.ascender / 1000) * size
    return {
      lineGap: Math.max(0, PITCH - natural),
      baselineOffset: BODY_ASCENT - ascent,
    }
  }

  /** Jarak sebelum judul pasal: dua baris penuh (tetap kelipatan grid). */
  const HEADING_GAP = PITCH * 2

  /**
   * Blok `title` PERTAMA = judul dokumen yang sudah digambar di KOP (header
   * halaman 1). Blok itu DILEWATI saat body dirender agar judul tidak tampil
   * dua kali — sehingga template MITRA lama (satu blok `title` di index 0)
   * menghasilkan PDF yang sama seperti sebelumnya.
   *
   * Blok `title` TAMBAHAN dan SEMUA blok `subtitle` digambar pada posisinya.
   */
  const headerTitleBlock = blocks.find((b) => b?.type === 'title') ?? null

  /**
   * MODE ALIRAN DUA-STREAM (booklet) — sesuai master `Original Example.pdf`.
   *
   * Master BUKAN aliran sekuensial (kolom kiri habis → kolom kanan). Ia adalah
   * layout booklet: konten dibagi ~50/50 menjadi dua stream.
   *   - Stream 0 mengisi kolom KIRI pada semua halaman.
   *   - Stream 1 mengisi kolom KANAN pada semua halaman.
   * Akibatnya PASAL 1 muncul di kolom KIRI halaman 1 dan mengalir ke bawah —
   * persis seperti dokumen asli.
   *
   * Halaman bersifat "buffered": setelah stream 0 membuat halaman, stream 1
   * menulis kolom kanannya lewat `switchToPage` pada halaman yang sama.
   */

  // --- Geometri kolom ---
  const colX = (c: number) => (c === 0 ? G.left.x0 : G.right.x0) + G.textPaddingLeft
  const colInnerWidth = (c: number) =>
    (c === 0 ? G.left.x1 - G.left.x0 : G.right.x1 - G.right.x0) - G.textPaddingLeft * 2
  const boxTop = (pageIdx: number) => (pageIdx === 0 ? G.firstPageBoxTop : G.contPageBoxTop)
  /**
   * Halaman yang kotaknya SENGAJA dipendekkan agar tabel tanda tangan mendapat
   * ruang di bawahnya (peta halaman → batas bawah baru).
   */
  const reservedBottomByPage = new Map<number, number>()
  const boxBottom = (pageIdx: number) => {
    const base = pageIdx === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
    const cap = reservedBottomByPage.get(pageIdx)
    return cap === undefined ? base : Math.min(base, cap)
  }

  // --- State ---
  let pageCount = 1 // halaman 0 dibuat otomatis (autoFirstPage)
  const streamPage = [0, 0] // halaman aktif tiap stream (0-based)
  let currentStream = 0
  let y = 0
  /**
   * Titik terdalam konten per halaman (digabung dari KEDUA stream) sehingga
   * tinggi kotak bisa mengikuti isi. Sesuai master: kotak kiri & kanan
   * berhenti di titik yang SAMA (= max kedua kolom).
   */
  const deepestByPage: number[] = []

  const noteDeepest = () => {
    const p = streamPage[currentStream]
    deepestByPage[p] = Math.max(deepestByPage[p] ?? 0, y)
  }

  /** Titik awal grid (top kotak + 2pt) pada halaman stream aktif. */
  const gridOrigin = () => boxTop(streamPage[currentStream]) + 2

  /**
   * Bulatkan `y` KE ATAS ke garis grid berikutnya.
   *
   * Dipakai setelah elemen yang tingginya tidak mengikuti grid (tabel) dan
   * setelah `spaceAfter` manual, supaya baris berikutnya kembali sejajar dengan
   * kolom satunya.
   */
  const snapToGrid = () => {
    const origin = gridOrigin()
    const steps = Math.ceil((y - origin) / PITCH - 1e-6)
    y = origin + Math.max(0, steps) * PITCH
  }

  /**
   * Gambar kotak kolom untuk satu halaman.
   *
   * @param contentBottom bila diberikan → kotak menyusut mengikuti isi
   *        (dinamis). Bila undefined → setinggi halaman (dipakai saat kotak
   *        digambar sebelum konten diketahui).
   */
  const strokeBoxesForPage = (pageIdx: number, contentBottom?: number) => {
    const top = boxTop(pageIdx)
    const full = boxBottom(pageIdx)
    const bottom = contentBottom === undefined
      ? full
      : Math.min(full, Math.max(top + G.minBoxHeight, contentBottom + G.boxPaddingBottom))
    doc.save()
    doc.lineWidth(G.borderWidth).strokeColor('#000000')
    for (const c of [G.left, G.right]) {
      doc.rect(c.x0, top, c.x1 - c.x0, bottom - top).stroke()
    }
    doc.restore()
    return bottom
  }

  const drawMasterHeader = () => {
    const pageWidth = G.pageWidth
    if (opts.logoPath) {
      try {
        doc.image(opts.logoPath, G.logo.x, G.logo.y, { width: G.logo.width, height: G.logo.height })
      } catch {
        /* logo opsional */
      }
    }
    doc.font(F.regular).fontSize(G.font.headerOrg).fillColor('#000000')
    doc.text(MITRA_HEADER_CHROME.org[0], 0, 16, { width: pageWidth, align: 'center', lineBreak: false })
    doc.text(MITRA_HEADER_CHROME.org[1], 0, 34, { width: pageWidth, align: 'center', lineBreak: false })
    doc.text(MITRA_HEADER_CHROME.org[2], 0, 54, { width: pageWidth, align: 'center', lineBreak: false })

    doc.font(F.regular).fontSize(G.font.headerAddress)
    doc.text(MITRA_HEADER_CHROME.address[0], 0, 70, { width: pageWidth, align: 'center', lineBreak: false })
    doc.text(MITRA_HEADER_CHROME.address[1], 0, 86, { width: pageWidth, align: 'center', lineBreak: false })
    doc.text(MITRA_HEADER_CHROME.address[2], 0, 98, { width: pageWidth, align: 'center', lineBreak: false })

    doc.save()
    doc.fillColor('#000000')
    doc.rect(G.rules.x0, G.rules.y1, G.rules.x1 - G.rules.x0, G.rules.thickness1).fill()
    doc.rect(G.rules.x0, G.rules.y2, G.rules.x1 - G.rules.x0, G.rules.thickness2).fill()
    doc.restore()

    doc.font(F.bold).fontSize(G.font.title).fillColor('#000000')
    doc.text(opts.title, 0, G.titleTop, { width: pageWidth, align: 'center', lineBreak: false })
    doc.font(F.regular).fontSize(G.font.title)
    if (opts.numberLabel) {
      doc.text(opts.numberLabel, 0, G.numberTop, { width: pageWidth, align: 'center', lineBreak: false })
    }
    if (opts.dateLabel) {
      doc.text(opts.dateLabel, 0, G.dateTop, { width: pageWidth, align: 'center', lineBreak: false })
    }
  }

  const gotoStreamPage = (s: number, pageIdx: number) => {
    doc.switchToPage(pageIdx)
    streamPage[s] = pageIdx
    currentStream = s
    y = boxTop(pageIdx) + 2
  }

  /** Tambah halaman fisik baru untuk stream `s` lalu lanjut di sana. */
  const nextPageForStream = (s: number) => {
    noteDeepest()
    const target = streamPage[s] + 1
    if (target >= pageCount) {
      doc.addPage()
      pageCount = target + 1
      // Kotak TIDAK digambar di sini — digambar pada pass akhir agar tingginya
      // bisa menyesuaikan isi (dinamis).
    }
    gotoStreamPage(s, target)
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > boxBottom(streamPage[currentStream])) nextPageForStream(currentStream)
  }

  /**
   * Tulis satu paragraf dengan pemecahan baris manual agar dapat mengalir
   * lintas halaman tanpa kehilangan teks. Mendukung hanging indent.
   */
  const writeText = (
    rawText: string,
    o: {
      font?: string
      size?: number
      align?: MitraAlign
      gapBefore?: number
      gapAfter?: number
      indent?: number
      hangingIndent?: number
      keepWithNextLines?: number
    } = {},
  ) => {
    const text = scrubRawTokens(mitraInterpolate(rawText, opts.values))
    if (!text) return
    const font = o.font ?? F.regular
    const size = o.size ?? G.font.body
    const align = o.align ?? 'justify'
    const indent = o.indent ?? 0
    const hang = o.hangingIndent ?? 0
    const s = currentStream

    const metrics = gridMetrics(font, size)
    // Tinggi baris SELALU PITCH supaya baseline tidak pernah keluar grid,
    // termasuk untuk ukuran selain body (subtitle).
    const lineHeight = PITCH
    const fullWidth = colInnerWidth(s)

    if (o.gapBefore) {
      // Jarak sebelum heading SELALU diterapkan (juga di puncak kolom). Kalau
      // dilewati secara kondisional, tinggi satu blok bergantung pada posisi
      // halaman — dan penyeimbangan kolom jadi tidak mungkin dihitung tepat.
      // Nilainya kelipatan PITCH, jadi baseline tetap di grid.
      ensureSpace(o.gapBefore)
      y += o.gapBefore
    }
    if (o.keepWithNextLines) {
      // Heading PASAL ditulis sebagai satu string multi-baris ("PASAL 7\n
      // KEADAAN MEMAKSA"). Ukur TINGGI SEBENARNYA agar kedua baris tidak
      // terpisah: bila tidak muat, pindah halaman sebelum menggambar.
      const headingH = doc.heightOfString(text, {
        width: fullWidth - indent,
        align,
        lineGap: metrics.lineGap,
      })
      const needed = Math.max(headingH, lineHeight * o.keepWithNextLines)
      if (y + needed > boxBottom(streamPage[s])) {
        nextPageForStream(s)
      }
    }
    if (y + lineHeight > boxBottom(streamPage[s])) {
      nextPageForStream(s)
    }

    if (hang > 0) {
      // --- Hanging indent: bungkus manual per baris (lebar baris 1 ≠ lanjutan). ---
      const firstWidth = fullWidth - indent
      const restWidth = fullWidth - indent - hang
      const lines = wrapWordsToLines(doc, text, { font, size, firstWidth, restWidth })

      for (let li = 0; li < lines.length; li++) {
        if (y + lineHeight > boxBottom(streamPage[s])) nextPageForStream(s)
        const isFirst = li === 0
        const isLast = li === lines.length - 1
        const lineIndent = isFirst ? indent : indent + hang
        const lineWidth = isFirst ? firstWidth : restWidth
        const lineX = colX(s) + lineIndent
        doc.font(font).fontSize(size).fillColor('#000000')
        // `baselineOffset` menempatkan BASELINE di grid, bukan atas kotak baris.
        const lineY = y + metrics.baselineOffset

        if (align === 'justify' && !isLast && lines[li].includes(' ')) {
          drawJustifiedLine(doc, lines[li], lineX, lineY, lineWidth, font, size)
        } else {
          doc.text(lines[li], lineX, lineY, {
            width: lineWidth,
            align: align === 'justify' ? 'left' : align,
            lineGap: metrics.lineGap,
            lineBreak: false,
          })
        }
        y += lineHeight
      }
      y += o.gapAfter ?? 0
      noteDeepest()
      return
    }

    // --- Modus normal: alur paragraf lintas halaman. ---
    const measure = (t: string) =>
      doc.heightOfString(t, { width: fullWidth - indent, align, lineGap: metrics.lineGap })

    let remaining = text
    while (remaining) {
      const avail = boxBottom(streamPage[s]) - y
      const fullH = measure(remaining)
      if (fullH <= avail) {
        doc.font(font).fontSize(size).fillColor('#000000')
        doc.text(remaining, colX(s) + indent, y + metrics.baselineOffset, {
          width: fullWidth - indent,
          align,
          lineGap: metrics.lineGap,
        })
        y += fullH
        break
      }

      const words = remaining.split(/\s+/)
      let lo = 1
      let hi = words.length
      let best = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const cand = words.slice(0, mid).join(' ')
        if (measure(cand) <= avail) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }

      if (best === 0) {
        nextPageForStream(s)
        continue
      }

      const chunk = words.slice(0, best).join(' ')
      const chunkH = measure(chunk)
      doc.font(font).fontSize(size).fillColor('#000000')
      doc.text(chunk, colX(s) + indent, y + metrics.baselineOffset, {
        width: fullWidth - indent,
        align,
        lineGap: metrics.lineGap,
      })
      y += chunkH
      remaining = words.slice(best).join(' ')
      if (remaining) nextPageForStream(s)
    }

    y += o.gapAfter ?? 0
    noteDeepest()
  }

  /**
   * Tulis satu paragraf BER-MARK (bold/italic/underline), meniru `writeText`
   * baris demi baris.
   *
   * KAPAN DIPAKAI: hanya bila teksnya benar-benar bermark. Bila tidak, fungsi ini
   * langsung mendelegasikan ke `writeText`, sehingga template yang sudah ada
   * memakai jalur kode yang SAMA PERSIS seperti sebelum fitur ini ditambahkan.
   *
   * Urutan penting: interpolasi dulu, baru mark di-parse — supaya
   * `**{{employee.fullName}}**` membuat NILAI-nya bold, bukan nama placeholder.
   *
   * Hanging indent didukung karena `paragraphOpts()` memberikannya kepada
   * paragraf bernomor (mis. `"1. Perusahaan..."`), bukan hanya blok `list`.
   * Tanpa dukungan ini, paragraf bernomor yang diberi mark akan kehilangan
   * indentasi gantungnya.
   */
  const writeRuns = (
    rawText: string,
    o: {
      font?: string
      size?: number
      align?: MitraAlign
      gapBefore?: number
      gapAfter?: number
      indent?: number
      hangingIndent?: number
      keepWithNextLines?: number
    } = {},
  ) => {
    const text = scrubRawTokens(mitraInterpolate(rawText, opts.values))
    if (!text) return
    if (!hasInlineMarks(text)) {
      writeText(rawText, o)
      return
    }

    const runs = parseInlineRuns(text)
    const font = o.font ?? F.regular
    const size = o.size ?? G.font.body
    const align = o.align ?? 'justify'
    const indent = o.indent ?? 0
    const hang = o.hangingIndent ?? 0
    const s = currentStream

    const metrics = gridMetrics(font, size)
    // Tinggi baris SAMA dengan jalur lama: bersumber dari font acuan, BUKAN dari
    // mark. Inilah yang membuat baris bermark setinggi baris tanpa mark sehingga
    // paginasi tidak bergeser (dibuktikan uji jumlah halaman).
    const lineHeight = PITCH
    const fullWidth = colInnerWidth(s)

    const firstWidth = fullWidth - indent
    const restWidth = fullWidth - indent - hang
    // Bungkus LEBIH DULU supaya keputusan pindah halaman memakai jumlah baris nyata.
    const lines = hang > 0
      ? wrapRunsToLines(doc, runs, restWidth, MITRA_RUN_FONTS, size, { firstLineWidth: firstWidth })
      : wrapRunsToLines(doc, runs, firstWidth, MITRA_RUN_FONTS, size)

    if (o.gapBefore) {
      // Sama dengan `writeText`: jarak heading selalu diterapkan (kelipatan
      // PITCH) supaya tinggi blok tidak bergantung posisi halaman.
      ensureSpace(o.gapBefore)
      y += o.gapBefore
    }
    if (o.keepWithNextLines) {
      const needed = Math.max(lines.length * lineHeight, lineHeight * o.keepWithNextLines)
      if (y + needed > boxBottom(streamPage[s])) nextPageForStream(s)
    }
    if (y + lineHeight > boxBottom(streamPage[s])) nextPageForStream(s)

    for (let li = 0; li < lines.length; li++) {
      if (y + lineHeight > boxBottom(streamPage[s])) nextPageForStream(s)
      const isFirst = li === 0
      const isLast = li === lines.length - 1
      const lineWidth = hang > 0 && !isFirst ? restWidth : firstWidth
      const lineX = colX(s) + (hang > 0 && !isFirst ? indent + hang : indent)
      // Baris terakhir paragraf tidak direntangkan — sama seperti Word/LaTeX dan
      // sama dengan `writeText`.
      const lineAlign: MitraAlign = align === 'justify' && isLast ? 'left' : align
      drawRunsLine(
        doc,
        lines[li],
        lineX,
        y + metrics.baselineOffset,
        lineWidth,
        MITRA_RUN_FONTS,
        size,
        lineAlign,
      )
      y += lineHeight
    }

    y += o.gapAfter ?? 0
    noteDeepest()
  }

  const paragraphOpts = (text: string, align?: MitraAlign) => {
    const base = NUMBERED_ITEM_RE.test(mitraInterpolate(text, opts.values))
      ? { gapAfter: 0, hangingIndent: G.listHangingIndent }
      : { gapAfter: 0 }
    // `align` sengaja TIDAK ditulis bila tidak ada, supaya `writeText`/`writeRuns`
    // memakai default `'justify'` — perilaku lama yang tidak boleh berubah.
    return align ? { ...base, align } : base
  }

  const renderBlock = (block: any) => {
    switch (block?.type) {
      case 'title':
        // Blok `title` PERTAMA sudah dipakai sebagai JUDUL KOP pada header
        // halaman 1 (`drawMasterHeader`). Menggambarnya lagi di body akan
        // membuat judul tampil dua kali, jadi blok itu dilewati.
        //
        // Aturan ini ditentukan di sini (bukan dari opsi pemanggil) supaya
        // hasilnya konsisten: template MITRA bawaan menaruh blok `title` di
        // index 0, sedangkan blok `title` TAMBAHAN yang dibuat admin lewat
        // editor tetap digambar pada posisinya masing-masing.
        if (block === headerTitleBlock) break
        writeText(block.text ?? '', {
          font: F.bold,
          size: G.font.body,
          align: 'center',
          gapBefore: HEADING_GAP,
          gapAfter: 0,
        })
        break

      case 'subtitle':
        writeText(block.text ?? '', {
          font: F.bold,
          size: G.font.body - 2,
          align: 'center',
          gapBefore: 0,
          gapAfter: 0,
        })
        break

      case 'paragraph':
        writeRuns(block.text ?? '', paragraphOpts(block.text ?? '', mitraBlockAlign(block?.align)))
        break

      case 'article': {
        const align = mitraBlockAlign(block?.align)
        // `headingAlign`: perataan KHUSUS judul pasal (PASAL 1 ...), LEPAS dari
        // `align` blok yang hanya berlaku untuk uraian. `align` sengaja TIDAK
        // ikut menjadi fallback: kalau ikut, memilih "Rata Kiri" pada uraian
        // diam-diam menggeser judul (bug editor: tombol judul menampilkan
        // "Rata Tengah" tetapi PDF mencetak rata kiri).
        const headingAlign = mitraBlockAlign(block?.headingAlign)
        if (block.heading) {
          writeText(block.heading, {
            font: F.bold,
            size: G.font.body,
            // Tanpa `headingAlign`, judul tetap center seperti perilaku asli.
            align: headingAlign ?? 'center',
            gapBefore: HEADING_GAP,
            gapAfter: 0,
            keepWithNextLines: 3,
          })
        }
        for (const p of block.paragraphs ?? []) {
          writeRuns(String(p), paragraphOpts(String(p), align))
        }
        break
      }

      case 'list': {
        const items = block.items ?? []
        /**
         * `startIndex` dipakai saat daftar DIPECAH di batas kolom: bagian
         * lanjutan harus meneruskan penomoran, bukan mengulang dari "1.".
         */
        const base = Number.isInteger(block.startIndex) ? Number(block.startIndex) : 0
        const style = block.style ?? 'bullet'
        // Tanpa `align` → 'left' (perilaku lama, PDF template lama identik).
        const align = mitraBlockAlign(block?.align) ?? 'left'
        // Ruang penanda mengikuti label TERLEBAR di blok ini ("10. " > "1. ").
        const textIndent = mitraListTextIndent(doc, items, style, base)

        items.forEach((item: any, i: number) => {
          const raw = typeof item === 'string' ? item : (item?.text ?? '')
          const text = scrubRawTokens(mitraInterpolate(String(raw), opts.values))
          if (!text) return
          const level = typeof item === 'object' ? (item?.level ?? 0) : 0
          const prefix = listPrefix(style, base + i)
          const markerIndent = level * G.listHangingIndent
          const s = currentStream

          // Pastikan baris PERTAMA muat sebelum penanda digambar. Tanpa ini,
          // penanda bisa tertinggal di halaman sebelumnya saat `writeRuns`
          // memutuskan pindah halaman.
          if (y + PITCH > boxBottom(streamPage[s])) nextPageForStream(s)

          doc.font(F.regular).fontSize(G.font.body).fillColor('#000000')
          // Spasi ikut digambar bersama penanda: tanpa itu teks hasil ekstraksi
          // PDF terbaca "10.Poin" walau secara visual ada jarak (sama seperti
          // `drawCell` di engine PKWT). `textIndent` dihitung dari `${prefix} `
          // sehingga lebarnya persis.
          doc.text(`${prefix} `, colX(s) + markerIndent, y, {
            width: textIndent,
            align: 'left',
            lineBreak: false,
          })

          // Teks poin dimulai SETELAH penanda dengan indent KONSTAN (bukan
          // hanging), sehingga baris lanjutan — termasuk baris baru dari
          // Shift+Enter — tetap sejajar dengan huruf pertama. Penanda tidak
          // ikut bergeser walau teksnya di-center/kanan/justify.
          writeRuns(text, {
            indent: markerIndent + textIndent,
            gapAfter: 0,
            align,
          })
        })
        break
      }

      case 'table': {
        const columns = block.columns ?? []
        const rows = block.rows ?? []
        if (columns.length === 0) break
        const size = G.font.body - 1
        // Lebar kolom dinormalisasi (bobot relatif) supaya totalnya SELALU
        // selebar kolom — memperbaiki tabel yang dulu meluber keluar halaman.
        const widths = computeColumnWidths(columns, colInnerWidth(currentStream))

        /**
         * Gambar satu baris. Bila tinggi baris MELEBIHI tinggi halaman penuh,
         * baris dipecah per-lini ke beberapa halaman (teks tetap utuh, tidak
         * terpotong). Baris normal hanya perlu `ensureSpace` seperti biasa.
         */
        const drawRow = (cells: string[], bold: boolean) => {
          const font = bold ? F.bold : F.regular
          doc.font(font).fontSize(size)
          const lineHeight = doc.heightOfString('Xg', { lineGap: 0 })
          const rowHeight = computeRowHeight(doc, cells, widths, size, 8, 6)
          const s = currentStream
          const maxBody = boxBottom(streamPage[s]) - boxTop(streamPage[s]) - 4

          if (rowHeight <= maxBody) {
            ensureSpace(rowHeight)
            const x0 = colX(currentStream)
            let x = x0
            columns.forEach((c: any, ci: number) => {
              doc.rect(x, y, widths[ci], rowHeight).stroke('#000000')
              doc
                .font(font)
                .fontSize(size)
                .text(cells[ci] ?? '', x + 4, y + 3, {
                  width: Math.max(widths[ci] - 8, 1),
                  align: (c.align ?? 'left') as any,
                })
              x += widths[ci]
            })
            y += rowHeight
            noteDeepest()
            return
          }

          // --- Baris ekstra-tinggi: pecah per-lini lintas halaman. ---
          const cellLines = cells.map((cell, ci) => wrapCellLines(doc, cell ?? '', Math.max(widths[ci] - 8, 1), font, size))
          const maxLines = Math.max(1, cellLines.reduce((m, l) => Math.max(m, l.length), 0))
          let consumed = 0
          while (consumed < maxLines) {
            if (y + lineHeight * 2 > boxBottom(streamPage[s])) nextPageForStream(s)
            const avail = boxBottom(streamPage[s]) - y
            const fit = Math.max(1, Math.floor((avail - 6) / lineHeight))
            const take = Math.min(fit, maxLines - consumed)
            const segHeight = take * lineHeight + 6
            const x0 = colX(currentStream)
            let x = x0
            columns.forEach((c: any, ci: number) => {
              doc.rect(x, y, widths[ci], segHeight).stroke('#000000')
              const chunk = cellLines[ci].slice(consumed, consumed + take).join('\n')
              doc
                .font(font)
                .fontSize(size)
                .text(chunk, x + 4, y + 3, {
                  width: Math.max(widths[ci] - 8, 1),
                  align: (c.align ?? 'left') as any,
                  lineGap: 0,
                })
              x += widths[ci]
            })
            y += segHeight
            consumed += take
            noteDeepest()
            if (consumed < maxLines) nextPageForStream(s)
          }
        }
        if (block.header !== false) {
          drawRow(columns.map((c: any) => mitraInterpolate(String(c.label ?? ''), opts.values)), true)
        }
        for (const row of rows) {
          drawRow(
            columns.map((c: any) => {
              const raw = mitraInterpolate(String(row?.[c.key] ?? ''), opts.values)
              return formatMitraCell(raw, c.format)
            }),
            false,
          )
        }
        // Tabel punya tinggi baris sendiri (di luar grid). Setelah tabel,
        // baris berikutnya dikembalikan ke grid agar kedua kolom sejajar lagi.
        snapToGrid()
        break
      }

      case 'pageBreak':
        nextPageForStream(currentStream)
        break

      case 'signature':
        break

      default:
        break
    }
  }

  // === Halaman 1: header + rules + judul ===
  // Kotak kolom TIDAK digambar di sini; digambar pada pass akhir agar
  // tingginya dapat menyesuaikan isi (dinamis).
  doc.switchToPage(0)
  drawMasterHeader()

  // === Bagi konten jadi dua stream sesuai RENCANA ===
  // Split & reservasi sudah dihitung `planMitraLayout` lewat pengukuran
  // terhadap engine asli, jadi di sini tinggal menerapkannya.
  const splitIndex = plan.splitIndex
  if (opts.reserveSignatureZone === true && plan.reservedPage >= 0) {
    const base = plan.reservedPage === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
    // `reserveShrink` = pemendekan MINIMUM yang membuat tanda tangan muat
    // (dihitung `planMitraLayout`). Default 0 → kotak tidak dipendekkan, dan
    // teks mengisi penuh halaman terakhir tanpa ruang kosong menggantung.
    reservedBottomByPage.set(plan.reservedPage, base - (plan.reserveShrink ?? 0))
  }

  ;(doc as any).__mitraSplit = { ...plan }
  /**
   * Blok dipecah di batas kolom (`splitHead`/`splitTail`): bagian awal menutup
   * kolom KIRI, sisanya membuka kolom KANAN. Tanpa pemecahan, batas hanya boleh
   * jatuh antar-blok (`splitIndex` = blok pertama stream kanan).
   */
  const blocksFirst = plan.splitHead
    ? [...blocks.slice(0, splitIndex), plan.splitHead]
    : blocks.slice(0, splitIndex)
  const blocksSecond = plan.splitTail
    ? [plan.splitTail, ...blocks.slice(splitIndex + 1)]
    : blocks.slice(splitIndex)

  /**
   * Render satu stream (kiri/kanan) sambil menerapkan `spaceAfter` antar blok.
   *
   * Jarak bersifat ADITIF di atas jarak bawaan blok dan hanya diterapkan bila
   * blok berikutnya benar-benar menggambar KONTEN di kolom/halaman yang SAMA.
   * Bila blok sebelumnya sudah mengisi penuh kolom (y pindah ke puncak kolom
   * baru), jarak dilewati — menambah jarak di puncak kolom baru hanya
   * menyisipkan ruang kosong di atas tanpa isi. Jarak juga dilewati bila blok
   * berikutnya bukan blok konten (`signature`/`pageBreak`) atau blok `title`
   * pertama yang dikonsumsi sebagai judul kop.
   *
   * Nilai `spaceAfter` dibulatkan KE ATAS ke garis grid berikutnya: jarak
   * manual tidak boleh menggeser baseline kolom ini dari kolom satunya.
   */
  const willRenderContent = (b: any) => {
    if (!b || b === headerTitleBlock) return false
    // `closing` dicetak DI LUAR kotak (bukan isi kolom), jadi tidak boleh ikut
    // dihitung saat membagi blok ke dua stream.
    return b.type !== 'signature' && b.type !== 'pageBreak' && b.type !== 'closing'
  }
  /**
   * Rekam (halaman, y) awal & akhir tiap blok per stream.
   *
   * Dipakai `planMitraLayout` untuk menghitung tinggi NYATA setiap blok pada
   * satu pass, lalu menentukan titik potong yang membuat kedua kolom berakhir
   * di ketinggian yang sama.
   */
  const blockSpans: Array<Array<{ start: { page: number; y: number }; end: { page: number; y: number } }>> = [[], []]
  const renderSequence = (list: MitraBlock[]) => {
    const stream = currentStream
    let prevSpace = 0
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && prevSpace > 0 && willRenderContent(list[i])) {
        const s = currentStream
        const pageTop = boxTop(streamPage[s]) + 2
        if (y > pageTop + 0.01) {
          const pageBefore = streamPage[s]
          ensureSpace(prevSpace)
          if (streamPage[s] === pageBefore) {
            y += prevSpace
            snapToGrid()
          }
        }
      }
      const start = { page: streamPage[stream], y }
      renderBlock(list[i])
      blockSpans[stream].push({ start, end: { page: streamPage[stream], y } })
      prevSpace = mitraBlockSpaceAfter((list[i] as any)?.spaceAfter)
    }
  }

  // === Stream 0 → kolom KIRI semua halaman ===
  gotoStreamPage(0, 0)
  renderSequence(blocksFirst)
  const streamEndY = [y, y]

  // === Stream 1 → kolom KANAN semua halaman ===
  gotoStreamPage(1, 0)
  renderSequence(blocksSecond)
  streamEndY[1] = y

  // === Pass akhir: gambar kotak kolom DINAMIS untuk SEMUA halaman ===
  // Kotak berhenti di teks terakhir + bantalan (bukan setinggi halaman).
  // Blok tanda tangan berada DI LUAR & DI BAWAH kotak, jadi tidak dihitung
  // sebagai isi kotak.
  const lastPage = pageCount - 1

  // Kotak digambar mengikuti isi; `boxBottom()` sudah memperhitungkan
  // pemendekan halaman yang disisihkan untuk tanda tangan.
  //
  // Batas bawah kotak halaman terakhir DISIMPAN karena tanda tangan harus
  // diletakkan di bawah KOTAK YANG BENAR-BENAR DIGAMBAR — bukan di bawah
  // konstanta `contPageBoxBottom`. Kotak bersifat dinamis dan bisa jauh lebih
  // pendek dari halaman; memakai konstanta membuat tanda tangan dianggap tidak
  // muat padahal ruang di bawah kotak berlimpah.
  let lastPageBoxBottom = boxBottom(lastPage)
  for (let p = 0; p < pageCount; p++) {
    doc.switchToPage(p)
    const contentBottom = deepestByPage[p] ?? boxTop(p)
    const drawnBottom = strokeBoxesForPage(p, contentBottom)
    if (p === lastPage) lastPageBoxBottom = drawnBottom
  }

  /**
   * Tinggi total tabel tanda tangan bila dimulai tepat di bawah
   * `lastPageBoxBottom`. Dipakai `planMitraLayout` untuk memutuskan apakah
   * reservasi perlu, dan seberapa banyak yang harus dipotong. Memakai helper
   * yang SAMA dengan penggambaran agar keputusan tidak menyimpang.
   */
  const signatureGapNeeded = mitraSignatureZoneHeight(doc, opts.signature)
  /**
   * Apakah tanda tangan muat TANPA memendekkan kotak?
   *
   * Aturannya harus SAMA PERSIS dengan `renderMitraSignature` (`tableTop +
   * tableHeight > G.pageHeight - 40`), kalau tidak keputusan pemendekan di
   * `planMitraLayout` akan berbeda dari hasil gambar yang sesungguhnya.
   */
  const signatureFits = lastPageBoxBottom + signatureGapNeeded <= G.pageHeight - 40

  ;(doc as any).__mitraFinalPage = {
    pageDeepest: deepestByPage[lastPage] ?? 0,
    pageCount,
    lastPage,
    lastPageBodyBottom: deepestByPage[lastPage] ?? boxTop(lastPage),
    /** Batas bawah kotak halaman terakhir yang BENAR-BENAR digambar. */
    lastPageBoxBottom,
    /** Jarak minimum yang dibutuhkan tanda tangan di bawah kotak. */
    signatureGapNeeded,
    /** Apakah tanda tangan muat tanpa memendekkan kotak. */
    signatureFits,
    /**
     * Halaman terakhir tiap stream (0-based). Dipakai `planMitraLayout` untuk
     * memilih split: jumlah halaman dokumen = max(stream kiri, stream kanan).
     */
    lastPageStream: [streamPage[0], streamPage[1]] as [number, number],
    /** Halaman yang benar-benar dipendekkan pada render ini (audit). */
    reservedPages: [...reservedBottomByPage.keys()],
    /** (halaman, y) akhir tiap stream — dasar penyeimbangan kolom. */
    streamEnd: [
      { page: streamPage[0], y: streamEndY[0] },
      { page: streamPage[1], y: streamEndY[1] },
    ] as Array<{ page: number; y: number }>,
    /** Rentang vertikal tiap blok per stream (untuk mengukur tinggi nyata). */
    blockSpans,
  }
}

/** Rencana tata letak hasil pengukuran. */
export interface MitraLayoutPlan {
  /**
   * Batas stream. Tanpa `splitHead`: blok pertama kolom KANAN. Dengan
   * `splitHead`: indeks blok yang DIPECAH di batas kolom.
   */
  splitIndex: number
  /** Bagian awal blok `splitIndex` yang menutup kolom KIRI. */
  splitHead?: MitraBlock
  /** Sisa blok `splitIndex` yang membuka kolom KANAN. */
  splitTail?: MitraBlock
  /** Halaman yang kotaknya dipendekkan untuk tanda tangan (-1 = tidak ada). */
  reservedPage: number
  /** Jumlah halaman akhir menurut pengukuran. */
  pageCount: number
  /**
   * Berapa pt kotak halaman `reservedPage` dipendekkan (0 = tidak dipendekkan).
   * Diisi `planMitraLayout` dengan nilai MINIMUM yang membuat tanda tangan muat,
   * supaya ruang kosong yang tertinggal di dalam kotak sekecil mungkin.
   */
  reserveShrink?: number
}

/**
 * Pilih rencana tata letak dengan MENGUKUR ENGINE ASLI.
 *
 * Alih-alih menaksir tinggi blok dengan rumus (yang meleset besar untuk
 * `article` panjang — terukur satu pasal ditaksir 1515pt sementara kolom penuh
 * hanya ±725pt), engine dijalankan utuh pada dokumen SCRATCH lalu
 * `__mitraFinalPage` dibaca. Ini satu-satunya cara yang benar-benar akurat.
 */

/** Baris kosong grid (pt) untuk satu ukuran font. */
function mitraLineGap(doc: any, font: string, size: number): number {
  const pitch = mitraPitch(doc)
  doc.font(font).fontSize(size)
  const natural = doc.heightOfString('Xg', { lineGap: 0 })
  return Math.max(0, pitch - natural)
}

/** Tinggi satu paragraf persis seperti yang digambar `writeText`. */
function measureMitraTextHeight(
  doc: any,
  text: string,
  o: { font: string; size: number; align: MitraAlign; width: number; indent?: number; hang?: number },
): number {
  const indent = o.indent ?? 0
  const hang = o.hang ?? 0
  const firstWidth = o.width - indent
  const restWidth = o.width - indent - hang
  if (hang > 0) {
    const lines = wrapWordsToLines(doc, text, { font: o.font, size: o.size, firstWidth, restWidth })
    return lines.length * mitraPitch(doc)
  }
  const lineGap = mitraLineGap(doc, o.font, o.size)
  doc.font(o.font).fontSize(o.size)
  return doc.heightOfString(text, { width: firstWidth, align: o.align, lineGap })
}

/** Teks dengan placeholder sudah diinterpolasi + token mentah dibersihkan. */
function resolveMitraText(raw: string, values: Record<string, string>): string {
  return scrubRawTokens(mitraInterpolate(raw, values))
}

/**
 * Mark (`**`, `*`, `__`) harus tetap seimbang setelah teks dipecah.
 *
 * `runsToText(parseInlineRuns(x)) !== x` berarti ada pembatas mark yang
 * terpotong — bagian itu tidak boleh dipakai sebagai titik potong.
 */
function marksStayBalanced(text: string): boolean {
  return runsToText(parseInlineRuns(text)) === text
}

/**
 * Cari jumlah kata terbesar yang tingginya masih ≤ `target`, lalu pecah teks.
 *
 * @returns `null` bila seluruh teks muat (tidak perlu pecah), tidak ada satu
 *          kata pun yang muat, atau titik potong merusak mark.
 */
function splitTextAtHeight(
  text: string,
  target: number,
  measure: (candidate: string) => number,
): { head: string; tail: string } | null {
  if (target <= 0) return null
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return null
  if (measure(text) <= target) return null

  let lo = 1
  let hi = words.length - 1
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (measure(words.slice(0, mid).join(' ')) <= target) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (best <= 0) return null

  // Mundur bila titik potong jatuh di dalam pasangan mark.
  for (let take = best; take > 0 && take > best - 12; take--) {
    const head = words.slice(0, take).join(' ')
    const tail = words.slice(take).join(' ')
    if (!tail) return null
    if (marksStayBalanced(head) && marksStayBalanced(tail)) return { head, tail }
  }
  return null
}

/** Blok yang bisa dipecah di batas kolom. */
const SPLITTABLE_TYPES = new Set(['paragraph', 'article', 'list', 'table'])

/**
 * Pecah satu blok pada ketinggian `target` (pt, diukur dari awal blok).
 *
 * Blok dipecah sedekat mungkin dengan `target` supaya kedua kolom berakhir di
 * ketinggian yang sama. `null` = blok ini tidak bisa dipecah (judul, ganti
 * halaman, atau tidak ada satu kata pun yang muat) — pemanggil memakai batas
 * antar-blok.
 */
function splitBlockAtHeight(
  doc: any,
  block: MitraBlock,
  target: number,
  width: number,
  values: Record<string, string>,
): { head: MitraBlock; tail: MitraBlock } | null {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES
  if (!SPLITTABLE_TYPES.has(String(block?.type))) return null

  if (block.type === 'paragraph') {
    const text = resolveMitraText(String(block.text ?? ''), values)
    if (!text.trim()) return null
    const align = mitraBlockAlign(block?.align) ?? 'justify'
    const hang = NUMBERED_ITEM_RE.test(text) ? G.listHangingIndent : 0
    const size = G.font.body
    const parts = splitTextAtHeight(text, target, (candidate) =>
      measureMitraTextHeight(doc, candidate, { font: F.regular, size, align, width, hang }),
    )
    if (!parts) return null
    return { head: { ...block, text: parts.head }, tail: { ...block, text: parts.tail } }
  }

  if (block.type === 'article') {
    const heading = resolveMitraText(String(block.heading ?? ''), values)
    const paragraphs = (block.paragraphs ?? []).map((p: unknown) =>
      resolveMitraText(String(p), values),
    )
    const align = mitraBlockAlign(block?.align)
    // Sama dengan renderer: judul TIDAK mewarisi `align` uraian.
    const headingAlign = mitraBlockAlign(block?.headingAlign) ?? 'center'
    const size = G.font.body

    let acc = 0
    if (heading) {
      // Renderer SELALU memberi jarak sebelum judul pasal (2 baris grid).
      acc += mitraPitch(doc) * 2
      acc += measureMitraTextHeight(doc, heading, {
        font: F.bold,
        size,
        align: headingAlign,
        width,
      })
      if (acc > target) return null
    }

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]
      const h = measureMitraTextHeight(doc, p, {
        font: F.regular,
        size,
        align: align ?? 'justify',
        width,
        hang: NUMBERED_ITEM_RE.test(p) ? G.listHangingIndent : 0,
      })
      if (acc + h <= target) {
        acc += h
        continue
      }
      const remaining = target - acc
      if (remaining <= 0 || i === 0) return null
      const parts = splitTextAtHeight(p, remaining, (candidate) =>
        measureMitraTextHeight(doc, candidate, {
          font: F.regular,
          size,
          align: align ?? 'justify',
          width,
          hang: NUMBERED_ITEM_RE.test(p) ? G.listHangingIndent : 0,
        }),
      )
      if (!parts) {
        // Paragraf tidak bisa dipecah: potong tepat SEBELUM paragraf ini.
        return {
          head: { ...block, paragraphs: paragraphs.slice(0, i) },
          tail: { ...block, heading: '', paragraphs: paragraphs.slice(i) },
        }
      }
      return {
        head: { ...block, paragraphs: [...paragraphs.slice(0, i), parts.head] },
        tail: { ...block, heading: '', paragraphs: [parts.tail, ...paragraphs.slice(i + 1)] },
      }
    }
    return null
  }

  if (block.type === 'list') {
    const items = (block.items ?? []).map((item: any) =>
      typeof item === 'string' ? item : String(item?.text ?? ''),
    )
    const levels = (block.items ?? []).map((item: any) =>
      typeof item === 'object' ? (item?.level ?? 0) : 0,
    )
    const base = Number.isInteger(block.startIndex) ? Number(block.startIndex) : 0
    const textIndent = mitraListTextIndent(doc, block.items ?? [], block.style ?? 'bullet', base)
    const size = G.font.body
    let acc = 0
    for (let i = 0; i < items.length; i++) {
      // Sama dengan renderer & `measureBlockHeight`: teks saja (penanda
      // digambar terpisah) dengan indent konstan.
      const text = resolveMitraText(items[i], values)
      const h = text
        ? measureMitraTextHeight(doc, text, {
            font: F.regular,
            size,
            align: 'left',
            width,
            indent: levels[i] * G.listHangingIndent + textIndent,
          })
        : 0
      if (acc + h <= target) {
        acc += h
        continue
      }
      if (i === 0) return null
      const headItems = items.slice(0, i).map((text: string, idx: number) => ({
        text,
        level: levels[idx],
      }))
      const tailItems = items.slice(i).map((text: string, idx: number) => ({
        text,
        level: levels[i + idx],
      }))
      return {
        head: { ...block, items: headItems },
        tail: { ...block, items: tailItems, startIndex: i },
      }
    }
    return null
  }

  // table: pecah antar-baris (header tetap diulang pada lanjutan).
  const columns = block.columns ?? []
  const rows = block.rows ?? []
  if (columns.length === 0 || rows.length === 0) return null
  const size = G.font.body - 1
  const widths = computeColumnWidths(columns, width)
  let acc = 0
  if (block.header !== false) {
    acc += computeRowHeight(
      doc,
      columns.map((c: any) => String(c.label ?? '')),
      widths,
      size,
      8,
      6,
    )
  }
  for (let i = 0; i < rows.length; i++) {
    const cells = columns.map((c: any) => String(rows[i]?.[c.key] ?? ''))
    const h = computeRowHeight(doc, cells, widths, size, 8, 6)
    if (acc + h <= target) {
      acc += h
      continue
    }
    if (i === 0) return null
    return {
      head: { ...block, rows: rows.slice(0, i) },
      tail: { ...block, rows: rows.slice(i) },
    }
  }
  return null
}

/**
 * Tinggi satu blok (pt) pada lebar kolom tertentu — TANPA menggambar.
 *
 * Dipakai untuk menilai titik potong secara analitis: tinggi bagian-awal
 * diukur pada lebar kolom KIRI, bagian-lanjutan pada lebar kolom KANAN
 * (kedua kolom tidak sama lebar).
 *
 * @param headingGap jarak sebelum judul pasal yang benar-benar dipakai renderer
 *        (0 bila blok dimulai di puncak kolom).
 */
function measureBlockHeight(
  doc: any,
  block: MitraBlock,
  width: number,
  values: Record<string, string>,
  headingGap = 0,
): number {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES
  const size = G.font.body

  if (block?.type === 'paragraph') {
    const text = resolveMitraText(String(block.text ?? ''), values)
    if (!text.trim()) return 0
    return measureMitraTextHeight(doc, text, {
      font: F.regular,
      size,
      align: mitraBlockAlign(block?.align) ?? 'justify',
      width,
      hang: NUMBERED_ITEM_RE.test(text) ? G.listHangingIndent : 0,
    })
  }

  if (block?.type === 'article') {
    const heading = resolveMitraText(String(block.heading ?? ''), values)
    const paragraphs = (block.paragraphs ?? []).map((p: unknown) =>
      resolveMitraText(String(p), values),
    )
    const align = mitraBlockAlign(block?.align)
    // Sama dengan renderer: judul TIDAK mewarisi `align` uraian.
    const headingAlign = mitraBlockAlign(block?.headingAlign) ?? 'center'
    let total = 0
    if (heading) {
      total +=
        headingGap +
        measureMitraTextHeight(doc, heading, { font: F.bold, size, align: headingAlign, width })
    }
    for (const p of paragraphs) {
      total += measureMitraTextHeight(doc, p, {
        font: F.regular,
        size,
        align: align ?? 'justify',
        width,
        hang: NUMBERED_ITEM_RE.test(p) ? G.listHangingIndent : 0,
      })
    }
    return total
  }

  if (block?.type === 'list') {
    const items = block.items ?? []
    const base = Number.isInteger(block.startIndex) ? Number(block.startIndex) : 0
    const textIndent = mitraListTextIndent(doc, items, block.style ?? 'bullet', base)
    let total = 0
    items.forEach((item: any) => {
      const raw = typeof item === 'string' ? item : String(item?.text ?? '')
      const text = resolveMitraText(raw, values)
      if (!text) return
      const level = typeof item === 'object' ? (item?.level ?? 0) : 0
      // Sama dengan renderer: teks dimulai setelah penanda, indent KONSTAN.
      total += measureMitraTextHeight(doc, text, {
        font: F.regular,
        size,
        align: 'left',
        width,
        indent: level * G.listHangingIndent + textIndent,
      })
    })
    return total
  }

  if (block?.type === 'table') {
    const columns = block.columns ?? []
    const rows = block.rows ?? []
    if (columns.length === 0) return 0
    const tableSize = G.font.body - 1
    const widths = computeColumnWidths(columns, width)
    let total = 0
    if (block.header !== false) {
      total += computeRowHeight(
        doc,
        columns.map((c: any) => String(c.label ?? '')),
        widths,
        tableSize,
        8,
        6,
      )
    }
    for (const row of rows) {
      total += computeRowHeight(
        doc,
        columns.map((c: any) => String(row?.[c.key] ?? '')),
        widths,
        tableSize,
        8,
        6,
      )
    }
    return total
  }

  return 0
}

/**
 * Pilih rencana tata letak dengan MENGUKUR ENGINE ASLI.
 *
 * Alih-alih menaksir tinggi blok dengan rumus (yang meleset besar untuk
 * `article` panjang — terukur satu pasal ditaksir 1515pt sementara kolom penuh
 * hanya ±725pt), engine dijalankan utuh pada dokumen SCRATCH lalu
 * `__mitraFinalPage` dibaca. Ini satu-satunya cara yang benar-benar akurat.
 */
export function planMitraLayout(blocks: MitraBlock[], opts: MitraLayoutOptions): MitraLayoutPlan {
  const G = MITRA_GEOMETRY
  const n = blocks?.length ?? 0
  if (n <= 1) return { splitIndex: Math.max(1, n), reservedPage: -1, pageCount: n === 0 ? 0 : 1 }

  const makeDoc = () =>
    new PDFDocument({
      size: [G.pageWidth, G.pageHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
      autoFirstPage: true,
    })

  /** Dokumen ukur dengan font MITRA terdaftar (untuk `splitBlockAtHeight`). */
  const measureDoc = makeDoc()
  measureDoc.registerFont(MITRA_FONT_NAMES.regular, opts.fonts.regular)
  measureDoc.registerFont(MITRA_FONT_NAMES.bold, opts.fonts.bold)
  measureDoc.registerFont(MITRA_FONT_NAMES.italic, opts.fonts.italic)
  measureDoc.registerFont(
    MITRA_FONT_NAMES.boldItalic,
    opts.fonts.boldItalic ?? opts.fonts.bold,
  )

  /**
   * Ukur satu kandidat rencana dengan render sungguhan.
   *
   * `shrink` = berapa pt kotak halaman `reservedPage` dipendekkan. Nilai ini
   * diteruskan ke `renderMitraPass` supaya pengukuran dan render akhir memakai
   * geometri yang sama persis.
   */
  const measure = (
    plan: Pick<MitraLayoutPlan, 'splitIndex' | 'splitHead' | 'splitTail'>,
    reservedPage = -1,
    shrink = 0,
  ) => {
    const doc = makeDoc()
    renderMitraPass(doc, blocks, opts, {
      ...plan,
      reservedPage,
      pageCount: 1,
      reserveShrink: shrink,
    })
    const meta = (doc as any).__mitraFinalPage as
      | {
        pageCount: number
        lastPageStream: [number, number]
        lastPageBoxBottom: number
        signatureGapNeeded: number
        signatureFits: boolean
        streamEnd: Array<{ page: number; y: number }>
        blockSpans: Array<Array<{ start: { page: number; y: number }; end: { page: number; y: number } }>>
      }
      | undefined
    const end = meta?.streamEnd ?? [{ page: 0, y: 0 }, { page: 0, y: 0 }]
    return {
      pageCount: meta?.pageCount ?? 1,
      leftPages: (meta?.lastPageStream?.[0] ?? 0) + 1,
      rightPages: (meta?.lastPageStream?.[1] ?? 0) + 1,
      /** Tinggi global (pt) tempat tiap kolom berakhir. */
      endGlobal: [
        mitraGlobalY(end[0].page, end[0].y),
        mitraGlobalY(end[1].page, end[1].y),
      ] as [number, number],
      blockSpans: meta?.blockSpans ?? [[], []],
      lastPageBoxBottom: meta?.lastPageBoxBottom ?? 0,
      signatureGapNeeded: meta?.signatureGapNeeded ?? 0,
      signatureFits: meta?.signatureFits ?? false,
    }
  }
  /**
   * --- 1. Bagi konten jadi dua stream SETINGGI MUNGKIN SAMA ---
   *
   * Layout booklet: kolom KIRI memuat paruh awal dokumen, kolom KANAN paruh
   * akhir. Kalau batas hanya boleh jatuh antar-blok, dokumen yang blok-bloknya
   * besar (pasal panjang) menghasilkan kolom yang jauh berbeda tinggi — bahkan
   * satu kolom kosong sehalaman penuh.
   *
   * Dua hal membuat perhitungan ini tidak boleh memakai satu pengukuran saja:
   *  1. KEDUA KOLOM LEBARNYA BERBEDA (kiri ±260pt, kanan ±248pt), sehingga
   *     paragraf yang sama memakan baris lebih banyak di kolom kanan.
   *  2. Titik potong boleh jatuh DI TENGAH blok.
   * Karena itu tinggi setiap blok diukur pada lebar kolom masing-masing, lalu
   * porsi blok yang dipecah dihitung agar kedua kolom berakhir di y yang sama.
   */
  const fullLeft = measure({ splitIndex: n })
  const fullRight = measure({ splitIndex: 0 })
  const spansL = fullLeft.blockSpans[0]
  const spansR = fullRight.blockSpans[1]
  const startL = (i: number) => mitraGlobalY(spansL[i].start.page, spansL[i].start.y)
  const endL = (i: number) => mitraGlobalY(spansL[i].end.page, spansL[i].end.y)
  const startR = (i: number) => mitraGlobalY(spansR[i].start.page, spansR[i].start.y)
  const endR = (i: number) => mitraGlobalY(spansR[i].end.page, spansR[i].end.y)
  /** Tinggi seluruh dokumen bila dicetak di kolom KANAN (yang lebih sempit). */
  const totalRight = spansR.length > 0 ? endR(spansR.length - 1) : 0

  /**
   * Cari titik potong dengan MENILAI tinggi secara analitis.
   *
   * Untuk setiap kandidat, tinggi bagian-awal diukur pada lebar kolom KIRI dan
   * bagian-lanjutan pada lebar kolom KANAN — keduanya berbeda, dan itu sebabnya
   * pendekatan "bagi dua blok" saja tidak pernah sejajar.
   */
  const widthL = columnInnerWidth(0)
  const widthR = columnInnerWidth(1)

  const evaluate = (k: number, headTarget: number) => {
    const parts = splitBlockAtHeight(measureDoc, blocks[k], headTarget, widthL, opts.values)
    if (!parts) return null
    const headH = measureBlockHeight(
      measureDoc,
      parts.head,
      widthL,
      opts.values,
      mitraPitch(measureDoc) * 2,
    )
    const tailH = measureBlockHeight(measureDoc, parts.tail, widthR, opts.values, 0)
    return {
      parts,
      diff: startL(k) + headH - ((totalRight - endR(k)) + tailH),
    }
  }

  let splitIndex = n
  let splitHead: MitraBlock | undefined
  let splitTail: MitraBlock | undefined

  /**
   * Cari tinggi bagian-awal terbaik untuk satu blok batas (model analitis).
   *
   * Mengembalikan juga `target` supaya pemanggil bisa mempersempit pencarian
   * berbasis render di sekitar tebakan ini.
   */
  const searchSplit = (k: number, hL: number) => {
    let lo = 0
    let hi = hL
    let best: { parts: { head: MitraBlock; tail: MitraBlock }; diff: number; target: number } | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      const ev = evaluate(k, mid)
      if (!ev) {
        lo = mid
        continue
      }
      if (Math.abs(ev.diff) < bestScore) {
        bestScore = Math.abs(ev.diff)
        best = { ...ev, target: mid }
      }
      if (Math.abs(ev.diff) <= 0.5) break
      if (ev.diff > 0) hi = mid
      else lo = mid
    }
    return best
  }

  for (let k = 0; k < spansL.length; k++) {
    const hL = endL(k) - startL(k)
    const hR = endR(k) - startR(k)
    if (hL <= 0 && hR <= 0) continue // blok tanpa isi (mis. signature)

    // Perkiraan awal: porsi blok yang harus masuk kolom KIRI.
    const f = (totalRight - endR(k) - startL(k) + hR) / (hL + hR)
    if (f > 1) continue
    splitIndex = k
    if (f <= 0) break // titik seimbang jatuh di celah antar-blok
    if (f >= 1) {
      splitIndex = k + 1
      break
    }

    const ev = searchSplit(k, hL)
    if (ev) {
      splitHead = ev.parts.head
      splitTail = ev.parts.tail
    }
    break
  }

  let plan: Pick<MitraLayoutPlan, 'splitIndex' | 'splitHead' | 'splitTail'> = {
    splitIndex,
    splitHead,
    splitTail,
  }

  /**
   * Penyeimbangan AKHIR memakai render SUNGGUHAN.
   *
   * Model analitis mengabaikan satu hal yang hanya terlihat saat mengalir:
   * paragraf yang terpotong batas halaman memakai satu baris tambahan, jadi
   * tinggi total bergeser dalam kelipatan baris. Pencarian di bawah mengukur
   * selisih NYATA pada beberapa titik di sekitar tebakan analitis (rentang
   * ±4 baris) dan memakai rencana dengan selisih terkecil.
   */
  if (splitHead && splitTail) {
    const PITCH = mitraPitch(measureDoc)
    const hL = endL(splitIndex) - startL(splitIndex)
    const ev = searchSplit(splitIndex, hL)
    let lo = Math.max(0, (ev?.target ?? 0) - PITCH * 4)
    let hi = Math.min(hL, (ev?.target ?? hL) + PITCH * 4)
    let bestPlan = plan
    let bestAbs = Number.POSITIVE_INFINITY
    for (let iter = 0; iter < 6; iter++) {
      const mid = (lo + hi) / 2
      const parts = splitBlockAtHeight(measureDoc, blocks[splitIndex], mid, widthL, opts.values)
      if (!parts) {
        lo = mid
        continue
      }
      const candidate = { splitIndex, splitHead: parts.head, splitTail: parts.tail }
      const m = measure(candidate)
      const d = m.endGlobal[0] - m.endGlobal[1]
      if (Math.abs(d) < bestAbs) {
        bestAbs = Math.abs(d)
        bestPlan = candidate
      }
      if (Math.abs(d) <= 0.5) break
      if (d > 0) hi = mid
      else lo = mid
    }
    plan = bestPlan
  }
  const isBalanced = (m: { leftPages: number; rightPages: number }) =>
    m.leftPages > 0 && m.rightPages > 0
  if (!isBalanced(measure(plan))) {
    // Jaring pengaman: dokumen sangat pendek / blok raksasa.
    plan = { splitIndex: Math.max(1, Math.round(n / 2)) }
  }

  // --- 2. Tentukan halaman yang perlu disisihkan untuk tanda tangan ---
  if (opts.reserveSignatureZone !== true) {
    return { ...plan, reservedPage: -1, pageCount: measure(plan).pageCount }
  }
  /**
   * Reservasi bersifat KONDISIONAL dan sehemat mungkin.
   *
   * Memendekkan halaman terakhir membuang ruang yang sebenarnya terpakai: teks
   * yang tadinya mengisi penuh halaman terakhir ditarik ke halaman berikutnya,
   * sehingga menyisakan ruang kosong besar DI DALAM kotak halaman terakhir
   * (terukur pada kontrak nyata: kotak hal. 8 turun dari 761 → 551pt sementara
   * teks berhenti di 532pt — menyisakan ~219pt kosong yang terlihat
   * "menggantung" dan membuat teks yang seharusnya menyambung jadi terputus).
   *
   * Bila halaman terakhir masih menyisakan ruang cukup di bawah KOTAK yang
   * benar-benar digambar, tanda tangan sudah muat di sana tanpa memendekkan
   * apa pun. Inilah kondisi normal (master acuan: 8 halaman, tanda tangan di
   * halaman terakhir tepat di bawah kotak).
   */
  const base = measure(plan, -1)
  if (base.signatureFits) {
    return { ...plan, reservedPage: -1, pageCount: base.pageCount }
  }

  /**
   * Tanda tangan TIDAK muat di bawah kotak halaman terakhir. Cari pemendekan
   * TERKECIL yang membuatnya muat, bukan 210pt tetap: makin sedikit yang
   * dipotong, makin sedikit ruang kosong yang tertinggal di dalam kotak.
   *
   * Pemendekan penuh (`signatureGapNeeded`) selalu membuat tanda tangan muat,
   * jadi batas atas pencarian pasti valid.
   */
  const reservedPage = base.pageCount - 1
  const fullShrink = Math.ceil(base.signatureGapNeeded)
  let shrinkLo = 0
  let shrinkHi = fullShrink
  while (shrinkLo < shrinkHi) {
    const mid = (shrinkLo + shrinkHi) >> 1
    if (measure(plan, reservedPage, mid).signatureFits) shrinkHi = mid
    else shrinkLo = mid + 1
  }
  return {
    ...plan,
    reservedPage,
    pageCount: measure(plan, reservedPage, shrinkLo).pageCount,
    reserveShrink: shrinkLo,
  }
}
/**
 * Signature block — master: label di area bawah halaman terakhir, dua pilar
 * (PIHAK PERTAMA di kolom kiri, PIHAK KEDUA di kolom kanan).
 *
 * Tidak pernah menimpa body: bila ruang bawah halaman terakhir tidak cukup,
 * signature dipindah ke halaman baru yang tetap ber-border.
 */
export function renderMitraSignature(
  doc: any,
  o: MitraSignatureOptions,
): void {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES
  const T = G.signatureTable

  const left = T.left
  const divider = T.divider
  const right = T.right
  // Padding teks dalam sel agar tidak menempel garis.
  const cellPad = SIG_CELL_PAD

  /**
   * Baris + tinggi dihitung helper BERSAMA dengan `planMitraLayout`, supaya
   * keputusan "tanda tangan muat atau tidak" memakai angka yang sama dengan
   * hasil gambar.
   */
  const { rows, heights, leftW, rightW, textW } = mitraSignatureRows(doc, o)
  const tableHeight = heights.reduce((a, b) => a + b, 0)

  const finalPage = (doc as any).__mitraFinalPage as
    | {
        pageDeepest: number
        pageCount: number
        lastPage: number
        lastPageBodyBottom: number
        /** Batas bawah kotak halaman terakhir yang benar-benar digambar. */
        lastPageBoxBottom?: number
      }
    | undefined
  let lastPage = finalPage?.lastPage ?? (doc.bufferedPageRange?.().count ?? 1) - 1

  /**
   * Batas bawah kotak halaman terakhir yang BENAR-BENAR DIGAMBAR.
   *
   * Ini BUKAN `contPageBoxBottom`. Kotak kolom bersifat dinamis dan bisa jauh
   * lebih pendek dari halaman; memakai konstanta membuat tanda tangan dianggap
   * "tidak muat" padahal ruang di bawah kotak masih berlimpah. Inilah yang dulu
   * mendorong tanda tangan ke halaman baru tanpa border.
   */
  const boxBottomOnLast =
    finalPage?.lastPageBoxBottom ??
    (lastPage === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom)

  /**
   * Tempatkan teks penutup + tabel tanda tangan.
   *
   * ATURAN KERAS: keduanya harus berada DI BAWAH kotak kolom, tidak boleh
   * menembusnya. Bila blok penutup ada, ia mengisi jarak antara kotak dan
   * tabel (`closing.gapFromBox` lalu tinggi teks), sehingga tabel tidak
   * melompat jauh seperti saat `gapFromBox` 50 dipakai sendirian.
   */
  const closingWrapped = wrapMitraClosingLines(doc, o.closingLines ?? [])
  const closingH = mitraClosingHeight(closingWrapped)
  let closingTop = boxBottomOnLast + (closingWrapped.length > 0 ? G.closing.gapFromBox : 0)
  let tableTop = closingWrapped.length > 0
    ? closingTop + closingH
    : boxBottomOnLast + T.gapFromBox

  if (tableTop + tableHeight > G.pageHeight - 40) {
    // Tidak muat di bawah kotak pada halaman ini: halaman baru ber-border.
    doc.addPage()
    lastPage += 1
    closingTop = G.contPageBoxTop + 40
    tableTop = closingWrapped.length > 0 ? closingTop + closingH : G.contPageBoxTop + 40
  }

  doc.switchToPage(lastPage)
  renderMitraClosing(doc, closingWrapped, closingTop, lastPage)

  /**
   * Rekam posisi tabel yang BENAR-BENAR digambar (audit + verifikasi).
   * `page` dipakai untuk membuktikan tanda tangan tidak menambah halaman.
   */
  ;(doc as any).__mitraSignatureBox = {
    page: lastPage,
    top: tableTop,
    bottom: tableTop + tableHeight,
    height: tableHeight,
    /** Kotak kolom yang jadi acuan: tanda tangan harus di bawah nilai ini. */
    boxBottomOnLast,
    /** Posisi teks penutup (0 baris = tidak ada blok penutup). */
    closingTop,
    closingBottom: closingTop + closingH,
    closingLineCount: closingWrapped.length,
  }

  // Garis tabel
  doc.save()
  doc.lineWidth(G.borderWidth).strokeColor('#000000')
  const tableBottom = tableTop + tableHeight
  doc.rect(left, tableTop, right - left, tableHeight).stroke()
  doc.moveTo(divider, tableTop).lineTo(divider, tableBottom).stroke()
  let y = tableTop
  for (let i = 0; i < heights.length - 1; i++) {
    y += heights[i]
    doc.moveTo(left, y).lineTo(right, y).stroke()
  }
  doc.restore()

  // Isi baris: teks dibungkus & dipusatkan dalam sel.
  const centerIn = (x0: number, w: number, text: string, top: number, rowH: number, bold: boolean) => {
    if (!text) return
    doc.font(bold ? F.bold : F.regular).fontSize(G.font.signature).fillColor('#000000')
    const h = doc.heightOfString(text, { width: textW(w), align: 'center' })
    const offsetY = Math.max((rowH - h) / 2, 3)
    doc.text(text, x0 + cellPad, top + offsetY, { width: textW(w), align: 'center' })
  }

  let rowTop = tableTop
  rows.forEach((row, i) => {
    const h = heights[i]
    centerIn(left, leftW, row.left, rowTop, h, row.bold === true)
    centerIn(divider, rightW, row.right, rowTop, h, row.bold === true)
    rowTop += h
  })
}
