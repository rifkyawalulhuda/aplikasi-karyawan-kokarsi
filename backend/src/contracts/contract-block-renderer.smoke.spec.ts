import PDFDocument from 'pdfkit'
import * as path from 'path'
import { buildValueMap, renderBlocks } from './contract-block-renderer'

/**
 * Smoke test renderer: pastikan semua jenis blok V1 dapat dirender tanpa error
 * dan menghasilkan PDF non-kosong.
 */
const FONT_DIR = process.platform === 'win32' ? 'C:/Windows/Fonts' : '/usr/share/fonts/truetype/msttcorefonts'

function makeSnapshotContent() {
  return {
    languages: {
      id: [
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        { id: 'subtitle', type: 'subtitle', text: 'Nomor: {{contract.contractNo}}' },
        { id: 'opening', type: 'paragraph', text: 'Perjanjian ini dibuat pada {{doc.hariTanggal}}.' },
        {
          id: 'article-1',
          type: 'article',
          heading: 'PASAL 1\neRUANG LINGKUP',
          paragraphs: ['PIHAK PERTAMA dan {{employee.fullName}} sepakat untuk jangka waktu {{contract.duration}}.'],
        },
        {
          id: 'duties',
          type: 'list',
          style: 'alphabetic',
          items: [{ text: 'pembahasan perkembangan kerja' }, { text: 'hal-hal lain yang perlu dievaluasi' }],
        },
        {
          id: 'compensation',
          type: 'table',
          columns: [
            { key: 'component', label: 'Komponen', width: 55 },
            { key: 'amount', label: 'Jumlah', width: 45, format: 'currency', align: 'right' },
          ],
          rows: [
            { component: 'Upah Pokok', amount: '{{contract.baseCompensation}}' },
            { component: 'Imbalan Kehadiran', amount: '100000' },
          ],
        },
        { id: 'break', type: 'pageBreak' },
        { id: 'closing', type: 'paragraph', text: 'Demikian Perjanjian ini dibuat dalam 2 (dua) rangkap.' },
        { id: 'sig', type: 'signature', leftRole: '(Ketua Koperasi)', rightRole: '(Driver)' },
      ],
      en: [],
    },
  }
}

function renderToBuffer(content: any, resolved: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true })
    const buffers: Buffer[] = []
    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    doc.registerFont('Times-Roman', path.join(FONT_DIR, 'times.ttf'))
    doc.registerFont('Times-Bold', path.join(FONT_DIR, 'timesbd.ttf'))
    doc.registerFont('Times-Italic', path.join(FONT_DIR, 'timesi.ttf'))
    doc.registerFont('Times-BoldItalic', path.join(FONT_DIR, 'timesbi.ttf'))

    const values = buildValueMap(resolved)
    doc.font('Times-Bold').fontSize(14).text('PERJANJIAN KEMITRAAN', 0, 50, { width: doc.page.width, align: 'center' })

    renderBlocks(doc, content.languages.id, { values }, {
      leftX: 34,
      rightX: 310,
      columnWidth: 252,
      topY: 100,
      bottomY: doc.page.height - 50,
      fontRegular: 'Times-Roman',
      fontBold: 'Times-Bold',
      fontItalic: 'Times-Italic',
      fontBoldItalic: 'Times-BoldItalic',
    })

    doc.end()
  })
}

/**
 * Jumlah halaman dari buffer PDF. Pola yang sama dipakai spec MITRA/PKWT:
 * menghitung penanda `/Type /Page` (bukan state internal PDFKit) — yang diuji
 * adalah PDF yang benar-benar ditulis.
 */
