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
import { hasInlineMarks, parseInlineRuns, type InlineRun } from './inline-marks'
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
 * Batas atas `spaceAfter` (pt) — SAMA dengan `MAX_BLOCK_SPACE_AFTER` di
 * `template-schema.validator.ts`. Digandakan (bukan diimpor) karena modul ini
 * berada di `contracts/`, sedangkan validator di `contract-templates/` yang
 * bergantung pada `contracts/` — mengimpor ke arah sebaliknya akan membuat
 * siklus modul.
 */
export const MITRA_MAX_BLOCK_SPACE_AFTER = 40

/**
 * Jarak vertikal TAMBAHAN di bawah satu blok (`block.spaceAfter`), satuan pt.
 *
 * Bersifat ADITIF di atas jarak bawaan renderer: nilai tak sah / `undefined` /
 * `<= 0` → `0` (tanpa jarak tambahan), sehingga template lama menghasilkan PDF
 * yang sama persis. Diterapkan hanya bila blok berikutnya masih berada di
 * kolom/halaman yang sama — lihat `renderMitraPass`.
 */
export function mitraBlockSpaceAfter(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const n = Math.round(value)
  if (n <= 0 || n > MITRA_MAX_BLOCK_SPACE_AFTER) return 0
  return n
}

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

    doc.font(font).fontSize(size)
    // Tinggi baris HARUS sama dengan jarak antar-baris PDFKit pada jalur normal
    // (heightOfString 1 baris dgn lineGap), supaya leading konsisten 15.8pt.
    const lineHeight = doc.heightOfString('Xg', { lineGap: G.lineGap })
    const fullWidth = colInnerWidth(s)

    if (o.gapBefore) {
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
        lineGap: G.lineGap,
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
      doc.font(font).fontSize(size)
      const spaceW = doc.widthOfString(' ')
      const widthOfWords = (ws: string[]) =>
        ws.reduce((a, w) => a + doc.widthOfString(w), 0) + Math.max(0, ws.length - 1) * spaceW

      const firstWidth = fullWidth - indent
      const restWidth = fullWidth - indent - hang
      const lines: string[] = []
      const words = text.split(/\s+/).filter(Boolean)
      let cur: string[] = []
      let curWidth = firstWidth
      for (const w of words) {
        const test = [...cur, w]
        if (widthOfWords(test) <= curWidth || cur.length === 0) {
          cur = test
        } else {
          lines.push(cur.join(' '))
          cur = [w]
          curWidth = restWidth
        }
      }
      if (cur.length) lines.push(cur.join(' '))

      for (let li = 0; li < lines.length; li++) {
        if (y + lineHeight > boxBottom(streamPage[s])) nextPageForStream(s)
        const isFirst = li === 0
        const isLast = li === lines.length - 1
        const lineIndent = isFirst ? indent : indent + hang
        const lineWidth = isFirst ? firstWidth : restWidth
        const lineX = colX(s) + lineIndent
        doc.font(font).fontSize(size).fillColor('#000000')

        if (align === 'justify' && !isLast && lines[li].includes(' ')) {
          drawJustifiedLine(doc, lines[li], lineX, y, lineWidth, font, size)
        } else {
          doc.text(lines[li], lineX, y, {
            width: lineWidth,
            align: align === 'justify' ? 'left' : align,
            lineGap: G.lineGap,
            lineBreak: false,
          })
        }
        y += lineHeight
      }
      y += o.gapAfter ?? G.paragraphGap
      noteDeepest()
      return
    }

    // --- Modus normal: alur paragraf lintas halaman. ---
    const measure = (t: string) =>
      doc.heightOfString(t, { width: fullWidth - indent, align, lineGap: G.lineGap })

    let remaining = text
    while (remaining) {
      const avail = boxBottom(streamPage[s]) - y
      const fullH = measure(remaining)
      if (fullH <= avail) {
        doc.font(font).fontSize(size).fillColor('#000000')
        doc.text(remaining, colX(s) + indent, y, {
          width: fullWidth - indent,
          align,
          lineGap: G.lineGap,
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
      doc.text(chunk, colX(s) + indent, y, {
        width: fullWidth - indent,
        align,
        lineGap: G.lineGap,
      })
      y += chunkH
      remaining = words.slice(best).join(' ')
      if (remaining) nextPageForStream(s)
    }

    y += o.gapAfter ?? G.paragraphGap
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

    doc.font(font).fontSize(size)
    // Tinggi baris SAMA dengan jalur lama: bersumber dari font acuan, BUKAN dari
    // mark. Inilah yang membuat baris bermark setinggi baris tanpa mark sehingga
    // paginasi tidak bergeser (dibuktikan uji jumlah halaman).
    const lineHeight = doc.heightOfString('Xg', { lineGap: G.lineGap })
    const fullWidth = colInnerWidth(s)

    const firstWidth = fullWidth - indent
    const restWidth = fullWidth - indent - hang
    // Bungkus LEBIH DULU supaya keputusan pindah halaman memakai jumlah baris nyata.
    const lines = hang > 0
      ? wrapRunsToLines(doc, runs, restWidth, MITRA_RUN_FONTS, size, { firstLineWidth: firstWidth })
      : wrapRunsToLines(doc, runs, firstWidth, MITRA_RUN_FONTS, size)

    if (o.gapBefore) {
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
      drawRunsLine(doc, lines[li], lineX, y, lineWidth, MITRA_RUN_FONTS, size, lineAlign)
      y += lineHeight
    }

    y += o.gapAfter ?? G.paragraphGap
    noteDeepest()
  }

  const NUMBERED_ITEM = /^(?:\d{1,2}|[a-z])\.\s/
  const paragraphOpts = (text: string, align?: MitraAlign) => {
    const base = NUMBERED_ITEM.test(mitraInterpolate(text, opts.values))
      ? { gapAfter: G.paragraphGap, hangingIndent: G.listHangingIndent }
      : { gapAfter: G.paragraphGap }
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
          gapBefore: 2,
          gapAfter: G.headingGapAfter,
        })
        break

      case 'subtitle':
        writeText(block.text ?? '', {
          font: F.bold,
          size: G.font.body - 2,
          align: 'center',
          gapBefore: 2,
          gapAfter: G.headingGapAfter,
        })
        break

      case 'paragraph':
        writeRuns(block.text ?? '', paragraphOpts(block.text ?? '', mitraBlockAlign(block?.align)))
        break

      case 'article': {
        const align = mitraBlockAlign(block?.align)
        // `headingAlign`: perataan KHUSUS judul pasal (PASAL 1 ...), terpisah
        // dari `align` blok yang tetap hanya berlaku untuk uraian. Urutan
        // prioritas: headingAlign → align (perilaku Fase 2d) → 'center'
        // (perilaku asli, tanpa properti apa pun).
        const headingAlign = mitraBlockAlign(block?.headingAlign)
        if (block.heading) {
          writeText(block.heading, {
            font: F.bold,
            size: G.font.body,
            // Tanpa keduanya, judul tetap center seperti sebelumnya.
            align: headingAlign ?? align ?? 'center',
            gapBefore: 2,
            gapAfter: G.headingGapAfter,
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
        items.forEach((item: any, i: number) => {
          const raw = typeof item === 'string' ? item : (item?.text ?? '')
          const level = typeof item === 'object' ? (item?.level ?? 0) : 0
          const prefix = listPrefix(block.style ?? 'bullet', i)
          writeText(`${prefix} ${raw}`, {
            indent: level * G.listHangingIndent,
            hangingIndent: G.listHangingIndent,
            gapAfter: 2,
            align: 'left',
          })
        })
        y += 2
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
        y += 4
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
  const blocksFirst = blocks.slice(0, splitIndex)
  const blocksSecond = blocks.slice(splitIndex)

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
   */
  const willRenderContent = (b: any) => {
    if (!b || b === headerTitleBlock) return false
    return b.type !== 'signature' && b.type !== 'pageBreak'
  }
  const renderSequence = (list: MitraBlock[]) => {
    let prevSpace = 0
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && prevSpace > 0 && willRenderContent(list[i])) {
        const s = currentStream
        const pageTop = boxTop(streamPage[s]) + 2
        if (y > pageTop + 0.01) {
          const pageBefore = streamPage[s]
          ensureSpace(prevSpace)
          if (streamPage[s] === pageBefore) y += prevSpace
        }
      }
      renderBlock(list[i])
      prevSpace = mitraBlockSpaceAfter((list[i] as any)?.spaceAfter)
    }
  }

  // === Stream 0 → kolom KIRI semua halaman ===
  gotoStreamPage(0, 0)
  renderSequence(blocksFirst)

  // === Stream 1 → kolom KANAN semua halaman ===
  gotoStreamPage(1, 0)
  renderSequence(blocksSecond)

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
  const signatureGapNeeded = G.signatureTable.gapFromBox
    + mitraSignatureTableHeight(doc, opts.signature)
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
  }
}

/** Rencana tata letak hasil pengukuran. */
export interface MitraLayoutPlan {
  /** Indeks pemisahan stream. */
  splitIndex: number
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

  /**
   * Ukur satu kandidat split dengan render sungguhan.
   *
   * `shrink` = berapa pt kotak halaman `reservedPage` dipendekkan. Nilai ini
   * diteruskan ke `renderMitraPass` supaya pengukuran dan render akhir memakai
   * geometri yang sama persis.
   */
  const measure = (splitIndex: number, reservedPage = -1, shrink = 0) => {
    const doc = makeDoc()
    renderMitraPass(doc, blocks, opts, { splitIndex, reservedPage, pageCount: 1, reserveShrink: shrink })
    const meta = (doc as any).__mitraFinalPage as
      | {
        pageCount: number
        lastPageStream: [number, number]
        lastPageBoxBottom: number
        signatureGapNeeded: number
        signatureFits: boolean
      }
      | undefined
    return {
      pageCount: meta?.pageCount ?? 1,
      leftPages: (meta?.lastPageStream?.[0] ?? 0) + 1,
      rightPages: (meta?.lastPageStream?.[1] ?? 0) + 1,
      lastPageBoxBottom: meta?.lastPageBoxBottom ?? 0,
      signatureGapNeeded: meta?.signatureGapNeeded ?? 0,
      signatureFits: meta?.signatureFits ?? false,
    }
  }

  // --- 1. Cari split dengan jumlah halaman paling sedikit ---
  // Syarat penting: KEDUA stream harus terisi. Split yang menaruh semua blok di
  // satu stream menghasilkan satu kolom kosong dan halaman lebih sedikit, tetapi
  // itu bukan layout booklet — jadi kandidat semacam itu dibuang.
  const isBalanced = (m: { leftPages: number; rightPages: number }) =>
    m.leftPages > 0 && m.rightPages > 0

  let lo = 1
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const m = measure(mid)
    if (!isBalanced(m) || m.leftPages >= m.rightPages) hi = mid
    else lo = mid + 1
  }
  const candidates = new Set<number>([lo - 1, lo, lo + 1].filter(k => k >= 1 && k <= n - 1))
  let bestSplit = lo
  let bestScore = Number.POSITIVE_INFINITY
  for (const k of candidates) {
    const m = measure(k)
    if (!isBalanced(m)) continue
    const score = m.pageCount * 1000 + Math.abs(m.leftPages - m.rightPages)
    if (score < bestScore) {
      bestScore = score
      bestSplit = k
    }
  }
  // Bila tidak ada kandidat yang seimbang (dokumen sangat pendek / blok raksasa),
  // pakai titik tengah sebagai jaring pengaman.
  if (bestScore === Number.POSITIVE_INFINITY) bestSplit = Math.max(1, Math.round(n / 2))

  // --- 2. Tentukan halaman yang perlu disisihkan untuk tanda tangan ---
  if (opts.reserveSignatureZone !== true) {
    return { splitIndex: bestSplit, reservedPage: -1, pageCount: measure(bestSplit).pageCount }
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
  const base = measure(bestSplit, -1)
  if (base.signatureFits) {
    return { splitIndex: bestSplit, reservedPage: -1, pageCount: base.pageCount }
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
    if (measure(bestSplit, reservedPage, mid).signatureFits) shrinkHi = mid
    else shrinkLo = mid + 1
  }
  return {
    splitIndex: bestSplit,
    reservedPage,
    pageCount: measure(bestSplit, reservedPage, shrinkLo).pageCount,
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
   * Tempatkan tabel tanda tangan.
   *
   * ATURAN KERAS: tanda tangan harus berada DI BAWAH kotak kolom, tidak boleh
   * menembusnya. Jadi `tableTop` = tepat `gapFromBox` di bawah batas bawah kotak
   * yang benar-benar digambar, dan tidak boleh melewati batas halaman.
   */
  let tableTop = boxBottomOnLast + T.gapFromBox

  if (tableTop + tableHeight > G.pageHeight - 40) {
    // Tidak muat di bawah kotak pada halaman ini: halaman baru ber-border.
    doc.addPage()
    lastPage += 1
    tableTop = G.contPageBoxTop + 40
  }

  doc.switchToPage(lastPage)

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
