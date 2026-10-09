import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

// `contract-templates.service.ts` meng-import `PrismaService`, yang membuat
// Prisma client saat modul dimuat. URL dummy cukup; koneksi nyata tidak dibuka
// karena test menyuntikkan client tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

/**
 * Unit test `ContractTemplatesService.remove`.
 *
 * Regresi yang dijaga (dulu 500 "Internal server error" di UI):
 *  - template dengan versi/binding field TIDAK bisa dihapus lewat `delete()`
 *    langsung, karena FK `contract_template_versions.templateId` dan
 *    `contract_template_fields.templateId` memakai `ON DELETE RESTRICT`;
 *  - template yang masih dipakai kontrak tetap ditolak;
 *  - kontrak yang menunjuk versi template (FK `SET NULL`) juga menolak hapus,
 *    agar jejak audit "kontrak memakai versi berapa" tidak hilang;
 *  - kegagalan FK yang lolos guard dibalas 409, bukan dibiarkan menjadi 500.
 */
interface TemplateRow {
  id: number
  code: string
  name: string
  templateKey: string
  family: string
}

const template29984: TemplateRow = {
  id: 29984,
  code: 'TEST001',
  name: 'Test001',
  templateKey: 'MITRA_KOMART',
  family: 'MITRA',
}

function makeService(opts: {
  template?: TemplateRow | null
  contractsUsingTemplate?: number
  contractsUsingVersion?: number
  versionIds?: number[]
  deleteError?: unknown
}) {
  const logs: Array<Record<string, unknown>> = []
  const deletedFields: number[] = []
  const deletedVersions: number[] = []
  const deletedTemplates: number[] = []
  const countCalls: Array<Record<string, any>> = []

  // `tx` mewakili `Prisma.TransactionClient` di dalam `$transaction`.
  const tx = {
    contractTemplateField: {
      deleteMany: async ({ where }: { where: { templateId: number } }) => {
        deletedFields.push(where.templateId)
        return { count: opts.versionIds?.length ?? 0 }
      },
    },
    contractTemplateVersion: {
      deleteMany: async ({ where }: { where: { templateId: number } }) => {
        deletedVersions.push(where.templateId)
        return { count: opts.versionIds?.length ?? 0 }
      },
    },
    contractTemplate: {
      delete: async ({ where }: { where: { id: number } }) => {
        if (opts.deleteError) throw opts.deleteError
        deletedTemplates.push(where.id)
        return opts.template
      },
    },
  }

  const client = {
    contractTemplate: {
      findUnique: async () => opts.template ?? null,
    },
    contractTemplateVersion: {
      findMany: async () => (opts.versionIds ?? []).map(id => ({ id })),
    },
    contract: {
      count: async (args: { where?: Record<string, any> }) => {
        countCalls.push(args)
        // Panggilan pertama = pemakaian langsung (`templateId`); berikutnya
        // = kontrak yang menunjuk versi template (`templateVersionId`).
        return args?.where?.templateVersionId
          ? opts.contractsUsingVersion ?? 0
          : opts.contractsUsingTemplate ?? 0
      },
    },
    $transaction: async (cb: (client: unknown) => Promise<unknown>) => cb(tx),
  }

  const activityLog = {
    log: async (dto: Record<string, unknown>) => { logs.push(dto) },
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractTemplatesService } = require('./contract-templates.service')
  // `findOne()` & `remove()` mengakses getter PrismaService
  // (`prisma.contractTemplate`, `prisma.contract`), sedangkan transaksi &
  // query versi memakai `prisma.client`. Tiruan menyediakan keduanya.
  const prisma = {
    client,
    contractTemplate: client.contractTemplate,
    contractTemplateVersion: client.contractTemplateVersion,
    contract: client.contract,
  } as never
  const service = new ContractTemplatesService(prisma, activityLog as never, {} as never)
  return { service, logs, deletedFields, deletedVersions, deletedTemplates, countCalls }
}

describe('ContractTemplatesService.remove', () => {
  it('menghapus binding field, versi, lalu template (bukan delete() langsung)', async () => {
    const { service, logs, deletedFields, deletedVersions, deletedTemplates } = makeService({
      template: template29984,
      versionIds: [64, 74],
    })

    await service.remove(29984, { name: 'tester', role: 'ADMIN' })

    // Urutan penting: anak template (FK RESTRICT) harus dihapus lebih dulu.
    expect(deletedFields).toEqual([29984])
    expect(deletedVersions).toEqual([29984])
    expect(deletedTemplates).toEqual([29984])
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'DELETE',
      module: 'Template Kontrak',
      targetLabel: 'Test001',
      performedBy: 'tester',
      performedByRole: 'ADMIN',
    })
  })

  it('tetap menghapus template yang belum punya versi sama sekali', async () => {
    const { service, deletedFields, deletedVersions, deletedTemplates } = makeService({
      template: template29984,
      versionIds: [],
    })

    await service.remove(29984, { name: 'tester', role: 'ADMIN' })

    expect(deletedFields).toEqual([29984])
    expect(deletedVersions).toEqual([29984])
    expect(deletedTemplates).toEqual([29984])
  })

  it('menolak template yang masih dipakai kontrak (menyebut jumlahnya)', async () => {
    const { service, deletedTemplates } = makeService({
      template: template29984,
      contractsUsingTemplate: 3,
      versionIds: [64, 74],
    })

    await expect(service.remove(29984, { name: 'tester', role: 'ADMIN' }))
      .rejects.toThrow(/sedang dipakai oleh 3 kontrak/i)
    await expect(service.remove(29984, { name: 'tester', role: 'ADMIN' }))
      .rejects.toBeInstanceOf(BadRequestException)
    expect(deletedTemplates).toHaveLength(0)
  })

  it('menolak bila ada kontrak yang menunjuk versi template (jejak audit)', async () => {
    const { service, deletedVersions, deletedTemplates } = makeService({
      template: template29984,
      contractsUsingTemplate: 0,
      contractsUsingVersion: 2,
      versionIds: [64, 74],
    })

    await expect(service.remove(29984, { name: 'tester', role: 'ADMIN' }))
      .rejects.toThrow(/masih dirujuk oleh 2 kontrak melalui versi template-nya/i)
    expect(deletedVersions).toHaveLength(0)
    expect(deletedTemplates).toHaveLength(0)
  })

  it('melempar NotFoundException bila template tidak ada', async () => {
    const { service } = makeService({ template: null })
    await expect(service.remove(999, { name: 'tester', role: 'ADMIN' }))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  it('memetakan pelanggaran FK yang lolos guard menjadi 409, bukan 500', async () => {
    const fkViolation = Object.assign(new Error('Foreign key constraint violated'), {
      code: 'P2003',
      meta: { cause: { originalCode: '23503' } },
    })
    const { service } = makeService({ template: template29984, versionIds: [64], deleteError: fkViolation })

    await expect(service.remove(29984, { name: 'tester', role: 'ADMIN' }))
      .rejects.toBeInstanceOf(ConflictException)
  })

  it('tidak menelan error tak terduga sebagai 409', async () => {
    const unexpected = new Error('koneksi database putus')
    const { service } = makeService({ template: template29984, versionIds: [64], deleteError: unexpected })

    await expect(service.remove(29984, { name: 'tester', role: 'ADMIN' }))
      .rejects.toThrow('koneksi database putus')
  })
})
