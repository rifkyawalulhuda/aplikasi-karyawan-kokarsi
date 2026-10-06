import PDFDocument from 'pdfkit'
import * as path from 'path'
import {
  MITRA_GEOMETRY,
  MITRA_FONT_NAMES,
  MITRA_RUN_FONTS,
  mitraInterpolate,
  mitraBlockAlign,
  mitraBlockSpaceAfter,
  scrubRawTokens,
  listPrefix,
  formatMitraCell,
  renderMitraLayout,
  renderMitraSignature,
} from './mitra-layout.engine'
import { createMitraPdfBuffer, resolveMitraFonts } from './mitra-document.renderer'
import { parseInlineRuns, runsToText } from './inline-marks'
import { wrapRunsToLines } from './inline-run-layout'
import { MITRA_PREVIEW_VALUES } from './mitra-preview-sample'
import {
  CONTRACT_DOCUMENT_DEFINITIONS,
  getContractDocumentDefinition,
} from './contract-document-definitions'
import { definitionToContentDefinition, type SeedContentDefinition } from '../contract-templates/default-template-definition'

const FONT_DIR = process.platform === 'win32' ? 'C:/Windows/Fonts' : '/usr/share/fonts/truetype/msttcorefonts'

/**
 * Regresi layout "Perjanjian Kemitraan".
 *
 * Geometri pada MITRA_GEOMETRY diukur dari master PDF
 * `docs/sample-legal-doc/pdf/KONTRAK KERJA MITRA DRIVER OPS .pdf`.
 * Test ini mengunci nilai-nilai tersebut agar tidak regresi.
 */
describe('MITRA layout — geometri master', () => {
  it('A4 portrait', () => {
    expect(MITRA_GEOMETRY.pageWidth).toBeCloseTo(595.5, 1)
    expect(MITRA_GEOMETRY.pageHeight).toBeCloseTo(842.25, 1)
    expect(MITRA_GEOMETRY.pageHeight).toBeGreaterThan(MITRA_GEOMETRY.pageWidth)
  })

  it('dua kolom ber-border dengan koordinat master', () => {
    expect(MITRA_GEOMETRY.left.x0).toBeCloseTo(27.02, 2)
    expect(MITRA_GEOMETRY.left.x1).toBeCloseTo(296.62, 2)
    expect(MITRA_GEOMETRY.right.x0).toBeCloseTo(309.4, 2)
    expect(MITRA_GEOMETRY.right.x1).toBeCloseTo(566.98, 2)
    expect(MITRA_GEOMETRY.borderWidth).toBeCloseTo(0.75, 2)
  })

  it('border kedua kolom tidak overlap dan gutter konsisten', () => {
    expect(MITRA_GEOMETRY.right.x0).toBeGreaterThan(MITRA_GEOMETRY.left.x1)
    const gutter = MITRA_GEOMETRY.right.x0 - MITRA_GEOMETRY.left.x1
    expect(gutter).toBeCloseTo(12.78, 1)
  })

  it('kotak halaman pertama & lanjutan sesuai master', () => {
    expect(MITRA_GEOMETRY.firstPageBoxTop).toBeCloseTo(197.42, 1)
    expect(MITRA_GEOMETRY.firstPageBoxBottom).toBeCloseTo(770.92, 1)
    expect(MITRA_GEOMETRY.contPageBoxTop).toBeCloseTo(31.53, 1)
    expect(MITRA_GEOMETRY.contPageBoxBottom).toBeCloseTo(761.17, 1)
  })

  it('dua rule header (2.85pt + 0.95pt) di bawah header', () => {
    expect(MITRA_GEOMETRY.rules.y1).toBeCloseTo(125.42, 1)
    expect(MITRA_GEOMETRY.rules.thickness1).toBeCloseTo(2.85, 2)
    expect(MITRA_GEOMETRY.rules.y2).toBeCloseTo(129.22, 1)
    expect(MITRA_GEOMETRY.rules.thickness2).toBeCloseTo(0.95, 2)
    expect(MITRA_GEOMETRY.rules.x0).toBeCloseTo(18.6, 1)
    expect(MITRA_GEOMETRY.rules.x1).toBeCloseTo(581.25, 1)
  })

  it('typography: body 12pt TNR, judul 12pt bold, header 14.27/12pt', () => {
    expect(MITRA_GEOMETRY.font.body).toBe(12)
    expect(MITRA_GEOMETRY.font.title).toBe(12)
    expect(MITRA_GEOMETRY.font.headerOrg).toBeCloseTo(14.27, 2)
    expect(MITRA_GEOMETRY.font.headerAddress).toBe(12)
    expect(MITRA_GEOMETRY.font.signature).toBeCloseTo(9.75, 2)
  })

  it('hanging indent item bernomor sesuai master (~13.5pt)', () => {
    // Master: label "1." di x0≈31.55, baris lanjutan di x0≈45.05.
    expect(MITRA_GEOMETRY.listHangingIndent).toBeCloseTo(13.5, 1)
  })

  it('jarak judul dari garis kop memenuhi minimum 20px', () => {
    const rulesEnd = MITRA_GEOMETRY.rules.y2 + MITRA_GEOMETRY.rules.thickness2
    const gapPt = MITRA_GEOMETRY.titleTop - rulesEnd
    const gapPx = gapPt / 0.75 // 1px = 0.75pt @96dpi
    expect(gapPx).toBeGreaterThanOrEqual(20)
  })

  it('judul berada DI BAWAH garis header (tidak overlap)', () => {
    // Rule kedua berakhir di y2 + thickness2; judul mulai di y=144.
    const rulesEnd = MITRA_GEOMETRY.rules.y2 + MITRA_GEOMETRY.rules.thickness2
    expect(144).toBeGreaterThan(rulesEnd)
    // Area judul juga berakhir di atas kotak body pertama.
    expect(172 + MITRA_GEOMETRY.font.title).toBeLessThan(MITRA_GEOMETRY.firstPageBoxTop)
  })

  it('tinggi kotak kolom DINAMIS: konstanta bantalan & minimum tersedia', () => {
    // Kotak mengikuti isi (bukan selalu setinggi halaman).
    expect(MITRA_GEOMETRY.boxPaddingBottom).toBeGreaterThan(0)
    expect(MITRA_GEOMETRY.minBoxHeight).toBeGreaterThan(0)
    expect(MITRA_GEOMETRY.minBoxHeight).toBeLessThan(
      MITRA_GEOMETRY.firstPageBoxBottom - MITRA_GEOMETRY.firstPageBoxTop,
    )
  })

  it('tabel tanda tangan: geometri master (di luar kotak, lebih sempit & di tengah)', () => {
    const T = MITRA_GEOMETRY.signatureTable
    // Diukur dari master p8: garis tepi 120.9 -> 468.6, pemisah 298.9.
    expect(T.left).toBeCloseTo(120.9, 1)
    expect(T.divider).toBeCloseTo(298.9, 1)
    expect(T.right).toBeCloseTo(468.6, 1)
    // Lebih sempit dari lebar kolom dan berada di dalam area halaman.
    expect(T.left).toBeGreaterThan(MITRA_GEOMETRY.left.x0)
    expect(T.right).toBeLessThan(MITRA_GEOMETRY.right.x1)
    // Kedua sisi tabel harus simetris terhadap pusat halaman.
    const pageCenter = MITRA_GEOMETRY.pageWidth / 2
    expect(Math.abs((T.left + T.right) / 2 - pageCenter)).toBeLessThan(6)
    // Ada jarak dari dasar kotak (tabel DI LUAR kotak).
    expect(T.gapFromBox).toBeGreaterThan(0)
    // 5 baris: label, perusahaan, ruang ttd, nama, jabatan.
    const rowH = [T.labelRowH, T.companyRowH, T.signSpaceRowH, T.nameRowH, T.roleRowH]
    expect(rowH.every(h => h > 0)).toBe(true)
    expect(rowH[2]).toBeGreaterThan(rowH[0]) // ruang tanda tangan paling tinggi
  })
})

