import { existsSync } from 'fs'
import PDFDocument from 'pdfkit'
import {
  createMitraPdfBuffer,
  renderMitraDocumentInto,
  resolveMitraFontDir,
  resolveMitraFonts,
} from './mitra-document.renderer'
import { MITRA_PREVIEW_VALUES } from './mitra-preview-sample'
import {
  CONTRACT_INPUT_FIELD_SEEDS,
  SYSTEM_FIELD_SEEDS,
} from '../contract-templates/template-field-seeds'

/**
 * Regresi pintu tunggal render MITRA.
 *
 * `createMitraPdfBuffer` dipakai DUA jalur: generate kontrak dan pratinjau
 * editor. Tes ini menjaga kontraknya tetap utuh:
 *  - menghasilkan PDF sah (header `%PDF-`) dari blok + nilai saja;
 *  - tidak butuh kontrak/karyawan (murni);
 *  - deterministik untuk input yang sama.
 */

/** Font Times New Roman wajib ada agar PDFKit bisa mengukur teks. */
function fontsAvailable(): boolean {
  return existsSync(resolveMitraFonts().regular)
}

/** Hitung `/Type /Page` (bukan `/Pages`) — penanda jumlah halaman PDF. */
function countPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

/**
 * Font Times New Roman wajib ada agar PDFKit bisa mengukur teks. Bila tidak ada,
 * tes yang merender PDF di-skip dengan jelas (bukan gagal) — pola yang sama
 * dengan `pkwt-document.renderer.spec.ts`.
 */
const maybe = fontsAvailable() ? it : it.skip