const countPages = (buffer: Buffer) =>
  (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

describe('renderBlocks (smoke, PDF nyata)', () => {
  const resolved = {
    'contract.contractNo': { value: '001/KK/2026', displayValue: '001/KK/2026' },
    'contract.duration': { value: '7 (tujuh) bulan', displayValue: '7 (tujuh) bulan' },
    'contract.baseCompensation': { value: 4500000, displayValue: 4500000 },
    'doc.hariTanggal': {
      value: 'x',
      displayValue: 'hari Senin tanggal 31 bulan Agustus tahun 2026',
    },
    'employee.fullName': { value: 'Budi Santoso', displayValue: 'Budi Santoso' },
  }

  it('menghasilkan PDF non-kosong untuk semua tipe blok V1', async () => {
    const buf = await renderToBuffer(makeSnapshotContent(), resolved)
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  }, 30000)

  it('placeholder tanpa nilai tidak membuat render gagal', async () => {
    const content = makeSnapshotContent()
    content.languages.id[2].text = 'Nilai {{custom.belum_diisi}} kosong.'
    const buf = await renderToBuffer(content, resolved)
    expect(buf.length).toBeGreaterThan(2000)
  }, 30000)

  it('table dengan nilai non-numerik tidak crash', async () => {
    const content = makeSnapshotContent()
    ;(content.languages.id[5] as any).rows = [{ component: 'Belum ada', amount: 'Belum ada' }]
    const buf = await renderToBuffer(content, resolved)
    expect(buf.length).toBeGreaterThan(2000)
  }, 30000)

  it('dokumen panjang memicu alur kolom/halaman tanpa error', async () => {
    const content = makeSnapshotContent()
    // duplikasi artikel banyak kali untuk memaksa pindah kolom & halaman
    const many = []
    for (let i = 0; i < 40; i++) {
      many.push({
        id: `art-${i}`,
        type: 'article',
        heading: `PASAL ${i + 2}`,
        paragraphs: [
          'Paragraf panjang untuk menguji alur kolom dan perpindahan halaman pada renderer blok. '.repeat(6),
        ],
      })
    }
    content.languages.id = [...content.languages.id.slice(0, 3), ...many, content.languages.id[content.languages.id.length - 1]]
    const buf = await renderToBuffer(content, resolved)
    expect(buf.length).toBeGreaterThan(5000)
  }, 40000)
})

describe('renderBlocks (smoke, PDF nyata) — mark & align (Fase 2d)', () => {
  const resolved = {
    'contract.contractNo': { value: '001/KK/2026', displayValue: '001/KK/2026' },
    'contract.duration': { value: '7 (tujuh) bulan', displayValue: '7 (tujuh) bulan' },
    'contract.baseCompensation': { value: 4500000, displayValue: 4500000 },
    'doc.hariTanggal': {
      value: 'x',
      displayValue: 'hari Senin tanggal 31 bulan Agustus tahun 2026',
    },
    'employee.fullName': { value: 'Budi Santoso', displayValue: 'Budi Santoso' },
  }

  it('paragraf bermark bold/italic/underline dirender tanpa error', async () => {
    const content = makeSnapshotContent()
    content.languages.id[2].text =
      'Perjanjian **ini** *dibuat* pada {{doc.hariTanggal}} dengan __garis bawah__ dan ***tebal-miring***.'
    const buf = await renderToBuffer(content, resolved)
    expect(buf.length).toBeGreaterThan(2000)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 30000)

  it('mark tidak mengubah jumlah halaman', async () => {
    const plain = makeSnapshotContent()
    const marked = makeSnapshotContent()
    marked.languages.id[2].text = 'Perjanjian **ini** dibuat pada {{doc.hariTanggal}}.'
    plain.languages.id[2].text = 'Perjanjian ini dibuat pada {{doc.hariTanggal}}.'

    expect(countPages(await renderToBuffer(marked, resolved))).toBe(
      countPages(await renderToBuffer(plain, resolved)),
    )
  }, 30000)

  it('keempat nilai align tidak mengubah jumlah halaman', async () => {
    const plain = makeSnapshotContent()
    const plainPages = countPages(await renderToBuffer(plain, resolved))

    for (const align of ['left', 'center', 'right', 'justify']) {
      const content = makeSnapshotContent()
      // Blok mentah dari contentDefinition: tipe array literal di
      // `makeSnapshotContent()` tidak mendeklarasikan `align`.
      const opening: any = { ...content.languages.id[2], align }
      content.languages.id[2] = opening
      expect({ align, pages: countPages(await renderToBuffer(content, resolved)) }).toEqual({
        align,
        pages: plainPages,
      })
    }
  }, 60000)

  it('perataan center pada blok article tetap menghasilkan PDF sah', async () => {
    const content = makeSnapshotContent()
    const article: any = { ...content.languages.id[3], align: 'center' }
    content.languages.id[3] = article
    const buf = await renderToBuffer(content, resolved)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  }, 30000)

  /**
   * Gerbang Fase 2d: mark + align pada dokumen PANJANG (banyak pasal, mengalir
   * lintas kolom dan halaman) tidak boleh menggeser paginasi.
   *
   * Mengikuti pola spec MITRA: hanya kata PERTAMA tiap paragraf yang di-bold
   * (perubahan lebar minimal) sehingga kesimpulan "jumlah halaman sama" tidak
   * mudah dipatahkan oleh selisih metrik glyph bold — yang diuji adalah
   * invariansi TINGGI BARIS, bukan lebar hasil bungkus.
   */
  it('mark + align tidak menggeser paginasi pada dokumen panjang', async () => {
    const build = (decorate: boolean) => {
      const content = makeSnapshotContent()
      const many: any[] = []
      for (let i = 0; i < 40; i++) {
        many.push({
          id: `art-${i}`,
          type: 'article',
          heading: `PASAL ${i + 2}`,
          paragraphs: [
            'Paragraf panjang untuk menguji alur kolom dan perpindahan halaman pada renderer blok. '.repeat(6),
          ],
          ...(decorate ? { align: 'center' } : {}),
        })
      }
      content.languages.id = [
        ...content.languages.id.slice(0, 3),
        ...many,
        content.languages.id[content.languages.id.length - 1],
      ]
      if (decorate) {
        for (const block of content.languages.id as any[]) {
          if (block.type === 'paragraph') block.text = String(block.text).replace(/^(\S+)/, '**$1**')
          if (block.type === 'article') {
            block.paragraphs = (block.paragraphs ?? []).map((p: string) => p.replace(/^(\S+)/, '**$1**'))
          }
        }
      }
      return content
    }

    const plainPages = countPages(await renderToBuffer(build(false), resolved))
    expect(plainPages).toBeGreaterThan(1)
    expect(countPages(await renderToBuffer(build(true), resolved))).toBe(plainPages)
  }, 120000)
})

