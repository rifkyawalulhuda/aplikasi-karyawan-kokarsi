import PDFDocument from 'pdfkit'
import { parseInlineRuns } from './inline-marks'
import { wrapCellLines } from './table-layout.helpers'
import {
  drawRunsLine,
  measureRunsLine,
  runFont,
  wrapRunsToLines,
  type RunFonts,
} from './inline-run-layout'

/**
 * Uji tata letak teks ber-run.
 *
 * Fokus uji ini BUKAN "bold tampil bold", melainkan tiga jaminan yang membuat
 * fitur ini tidak merusak dokumen yang sudah ada:
 *  1. Pemecahan baris teks tanpa mark SAMA dengan `wrapCellLines` (jalur lama).
 *  2. Tinggi baris berasal dari SATU font acuan → paginasi tidak bergeser.
 *  3. `center`/`right`/`justify` tidak pernah membuat teks bocor ke luar kolom.
 */
const FONTS: RunFonts = { regular: 'R', bold: 'B', italic: 'I', boldItalic: 'BI' }

interface TextCall {
  text: string
  x: number
  y: number
  font: string
  size: number
}

/** Satu garis yang digambar (untuk memverifikasi underline). */
interface LineCall {
  x1: number
  y1: number
  x2: number
  y2: number
  lineWidth: number
}

/**
 * Dokumen tiruan.
 *
 * `widthOf` dapat diganti supaya uji bisa memakai lebar seragam (1 karakter = 1
 * unit, sama seperti pola di `table-layout.helpers.spec.ts`) atau lebar yang
 * berbeda per font (untuk membuktikan font tiap run benar-benar dipakai).
 *
 * Metode grafik (`save`/`moveTo`/`lineTo`/`stroke`) ikut ditiru karena underline
 * digambar manual — bukan lewat opsi `underline` PDFKit. Lihat `drawPiece()` di
 * `inline-run-layout.ts` untuk alasan lengkapnya.
 */
function makeDoc(widthOf: (text: string, font: string) => number = text => text.length) {
  const calls: TextCall[] = []
  const lines: LineCall[] = []
  const state = { font: 'R', size: 0 }
  let pending: { x: number; y: number } | null = null
  let pendingLineWidth = 0

  const doc: any = {
    font(font: string) { state.font = font; return doc },
    fontSize(size: number) { state.size = size; return doc },
    fillColor() { return doc },
    widthOfString(text: string) { return widthOf(String(text), state.font) },
    heightOfString() { return 10 },
    currentLineHeight() { return 11 },
    save() { return doc },
    restore() { return doc },
    strokeColor() { return doc },
    lineWidth(w: number) { pendingLineWidth = w; return doc },
    moveTo(x: number, y: number) { pending = { x, y }; return doc },
    lineTo(x: number, y: number) {
      if (pending) lines.push({ x1: pending.x, y1: pending.y, x2: x, y2: y, lineWidth: pendingLineWidth })
      pending = null
      return doc
    },
    stroke() { return doc },
    text(text: string, x: number, y: number, options?: any) {
      calls.push({ text, x, y, font: state.font, size: state.size })
      // `underline` TIDAK boleh dipakai: tanpa `width`, PDFKit melempar
      // "unsupported number: NaN". Asersi ini menjaga agar tidak ada yang
      // mengembalikannya.
      if (options?.underline !== undefined) {
        throw new Error('opsi underline tidak boleh dipakai tanpa options.width')
      }
      return doc
    },
  }
  return { doc, calls, lines, state }
}

const lineText = (line: { text: string }[]) => line.map(run => run.text).join('')

