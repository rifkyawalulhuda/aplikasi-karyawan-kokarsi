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
 */

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
  pageBottomPadding?: number
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g

/** Ganti semua {{key}} dengan nilai dari context. Placeholder tanpa nilai dibiarkan terlihat (fail-visible). */
export function interpolate(text: string, values: Record<string, string>): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER, (_m, key: string) => {
    const v = values[key]
    return v === undefined || v === null || v === '' ? `«${key}»` : String(v)
  })
}

export function buildValueMap(resolved: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!resolved || typeof resolved !== 'object') return out
  for (const [key, entry] of Object.entries(resolved as Record<string, any>)) {
    if (entry && typeof entry === 'object' && 'displayValue' in entry) {
      out[key] = String((entry as any).displayValue ?? '')
    } else {
      out[key] = String(entry ?? '')
    }
  }
  return out
}

/** Format angka untuk kolom tabel sesuai format yang diminta. */
export function formatCell(value: string, format: string | undefined): string {
  if (format !== 'currency' && format !== 'number') return value
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  // Tidak ada digit sama sekali → bukan angka, kembalikan apa adanya
  if (!/[0-9]/.test(cleaned)) return value
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return value
  if (format === 'currency') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
  }
  return new Intl.NumberFormat('id-ID').format(n)
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

  const writeText = (text: string, opts2: {
    font?: string
    size?: number
    align?: 'left' | 'justify' | 'center'
    gapBefore?: number
    gapAfter?: number
    indent?: number
    width?: number
  } = {}) => {
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
      lineGap: 0.6,
    })
    state.y = doc.y + (opts2.gapAfter ?? 4)
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

      case 'paragraph':
        writeText(interpolate(block.text ?? '', values), { gapAfter: 5 })
        break

      case 'article': {
        if (block.heading) {
          writeText(interpolate(block.heading, values), {
            font: opts.fontBold,
            size: 10,
            align: 'left',
            gapBefore: 6,
            gapAfter: 3,
          })
        }
        for (const p of block.paragraphs ?? []) {
          writeText(interpolate(String(p), values), { gapAfter: 3 })
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

        const totalWidth = opts.columnWidth
        const widths = columns.map((c: any) =>
          c.width ? (totalWidth * Number(c.width)) / 100 : totalWidth / columns.length,
        )

        const ensureTableSpace = (needed: number) => {
          if (state.y + needed > pageBottom()) moveToNextColumnOrPage()
        }

        const drawRow = (cells: string[], bold: boolean) => {
          const font = bold ? opts.fontBold : opts.fontRegular
          doc.font(font).fontSize(fontSize)
          const heights = columns.map((_c: any, ci: number) =>
            doc.heightOfString(cells[ci] ?? '', { width: widths[ci] - 8 }),
          )
          const rowHeight = Math.max(...heights, fontSize) + 6
          ensureTableSpace(rowHeight)
          let x = currentX
          const alignMap: Record<number, string> = {}
          columns.forEach((c: any, ci: number) => {
            alignMap[ci] = c.align ?? 'left'
          })
          columns.forEach((_c: any, ci: number) => {
            doc.rect(x, state.y, widths[ci], rowHeight).stroke('#000000')
            doc
              .font(font)
              .fontSize(fontSize)
              .text(cells[ci] ?? '', x + 4, state.y + 3, {
                width: widths[ci] - 8,
                align: alignMap[ci] as any,
              })
            x += widths[ci]
          })
          state.y += rowHeight
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
