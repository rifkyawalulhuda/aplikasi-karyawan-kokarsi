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
    })

    doc.end()
  })
}

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