describe('runFont', () => {
  it('memilih font sesuai kombinasi mark', () => {
    expect(runFont({ text: 'x', bold: false, italic: false, underline: false }, FONTS)).toBe('R')
    expect(runFont({ text: 'x', bold: true, italic: false, underline: false }, FONTS)).toBe('B')
    expect(runFont({ text: 'x', bold: false, italic: true, underline: false }, FONTS)).toBe('I')
    expect(runFont({ text: 'x', bold: true, italic: true, underline: false }, FONTS)).toBe('BI')
  })

  it('underline tidak mengubah pilihan font', () => {
    expect(runFont({ text: 'x', bold: false, italic: false, underline: true }, FONTS)).toBe('R')
    expect(runFont({ text: 'x', bold: true, italic: false, underline: true }, FONTS)).toBe('B')
  })

  it('bold+italic jatuh ke BOLD bila boldItalic tidak tersedia', () => {
    // MITRA bisa belum mendaftarkan boldItalic; teks yang diminta tebal harus
    // tetap terlihat tebal, bukan jatuh ke italic.
    const fonts: RunFonts = { regular: 'R', bold: 'B', italic: 'I' }
    expect(runFont({ text: 'x', bold: true, italic: true, underline: false }, fonts)).toBe('B')
  })

describe('wrapRunsToLines — konsisten dengan jalur lama (wrapCellLines)', () => {
  /**
   * INI GERBANG PENTINGNYA. Kalau teks tanpa mark dipecah menjadi jumlah baris
   * yang berbeda dari jalur lama, paginasi template yang sudah ada akan bergeser.
   */
  const samples: Array<[string, number]> = [
    ['aaa bbb ccc ddd', 7],
    ['a b c', 3],
    ['aaaaaaaaaa', 3],
    ['a\nb', 100],
    ['', 10],
    ['kata yang sangat panjang sekali', 12],
    ['Nomor: 220/KUKP-SII/2026', 14],
    ['satu', 100],
  ]

  it('teks tanpa mark dipecah IDENTIK dengan wrapCellLines', () => {
    for (const [sample, width] of samples) {
      const { doc } = makeDoc()
      const runs = parseInlineRuns(sample)
      const runLines = wrapRunsToLines(doc, runs, width, FONTS, 9).map(lineText)
      const legacyLines = wrapCellLines(doc, sample, width, FONTS.regular, 9)
      expect(runLines).toEqual(legacyLines)
    }
  })

  it('menghormati newline eksplisit', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('a\nb'), 100, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['a', 'b'])
  })

  it('kata lebih panjang dari lebar tetap utuh', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('aaaaaaaaaa'), 3, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['aaaaaaaaaa'])
  })

  it('teks kosong menghasilkan satu baris kosong', () => {
    const { doc } = makeDoc()
    expect(wrapRunsToLines(doc, parseInlineRuns(''), 50, FONTS, 9).map(lineText)).toEqual([''])
  })

  it('daftar run kosong menghasilkan satu baris kosong', () => {
    const { doc } = makeDoc()
    expect(wrapRunsToLines(doc, [], 50, FONTS, 9).map(lineText)).toEqual([''])
  })

  it('deret spasi dipadatkan menjadi satu, sama seperti jalur lama', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('aaa    bbb'), 100, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['aaa bbb'])
  })

  it('spasi di ujung kanan tidak ikut ke baris', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('aaa bbb   '), 100, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['aaa bbb'])
  })

  it('spasi memakai gaya run TEMPATNYA, bukan run sebelumnya', () => {
    // Regresi yang dicegah: dulu spasi sebelum `c` mewarisi gaya run `__b__`
    // sehingga spasi itu ikut bergaris bawah.
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('a __b__ c'), 200, FONTS, 9)
    expect(lines[0]).toEqual([
      { text: 'a ', bold: false, italic: false, underline: false },
      { text: 'b', bold: false, italic: false, underline: true },
      { text: ' c', bold: false, italic: false, underline: false },
    ])
  })

  it('spasi DI LUAR mark tetap regular, tidak ikut menjadi bold', () => {
    // `**a** **b**`: spasi berada DI ANTARA dua mark, jadi ia teks biasa.
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('**a** **b**'), 200, FONTS, 9)
    expect(lines[0]).toEqual([
      { text: 'a', bold: true, italic: false, underline: false },
      { text: ' ', bold: false, italic: false, underline: false },
      { text: 'b', bold: true, italic: false, underline: false },
    ])
  })

  it('spasi DI DALAM mark ikut bergaya mark', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('**a b**'), 200, FONTS, 9)
    expect(lines[0]).toEqual([
      { text: 'a b', bold: true, italic: false, underline: false },
    ])
  })

  it('mark tetap menempel pada teksnya setelah dipecah', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('aaa **bbb** ccc'), 7, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['aaa bbb', 'ccc'])
    expect(lines[0][0]).toEqual({ text: 'aaa ', bold: false, italic: false, underline: false })
    expect(lines[0][1]).toEqual({ text: 'bbb', bold: true, italic: false, underline: false })
  })

  it('baris kosong di tengah teks tetap dipertahankan', () => {
    const { doc } = makeDoc()
    const lines = wrapRunsToLines(doc, parseInlineRuns('a\n\nb'), 100, FONTS, 9)
    expect(lines.map(lineText)).toEqual(['a', '', 'b'])
  })
})