const blocks = [
  { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
  { id: 'p1', type: 'paragraph', text: 'Dibuat pada {{doc.hariTanggal}} oleh:' },
  { id: 'a1', type: 'article', heading: 'PASAL 1\nRUANG LINGKUP', paragraphs: ['1. Nama mitra {{employee.fullName}}.'] },
  { id: 'sig', type: 'signature', leftRole: 'PIHAK PERTAMA', rightRole: 'PIHAK KEDUA' },
]

describe('mitra-document.renderer', () => {
  it('resolveMitraFonts menunjuk file Times New Roman', () => {
    const fonts = resolveMitraFonts()
    expect(fonts.regular).toContain('times.ttf')
    expect(fonts.bold).toContain('timesbd.ttf')
    expect(fonts.italic).toContain('timesi.ttf')
    expect(resolveMitraFontDir()).toBeTruthy()
  })

  it('resolveMitraFonts menyediakan boldItalic (jatuh ke BOLD bila tidak ada)', () => {
    // `timesbi.ttf` tidak selalu tersedia di paket msttcorefonts. Yang penting:
    // `boldItalic` SELALU terisi, sehingga registrasi font tidak pernah kosong
    // dan teks bold+italic tetap terbentuk (minimal sebagai bold).
    const fonts = resolveMitraFonts()
    expect(typeof fonts.boldItalic).toBe('string')
    expect(fonts.boldItalic).toBeTruthy()
    expect(fonts.boldItalic).toMatch(/timesbi\.ttf|timesbd\.ttf/)
  })

  const maybe = fontsAvailable() ? it : it.skip

  maybe('menghasilkan buffer PDF sah dari blok + nilai saja (tanpa kontrak)', async () => {
    const buffer = await createMitraPdfBuffer({
      blocks,
      values: MITRA_PREVIEW_VALUES,
      fonts: resolveMitraFonts(),
    })

    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('menghasilkan ukuran dan struktur yang sama untuk input yang sama', async () => {
    const opts = { blocks, values: MITRA_PREVIEW_VALUES, fonts: resolveMitraFonts() }
    const [a, b] = await Promise.all([createMitraPdfBuffer(opts), createMitraPdfBuffer(opts)])
    // PDFKit menyematkan ID/timestamp dokumen, jadi byte tidak identik.
    // Yang harus stabil: panjang dan jumlah halaman.
    expect(a.length).toBe(b.length)
    expect(countPages(a)).toBe(countPages(b))
    expect(countPages(a)).toBeGreaterThan(0)
  })

  maybe('tidak mencetak nama variabel placeholder ke dokumen', async () => {
    const buffer = await createMitraPdfBuffer({
      blocks: [{ id: 'p', type: 'paragraph', text: 'Nilai kosong: {{custom.tidak_ada}}.' }],
      values: {},
      fonts: resolveMitraFonts(),
    })
    // PDF terkompresi; kehadiran `%PDF-` cukup untuk memastikan render selesai
    // tanpa melempar. Kebocoran token diuji terpisah di mitra-layout.engine.spec.ts.
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('MITRA document renderer — mark & perataan di PDF NYATA', () => {
  const base = () => ({
    values: { ...MITRA_PREVIEW_VALUES },
    fonts: resolveMitraFonts(),
    title: 'PERJANJIAN KEMITRAAN',
    numberLabel: 'Nomor: 1/X/2026',
    dateLabel: 'Tanggal 1 Januari 2026',
  })

  const withBlocks = (text: string, extra: Record<string, unknown> = {}) => [
    { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
    { id: 'p1', type: 'paragraph', text, ...extra },
    { id: 'sig', type: 'signature' },
  ]

  maybe('mark tidak mengubah jumlah halaman', async () => {
    const plain = await createMitraPdfBuffer({ ...base(), blocks: withBlocks('Dibuat oleh para pihak.') })
    const marked = await createMitraPdfBuffer({ ...base(), blocks: withBlocks('Dibuat oleh **para pihak**.') })
    expect(countPages(marked)).toBe(countPages(plain))
  })

  maybe('keempat nilai perataan tidak mengubah jumlah halaman', async () => {
    const plain = await createMitraPdfBuffer({ ...base(), blocks: withBlocks('Dibuat oleh para pihak.') })
    for (const align of ['left', 'center', 'right', 'justify']) {
      const aligned = await createMitraPdfBuffer({
        ...base(),
        blocks: withBlocks('Dibuat oleh para pihak.', { align }),
      })
      expect(countPages(aligned)).toBe(countPages(plain))
    }
  })

  maybe('mark + perataan bersamaan tetap menghasilkan PDF sah', async () => {
    const buffer = await createMitraPdfBuffer({
      ...base(),
      blocks: withBlocks('**Tebal** dan *miring* __garis__.', { align: 'center' }),
    })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1000)
  })

  maybe('perataan center pada blok article tetap menghasilkan PDF sah', async () => {
    const buffer = await createMitraPdfBuffer({
      ...base(),
      blocks: [
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        {
          id: 'a1',
          type: 'article',
          heading: 'PASAL 1\nRUANG LINGKUP',
          paragraphs: ['1. Nama mitra {{employee.fullName}}.'],
          align: 'center',
        },
        { id: 'sig', type: 'signature' },
      ],
    })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

describe('MITRA — blok penutup (tempat/tanggal + organisasi)', () => {
  const maybeRender = fontsAvailable() ? it : it.skip

  maybeRender('dicetak DI LUAR kotak, sebelum tabel tanda tangan', () => {
    const doc = new PDFDocument({
      size: [595.5, 842.25],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    })
    // Konsumsi stream supaya PDFKit tidak menahan buffer.
    doc.on('data', () => {})

    renderMitraDocumentInto(doc, {
      blocks: [
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        { id: 'p', type: 'paragraph', text: 'Dibuat pada {{doc.hariTanggal}}.' },
        {
          id: 'place',
          type: 'closing',
          text: 'Bekasi, {{doc.docDate}}\nKOPERASI KARYAWAN PT SANKYU INDONESIA INTERNATIONAL\nUNIT KANTOR PUSAT',
        },
        { id: 'sig', type: 'signature' },
      ],
      values: { 'doc.docDate': '01 September 2026', 'doc.hariTanggal': 'Selasa, 1 September 2026' },
      fallbackTitle: 'PERJANJIAN KEMITRAAN',
      fonts: resolveMitraFonts(),
    })

    const box = (doc as any).__mitraSignatureBox
    expect(box.closingLineCount).toBe(3)
    expect(box.closingTop).toBeGreaterThan(box.boxBottomOnLast)
    expect(box.closingBottom).toBeGreaterThan(box.closingTop)
    // Tabel tanda tangan berada SETELAH teks penutup.
    expect(box.top).toBeGreaterThanOrEqual(box.closingBottom)
    doc.end()
  })

  maybeRender('tanpa blok penutup, tabel tanda tangan tetap seperti sebelumnya', () => {
    const doc = new PDFDocument({
      size: [595.5, 842.25],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    })
    doc.on('data', () => {})

    renderMitraDocumentInto(doc, {
      blocks: [
        { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
        { id: 'p', type: 'paragraph', text: 'Isi.' },
        { id: 'sig', type: 'signature' },
      ],
      values: {},
      fallbackTitle: 'PERJANJIAN KEMITRAAN',
      fonts: resolveMitraFonts(),
    })

    const box = (doc as any).__mitraSignatureBox
    expect(box.closingLineCount).toBe(0)
    // Perilaku lama: `gapFromBox` (50) dari kotak, tanpa teks penutup.
    expect(box.top - box.boxBottomOnLast).toBeCloseTo(50, 0)
    doc.end()
  })

  /**
   * `fieldSpacing` blok penutup: jarak hanya antar BARIS LOGIS. Karena tinggi
   * zona tanda tangan dipakai untuk memutuskan pemendekan kotak, nilai ini
   * harus benar-benar menambah `closingBottom` — kalau tidak, tanda tangan bisa
   * menimpa teks penutup.
   */
  maybeRender('fieldSpacing menambah jarak antar baris logis penutup', () => {
    const render = (fieldSpacing?: number) => {
      const doc = new PDFDocument({
        size: [595.5, 842.25],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
      })
      doc.on('data', () => {})
      renderMitraDocumentInto(doc, {
        blocks: [
          { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
          { id: 'p', type: 'paragraph', text: 'Isi.' },
          {
            id: 'place',
            type: 'closing',
            text: 'BARIS_SATU\nBARIS_DUA\nBARIS_TIGA',
            fieldSpacing,
          },
          { id: 'sig', type: 'signature' },
        ],
        values: {},
        fallbackTitle: 'PERJANJIAN KEMITRAAN',
        fonts: resolveMitraFonts(),
      })
      const box = (doc as any).__mitraSignatureBox
      doc.end()
      return box
    }

    const base = render()
    const spaced = render(10)
    // Jumlah baris tercetak TIDAK berubah (3 baris logis, tanpa lipatan).
    expect(base.closingLineCount).toBe(3)
    expect(spaced.closingLineCount).toBe(3)
    // 3 baris logis → 2 jarak → +20pt.
    expect(spaced.closingBottom - spaced.closingTop).toBeCloseTo(
      base.closingBottom - base.closingTop + 20,
      3,
    )
    // Tabel tanda tangan tetap menempel di bawah teks penutup.
    expect(spaced.top).toBeGreaterThanOrEqual(spaced.closingBottom)
  })
})

describe('MITRA_PREVIEW_VALUES', () => {
  it('mencakup placeholder yang dipakai template MITRA', () => {
    // Field dinamis penting untuk pratinjau yang informatif.
    for (const key of [
      'contract.baseCompensation',
      'contract.duration',
      'contract.termRange',
      'employee.fullName',
      'employee.nik',
      'employee.gender',
      'employee.jobRole',
      'settings.cooperativeChairmanName',
      'doc.hariTanggal',
    ]) {
      expect(MITRA_PREVIEW_VALUES[key]).toBeTruthy()
    }
  })

  it('mencakup SELURUH field katalog yang bisa disisipkan dari picker editor', () => {
    // Penjaga kelas bug: field yang terdaftar di katalog (dan karena itu BISA
    // disisipkan admin lewat picker) tetapi tidak punya nilai contoh akan tampil
    // sebagai `...............` di Pratinjau, sehingga terlihat seperti renderer
    // rusak padahal hanya sample-nya kurang. Diuji terhadap katalog, bukan
    // terhadap satu daftar hardcode, supaya field baru otomatis ikut terjaga.
    const missingSystem = SYSTEM_FIELD_SEEDS
      .map(seed => seed.key)
      .filter(key => !MITRA_PREVIEW_VALUES[key])
    expect(missingSystem).toEqual([])

    const missingContractInput = CONTRACT_INPUT_FIELD_SEEDS
      .map(seed => `custom.${seed.key}`)
      .filter(key => !MITRA_PREVIEW_VALUES[key])
    expect(missingContractInput).toEqual([])
  })

  it('memakai key custom tanpa prefix ganda', () => {
    expect(MITRA_PREVIEW_VALUES['custom.ktp_issued_date']).toBeTruthy()
    expect(MITRA_PREVIEW_VALUES['ktp_issued_date']).toBeUndefined()
  })
})
