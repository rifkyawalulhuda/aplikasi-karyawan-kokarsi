/**
 * Renderer dokumen MITRA (Perjanjian Kemitraan) — pintu TUNGGAL.
 *
 * Modul ini adalah SATU-SATUNYA tempat yang tahu cara merakit PDF MITRA dari
 * blok konten + nilai placeholder. Dipakai oleh:
 *  1. Generate kontrak  → `ContractDocumentService` (jalur snapshot)
 *  2. Pratinjau editor  → endpoint `.../preview-pdf` (draft belum tersimpan)
 *
 * Karena keduanya memanggil fungsi yang sama, hasil pratinjau tidak mungkin
 * menyimpang dari hasil generate.
 *
 * Modul ini MURNI (tanpa NestJS/Prisma): masuk blok + nilai, keluar buffer PDF.
 * Itulah kenapa modul `contract-templates` dapat memakainya tanpa membuat
 * ketergantungan sirkular ke `contracts`.
 */
import PDFDocument from 'pdfkit'
import { interpolate } from './contract-block-renderer'
import {
  MITRA_HEADER_CHROME,
  renderMitraLayout,
  renderMitraSignature,
  type MitraBlock,
  type MitraSignatureOptions,
} from './mitra-layout.engine'

/** Path font Times New Roman. */
export function resolveMitraFontDir(): string {
  return process.env.FONT_DIR
    ?? (process.platform === 'win32'
      ? 'C:/Windows/Fonts'
      : '/usr/share/fonts/truetype/msttcorefonts')
}

/** Nama file font MITRA (relatif terhadap `resolveMitraFontDir()`). */
export function resolveMitraFonts() {
  const dir = resolveMitraFontDir()

  const fs = require('node:fs') as typeof import('node:fs')
  const exists = (p: string) => {
    try { return fs.existsSync(p) } catch { return false }
  }

  // `timesbi.ttf` (bold-italic) tidak selalu ada di semua paket msttcorefonts.
  // Bila tidak ada, jatuh ke BOLD supaya teks yang diminta tebal tetap terlihat
  // tebal — dokumen tetap terbentuk, hanya tanpa kemiringan.
  const boldItalic = `${dir}/timesbi.ttf`

  return {
    regular: `${dir}/times.ttf`,
    bold: `${dir}/timesbd.ttf`,
    italic: `${dir}/timesi.ttf`,
    boldItalic: exists(boldItalic) ? boldItalic : `${dir}/timesbd.ttf`,
  }
}

/** Path absolut logo kop MITRA. */
export function resolveMitraLogoPath(assetRoot: string): string {
  return `${assetRoot}/contract-logo-mitra.jpg`
}

export interface MitraDocumentRenderOptions {
  /** Blok konten bahasa Indonesia (`contentDefinition.languages.id`). */
  blocks: MitraBlock[]
  /** Nilai placeholder (key → displayValue). */
  values: Record<string, string>
  /** Judul dokumen. Bila kosong, diambil dari blok `title` lalu fallback. */
  title?: string
  /** Nama template — fallback judul bila blok `title` tidak ada. */
  fallbackTitle?: string
  /** Label nomor kontrak (mis. "Nomor: 220/KUKP-SII/2026"). */
  numberLabel?: string
  /** Label tanggal (mis. "Tanggal 31 Agustus 2026"). */
  dateLabel?: string
  logoPath?: string
  fonts: { regular: string; bold: string; italic: string; boldItalic?: string }
  /**
   * Override nama/jabatan pada blok tanda tangan. Dipakai jalur generate agar
   * tetap dapat jatuh ke data karyawan bila placeholder-nya kosong; pratinjau
   * cukup mengandalkan `values` (data contoh selalu terisi).
   */
  signature?: {
    chairmanName?: string
    employeeName?: string
    jobRole?: string
  }
  /**
   * Sisihkan ruang tanda tangan di halaman terakhir (default: true).
   *
   * `true`  → halaman terakhir dipendekkan 210pt agar tabel tanda tangan muat
   *           DI BAWAH kotak. Berguna bila kotak halaman terakhir nyaris penuh.
   * `false` → kotak memakai tinggi penuh; engine meletakkan tanda tangan di
   *           bawah batas kotak yang BENAR-BENAR digambar (`lastPageBoxBottom`),
   *           sehingga tidak ada ruang kosong di dalam kotak.
   */
  reserveSignatureZone?: boolean
}

