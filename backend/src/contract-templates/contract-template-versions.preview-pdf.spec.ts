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
  it('menolak template non-MITRA dengan pesan jelas', async () => {
    const service = makeService({
      id: 1,
      templateId: 5,
      versionNumber: 1,
      status: 'PUBLISHED',
      contentDefinition: MITRA_CONTENT,
      fieldDefinitions: [],
      template: { id: 5, code: 'PKWT_DRIVER', name: 'PKWT Driver', family: 'PKWT' },
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
})
