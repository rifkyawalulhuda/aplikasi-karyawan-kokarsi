import { BadRequestException } from '@nestjs/common'
import { readFileSync } from 'fs'
import { join } from 'path'

// Env HARUS diset sebelum modul service dimuat — `prisma.service.ts` melempar
// saat impor bila `DATABASE_URL` kosong. Karena itu service di-`require` di
// dalam factory, bukan di-import di puncak berkas (impor TS ter-hoist).
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.FONT_DIR ??= process.platform === 'win32' ? 'C:/Windows/Fonts' : '/usr/share/fonts/truetype/msttcorefonts'

/** Payload bentuk `loadContract()` dengan snapshot yang sudah resolved. */
function payload(family: 'PKWT' | 'MITRA') {
  const content = {
    languages: {
      id: [
        { type: 'title', text: 'KESEPAKATAN KERJA WAKTU TERTENTU' },
        { type: 'paragraph', text: 'Pada hari ini, Kamis, 2 Juli 2026.' },
      ],
      en: [{ type: 'title', text: 'STATED PERIODS LABOUR AGREEMENT' }],
    },
  }
  return {
    contract: {
      id: 1,
      contractNo: '174/KUKP-SII/VII/2026',
      templateSnapshot: { family, contentDefinition: content },
      resolvedTemplateData: { 'employee.jobRole': 'Driver' },
      template: { templateKey: `${family}_DRIVER`, name: `${family} Driver`, family },
    },
    employee: { fullName: 'Ibad Ubaidillah', jobRole: { name: 'Driver' } },
    definition: { title: 'KESEPAKATAN KERJA WAKTU TERTENTU', subtitle: 'STATED PERIODS LABOUR AGREEMENT' },
    missingFields: [],
    meta: {
      contractNo: '174/KUKP-SII/VII/2026',
      positionLabel: 'Driver',
      cooperativeChairmanName: 'Hari Suhono',
      signedDate: '2 Juli 2026',
    },
  }
}

function makeService() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractDocumentService } = require('./contract-document.service')
  return new ContractDocumentService({ contract: { findUnique: async () => null } } as never, {} as never)
}

/** Dokumen PDFKit palsu yang cukup untuk mencatat pemanggilan tanpa I/O. */
function stubDoc() {
  const doc: any = { page: { width: 595.5, height: 842.25 } }
  for (const m of ['font', 'fontSize', 'text', 'save', 'restore', 'addPage', 'image', 'registerFont', 'rect', 'moveTo', 'lineTo', 'lineWidth', 'stroke', 'fill', 'fillColor', 'strokeColor', 'switchToPage', 'end', 'on', 'widthOfString', 'heightOfString']) {
    doc[m] = () => doc
  }
  return doc
}

describe('ContractDocumentService — routing keluarga PKWT', () => {
  it('PKWT snapshot tidak lagi memakai renderer blok generik', () => {
    // Regresi: `renderSnapshotPdf` pernah memanggil `renderBlocks` dengan font
    // builtin `Times-Roman` dan dua aliran kolom tanpa penguncian baris.
    const source = readFileSync(join(__dirname, 'contract-document.service.ts'), 'utf8')
    expect(source).not.toContain('renderBlocks(')
    expect(source).not.toContain('fontRegular:')
    // `'Times-Roman'` masih SAH untuk MITRA (master-nya memang Times), jadi
    // yang diperiksa adalah tidak adanya literals itu di jalur PKWT.
    const pkwt = source.slice(
      source.indexOf('renderPkwtLayoutFromBlocks'),
      source.indexOf('renderMitraLayoutFromBlocks'),
    )
    expect(pkwt).not.toContain("'Times-Roman'")
    expect(pkwt).not.toContain("'Times-Bold'")
  })

  it('memilih jalur PKWT untuk keluarga PKWT', () => {
    const service = makeService()
    const spy = jest.spyOn(service as any, 'renderPkwtLayoutFromBlocks').mockImplementation(() => {})
    ;(service as any).renderSnapshotPdf(stubDoc(), payload('PKWT'))
    expect(spy).toHaveBeenCalled()
  })

  it('memilih jalur MITRA untuk keluarga MITRA', () => {
    const service = makeService()
    const pkwt = jest.spyOn(service as any, 'renderPkwtLayoutFromBlocks').mockImplementation(() => {})
    const mitra = jest.spyOn(service as any, 'renderMitraLayoutFromBlocks').mockImplementation(() => {})
    ;(service as any).renderSnapshotPdf(stubDoc(), payload('MITRA'))
    expect(mitra).toHaveBeenCalled()
    expect(pkwt).not.toHaveBeenCalled()
  })

  it('jalur legacy PKWT menyatu ke mesin yang sama, bukan renderer lama', () => {
    const service = makeService()
    const spy = jest.spyOn(service as any, 'renderPkwtLayoutFromBlocks').mockImplementation(() => {})
    const p = payload('PKWT') as any
    // Legacy: `definition` sudah di-merge `mergeDefinition`, jadi semua field
    // wajib ada (service ini tidak menormalkannya lagi).
    p.definition = {
      family: 'PKWT',
      title: 'KESEPAKATAN KERJA WAKTU TERTENTU',
      subtitle: 'STATED PERIODS LABOUR AGREEMENT',
      openingLine: 'Pada hari ini, Para Pihak sepakat.',
      recitals: ['PIHAK PERTAMA adalah Koperasi Karyawan.'],
      roleLabel: 'Driver',
      locationLine: 'Dengan lokasi kerja di Koperasi.',
      termLine: 'Berlaku sesuai periode kontrak.',
      compensationLabel: 'Upah Karyawan',
      closingParagraphs: ['Demikian Kesepakatan Kerja ini dibuat.'],
      firstPartyLabel: 'Pengusaha/Perusahaan',
      secondPartyLabel: 'Karyawan/employee',
      sections: [],
      requiredFields: [],
      englishSections: {},
    }
    ;(service as any).renderPkwtPdf(stubDoc(), p)
    expect(spy).toHaveBeenCalled()
  })

  it('melempar bila definisi template tidak ditemukan (legacy)', () => {
    const service = makeService()
    const p = payload('PKWT') as any
    p.definition = null
    expect(() => (service as any).renderPkwtPdf(stubDoc(), p)).toThrow(BadRequestException)
  })

  it('jalur generate MITRA memakai resolveMitraFonts (font sama dengan pratinjau)', () => {
    // Regresi: kedua jalur generate MITRA dulu meng-hardcode 3 font TANPA
    // `boldItalic`, sehingga run tebal+miring di PDF hasil generate jatuh ke
    // BOLD tanpa kemiringan — padahal pratinjau editor (yang memakai
    // `resolveMitraFonts()`, lengkap dengan `timesbi.ttf`) menampilkannya benar.
    const source = readFileSync(join(__dirname, 'contract-document.service.ts'), 'utf8')
    expect(source).toContain('import { renderMitraDocumentInto, resolveMitraFonts }')
    // Tepat dua panggilan: `renderMitraLayoutFromBlocks` (snapshot) dan
    // `renderMitraPdf` (legacy) — sama seperti pratinjau editor.
    expect(source.match(/fonts: resolveMitraFonts\(\)/g)?.length).toBe(2)
  })
})