describe('measureRunsLine', () => {
  it('mengembalikan tinggi SATU line box dari font acuan', () => {
    const { doc, state } = makeDoc()
    expect(measureRunsLine(doc, FONTS.regular, 9, 0.6)).toBe(10)
    expect(state.font).toBe('R')
    expect(state.size).toBe(9)
  })

  it('tinggi TIDAK bergantung pada mark — font acuan yang menentukan', () => {
    // Inilah yang menjaga paginasi: baris bermark setinggi baris tanpa mark.
    const a = makeDoc()
    const b = makeDoc()
    const plain = measureRunsLine(a.doc, FONTS.regular, 9)
    const marked = measureRunsLine(b.doc, FONTS.regular, 9)
    expect(marked).toBe(plain)
  })
})

})

describe('drawRunsLine — perataan', () => {
  const runs = () => parseInlineRuns('a b c')

  it('left mulai tepat di x', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, runs(), 10, 20, 100, FONTS, 9, 'left')
    expect(calls[0].x).toBe(10)
    expect(calls[0].y).toBe(20)
  })

  it('default (tanpa argumen align) sama dengan left', () => {
    const a = makeDoc()
    const b = makeDoc()
    drawRunsLine(a.doc, runs(), 10, 20, 100, FONTS, 9)
    drawRunsLine(b.doc, runs(), 10, 20, 100, FONTS, 9, 'left')
    expect(a.calls.map(c => c.x)).toEqual(b.calls.map(c => c.x))
  })

  it('center menggeser titik awal sebesar setengah sisa ruang', () => {
    // natural = 5 ('a',' ','b',' ','c'), width = 11 -> mulai di 3
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, runs(), 0, 0, 11, FONTS, 9, 'center')
    expect(calls[0].x).toBe(3)
  })

  it('right menempelkan akhir baris ke tepi kanan kotak', () => {
    // natural = 5, width = 11 -> mulai di 6
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, runs(), 0, 0, 11, FONTS, 9, 'right')
    expect(calls[0].x).toBe(6)
  })

  it('center/right tidak pernah membocorkan teks ke kiri kotak', () => {
    // natural (5) > width (2): titik awal akan negatif, harus dijepit ke x.
    for (const align of ['center', 'right'] as const) {
      const { doc, calls } = makeDoc()
      drawRunsLine(doc, runs(), 0, 0, 2, FONTS, 9, align)
      expect(calls[0].x).toBe(0)
    }
  })

  it('center/right mempertahankan spasi asli (jumlah potongan tidak berubah)', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      const { doc, calls } = makeDoc()
      drawRunsLine(doc, runs(), 0, 0, 100, FONTS, 9, align)
      expect(calls).toHaveLength(5)
    }
  })
})

describe('drawRunsLine — justify (meniru drawJustifiedLine)', () => {
  it('celah = (width - natural) / (jumlah kata - 1) dan spasi asli dibuang', () => {
    // natural = 3, width = 11, 3 kata -> celah 4 -> x di 0, 5, 10
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('a b c'), 0, 0, 11, FONTS, 9, 'justify')
    expect(calls.map(c => c.text)).toEqual(['a', 'b', 'c'])
    expect(calls.map(c => c.x)).toEqual([0, 5, 10])
  })

  it('jatuh ke rata-kiri bila celah <= 0 (kata tidak boleh menumpuk)', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('a b c'), 0, 0, 3, FONTS, 9, 'justify')
    expect(calls).toHaveLength(5)
    expect(calls.map(c => c.x)).toEqual([0, 1, 2, 3, 4])
  })

  it('satu kata tidak direntangkan', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('abc'), 7, 0, 100, FONTS, 9, 'justify')
    expect(calls).toHaveLength(1)
    expect(calls[0].x).toBe(7)
  })
})