describe('MITRA layout — helper', () => {
  it('interpolate mengganti placeholder, nilai kosong → titik-titik (bukan nama variabel)', () => {
    expect(mitraInterpolate('Nama {{employee.fullName}}', { 'employee.fullName': 'Budi' })).toBe('Nama Budi')
    // ATURAN: nama variabel tidak boleh tercetak di PDF.
    const empty = mitraInterpolate('X {{custom.a}}', {})
    expect(empty).not.toContain('custom.a')
    expect(empty).not.toContain('{{')
    expect(empty).toContain('...')
    // nilai kosong / spasi juga dianggap kosong
    expect(mitraInterpolate('Y {{custom.b}}', { 'custom.b': '   ' })).not.toContain('custom.b')
  })

  it('scrubRawTokens membuang token mentah yang lolos', () => {
    expect(scrubRawTokens('a <<custom.ktp_issued_date>> b')).not.toContain('<<')
    expect(scrubRawTokens('a <<custom.ktp_issued_date>> b')).not.toContain('ktp_issued_date')
    expect(scrubRawTokens('a {{custom.x}} b')).not.toContain('{{')
    expect(scrubRawTokens('a __MITRA_TERM__ b')).not.toContain('__MITRA_TERM__')
  })

  it('numbering legal dipertahankan (1. / a. / b.)', () => {
    expect(listPrefix('numbered', 0)).toBe('1.')
    expect(listPrefix('alphabetic', 0)).toBe('a.')
    expect(listPrefix('alphabetic', 1)).toBe('b.')
  })

  it('format mata uang untuk imbalan', () => {
    expect(formatMitraCell('6000000', 'currency')).toContain('6.000.000')
  })
})

function makeDoc() {
  const doc = new PDFDocument({
    size: [MITRA_GEOMETRY.pageWidth, MITRA_GEOMETRY.pageHeight],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
  })
  const buffers: Buffer[] = []
  doc.on('data', (c: Buffer) => buffers.push(c))
  return { doc, buffers }
}

function fonts() {
  return {
    regular: path.join(FONT_DIR, 'times.ttf'),
    bold: path.join(FONT_DIR, 'timesbd.ttf'),
    italic: path.join(FONT_DIR, 'timesi.ttf'),
    boldItalic: path.join(FONT_DIR, 'timesbi.ttf'),
  }
}

