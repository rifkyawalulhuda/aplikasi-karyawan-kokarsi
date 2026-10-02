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
  return {
    regular: `${dir}/times.ttf`,
    bold: `${dir}/timesbd.ttf`,
    italic: `${dir}/timesi.ttf`,
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
  fonts: { regular: string; bold: string; italic: string }
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

  renderMitraLayout(doc, blocks, {
    values,
    title,
    numberLabel: opts.numberLabel,
    dateLabel: opts.dateLabel,
    logoPath: opts.logoPath,
    fonts: opts.fonts,
  })

  // Signature: dua pilar di bawah kotak kolom, mengikuti master.
  // Label "PIHAK PERTAMA"/"PIHAK KEDUA" adalah HEADER pilar (chrome).
  // Baris di bawah nama adalah JABATAN, bukan label pihak — memakai label
  // pihak di sini akan mencetak "PIHAK PERTAMA" dua kali (bug).
  const chairman = opts.signature?.chairmanName ?? values['settings.cooperativeChairmanName'] ?? ''
  const employeeName = opts.signature?.employeeName ?? values['employee.fullName'] ?? ''
  const jobRole = opts.signature?.jobRole ?? values['employee.jobRole'] ?? ''
  renderMitraSignature(doc, {
    leftHeader: MITRA_HEADER_CHROME.signature.leftHeader,
    leftName: chairman,
    leftRole: MITRA_HEADER_CHROME.signature.leftRoleLabel,
    rightHeader: MITRA_HEADER_CHROME.signature.rightHeader,
    rightName: employeeName,
    rightRole: jobRole
      ? `( ${jobRole} )`
      : MITRA_HEADER_CHROME.signature.rightRoleFallback,
  })
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
