/**
 * Block renderer V1 — merender kontrak dari contentDefinition (versi template)
 * + resolvedTemplateData (nilai yang sudah di-resolve saat kontrak dibuat).
 *
 * Prinsip:
 *  - Hanya tipe blok yang di-allowlist (title, subtitle, paragraph, article,
 *    list, table, pageBreak, signature) yang dapat dirender.
 *  - Nilai placeholder diambil dari resolvedTemplateData kontrak; tidak ada
 *    query DB dan tidak ada master template yang dibaca saat render.
 *  - Layout tetap milik renderer (margin, kolom, font) — admin hanya mengatur konten.
 *  - Pemformatan inline (`**bold**`, `*italic*`, `__underline__`) dan perataan blok
 *    (`align`) diterapkan HANYA pada `paragraph`/`article`. Teks TANPA mark tetap
 *    lewat jalur `doc.text` lama, sehingga template yang sudah ada menghasilkan PDF
 *    yang sama persis (pola dua-sumbu yang sama dengan engine PKWT/MITRA).
 */
import { computeColumnWidths, computeRowHeight, formatCell, wrapCellLines } from './table-layout.helpers'
// `formatCell` dulu didefinisikan di sini; kini tinggal di `table-layout.helpers`
// (dipakai bersama engine PKWT). Re-export agar importer lama tetap bekerja.
export { formatCell } from './table-layout.helpers'
// Tipe saja (`import type`): helper resolver adalah modul daun tanpa dependency
// NestJS/Prisma, jadi memakai tipe bahasanya di sini tidak menimbulkan siklus
// modul walau `contract-templates` sendiri bergantung pada `contracts`.
import type { DocumentLanguage } from '../contract-templates/template-value-resolver.helpers'
import { hasInlineMarks, parseInlineRuns } from './inline-marks'
import {
  drawRunsLine,
  measureRunsLine,
  wrapRunsToLines,
  type InlineRunAlign,
  type RunFonts
} from './inline-run-layout'

export interface RenderedBlockContext {
  /** Map placeholder key → displayValue */
  values: Record<string, string>
}

export interface BlockRendererOptions {
  leftX: number
  rightX: number
  columnWidth: number
  topY: number
  bottomY: number
  fontRegular: string
  fontBold: string
  fontItalic: string
  /** Opsional: dipakai run `bold+italic`. Bila kosong, jatuh ke `fontBold`. */
  fontBoldItalic?: string
  pageBottomPadding?: number
}

/**
 * Opsi satu panggilan tulis-teks. Diekstrak agar `writeText` (jalur lama) dan
 * `writeRuns` (jalur bermark) memakai bentuk opsi yang sama.
 */
interface BlockTextOptions {
  font?: string
  size?: number
  /** Perataan blok. `right` baru ditambahkan; `undefined` → `justify` (perilaku lama). */
  align?: InlineRunAlign
  gapBefore?: number
  gapAfter?: number
  indent?: number
  width?: number
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g

/** Jarak antar-baris jalur lama; jalur bermark memakai angka yang SAMA agar tinggi baris identik. */
const LINE_GAP = 0.6

/** Ganti semua {{key}} dengan nilai dari context. Placeholder tanpa nilai dibiarkan terlihat (fail-visible). */
export function interpolate(text: string, values: Record<string, string>): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER, (_m, key: string) => {
    const v = values[key]
    return v === undefined || v === null || v === '' ? `«${key}»` : String(v)
  })
}

/**
 * Peta `key -> teks cetak` dari `resolvedTemplateData`.
 *
 * `language` menentukan varian label: `EN` memakai `displayValueEn` bila field
 * itu punya label Inggris sendiri (mis. `employee.gender` → "Male") dan jatuh ke
 * `displayValue` untuk semua field lain. `ID` selalu `displayValue`, jadi
 * pemanggil lama (MITRA, satu kolom) tidak berubah perilakunya.
 */
export function buildValueMap(resolved: any, language: DocumentLanguage = 'ID'): Record<string, string> {
  const out: Record<string, string> = {}
  if (!resolved || typeof resolved !== 'object') return out
  for (const [key, entry] of Object.entries(resolved as Record<string, any>)) {
    if (entry && typeof entry === 'object' && 'displayValue' in entry) {
      const display = language === 'EN' ? (entry.displayValueEn ?? entry.displayValue) : entry.displayValue
      out[key] = String(display ?? '')
    } else {
      out[key] = String(entry ?? '')
    }
  }
  return out
}