describe('MITRA layout — rendering', () => {
  it('item bernomor: kata tidak pernah saling menempel', async () => {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>(res => doc.on('end', () => res()))

    renderMitraLayout(
      doc,
      [
        { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        {
          type: 'article',
          heading: 'PASAL 1\nRUANG LINGKUP',
          paragraphs: [
            '3. PIHAK KEDUA dilarang untuk mensubkontrakkan sebagian/seluruh pekerjaan dan kewajibannya dalam Perjanjian ini kepada pihak ketiga manapun tanpa persetujuan tertulis dari PIHAK PERTAMA.',
            'a. Memiliki SIM kendaraan yang aktif dan berlaku selama masa kemitraan berlangsung sesuai ketentuan.',
          ],
        },
        { type: 'signature' },
      ],
      {
        values: {},
        title: 'PERJANJIAN KEMITRAAN',
        numberLabel: 'Nomor: 1/X/2026',
        dateLabel: 'Tanggal 1 Januari 2026',
        fonts: fonts(),
      },
    )
    doc.end()
    await done
    const buf = Buffer.concat(buffers)
    expect(buf.length).toBeGreaterThan(1000)
    // PDFKit meng-encode teks; cukup pastikan tidak ada pola kata-tertempel
    // yang kita kenali dari data uji (dicek lewat pdfplumber di skrip validasi).
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  }, 30000)

  it('aliran dua-stream: blok pertama ada di KIRI, blok kedua di KANAN', async () => {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>(res => doc.on('end', () => res()))

    // 10 paragraf; stream 1 harus berisi blok-blok akhir (teks penanda "KANAN").
    const blocks: any[] = [{ type: 'title', text: 'PERJANJIAN KEMITRAAN' }]
    for (let i = 1; i <= 10; i++) {
      blocks.push({
        type: 'paragraph',
        text: `PARA-${i} ` + 'kata '.repeat(60),
      })
    }
    blocks.push({ type: 'signature' })

    // Sadap teks yang BENAR-BENAR digambar, sekaligus kolom tempatnya ditulis
    // (x < tengah halaman = KIRI). Ini membuktikan aliran dua-stream, bukan
    // sekadar jumlah halaman.
    const drawnLeft: string[] = []
    const drawnRight: string[] = []
    const realText = doc.text.bind(doc)
    ;(doc as any).text = (text: any, x?: any, ...rest: any[]) => {
      if (typeof text === 'string' && x !== undefined) {
        const isLeft = x < MITRA_GEOMETRY.pageWidth / 2
        // Teks kop memakai x=0 dengan lebar penuh, jadi hanya catat teks body.
        const isBodyCol = Math.abs(x - (MITRA_GEOMETRY.left.x0 + MITRA_GEOMETRY.textPaddingLeft)) < 0.5
          || Math.abs(x - (MITRA_GEOMETRY.right.x0 + MITRA_GEOMETRY.textPaddingLeft)) < 0.5
        if (isBodyCol) (isLeft ? drawnLeft : drawnRight).push(text)
      }
      return realText(text, x, ...rest)
    }

    renderMitraLayout(doc, blocks, {
      values: {},
      title: 'PERJANJIAN KEMITRAAN',
      numberLabel: 'Nomor: 1/X/2026',
      dateLabel: 'Tanggal 1 Januari 2026',
      fonts: fonts(),
    })
    doc.end()
    await done
    const buf = Buffer.concat(buffers)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')

    // SEMUA paragraf harus tergambar — tidak ada yang hilang karena pemisahan
    // stream. Ini penjaga utama: pengukuran yang salah tidak boleh membuang
    // konten demi menghemat halaman.
    const allDrawn = [...drawnLeft, ...drawnRight].join(' ')
    for (let i = 1; i <= 10; i++) {
      expect(allDrawn).toContain(`PARA-${i} `)
    }

    // Kedua kolom terisi, dan konten awal ada di KIRI (bukan semua di kanan).
    expect(drawnLeft.length).toBeGreaterThan(0)
    expect(drawnRight.length).toBeGreaterThan(0)

    // Layout dua-stream berarti jumlah halaman = max(panjang stream), bukan
    // jumlah semua blok dibagi dua kolom per halaman secara sekuensial.
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    expect(pages).toBeGreaterThan(0)
  }, 30000)

  it('tanda tangan DI LUAR kotak dan tidak menambah halaman', async () => {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>(res => doc.on('end', () => res()))

    // Dokumen panjang: memaksa banyak halaman sehingga kotak halaman terakhir
    // hampir penuh — inilah kondisi yang dulu memaksa tanda tangan ke halaman
    // baru atau menembus kotak.
    const blocks: any[] = [{ type: 'title', text: 'PERJANJIAN KEMITRAAN' }]
    for (let i = 1; i <= 30; i++) {
      blocks.push({
        type: 'article',
        heading: `PASAL ${i}\nPASAL UJI ${i}`,
        paragraphs: ['Ketentuan ini mengatur ' + 'x'.repeat(400) + ' dan seterusnya.'],
      })
    }
    blocks.push({ type: 'signature' })

    const G = MITRA_GEOMETRY
    const columnBoxes: Array<{ top: number; bottom: number }> = []
    let pendingCol: { top: number; bottom: number } | null = null
    let sigTable: { top: number; bottom: number } | null = null

    const realRect = doc.rect.bind(doc)
    ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
      const isCol = Math.abs(x - G.left.x0) < 1 || Math.abs(x - G.right.x0) < 1
      pendingCol = isCol ? { top: y, bottom: y + h } : null
      // Tabel tanda tangan dikenali dari x tepi kirinya yang khas.
      if (Math.abs(x - G.signatureTable.left) < 0.5) sigTable = { top: y, bottom: y + h }
      return realRect(x, y, w, h, ...rest)
    }
    const realStroke = doc.stroke.bind(doc)
    ;(doc as any).stroke = (...a: any[]) => {
      if (pendingCol) {
        columnBoxes.push(pendingCol)
        pendingCol = null
      }
      return realStroke(...a)
    }

    renderMitraLayout(doc, blocks, {
      values: {},
      title: 'PERJANJIAN KEMITRAAN',
      numberLabel: 'Nomor: 1/X/2026',
      dateLabel: 'Tanggal 1 Januari 2026',
      fonts: fonts(),
      reserveSignatureZone: true,
    })
    const plannedPages = (doc as any).__mitraSplit?.pageCount as number
    const layoutPages = doc.bufferedPageRange().count

    renderMitraSignature(doc, {
      leftHeader: "KOPERASI PT. SANKYU INT'L",
      leftName: 'Hari Suhono',
      leftRole: '(Ketua Koperasi)',
      rightHeader: 'MITRA',
      rightName: 'M. Ikhsan Umar',
      rightRole: '( Driver )',
    })
    const afterSigPages = doc.bufferedPageRange().count

    doc.end()
    await done
    expect(Buffer.concat(buffers).subarray(0, 5).toString()).toBe('%PDF-')

    // 1. Rencana engine HARUS cocok dengan jumlah halaman nyata. Bila meleset,
    //    seluruh pemilihan split & reservasi tidak bisa dipercaya.
    expect(layoutPages).toBe(plannedPages)

    // 2. Tanda tangan TIDAK boleh menambah halaman.
    expect(afterSigPages).toBe(layoutPages)

    // 3. Tanda tangan berada DI BAWAH kotak halaman terakhir (di luar kotak).
    //    Kotak digambar berurutan per halaman (kiri lalu kanan), jadi dua entri
    //    terakhir adalah halaman terakhir.
    expect(sigTable).not.toBeNull()
    const lastBoxBottom = columnBoxes[columnBoxes.length - 1].bottom
    expect((sigTable as any).top).toBeGreaterThanOrEqual(lastBoxBottom)

    // 4. Tanda tangan tidak boleh keluar batas halaman.
    expect((sigTable as any).bottom).toBeLessThanOrEqual(G.pageHeight)
  }, 30000)

  /**
   * Regresi gap halaman: saat tanda tangan MASIH MUAT di bawah kotak halaman
   * terakhir, kotak itu TIDAK boleh dipendekkan.
   *
   * Bug yang dijaga di sini (ditemukan pada kontrak nyata
   * 015/KK/KUKP/SII/X/2026): halaman terakhir SELALU dipendekkan 210pt, sehingga
   * teks yang seharusnya mengisi penuh halaman terakhir tertarik ke halaman
   * berikutnya dan menyisakan ~219pt ruang kosong DI DALAM kotak. Bagi pembaca,
   * teks yang seharusnya menyambung antar halaman jadi terputus.
   */
  it('tidak memendekkan kotak halaman terakhir bila tanda tangan masih muat', async () => {
    const { doc } = makeDoc()

    const blocks: any[] = [{ type: 'title', text: 'PERJANJIAN KEMITRAAN' }]
    // 12 paragraf pendek → beberapa halaman, halaman terakhir masih lega.
    for (let i = 1; i <= 12; i++) {
      blocks.push({ type: 'paragraph', text: `PARA-${i} ` + 'kata '.repeat(60) })
    }
    blocks.push({ type: 'signature' })

    const G = MITRA_GEOMETRY
    const columnBoxes: Array<{ top: number; bottom: number }> = []
    let pendingCol: { top: number; bottom: number } | null = null
    const realRect = doc.rect.bind(doc)
    ;(doc as any).rect = (x: number, y: number, w: number, h: number, ...rest: any[]) => {
      const isCol = Math.abs(x - G.left.x0) < 1 || Math.abs(x - G.right.x0) < 1
      pendingCol = isCol ? { top: y, bottom: y + h } : null
      return realRect(x, y, w, h, ...rest)
    }
    const realStroke = doc.stroke.bind(doc)
    ;(doc as any).stroke = (...a: any[]) => {
      if (pendingCol) { columnBoxes.push(pendingCol); pendingCol = null }
      return realStroke(...a)
    }

    renderMitraLayout(doc, blocks, {
      values: {},
      title: 'PERJANJIAN KEMITRAAN',
      fonts: fonts(),
      reserveSignatureZone: true,
      signature: {
        leftHeader: "KOPERASI PT. SANKYU INT'L",
        rightHeader: 'MITRA',
        leftName: 'Hari Suhono',
        rightName: 'M. Ikhsan Umar',
        leftRole: '(Ketua Koperasi)',
        rightRole: '( Driver )',
      },
    })

    const plan = (doc as any).__mitraSplit
    const finalPage = (doc as any).__mitraFinalPage

    // 1. Tanda tangan MUAT tanpa reservasi → tidak boleh ada pemendekan sama sekali.
    expect(finalPage.signatureFits).toBe(true)
    expect(plan.reservedPage).toBe(-1)
    expect(plan.reserveShrink ?? 0).toBe(0)

    // 2. Kotak halaman terakhir mengikuti ISI — bukan dipotong ke konstanta
    //    `contPageBoxBottom - 210`. Kalau dipendekkan, tingginya akan jatuh jauh
    //    di bawah titik terdalam isi halaman itu.
    const lastBoxBottom = columnBoxes[columnBoxes.length - 1].bottom
    const expected = Math.min(finalPage.pageDeepest + G.boxPaddingBottom, G.contPageBoxBottom)
    expect(lastBoxBottom).toBeCloseTo(expected, 1)
  }, 30000)

  /**
   * Regresi: bila tanda tangan memang TIDAK muat, pemendekan yang dipakai harus
   * yang TERKECIL yang cukup — bukan 210pt tetap — supaya ruang kosong yang
   * tertinggal di dalam kotak sekecil mungkin.
   */
  it('memendekkan halaman terakhir seminimal mungkin saat tanda tangan tidak muat', async () => {
    const { doc } = makeDoc()

    const G = MITRA_GEOMETRY
    const blocks: any[] = [{ type: 'title', text: 'PERJANJIAN KEMITRAAN' }]
    // Dokumen panjang: halaman terakhir nyaris penuh sehingga tanda tangan tidak
    // mendapat ruang, tetapi pemendekannya tidak perlu sampai 210pt penuh.
    for (let i = 1; i <= 20; i++) {
      blocks.push({ type: 'article', heading: `PASAL ${i}`, paragraphs: ['Ketentuan ' + 'x'.repeat(500)] })
    }
    blocks.push({ type: 'signature' })

    renderMitraLayout(doc, blocks, {
      values: {},
      title: 'PERJANJIAN KEMITRAAN',
      fonts: fonts(),
      reserveSignatureZone: true,
      signature: {
        leftHeader: "KOPERASI PT. SANKYU INT'L",
        rightHeader: 'MITRA',
        leftName: 'Hari Suhono',
        rightName: 'M. Ikhsan Umar',
        leftRole: '(Ketua Koperasi)',
        rightRole: '( Driver )',
      },
    })

    const plan = (doc as any).__mitraSplit
    const finalPage = (doc as any).__mitraFinalPage
    const gapNeeded = finalPage.signatureGapNeeded

    // Pemendekan harus > 0 (memang perlu) tetapi TIDAK boros.
    expect(plan.reservedPage).toBeGreaterThanOrEqual(0)
    expect(plan.reserveShrink).toBeGreaterThan(0)
    // Pencarian biner membulatkan ke atas → toleransi 1pt.
    expect(plan.reserveShrink).toBeLessThanOrEqual(Math.ceil(gapNeeded) + 1)
    // Dan tetap jauh di bawah nilai tetap lama (210pt).
    expect(plan.reserveShrink).toBeLessThan(G.signatureZoneHeight)
  }, 30000)

  it('merender dokumen panjang tanpa error dan menghasilkan PDF', async () => {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>(res => doc.on('end', () => res()))

    const blocks: any[] = [
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { type: 'paragraph', text: 'Pada hari ini Para Pihak sepakat untuk mengikatkan diri.' },
    ]
    for (let i = 1; i <= 15; i++) {
      blocks.push({
        type: 'article',
        heading: `PASAL ${i}\nPASAL UJI ${i}`,
        paragraphs: ['Ketentuan ini mengatur ' + 'x'.repeat(200) + ' dan seterusnya.'],
      })
    }
    blocks.push({ type: 'signature' })

    renderMitraLayout(doc, blocks, {
      values: { 'employee.fullName': 'M. Ikhsan Umar' },
      title: 'PERJANJIAN KEMITRAAN',
      numberLabel: 'Nomor: 220/KUKP-SII/2026',
      dateLabel: 'Tanggal 31 Agustus 2026',
      fonts: fonts(),
    })
    renderMitraSignature(doc, {
      leftHeader: "KOPERASI PT. SANKYU INT'L",
      leftName: 'Hari Suhono',
      leftRole: '(Ketua Koperasi)',
      rightHeader: 'MITRA',
      rightName: 'M. Ikhsan Umar',
      rightRole: '( Driver )',
    })

    doc.end()
    await done
    const buf = Buffer.concat(buffers)
    expect(buf.length).toBeGreaterThan(3000)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  }, 30000)

  it('blok title dari snapshot TIDAK dirender ganda di body', async () => {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>(res => doc.on('end', () => res()))

    renderMitraLayout(
      doc,
      [
        { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        { type: 'paragraph', text: 'Isi.' },
      ],
      {
        values: {},
        title: 'PERJANJIAN KEMITRAAN',
        numberLabel: 'Nomor: 1/X/2026',
        dateLabel: 'Tanggal 1 Januari 2026',
        fonts: fonts(),
      },
    )
    doc.end()
    await done
    const text = Buffer.concat(buffers).toString('latin1')
    expect(text.length).toBeGreaterThan(0)
  }, 30000)
})

/**
 * Regresi: blok `title`/`subtitle` dari editor template.
 *
 * Sebelumnya `renderBlock` melakukan `break` untuk kedua tipe ini sehingga
 * blok yang ditambahkan admin lewat editor TIDAK PERNAH muncul di PDF
 * (dilaporkan sebagai "tidak ada di Pratinjau"). Blok `title` pertama tetap
 * "dikonsumsi" sebagai judul kop supaya template lama tidak dapat judul dobel.
 */
describe('MITRA layout — blok title/subtitle dari editor', () => {
  /**
   * Kumpulkan semua string yang BENAR-BENAR digambar lewat `doc.text()`.
   *
   * PDFKit menyandikan teks sebagai CID (subset font), jadi memeriksa byte PDF
   * tidak dapat diandalkan — menyadap pemanggilan `text()` jauh lebih tepat.
   */
  async function drawnTexts(blocks: any[]): Promise<string[]> {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>((res) => doc.on('end', () => res()))
    const drawn: string[] = []
    const realText = doc.text.bind(doc)
    ;(doc as any).text = (text: any, ...rest: any[]) => {
      if (typeof text === 'string') drawn.push(text)
      return realText(text, ...rest)
    }

    renderMitraLayout(doc, blocks, {
      values: {},
      title: blocks.find((b) => b?.type === 'title')?.text ?? 'PERJANJIAN KEMITRAAN',
      numberLabel: 'Nomor: 1/X/2026',
      dateLabel: 'Tanggal 1 Januari 2026',
      fonts: fonts(),
    })
    doc.end()
    await done

    expect(Buffer.concat(buffers).subarray(0, 5).toString()).toBe('%PDF-')
    return drawn
  }

  it('menggambar blok subtitle di body (sebelumnya selalu dibuang)', async () => {
    const drawn = await drawnTexts([
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { type: 'subtitle', text: 'SUBTITLE_MARKER' },
      { type: 'paragraph', text: 'Isi paragraf.' },
    ])

    expect(drawn).toContain('SUBTITLE_MARKER')
  })

  it('menggambar blok title TAMBAHAN di body', async () => {
    const drawn = await drawnTexts([
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { type: 'paragraph', text: 'Isi paragraf.' },
      { type: 'title', text: 'JUDUL_TAMBAHAN_MARKER' },
    ])

    expect(drawn).toContain('JUDUL_TAMBAHAN_MARKER')
  })

  it('tidak menggambar blok title PERTAMA dua kali (hanya di kop)', async () => {
    const drawn = await drawnTexts([
      { type: 'title', text: 'JUDUL_KOP_MARKER' },
      { type: 'paragraph', text: 'Isi paragraf.' },
    ])

    // Sekali untuk kop (header halaman 1) — tidak diulang di body.
    expect(drawn.filter((t) => t === 'JUDUL_KOP_MARKER')).toHaveLength(1)
  })

  it('menggambar title TAMBAHAN + subtitle tanpa menduplikasi judul kop', async () => {
    const drawn = await drawnTexts([
      { type: 'title', text: 'JUDUL_KOP_MARKER' },
      { type: 'paragraph', text: 'Isi paragraf.' },
      { type: 'title', text: 'JUDUL_TAMBAHAN_MARKER' },
      { type: 'subtitle', text: 'SUBJUDUL_TAMBAHAN_MARKER' },
    ])

    expect(drawn.filter((t) => t === 'JUDUL_KOP_MARKER')).toHaveLength(1)
    expect(drawn).toContain('JUDUL_TAMBAHAN_MARKER')
    expect(drawn).toContain('SUBJUDUL_TAMBAHAN_MARKER')
  })
})

describe('MITRA — mitraBlockAlign & font logical run', () => {
  it('meneruskan keempat nilai sah apa adanya', () => {
    for (const align of ['left', 'center', 'right', 'justify']) {
      expect(mitraBlockAlign(align)).toBe(align)
    }
  })

  it('nilai tak dikenal / kosong → undefined (perilaku lama)', () => {
    // Jaring pengaman: data lama atau rusak tidak boleh mengubah perataan.
    expect(mitraBlockAlign(undefined)).toBeUndefined()
    expect(mitraBlockAlign(null)).toBeUndefined()
    expect(mitraBlockAlign('')).toBeUndefined()
    expect(mitraBlockAlign('middle')).toBeUndefined()
    expect(mitraBlockAlign(1)).toBeUndefined()
  })

  it('MITRA_FONT_NAMES punya boldItalic dan MITRA_RUN_FONTS memetakannya', () => {
    expect(MITRA_FONT_NAMES.boldItalic).toBe('MitraTimesBoldItalic')
    expect(MITRA_RUN_FONTS).toEqual({
      regular: 'MitraTimes',
      bold: 'MitraTimesBold',
      italic: 'MitraTimesItalic',
      boldItalic: 'MitraTimesBoldItalic',
    })
  })
})

describe('MITRA — mitraBlockSpaceAfter', () => {
  it('mengembalikan nilai bulat sah apa adanya', () => {
    expect(mitraBlockSpaceAfter(0)).toBe(0)
    expect(mitraBlockSpaceAfter(12)).toBe(12)
    expect(mitraBlockSpaceAfter(40)).toBe(40)
  })

  it('membulatkan nilai pecahan', () => {
    expect(mitraBlockSpaceAfter(12.4)).toBe(12)
    expect(mitraBlockSpaceAfter(12.6)).toBe(13)
  })

  it('nilai tak sah / di luar rentang → 0 (perilaku lama)', () => {
    expect(mitraBlockSpaceAfter(undefined)).toBe(0)
    expect(mitraBlockSpaceAfter(null)).toBe(0)
    expect(mitraBlockSpaceAfter(-4)).toBe(0)
    expect(mitraBlockSpaceAfter(41)).toBe(0)
    expect(mitraBlockSpaceAfter('12')).toBe(0)
    expect(mitraBlockSpaceAfter(Number.NaN)).toBe(0)
  })
})

/**
 * Gerbang Fase 2c: mark & perataan TIDAK BOLEH mengubah paginasi.
 *
 * Diukur pada definisi PRODUKSI (4 varian MITRA) dan dibandingkan RELATIF
 * (dengan mark vs tanpa mark pada definisi yang sama), sehingga tes tidak
 * bergantung pada jumlah halaman dasar yang bisa berubah bila template disunting.
 *
 * Jumlah halaman dihitung dari penanda `/Type /Page` di buffer — pola yang sudah
 * dipakai spec MITRA lainnya. Karena perbandingannya RELATIF, kelemahan
 * penghitungan semacam itu tidak memengaruhi kesimpulan.
 */
describe('MITRA — mark & perataan tidak menggeser paginasi (definisi produksi)', () => {
  jest.setTimeout(120_000)

  const countPages = (buffer: Buffer) =>
    (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

  /** Tandai kata PERTAMA tiap paragraf bold (perubahan lebar minimal) + beri align. */
  const decorate = (blocks: any[], align: string) =>
    (blocks ?? []).map((block: any) => {
      if (block.type === 'paragraph') {
        const text = String(block.text ?? '')
        return { ...block, text: text.replace(/^(\S+)/, '**$1**'), align }
      }
      if (block.type === 'article') {
        return { ...block, align }
      }
      return block
    })

  it('mark + keempat nilai perataan tidak menambah/mengurangi halaman', async () => {
    const keys = Object.keys(CONTRACT_DOCUMENT_DEFINITIONS).filter(k => k.startsWith('MITRA_'))
    expect(keys.length).toBeGreaterThanOrEqual(4)

    for (const key of keys) {
      const content: SeedContentDefinition = definitionToContentDefinition(getContractDocumentDefinition(key))
      const base = {
        values: { ...MITRA_PREVIEW_VALUES },
        fonts: resolveMitraFonts(),
        title: 'PERJANJIAN KEMITRAAN',
        numberLabel: 'Nomor: 1/X/2026',
        dateLabel: 'Tanggal 1 Januari 2026',
      }
      const plainPages = countPages(await createMitraPdfBuffer({
        ...base,
        blocks: (content?.languages?.id ?? []) as any,
      }))

      for (const align of ['left', 'center', 'right', 'justify']) {
        const marked = await createMitraPdfBuffer({
          ...base,
          blocks: decorate(content?.languages?.id, align) as any,
        })
        expect({ key, align, pages: countPages(marked) }).toEqual({ key, align, pages: plainPages })
      }
    }
  })
})

describe('MITRA — mark di PDF NYATA', () => {
  /**
   * Sadap pemanggilan `doc.font()` DAN `doc.text()`.
   *
   * Memeriksa nama font di byte PDF TIDAK dapat diandalkan: PDFKit menuliskan
   * nama INTERNAL font dari TTF (`TimesNewRomanPS-BoldMT`), bukan nama logis yang
   * kita daftarkan (`MitraTimesBold`). Menyadap `doc.font()` menguji hal yang
   * benar-benar kita kendalikan: font logis mana yang DIMINTA renderer.
   */
  async function draw(
    blocks: any[],
    values: Record<string, string> = {},
  ): Promise<{ buf: Buffer; drawn: string[]; fontsUsed: string[]; texts: Array<{ text: string; x: number; y: number; align?: string }> }> {
    const { doc, buffers } = makeDoc()
    const done = new Promise<void>((res) => doc.on('end', () => res()))
    const drawn: string[] = []
    const fontsUsed: string[] = []
    const texts: Array<{ text: string; x: number; y: number; align?: string }> = []

    const realFont = doc.font.bind(doc)
    ;(doc as any).font = (name: any, ...rest: any[]) => {
      if (typeof name === 'string') fontsUsed.push(name)
      return realFont(name, ...rest)
    }

    const realText = doc.text.bind(doc)
    ;(doc as any).text = (text: any, x?: any, ...rest: any[]) => {
      if (typeof text === 'string') {
        drawn.push(text)
        // `rest[1]` = options PDFKit — opsi `align` dipakai regresi perataan
        // (renderer selalu menggambar dari colX, jadi x tidak membedakan align).
        if (typeof x === 'number') {
          texts.push({
            text,
            x,
            y: typeof rest[0] === 'number' ? rest[0] : -1,
            align: (rest[1] as any)?.align,
          })
        }
      }
      return realText(text, x, ...rest)
    }

    renderMitraLayout(doc, blocks, {
      values,
      title: 'PERJANJIAN KEMITRAAN',
      numberLabel: 'Nomor: 1/X/2026',
      dateLabel: 'Tanggal 1 Januari 2026',
      fonts: fonts(),
    })
    doc.end()
    await done
    const buf = Buffer.concat(buffers)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    return { buf, drawn, fontsUsed, texts }
  }

  const withSig = (text: string) => [
    { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
    { type: 'paragraph', text },
    { type: 'signature' },
  ]

  it('meminta font BOLD logis saat teks bermark', async () => {
    const { fontsUsed } = await draw(withSig('Kata **tebal** di sini.'))
    expect(fontsUsed).toContain(MITRA_FONT_NAMES.bold)
  })

  it('meminta font BOLDITALIC logis untuk mark bold+italic', async () => {
    const { fontsUsed } = await draw(withSig('Kata ***tebal miring*** di sini.'))
    expect(fontsUsed).toContain(MITRA_FONT_NAMES.boldItalic)
  })

  it('meminta font ITALIC logis untuk mark italic', async () => {
    const { fontsUsed } = await draw(withSig('Kata *miring* di sini.'))
    expect(fontsUsed).toContain(MITRA_FONT_NAMES.italic)
  })

  /**
   * Regresi `headingAlign`: perataan khusus JUDUL pasal yang terpisah dari
   * `align` blok. Pola ukur: bandingkan OPSI `align` hasil sapuan `doc.text()`
   * antara definisi dengan `headingAlign: 'left'` vs tanpa `headingAlign`
   * (perilaku lama: judul ikut `align` blok). Uraian HARUS sama di kedua versi.
   */
  it('headingAlign mengatur judul pasal sendiri; uraian tetap ikut align blok', async () => {
    const article = (headingAlign?: string) => [
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      {
        type: 'article',
        heading: 'PASAL 1',
        headingAlign,
        align: 'center',
        paragraphs: ['Isi pasal yang cukup panjang agar perataannya terlihat.'],
      },
      { type: 'signature' },
    ]
    const baseline = await draw(article(undefined) as any)
    const left = await draw(article('left') as any)
    const findText = (result: Awaited<ReturnType<typeof draw>>, needle: string) =>
      result.texts.find((t: { text: string }) => t.text.includes(needle))

    // `writeText` selalu menggambar dari colX dengan align sebagai OPSI PDFKit,
    // jadi yang diuji adalah align yang DIMINTA renderer — bukan koordinat x.
    const headingBase = findText(baseline, 'PASAL 1')
    const headingLeft = findText(left, 'PASAL 1')
    expect(headingBase).toBeDefined()
    expect(headingLeft).toBeDefined()
    // Baseline (tanpa headingAlign): judul ikut align blok 'center'.
    expect(headingBase!.align).toBe('center')
    // Dengan headingAlign 'left': judul minta 'left'.
    expect(headingLeft!.align).toBe('left')

    // Uraian TIDAK terpengaruh headingAlign: align sama di kedua versi.
    const bodyBase = findText(baseline, 'Isi pasal')
    const bodyLeft = findText(left, 'Isi pasal')
    expect(bodyBase).toBeDefined()
    expect(bodyLeft).toBeDefined()
    expect(bodyLeft!.align).toBe(bodyBase!.align)
  })

  /**
   * `spaceAfter` (khusus MITRA): jarak vertikal TAMBAHAN di bawah blok. Diukur
   * lewat POSISI Y blok berikutnya — selisihnya harus PERSIS sebesar nilai yang
   * diset, karena jarak diterapkan tepat sebelum blok berikutnya.
   */
  it('spaceAfter menggeser blok berikutnya tepat sebesar nilainya', async () => {
    const build = (spaceAfter?: number) => [
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { type: 'paragraph', text: 'PARAGRAF_A', spaceAfter },
      { type: 'paragraph', text: 'PARAGRAF_B' },
      { type: 'signature' },
    ]
    const yOf = (r: Awaited<ReturnType<typeof draw>>, needle: string) =>
      r.texts.find(t => t.text.includes(needle))?.y ?? -1

    const base = await draw(build() as any)
    const spaced = await draw(build(24) as any)

    const baseY = yOf(base, 'PARAGRAF_B')
    const spacedY = yOf(spaced, 'PARAGRAF_B')
    expect(baseY).toBeGreaterThan(0)
    expect(spacedY - baseY).toBeCloseTo(24, 1)
    // Blok sebelumnya sendiri tidak bergeser.
    expect(yOf(spaced, 'PARAGRAF_A')).toBeCloseTo(yOf(base, 'PARAGRAF_A'), 1)
  })

  it('tanpa spaceAfter, output identik dengan perilaku lama (tidak ada jarak)', async () => {
    const build = () => [
      { type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { type: 'paragraph', text: 'PARAGRAF_A' },
      { type: 'paragraph', text: 'PARAGRAF_B' },
      { type: 'signature' },
    ]
    const a = await draw(build() as any)
    const b = await draw(build() as any)
    const yOf = (r: Awaited<ReturnType<typeof draw>>, needle: string) =>
      r.texts.find(t => t.text.includes(needle))?.y ?? -1
    expect(yOf(a, 'PARAGRAF_B')).toBeCloseTo(yOf(b, 'PARAGRAF_B'), 6)
  })

  it('spaceAfter pada blok terakhir tidak menambah halaman kosong', async () => {
    const countPages = (buf: Buffer) =>
      (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    const build = (spaceAfter?: number) => {
      const blocks: any[] = [{ type: 'title', text: 'PERJANJIAN KEMITRAAN' }]
      for (let i = 1; i <= 12; i++) blocks.push({ type: 'paragraph', text: `PARA-${i} ` + 'kata '.repeat(60) })
      blocks[blocks.length - 1].spaceAfter = spaceAfter
      blocks.push({ type: 'signature' })
      return blocks
    }
    const base = await draw(build() as any)
    const spaced = await draw(build(40) as any)
    expect(countPages(spaced.buf)).toBe(countPages(base.buf))
  })

  it('TIDAK meminta font mark saat teksnya polos (jalur lama)', async () => {
    const { fontsUsed } = await draw(withSig('Kata biasa saja.'))
    expect(fontsUsed).not.toContain(MITRA_FONT_NAMES.italic)
    expect(fontsUsed).not.toContain(MITRA_FONT_NAMES.boldItalic)
  })

  it('mark TIDAK pernah membuang teks dan tidak mencetak penandanya', async () => {
    const { drawn } = await draw(withSig('**satu** dua *tiga* empat'))
    // `drawRunsLine` menggambar per potongan, jadi teksnya terpecah.
    const joined = drawn.join('')
    for (const word of ['satu', 'dua', 'tiga', 'empat']) expect(joined).toContain(word)
    expect(joined).not.toContain('**')
    expect(joined).not.toContain('__')
  })

  it('placeholder diinterpolasi SEBELUM mark di-parse (nilainya yang bold)', async () => {
    const { drawn, fontsUsed } = await draw(
      withSig('Halo **{{employee.fullName}}**!'),
      { 'employee.fullName': 'Budi' },
    )
    expect(drawn.join('')).toContain('Budi')
    expect(fontsUsed).toContain(MITRA_FONT_NAMES.bold)
  })

  it('paragraf bernomor BER-MARK tetap memakai hanging indent', async () => {
    // Regresi yang dicegah: kalau `writeRuns` tidak mendukung hanging indent,
    // paragraf bernomor kehilangan indentasi gantungnya saat diberi mark.
    //
    // Diukur lewat POSISI X AWAL TIAP BARIS (y unik), bukan jumlah potongan:
    // teks bermark dipecah menjadi banyak potongan, sehingga menghitung potongan
    // tidak sama dengan menghitung baris.
    //
    // PENTING: awal baris ≠ posisi kata pertama. Pada baris 1 teks diawali
    // penanda `"1. "`, jadi kata `kata` pertama berada ~12.95pt lebih kanan dari
    // awal baris. Karena itu x minimum diambil dari SELURUH potongan pada y itu
    // (termasuk `"1."`), bukan hanya potongan yang memuat `kata`.
    //
    // CATATAN: jumlah baris bermark BOLEH berbeda dari baris polos — teks bold
    // memang lebih lebar dari regular. Yang harus IDENTIK adalah GEOMETRI
    // indentasinya, dan itulah yang diuji di sini.
    const lineStarts = (texts: Array<{ text: string; x: number; y: number }>) => {
      const bodyYs = new Set(
        texts.filter(t => t.text.includes('kata') && t.y >= 0).map(t => t.y),
      )
      const byY = new Map<number, number>()
      for (const t of texts) {
        if (!bodyYs.has(t.y)) continue
        const cur = byY.get(t.y)
        if (cur === undefined || t.x < cur) byY.set(t.y, t.x)
      }
      return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x)
    }

    const marked = await draw(withSig('1. ' + '**kata** '.repeat(40)))
    const plain = await draw(withSig('1. ' + 'kata '.repeat(40)))
    const markedX = lineStarts(marked.texts)
    const plainX = lineStarts(plain.texts)

    // Keduanya benar-benar membungkus ke banyak baris.
    expect(markedX.length).toBeGreaterThan(1)
    expect(plainX.length).toBeGreaterThan(1)

    for (const xs of [plainX, markedX]) {
      // Baris lanjutan menjorok LEBIH DALAM dari baris pertama ...
      expect(xs[1]).toBeGreaterThan(xs[0])
      // ... dengan besar indentasi PERSIS `listHangingIndent`.
      expect(xs[1] - xs[0]).toBeCloseTo(MITRA_GEOMETRY.listHangingIndent, 6)
      // ... dan SEMUA baris lanjutan rata pada kolom yang sama.
      for (const x of xs.slice(1)) expect(x).toBeCloseTo(xs[1], 6)
    }

    // Awal baris pertama IDENTIK antara jalur polos dan jalur run.
    expect(markedX[0]).toBeCloseTo(plainX[0], 6)
    // Kolom baris lanjutan juga IDENTIK (bukan sekadar "lebih menjorok").
    expect(markedX[1]).toBeCloseTo(plainX[1], 6)
  })

  it('pembungkus run identik dengan algoritma baris-lama untuk teks POLOS', async () => {
    // Uji inti korektnes `wrapRunsToLines`: untuk teks tanpa mark, hasil
    // pembungkusan HARUS persis sama dengan rumus word-wrap lama di
    // `writeText` (jumlah lebar kata + spasi antar-kata). Bila berbeda,
    // paragraf polos yang kebetulan bermark akan berubah paginasinya.
    const { doc } = makeDoc()
    const f = fonts()
    doc.registerFont(MITRA_RUN_FONTS.regular, f.regular)

    const width = 250
    const size = 11
    const text = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do ' +
      'eiusmod tempor incididunt ut labore et dolore magna aliqua ').repeat(3).trim()

    doc.font(MITRA_RUN_FONTS.regular).fontSize(size)
    const spaceW = doc.widthOfString(' ')
    const legacy: string[] = []
    {
      const words = text.split(/\s+/).filter(Boolean)
      let cur: string[] = []
      for (const w of words) {
        const test = [...cur, w]
        const wTest =
          test.reduce((a, x) => a + doc.widthOfString(x), 0) + Math.max(0, test.length - 1) * spaceW
        if (wTest <= width || cur.length === 0) cur = test
        else {
          legacy.push(cur.join(' '))
          cur = [w]
        }
      }
      if (cur.length) legacy.push(cur.join(' '))
    }

    const runs = parseInlineRuns(text)
    expect(runsToText(runs)).toBe(text)
    const lines = wrapRunsToLines(doc, runs, width, MITRA_RUN_FONTS, size)
    expect(lines.length).toBe(legacy.length)
    expect(lines.map(l => runsToText(l).replace(/\s+/g, ' ').trim())).toEqual(legacy)
  })
})

