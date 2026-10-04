import { BadRequestException } from '@nestjs/common'
import { existsSync } from 'fs'
import { resolveMitraFonts } from '../contracts/mitra-document.renderer'

// `contract-template-versions.service.ts` meng-import PrismaService (membuat
// Prisma client saat modul dimuat). URL dummy cukup; koneksi nyata tidak dibuka.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

const fontsAvailable = existsSync(resolveMitraFonts().regular)
const maybe = fontsAvailable ? it : it.skip

const MITRA_CONTENT = {
  languages: {
    id: [
      { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
      { id: 'p1', type: 'paragraph', text: 'Dibuat pada {{doc.hariTanggal}}.' },
      { id: 'sig', type: 'signature', leftRole: 'PIHAK PERTAMA', rightRole: 'PIHAK KEDUA' },
    ],
  },
}

/** Konten PKWT bilingual — kolom kiri ID, kolom kanan EN. */
const PKWT_CONTENT = {
  languages: {
    id: [
      { id: 'title', type: 'title', text: 'KESEPAKATAN KERJA WAKTU TERTENTU' },
      { id: 'subtitle', type: 'subtitle', text: 'STATED PERIODS LABOUR AGREEMENT' },
      { id: 'p1', type: 'paragraph', text: 'Pada hari ini, Kamis, 2 Juli 2026.' },
      {
        id: 'a1',
        type: 'article',
        heading: 'Pasal 1\nMaksud Kesepakatan',
        paragraphs: ['1. Perusahaan mempekerjakan Karyawan sebagai {{employee.jobRole}}.'],
      },
      { id: 'sig', type: 'signature', leftRole: 'Karyawan/employee', rightRole: 'Pengusaha/Perusahaan' },
    ],
    en: [
      { id: 'title', type: 'title', text: 'STATED PERIODS LABOUR AGREEMENT' },
      { id: 'p1', type: 'paragraph', text: 'Today Thursday, dated july 02, 2026,' },
      {
        id: 'a1',
        type: 'article',
        heading: 'Article 1\nPurpose of Agreement',
        paragraphs: ['1. Company employ the Employee for stated periods.'],
      },
    ],
  },
}

function makeService(version: any) {
  const client = {
    contractTemplateVersion: {
      findUnique: async () => version,
      findFirst: async () => null,
    },
    contractTemplateField: { findMany: async () => [] },
    templateFieldDefinition: { findMany: async () => [] },
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  const noop = {} as never
  return new ContractTemplateVersionsService({ client } as never, noop, noop)
}

describe('ContractTemplateVersionsService.renderPreviewPdf', () => {
  it('menolak keluarga template tanpa mesin layout master', async () => {
    const service = makeService({
      id: 1,
      templateId: 5,
      versionNumber: 1,
      status: 'PUBLISHED',
      contentDefinition: MITRA_CONTENT,
      fieldDefinitions: [],
      // `ContractFamily` hanya berisi MITRA/PKWT, jadi nilai lain hanya bisa
      // muncul dari data rusak — guard-nya diuji lewat cast.
      template: { id: 5, code: 'MAGANG_2026', name: 'Magang', family: 'MAGANG' as any },
    })

    await expect(service.renderPreviewPdf(1, {})).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.renderPreviewPdf(1, {})).rejects.toThrow(/Perjanjian Kemitraan/i)
  })

  it('menolak konten kosong', async () => {
    const service = makeService({
      id: 1,
      templateId: 1,
      versionNumber: 1,
      status: 'DRAFT',
      contentDefinition: { languages: { id: [] } },
      fieldDefinitions: [],
      template: { id: 1, code: 'MITRA_KOMART', name: 'Mitra Kasir Komart', family: 'MITRA' },
    })

    await expect(service.renderPreviewPdf(1, {})).rejects.toBeInstanceOf(BadRequestException)
  })

  maybe('MITRA: mengembalikan buffer PDF sah dari contentDefinition tersimpan', async () => {
    const service = makeService({
      id: 1,
      templateId: 1,
      versionNumber: 1,
      status: 'PUBLISHED',
      contentDefinition: MITRA_CONTENT,
      fieldDefinitions: [],
      template: { id: 1, code: 'MITRA_KOMART', name: 'Mitra Kasir Komart', family: 'MITRA' },
    })

    const buffer = await service.renderPreviewPdf(1, {})
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('MITRA: contentDefinition dari body dipakai (editan belum tersimpan)', async () => {
    const service = makeService({
      id: 1,
      templateId: 1,
      versionNumber: 1,
      status: 'DRAFT',
      contentDefinition: MITRA_CONTENT,
      fieldDefinitions: [],
      template: { id: 1, code: 'MITRA_KOMART', name: 'Mitra Kasir Komart', family: 'MITRA' },
    })

    const edited = {
      languages: {
        id: [
          { id: 'title', type: 'title', text: 'PERJANJIAN KEMITRAAN' },
          { id: 'p1', type: 'paragraph', text: 'PARAGRAF HASIL EDIT BELUM DISIMPAN.' },
          { id: 'sig', type: 'signature', leftRole: 'PIHAK PERTAMA', rightRole: 'PIHAK KEDUA' },
        ],
      },
    }

    const buffer = await service.renderPreviewPdf(1, { contentDefinition: edited })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('PKWT: mengembalikan buffer PDF sah dari contentDefinition tersimpan', async () => {
    const service = makeService({
      id: 1,
      templateId: 7,
      versionNumber: 1,
      status: 'PUBLISHED',
      contentDefinition: PKWT_CONTENT,
      fieldDefinitions: [],
      template: { id: 7, code: 'PKWT_DRIVER', name: 'PKWT Driver', family: 'PKWT' },
    })

    const buffer = await service.renderPreviewPdf(1, {})
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  maybe('PKWT: contentDefinition dari body dipakai (editan belum tersimpan)', async () => {
    const service = makeService({
      id: 1,
      templateId: 7,
      versionNumber: 1,
      status: 'DRAFT',
      contentDefinition: PKWT_CONTENT,
      fieldDefinitions: [],
      template: { id: 7, code: 'PKWT_DRIVER', name: 'PKWT Driver', family: 'PKWT' },
    })

    const edited = JSON.parse(JSON.stringify(PKWT_CONTENT))
    edited.languages.id[2].text = 'PARAGRAF HASIL EDIT BELUM DISIMPAN.'

    const buffer = await service.renderPreviewPdf(1, { contentDefinition: edited })
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
