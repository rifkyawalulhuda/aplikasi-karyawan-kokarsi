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
   * Zona bawah yang DISISIHKAN untuk blok tanda tangan pada halaman terakhir.
   * Body tidak boleh turun melewati batas ini bila signature ikut dirender,
   * agar tanda tangan tidak menimpa teks (master bebas overlap).
   */
  signatureZoneHeight: 150,

  /**
   * Blok tanda tangan = TABEL BERGRARIS di BAWAH & DI LUAR kotak kolom.
   * Geometri diukur dari master (p8):
   *   - garis tepi kiri  x = 120.9
   *   - garis pemisah    x = 298.9
   *   - garis tepi kanan x = 468.6
   *   - jarak dari dasar kotak ke atas tabel ≈ 50pt
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
  fonts: { regular: string; bold: string; italic: string }
  /**
   * Bila true, zona bawah halaman terakhir disisihkan untuk blok tanda tangan
   * sehingga body berhenti di atasnya (mencegah tanda tangan menimpa teks).
   */
  reserveSignatureZone?: boolean
}

export interface MitraBlock {
  type: string
  [key: string]: any
}

export const MITRA_FONT_NAMES = {
  regular: 'MitraTimes',
  bold: 'MitraTimesBold',
  italic: 'MitraTimesItalic',
} as const

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
 * Render blok konten ke PDFKit doc dengan layout master dua kolom ber-border.
 *
 * Header + horizontal rules + title hanya dirender pada HALAMAN 1.
 * Kotak dua kolom dirender pada SETIAP halaman.
 */
