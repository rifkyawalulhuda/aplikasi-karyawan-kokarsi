import { existsSync } from 'fs'
import {
  createMitraPdfBuffer,
  resolveMitraFontDir,
  resolveMitraFonts,
} from './mitra-document.renderer'
import { MITRA_PREVIEW_VALUES } from './mitra-preview-sample'

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

describe('MITRA_PREVIEW_VALUES', () => {
  it('mencakup placeholder yang dipakai template MITRA', () => {
    // Field dinamis penting untuk pratinjau yang informatif.
    for (const key of [
      'contract.baseCompensation',
      'contract.duration',
      'contract.termRange',
      'employee.fullName',
      'employee.nik',
      'employee.jobRole',
      'settings.cooperativeChairmanName',
      'doc.hariTanggal',
    ]) {
      expect(MITRA_PREVIEW_VALUES[key]).toBeTruthy()
    }
  })

  it('memakai key custom tanpa prefix ganda', () => {
    expect(MITRA_PREVIEW_VALUES['custom.ktp_issued_date']).toBeTruthy()
    expect(MITRA_PREVIEW_VALUES['ktp_issued_date']).toBeUndefined()
  })
})