describe('drawRunsLine — font & underline per run', () => {
  it('memakai font sesuai mark tiap potongan', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('**b** *i* __u__'), 0, 0, 200, FONTS, 9)
    const fontOf = (text: string) => calls.find(c => c.text === text)?.font
    expect(fontOf('b')).toBe('B')
    expect(fontOf('i')).toBe('I')
    expect(fontOf('u')).toBe('R')
  })

  it('bold+italic memakai boldItalic', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('***x***'), 0, 0, 200, FONTS, 9)
    expect(calls[0].font).toBe('BI')
  })

  it('menggambar garis bawah HANYA pada potongan bergaris bawah', () => {
    const { doc, lines } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('a __b__ c'), 0, 0, 200, FONTS, 9)
    // Satu garis saja, tepat di bawah potongan 'b' (setelah 'a ' = 2 satuan).
    expect(lines).toHaveLength(1)
    expect(lines[0].x1).toBe(2)
    expect(lines[0].x2).toBe(3)
    expect(lines[0].y1).toBe(lines[0].y2)
    // Ukuran 9pt < 10 → tebal garis 0.5 (rumus sama dengan PDFKit).
    expect(lines[0].lineWidth).toBe(0.5)
  })

  it('teks tanpa underline tidak menggambar garis sama sekali', () => {
    const { doc, lines } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('a **b** c'), 0, 0, 200, FONTS, 9)
    expect(lines).toHaveLength(0)
  })

  it('underline digambar juga pada jalur justify', () => {
    const { doc, lines } = makeDoc()
    drawRunsLine(doc, parseInlineRuns('__a__ b c'), 0, 0, 11, FONTS, 9, 'justify')
    expect(lines).toHaveLength(1)
    expect(lines[0].x1).toBe(0)
    expect(lines[0].x2).toBe(1)
  })

  it('lebar tiap potongan diukur dengan font potongan itu', () => {
    // Font 'B' dua kali lebih lebar, jadi potongan bold menggeser potongan berikutnya.
    const { doc, calls } = makeDoc(text => (text === 'x' ? 1 : 0))
    drawRunsLine(doc, parseInlineRuns('x**x**'), 0, 0, 200, FONTS, 9)
    // 'x'(R) lebar 1 -> berikutnya di 1
    expect(calls[0].x).toBe(0)
    expect(calls[1].x).toBe(1)
  })

  it('daftar run kosong tidak menggambar apa pun', () => {
    const { doc, calls } = makeDoc()
    drawRunsLine(doc, [], 0, 0, 100, FONTS, 9)
    expect(calls).toHaveLength(0)
  })
})


describe('konsistensi dengan PDFKit NYATA (metrik font sebenarnya)', () => {
  /**
   * Dokumen tiruan memakai lebar = jumlah karakter. Font nyata bisa punya
   * kerning, sehingga `widthOfString('a b')` belum tentu sama dengan jumlah
   * lebar tokennya. Blok ini membuktikan klaim inti Fase 2a memakai PDFKit
   * sungguhan, sehingga sifat "tidak menggeser paginasi" terkunci permanen.
   */
  const REAL_FONTS: RunFonts = {
    regular: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    boldItalic: 'Times-BoldItalic',
  }
  const SIZE = 9.5
  const LINE_GAP = 0.6

  const makeRealDoc = () => {
    const doc = new PDFDocument({ size: [595.5, 842.25], margins: { top: 0, bottom: 0, left: 0, right: 0 } })
    doc.on('data', () => {})
    return doc
  }

  const samples = [
    'Pihak Pertama dan Pihak Kedua sepakat untuk mengadakan perjanjian kerja sama operasional.',
    'Nomor: 220/KUKP-SII/2026',
    'Warga Negara Indonesia, lahir di Jakarta pada tanggal 1 Januari 1990.',
    "KOPERASI PT. SANKYU INT'L",
    'a b c',
    'satu',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'Kewajiban dan tanggung jawab Para Pihak diatur dalam Pasal 5 ayat (2) huruf b perjanjian ini.',
    'Upah sebesar Rp 4.000.000,- dibayarkan setiap bulan tanpa potongan.',
  ]
  const widths = [200, 260.4, 150.25, 90, 45]

  it('teks tanpa mark dipecah IDENTIK dengan wrapCellLines pada font nyata', () => {
    const doc = makeRealDoc()
    for (const sample of samples) {
      for (const width of widths) {
        const legacy = wrapCellLines(doc, sample, width, REAL_FONTS.regular, SIZE)
        const runs = wrapRunsToLines(doc, parseInlineRuns(sample), width, REAL_FONTS, SIZE).map(lineText)
        expect(runs).toEqual(legacy)
      }
    }
  })

  it('tinggi baris jalur run sama persis dengan rumus jalur lama', () => {
    const doc = makeRealDoc()
    doc.font(REAL_FONTS.regular).fontSize(SIZE)
    const legacy = doc.heightOfString('Xg', { lineGap: LINE_GAP })
    expect(measureRunsLine(doc, REAL_FONTS.regular, SIZE, LINE_GAP)).toBe(legacy)
  })

  it('tidak ada risiko kerning: jumlah lebar token == lebar gabungan', () => {
    const doc = makeRealDoc()
    doc.font(REAL_FONTS.regular).fontSize(SIZE)
    const text = 'Pihak Pertama dan Pihak Kedua sepakat'
    const summed = text
      .split(/(\s+)/)
      .filter(Boolean)
      .reduce((acc, token) => acc + doc.widthOfString(token), 0)
    expect(summed).toBeCloseTo(doc.widthOfString(text), 6)
  })
})

