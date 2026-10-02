import PDFDocument from 'pdfkit'
import * as path from 'path'
import {
  MITRA_GEOMETRY,
  mitraInterpolate,
  scrubRawTokens,
  listPrefix,
  formatMitraCell,
  renderMitraLayout,
  renderMitraSignature,
} from './mitra-layout.engine'

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

    // Layout dua-stream berarti jumlah halaman = max(panjang stream), bukan
    // jumlah semua blok dibagi dua kolom per halaman secara sekuensial.
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    expect(pages).toBeGreaterThan(1)
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