/** Prefix bernomor untuk list: 1. / a. / •  */
export function listPrefix(style: string, index: number): string {
  if (style === 'numbered') return `${index + 1}.`
  if (style === 'alphabetic') return `${String.fromCharCode(97 + (index % 26))}.`
  return '•'
}

interface RenderState {
  y: number
  usedColumnBreak: boolean
}

/**
 * `block.align` yang sah untuk jalur ini.
 *
 * Hanya `paragraph`/`article` yang membawa `align` (lihat `ALIGN_CAPABLE_BLOCKS`
 * di validator). Nilai tak dikenal — termasuk `undefined` — diabaikan supaya
 * perilaku lama tidak berubah (jaring pengaman, sama seperti `pkwtBlockAlign`).
 */
function blockAlign(value: unknown): InlineRunAlign | undefined {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
    ? value
    : undefined
}

/**
 * Render daftar blok ke dokumen PDFKit. Mendukung alur dua kolom
 * (kolom kiri penuh → kolom kanan → halaman baru) seperti dokumen legal asli.
 */
export function renderBlocks(
  doc: any,
  blocks: any[],
  ctx: RenderedBlockContext,
  opts: BlockRendererOptions,
): void {
  const state: RenderState = { y: opts.topY, usedColumnBreak: false }
  let currentX = opts.leftX

  const pageBottom = () => doc.page.height - (opts.pageBottomPadding ?? 50)
  const values = ctx.values

  const moveToNextColumnOrPage = () => {
    if (!state.usedColumnBreak) {
      state.usedColumnBreak = true
      currentX = opts.rightX
      state.y = opts.topY
      return
    }
    doc.addPage()
    state.usedColumnBreak = false
    currentX = opts.leftX
    state.y = opts.topY
  }

  const ensureSpace = (needed: number) => {
    if (state.y + needed > pageBottom()) {
      moveToNextColumnOrPage()
    }
  }

  const writeText = (text: string, opts2: BlockTextOptions = {}) => {
    const size = opts2.size ?? 9.5
    const font = opts2.font ?? opts.fontRegular
    doc.font(font).fontSize(size)
    const width = opts2.width ?? opts.columnWidth
    const x = currentX + (opts2.indent ?? 0)
    const textWidth = width - (opts2.indent ?? 0)
    const height = doc.heightOfString(text, { width: textWidth, align: opts2.align ?? 'justify' })
    if (opts2.gapBefore) ensureSpace(opts2.gapBefore)
    state.y += opts2.gapBefore ?? 0
    ensureSpace(height)
    doc.text(text, x, state.y, {
      width: textWidth,
      align: opts2.align ?? 'justify',
      lineGap: LINE_GAP,
    })
    state.y = doc.y + (opts2.gapAfter ?? 4)
  }

  /**
   * Tulis satu blok teks BER-MARK (bold/italic/underline), meniru `writeText`
   * baris demi baris.
   *
   * KAPAN DIPAKAI: hanya bila teksnya benar-benar bermark. Bila tidak, fungsi ini
   * mendelegasikan ke `writeText`, sehingga template yang sudah ada memakai jalur
   * kode yang SAMA PERSIS seperti sebelum fitur ini ditambahkan.
   *
   * Urutan penting: interpolasi dulu, baru mark di-parse — supaya
   * `**{{employee.fullName}}**` membuat NILAI-nya bold, bukan nama placeholder.
   * Karena itu `text` yang diterima fungsi ini sudah terinterpolasi.
   *
   * CATATAN jalur ini: baris digambar satu per satu, jadi keputusan pindah
   * kolom/halaman dibuat di sini.
   *
   * Aturan keputusan itu **disamakan dengan jalur lama** (`writeText`), bukan
   * diciptakan baru:
   *  - Paragraf yang MASIH MUAT dalam satu kolom dipindahkan **UTUH** — persis
   *    seperti `ensureSpace(height)` di `writeText`. Ini penting: kalau paragraf
   *    bermark mengisi sisa kolom sementara paragraf polos dipindahkan, dokumen
   *    yang sama bisa berbeda jumlah halaman hanya karena ada/tidaknya mark.
   *  - Paragraf yang LEBIH TINGGI dari satu kolom **dicicil per baris** mengikuti
   *    alur dua kolom. Jalur lama menyerahkan kasus ini ke PDFKit (`doc.text`
   *    menambah halaman sendiri di luar alur kolom); perilaku itu tidak ditiru,
   *    dan hanya kasus inilah yang boleh berbeda.
   */
  const writeRuns = (text: string, opts2: BlockTextOptions = {}) => {
    if (!hasInlineMarks(text)) {
      writeText(text, opts2)
      return
    }

    const size = opts2.size ?? 9.5
    const font = opts2.font ?? opts.fontRegular
    const width = opts2.width ?? opts.columnWidth
    const indent = opts2.indent ?? 0
    const textWidth = width - indent
    const align: InlineRunAlign = opts2.align ?? 'justify'
    const fonts: RunFonts = {
      regular: opts.fontRegular,
      bold: opts.fontBold,
      italic: opts.fontItalic,
      boldItalic: opts.fontBoldItalic,
    }

    // Tinggi baris SAMA dengan jalur lama: bersumber dari font ACUAN, bukan dari
    // mark. Inilah yang membuat baris bermark setinggi baris tanpa mark sehingga
    // paginasi tidak bergeser.
    const lineHeight = measureRunsLine(doc, font, size, LINE_GAP)
    // Bungkus LEBIH DULU supaya keputusan pindah kolom/halaman memakai jumlah baris nyata.
    const lines = wrapRunsToLines(doc, parseInlineRuns(text), textWidth, fonts, size)

    // Paragraf yang muat dalam satu kolom dipindahkan UTUH (lihat catatan di atas):
    // hanya paragraf yang lebih tinggi dari satu kolom yang dicicil per baris.
    const paragraphHeight = lines.length * lineHeight
    const fitsInOneColumn = paragraphHeight <= pageBottom() - opts.topY

    if (opts2.gapBefore) {
      ensureSpace(opts2.gapBefore)
      state.y += opts2.gapBefore
    }
    if (fitsInOneColumn) ensureSpace(paragraphHeight)

    lines.forEach((line, index) => {
      if (!fitsInOneColumn) ensureSpace(lineHeight)
      const isLast = index === lines.length - 1
      // Baris terakhir paragraf tidak direntangkan — sama seperti Word/LaTeX dan
      // sama dengan perilaku `doc.text` bawaan PDFKit.
      const lineAlign: InlineRunAlign = align === 'justify' && isLast ? 'left' : align
      drawRunsLine(doc, line, currentX + indent, state.y, textWidth, fonts, size, lineAlign)
      state.y += lineHeight
    })

    state.y += opts2.gapAfter ?? 4
  }

  for (const block of blocks ?? []) {
    switch (block?.type) {
      case 'title':
        writeText(interpolate(block.text ?? '', values), {
          font: opts.fontBold,
          size: 12,
          align: 'center',
          gapAfter: 8,
        })
        break

      case 'subtitle':
        writeText(interpolate(block.text ?? '', values), {
          font: opts.fontBold,
          size: 10,
          align: 'center',
          gapAfter: 6,
        })
        break

      case 'paragraph': {
        const align = blockAlign(block?.align)
        writeRuns(
          interpolate(block.text ?? '', values),
          align ? { gapAfter: 5, align } : { gapAfter: 5 },
        )
        break
      }

      case 'article': {
        const align = blockAlign(block?.align)
        // `headingAlign`: perataan khusus judul pasal, terpisah dari `align`
        // blok (yang tetap hanya berlaku untuk uraian). Tanpa keduanya, judul
        // tetap `left` seperti sebelumnya (perilaku lama jalur legacy).
        const headingAlign = blockAlign(block?.headingAlign)
        if (block.heading) {
          writeText(interpolate(block.heading, values), {
            font: opts.fontBold,
            size: 10,
            align: headingAlign ?? align ?? 'left',
            gapBefore: 6,
            gapAfter: 3,
          })
        }
        for (const p of block.paragraphs ?? []) {
          const text = interpolate(String(p), values)
          writeRuns(text, align ? { gapAfter: 3, align } : { gapAfter: 3 })
        }
        break
      }

      case 'list': {
        const items = block.items ?? []
        items.forEach((item: any, i: number) => {
          const raw = typeof item === 'string' ? item : (item?.text ?? '')
          const level = typeof item === 'object' ? (item?.level ?? 0) : 0
          const prefix = listPrefix(block.style ?? 'bullet', i)
          const indent = 12 + level * 12
          writeText(`${prefix} ${interpolate(raw, values)}`, {
            indent,
            gapAfter: 2,
            align: 'left',
          })
        })
        state.y += 2
        break
      }

      case 'table': {
        const columns = block.columns ?? []
        const rows = block.rows ?? []
        if (columns.length === 0) break
        const fontSize = 9
        doc.font(opts.fontRegular).fontSize(fontSize)

        // Normalisasi bobot lebar kolom (lihat `computeColumnWidths`) supaya
        // totalnya selalu selebar kolom, bukan 100% per kolom.
        const widths = computeColumnWidths(columns, opts.columnWidth)
        const lineHeight = doc.heightOfString('Xg', { lineGap: 0 })

        const ensureTableSpace = (needed: number) => {
          if (state.y + needed > pageBottom()) moveToNextColumnOrPage()
        }

        const drawRow = (cells: string[], bold: boolean) => {
          const font = bold ? opts.fontBold : opts.fontRegular
          doc.font(font).fontSize(fontSize)
          const rowHeight = computeRowHeight(doc, cells, widths, fontSize, 8, 6)
          const maxBody = pageBottom() - opts.topY

          if (rowHeight <= maxBody) {
            ensureTableSpace(rowHeight)
            let x = currentX
            columns.forEach((c: any, ci: number) => {
              doc.rect(x, state.y, widths[ci], rowHeight).stroke('#000000')
              doc
                .font(font)
                .fontSize(fontSize)
                .text(cells[ci] ?? '', x + 4, state.y + 3, {
                  width: Math.max(widths[ci] - 8, 1),
                  align: (c.align ?? 'left') as any,
                })
              x += widths[ci]
            })
            state.y += rowHeight
            return
          }

          // Baris ekstra-tinggi: pecah per-lini lintas kolom/halaman.
          const cellLines = cells.map((cell, ci) =>
            wrapCellLines(doc, cell ?? '', Math.max(widths[ci] - 8, 1), font, fontSize),
          )
          const maxLines = Math.max(1, cellLines.reduce((m, l) => Math.max(m, l.length), 0))
          let consumed = 0
          while (consumed < maxLines) {
            if (state.y + lineHeight * 2 > pageBottom()) moveToNextColumnOrPage()
            const avail = pageBottom() - state.y
            const fit = Math.max(1, Math.floor((avail - 6) / lineHeight))
            const take = Math.min(fit, maxLines - consumed)
            const segHeight = take * lineHeight + 6
            let x = currentX
            columns.forEach((c: any, ci: number) => {
              doc.rect(x, state.y, widths[ci], segHeight).stroke('#000000')
              const chunk = cellLines[ci].slice(consumed, consumed + take).join('\n')
              doc
                .font(font)
                .fontSize(fontSize)
                .text(chunk, x + 4, state.y + 3, {
                  width: Math.max(widths[ci] - 8, 1),
                  align: (c.align ?? 'left') as any,
                  lineGap: 0,
                })
              x += widths[ci]
            })
            state.y += segHeight
            consumed += take
            if (consumed < maxLines) moveToNextColumnOrPage()
          }
        }

        if (block.header !== false) {
          drawRow(
            columns.map((c: any) => interpolate(String(c.label ?? ''), values)),
            true,
          )
        }
        for (const row of rows) {
          const cells = columns.map((c: any) => {
            const raw = interpolate(String(row?.[c.key] ?? ''), values)
            return formatCell(raw, c.format)
          })
          drawRow(cells, false)
        }
        state.y += 4
        break
      }

      case 'pageBreak':
        moveToNextColumnOrPage()
        break

      case 'signature':
        // Signature dirender terpisah (dua pilar / footer) — layout milik renderer
        break

      default:
        // Blok tak dikenal di-skip; validator sudah menolaknya saat publish
        break
    }
  }
}