/**
 * Gambar header + aturan + judul, alirkan body dua kolom, lalu tanda tangan.
 *
 * Tidak mengakhiri dokumen (`doc.end()`) — pemanggil yang menentukan.
 */
export function renderMitraDocumentInto(doc: any, opts: MitraDocumentRenderOptions): void {
  const { blocks, values } = opts

  const titleBlock = blocks.find(b => b?.type === 'title')
  const title = (opts.title
    ?? (titleBlock?.text ? interpolate(String(titleBlock.text), values) : opts.fallbackTitle)
    ?? 'PERJANJIAN KEMITRAAN').toUpperCase()

  // Signature: dua pilar di bawah kotak kolom, mengikuti master.
  //
  // Teks STATIS dapat dikonfigurasi per-template lewat blok `signature`
  // (Opsi D): label pilar (`leftRole`/`rightRole`), nama perusahaan/pihak
  // (`leftHeader`/`rightHeader`), dan jabatan (`leftParty`/`rightParty`).
  // Field yang kosong → fallback chrome (data lama tetap 1:1 dengan master).
  // Nama ORANG tetap dari data kontrak, bukan teks template.
  const sig = blocks.find((b: any) => b?.type === 'signature') as any
  const text = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined

  const chairman = opts.signature?.chairmanName ?? values['settings.cooperativeChairmanName'] ?? ''
  const employeeName = opts.signature?.employeeName ?? values['employee.fullName'] ?? ''
  const jobRole = opts.signature?.jobRole ?? values['employee.jobRole'] ?? ''

  /**
   * Isi tanda tangan dibangun SEKALI, lalu dipakai DUA kali:
   *  1. `renderMitraLayout` — untuk MENGUKUR tinggi tabel secara akurat, supaya
   *     keputusan "perlu memendekkan halaman terakhir atau tidak" memakai angka
   *     nyata (panjang nama perusahaan/jabatan memengaruhi word-wrap).
   *  2. `renderMitraSignature` — untuk menggambar.
   * Karena satu objek, pengukuran dan hasil gambar tidak mungkin menyimpang.
   */
  const signature: MitraSignatureOptions = {
    // Label pilar — dari field lama `leftRole`/`rightRole` (seeder mengisinya
    // dengan `firstPartyLabel` = "PIHAK PERTAMA"/"PIHAK KEDUA").
    leftLabel: text(sig?.leftRole),
    rightLabel: text(sig?.rightRole),
    leftHeader: text(sig?.leftHeader) ?? MITRA_HEADER_CHROME.signature.leftHeader,
    rightHeader: text(sig?.rightHeader) ?? MITRA_HEADER_CHROME.signature.rightHeader,
    leftName: chairman,
    rightName: employeeName,
    leftRole: text(sig?.leftParty) ?? MITRA_HEADER_CHROME.signature.leftRoleLabel,
    rightRole: text(sig?.rightParty)
      ?? (jobRole ? `( ${jobRole} )` : MITRA_HEADER_CHROME.signature.rightRoleFallback),
  }

  renderMitraLayout(doc, blocks, {
    values,
    title,
    numberLabel: opts.numberLabel,
    dateLabel: opts.dateLabel,
    logoPath: opts.logoPath,
    fonts: opts.fonts,
    // Tanda tangan harus berada DI LUAR kotak kolom. Reservasi dipakai HANYA
    // bila tanda tangan memang tidak muat di bawah kotak halaman terakhir, dan
    // hanya sebesar yang diperlukan — lihat `planMitraLayout`.
    reserveSignatureZone: opts.reserveSignatureZone ?? true,
    signature,
  })

  renderMitraSignature(doc, signature)
}

/**
 * Bangun buffer PDF MITRA lengkap (dokumen baru, siap dikirim/ditulis).
 * Geometri halaman mengikuti master (A4 legal sample).
 */
export function createMitraPdfBuffer(opts: MitraDocumentRenderOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [595.5, 842.25],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    })

    const buffers: Buffer[] = []
    doc.on('data', (chunk: Buffer) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    try {
      renderMitraDocumentInto(doc, opts)
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
