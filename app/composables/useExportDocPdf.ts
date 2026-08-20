/**
 * useExportDocPdf — generate PDF dari konten Tiptap (ProseMirror JSON)
 * Menggunakan jspdf (sudah terinstall di project).
 * Mendukung: heading 1–3, paragraph, bulletList, orderedList, blockquote, codeBlock, hardBreak, horizontalRule.
 */

interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: { type: string }[]
  attrs?: Record<string, any>
}

// Strip karakter di luar Latin-1 (emoji, simbol unicode) yang tidak didukung font Helvetica jsPDF
function sanitize(text: string): string {
  return text.replace(/[^\u0000-\u00FF]/g, '').replace(/\s+$/gm, '')
}

function extractText(nodes: TiptapNode[] = []): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.text ?? ''
    if (n.type === 'hardBreak') return '\n'
    return extractText(n.content)
  }).join('')
}

function extractListItems(nodes: TiptapNode[] = [], ordered: boolean, startIndex = 1): { text: string; bullet: string }[] {
  const items: { text: string; bullet: string }[] = []
  nodes.forEach((node, i) => {
    if (node.type === 'listItem') {
      const text = extractText(node.content)
      items.push({
        text: text.replace(/\n$/, ''),
        // Gunakan '-' bukan '•' karena bullet U+2022 tidak ada di Helvetica
        bullet: ordered ? `${startIndex + i}.` : '-',
      })
    }
  })
  return items
}

export function useExportDocPdf() {
  async function exportDocPdf(
    title: string,
    emoji: string,
    contentJson: string,
    filename?: string
  ) {
    // Dynamic import agar tidak break SSR
    const { jsPDF } = await import('jspdf')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const marginLeft = 20
    const marginRight = 20
    const marginTop = 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const contentWidth = pageWidth - marginLeft - marginRight
    const pageHeight = doc.internal.pageSize.getHeight()
    const marginBottom = 20

    let cursorY = marginTop

    // Helper: cek apakah perlu halaman baru
    function checkPageBreak(neededHeight: number) {
      if (cursorY + neededHeight > pageHeight - marginBottom) {
        doc.addPage()
        cursorY = marginTop
      }
    }

    // Helper: render teks dengan word-wrap otomatis, kembalikan tinggi yang dipakai
    function renderText(
      text: string,
      x: number,
      y: number,
      opts: { fontSize: number; fontStyle?: string; maxWidth: number; lineHeightFactor?: number }
    ): number {
      const { fontSize, fontStyle = 'normal', maxWidth, lineHeightFactor = 1.4 } = opts
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', fontStyle)
      const safeText = sanitize(text)
      const lines = doc.splitTextToSize(safeText, maxWidth)
      const lineH = (fontSize / doc.internal.scaleFactor) * lineHeightFactor
      lines.forEach((line: string, i: number) => {
        doc.text(line, x, y + i * lineH)
      })
      return lines.length * lineH
    }

    // ── Header: judul (tanpa emoji — Helvetica tidak support unicode emoji) ──────
    const headerTitle = sanitize(title || 'Untitled')
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    const titleLines = doc.splitTextToSize(headerTitle, contentWidth)
    const titleLineH = (20 / doc.internal.scaleFactor) * 1.3
    titleLines.forEach((line: string, i: number) => {
      doc.text(line, marginLeft, cursorY + i * titleLineH)
    })
    cursorY += titleLines.length * titleLineH + 4

    // Garis separator di bawah judul
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(marginLeft, cursorY, pageWidth - marginRight, cursorY)
    cursorY += 6

    // ── Parse Tiptap JSON ──────────────────────────────────────────────────────
    let nodes: TiptapNode[] = []
    try {
      const parsed = JSON.parse(contentJson)
      nodes = parsed?.content ?? []
    } catch {
      nodes = []
    }

    // ── Render setiap node ─────────────────────────────────────────────────────
    for (const node of nodes) {
      switch (node.type) {
        case 'heading': {
          const level = node.attrs?.level ?? 1
          const text = extractText(node.content)
          if (!text.trim()) break
          const sizes: Record<number, number> = { 1: 16, 2: 14, 3: 12 }
          const fontSize = sizes[level] ?? 12
          const gap = level === 1 ? 4 : 2
          checkPageBreak(fontSize / doc.internal.scaleFactor * 1.5 + gap + 4)
          cursorY += level === 1 ? 4 : 2
          const h = renderText(text, marginLeft, cursorY, { fontSize, fontStyle: 'bold', maxWidth: contentWidth })
          cursorY += h + (level === 1 ? 3 : 2)
          break
        }

        case 'paragraph': {
          const text = extractText(node.content)
          if (!text.trim()) {
            cursorY += 3
            break
          }
          checkPageBreak(10)
          const h = renderText(text, marginLeft, cursorY, { fontSize: 10, fontStyle: 'normal', maxWidth: contentWidth })
          cursorY += h + 3
          break
        }

        case 'bulletList':
        case 'orderedList': {
          const items = extractListItems(node.content, node.type === 'orderedList')
          for (const item of items) {
            checkPageBreak(8)
            // Bullet/number
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.text(item.bullet, marginLeft + 3, cursorY)
            // Teks item
            const h = renderText(item.text || '', marginLeft + 10, cursorY, {
              fontSize: 10,
              fontStyle: 'normal',
              maxWidth: contentWidth - 10,
            })
            cursorY += Math.max(h, 5) + 1.5
          }
          cursorY += 2
          break
        }

        case 'blockquote': {
          const text = extractText(node.content)
          if (!text.trim()) break
          checkPageBreak(10)
          // Garis kiri aksen
          doc.setDrawColor(150, 150, 150)
          doc.setLineWidth(0.8)
          const bqStartY = cursorY - 3
          const h = renderText(text, marginLeft + 6, cursorY, {
            fontSize: 10,
            fontStyle: 'italic',
            maxWidth: contentWidth - 8,
          })
          doc.line(marginLeft + 1, bqStartY, marginLeft + 1, cursorY + h)
          cursorY += h + 4
          break
        }

        case 'codeBlock': {
          const text = extractText(node.content)
          if (!text.trim()) break
          checkPageBreak(12)
          doc.setFontSize(9)
          doc.setFont('courier', 'normal')
          const lines = doc.splitTextToSize(text, contentWidth - 8)
          const lineH = (9 / doc.internal.scaleFactor) * 1.4
          const blockH = lines.length * lineH + 6
          checkPageBreak(blockH)
          // Background abu-abu
          doc.setFillColor(245, 245, 245)
          doc.roundedRect(marginLeft, cursorY - 3, contentWidth, blockH, 1.5, 1.5, 'F')
          lines.forEach((line: string, i: number) => {
            doc.text(line, marginLeft + 4, cursorY + i * lineH)
          })
          cursorY += blockH + 3
          break
        }

        case 'horizontalRule': {
          checkPageBreak(6)
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.3)
          doc.line(marginLeft, cursorY, pageWidth - marginRight, cursorY)
          cursorY += 5
          break
        }

        default:
          break
      }
    }

    // ── Footer: nomor halaman ──────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(160, 160, 160)
      doc.text(
        `${sanitize(title || 'Dokumen')}  -  Halaman ${p} dari ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
      doc.setTextColor(0, 0, 0)
    }

    // ── Download ───────────────────────────────────────────────────────────────
    const slug = (filename ?? title ?? 'dokumen')
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 60)
    doc.save(`${slug}.pdf`)
  }

  return { exportDocPdf }
}