export function renderMitraLayout(
  doc: any,
  blocks: MitraBlock[],
  opts: MitraLayoutOptions,
): void {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES

  doc.registerFont(F.regular, opts.fonts.regular)
  doc.registerFont(F.bold, opts.fonts.bold)
  doc.registerFont(F.italic, opts.fonts.italic)

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
  const boxBottom = (pageIdx: number) => (pageIdx === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom)

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
      align?: 'left' | 'center' | 'justify'
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

  const NUMBERED_ITEM = /^(?:\d{1,2}|[a-z])\.\s/
  const paragraphOpts = (text: string) =>
    NUMBERED_ITEM.test(mitraInterpolate(text, opts.values))
      ? { gapAfter: G.paragraphGap, hangingIndent: G.listHangingIndent }
      : { gapAfter: G.paragraphGap }

  const renderBlock = (block: any) => {
    switch (block?.type) {
      case 'title':
      case 'subtitle':
        break

      case 'paragraph':
        writeText(block.text ?? '', paragraphOpts(block.text ?? ''))
        break

      case 'article': {
        if (block.heading) {
          writeText(block.heading, {
            font: F.bold,
            size: G.font.body,
            align: 'center',
            gapBefore: 2,
            gapAfter: G.headingGapAfter,
            keepWithNextLines: 3,
          })
        }
        for (const p of block.paragraphs ?? []) {
          writeText(String(p), paragraphOpts(String(p)))
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
        const s = currentStream
        const size = G.font.body - 1
        const totalWidth = colInnerWidth(s)
        const widths = columns.map((c: any) =>
          c.width ? (totalWidth * Number(c.width)) / 100 : totalWidth / columns.length,
        )
        const drawRow = (cells: string[], bold: boolean) => {
          const font = bold ? F.bold : F.regular
          doc.font(font).fontSize(size)
          const heights = columns.map((_c: any, ci: number) =>
            doc.heightOfString(cells[ci] ?? '', { width: widths[ci] - 8 }),
          )
          const rowHeight = Math.max(...heights, size) + 6
          ensureSpace(rowHeight)
          let x = colX(s)
          columns.forEach((c: any, ci: number) => {
            doc.rect(x, y, widths[ci], rowHeight).stroke('#000000')
            doc
              .font(font)
              .fontSize(size)
              .text(cells[ci] ?? '', x + 4, y + 3, {
                width: widths[ci] - 8,
                align: (c.align ?? 'left') as any,
              })
            x += widths[ci]
          })
          y += rowHeight
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

  // === Bagi konten jadi dua stream (~50/50 tinggi) ===
  const splitIndex = computeSplitIndex(blocks, (b) => estimateBlockHeight(doc, b, opts))
  const blocksFirst = blocks.slice(0, splitIndex)
  const blocksSecond = blocks.slice(splitIndex)

  // === Stream 0 → kolom KIRI semua halaman ===
  gotoStreamPage(0, 0)
  for (const b of blocksFirst) renderBlock(b)

  // === Stream 1 → kolom KANAN semua halaman ===
  gotoStreamPage(1, 0)
  for (const b of blocksSecond) renderBlock(b)

  // === Pass akhir: gambar kotak kolom DINAMIS untuk SEMUA halaman ===
  // Kotak berhenti di teks terakhir + bantalan (bukan setinggi halaman).
  // Blok tanda tangan berada DI LUAR & DI BAWAH kotak, jadi tidak dihitung
  // sebagai isi kotak.
  const lastPage = pageCount - 1

  for (let p = 0; p < pageCount; p++) {
    doc.switchToPage(p)
    const contentBottom = deepestByPage[p] ?? boxTop(p)
    strokeBoxesForPage(p, contentBottom)
  }

  ;(doc as any).__mitraFinalPage = {
    pageDeepest: deepestByPage[lastPage] ?? 0,
    pageCount,
    lastPage,
    lastPageBodyBottom: deepestByPage[lastPage] ?? boxTop(lastPage),
  }
}

/** Perkirakan tinggi sebuah blok untuk keperluan pemisahan stream. */
function estimateBlockHeight(doc: any, block: any, opts: MitraLayoutOptions): number {
  if (!block) return 0
  const G = MITRA_GEOMETRY
  const width = G.left.x1 - G.left.x0 - G.textPaddingLeft * 2
  doc.font(MITRA_FONT_NAMES.regular).fontSize(G.font.body)
  switch (block.type) {
    case 'article': {
      let h = 0
      if (block.heading) h += G.headingGapAfter + G.font.body * 2
      for (const p of block.paragraphs ?? []) {
        h += doc.heightOfString(scrubRawTokens(mitraInterpolate(String(p), opts.values)), { width }) + G.paragraphGap
      }
      return h
    }
    case 'paragraph':
      return doc.heightOfString(
        scrubRawTokens(mitraInterpolate(String(block.text ?? ''), opts.values)),
        { width },
      ) + G.paragraphGap
    case 'list':
      return (block.items ?? []).length * (doc.currentLineHeight() + 2)
    case 'title':
    case 'subtitle':
      return 0
    default:
      return doc.heightOfString(JSON.stringify(block ?? {}), { width })
  }
}

/** Cari indeks pemisahan terdekat 50% tinggi total. */
function computeSplitIndex(blocks: MitraBlock[], heightOf: (b: MitraBlock) => number): number {
  if (!blocks?.length) return 0
  const heights = blocks.map(heightOf)
  const total = heights.reduce((a, b) => a + b, 0)
  let acc = 0
  let idx = blocks.length
  for (let i = 0; i < blocks.length; i++) {
    acc += heights[i]
    if (acc >= total / 2) {
      idx = i + 1
      break
    }
  }
  return Math.min(Math.max(idx, 1), blocks.length)
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
  o: {
    leftHeader: string
    leftName: string
    leftRole: string
    rightHeader: string
    rightName: string
    rightRole: string
  },
): void {
  const G = MITRA_GEOMETRY
  const F = MITRA_FONT_NAMES
  const T = G.signatureTable

  const finalPage = (doc as any).__mitraFinalPage as
    | { pageDeepest: number; pageCount: number; lastPage: number; lastPageBodyBottom: number }
    | undefined
  let lastPage = finalPage?.lastPage ?? (doc.bufferedPageRange?.().count ?? 1) - 1
  const bodyBottom = finalPage?.lastPageBodyBottom ?? G.contPageBoxTop

  const rowHeights = [T.labelRowH, T.companyRowH, T.signSpaceRowH, T.nameRowH, T.roleRowH]
  const tableHeight = rowHeights.reduce((a, b) => a + b, 0)

  // Tabel tanda tangan berada DI LUAR & DI BAWAH kotak kolom.
  const boxBottomOnLast = lastPage === 0 ? G.firstPageBoxBottom : G.contPageBoxBottom
  let tableTop = Math.max(bodyBottom + G.boxPaddingBottom, boxBottomOnLast - tableHeight - T.gapFromBox) + T.gapFromBox

  // Bila tidak muat di halaman terakhir → halaman BARU untuk tanda tangan.
  if (tableTop + tableHeight > G.pageHeight - 40) {
    doc.addPage()
    lastPage += 1
    // Halaman baru ini hanya berisi tabel tanda tangan (tanpa kotak kolom).
    tableTop = G.contPageBoxTop + 40
  }

  doc.switchToPage(lastPage)

  const left = T.left
  const divider = T.divider
  const right = T.right
  const leftW = divider - left
  const rightW = right - divider

  // --- Garis tabel ---
  doc.save()
  doc.lineWidth(G.borderWidth).strokeColor('#000000')
  // tepi luar
  const tableBottom = tableTop + tableHeight
  doc.rect(left, tableTop, right - left, tableHeight).stroke()
  // garis pemisah vertikal tengah
  doc.moveTo(divider, tableTop).lineTo(divider, tableBottom).stroke()
  // garis horizontal antar baris (bukan setelah baris terakhir — sudah jadi tepi)
  let y = tableTop
  for (let i = 0; i < rowHeights.length - 1; i++) {
    y += rowHeights[i]
    doc.moveTo(left, y).lineTo(right, y).stroke()
  }
  doc.restore()

  // --- Isi baris ---
  const centerIn = (x0: number, w: number, text: string, options: { bold?: boolean; offsetY: number }) => {
    doc
      .font(options.bold ? F.bold : F.regular)
      .fontSize(G.font.signature)
      .fillColor('#000000')
    doc.text(text, x0, tableTop + options.offsetY, {
      width: w,
      align: 'center',
      lineBreak: false,
    })
  }

  const yLabel = rowHeights[0] * 0.25
  const yCompany = rowHeights[0] + rowHeights[1] * 0.25
  const yName = rowHeights[0] + rowHeights[1] + rowHeights[2] + rowHeights[3] * 0.15
  const yRole = rowHeights[0] + rowHeights[1] + rowHeights[2] + rowHeights[3] + rowHeights[4] * 0.1

  centerIn(left, leftW, 'PIHAK PERTAMA', { offsetY: yLabel })
  centerIn(divider, rightW, 'PIHAK KEDUA', { offsetY: yLabel })

  centerIn(left, leftW, o.leftHeader, { offsetY: yCompany })
  centerIn(divider, rightW, o.rightHeader, { offsetY: yCompany })

  centerIn(left, leftW, o.leftName, { bold: true, offsetY: yName })
  centerIn(divider, rightW, o.rightName, { bold: true, offsetY: yName })

  centerIn(left, leftW, o.leftRole, { offsetY: yRole })
  centerIn(divider, rightW, o.rightRole, { offsetY: yRole })
}
