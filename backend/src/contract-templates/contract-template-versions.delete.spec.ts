import { BadRequestException, NotFoundException } from '@nestjs/common'

// `contract-template-versions.service.ts` meng-import `PrismaService`, yang
// membuat Prisma client saat modul dimuat. URL dummy cukup; koneksi nyata tidak
// dibuka karena test menyuntikkan client tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

/**
 * Unit test `ContractTemplateVersionsService.deleteVersion`.
 *
 * Aturan yang dijaga:
 *  - hanya ARCHIVED/DRAFT yang boleh dihapus (PUBLISHED selalu ditolak);
 *  - versi yang masih dipakai kontrak ditolak (FK `SET NULL` akan menghapus
 *    jejak audit "kontrak memakai versi berapa");
 *  - penghapusan tercatat di activity log.
 */
interface Row {
  id: number
  templateId?: number
  versionNumber: number
  status: string
  template?: { id: number, code: string, name: string, family: string }
}

function makeService(opts: {
  version?: Row | null
  usedByContracts?: number
}) {
  const logs: Array<Record<string, unknown>> = []
  const deletedIds: number[] = []

  const client = {
    contractTemplateVersion: {
      findUnique: async () => opts.version ?? null,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedIds.push(where.id)
        return opts.version
      },
    },
    contract: {
      count: async () => opts.usedByContracts ?? 0,
    },
  }
  const activityLog = {
    log: async (dto: Record<string, unknown>) => { logs.push(dto) },
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractTemplateVersionsService } = require('./contract-template-versions.service')
  const service = new ContractTemplateVersionsService({ client } as never, {} as never, activityLog as never)
  return { service, logs, deletedIds }
}

const archivedVersion = (id = 70, used = 0): Row => ({
  id,
  templateId: 1,
  versionNumber: 3,
  status: 'ARCHIVED',
  template: { id: 1, code: '111', name: '111', family: 'MITRA' },
})

describe('ContractTemplateVersionsService.deleteVersion', () => {
  it('menolak versi PUBLISHED', async () => {
    const { service, deletedIds } = makeService({
      version: { ...archivedVersion(31), status: 'PUBLISHED' },
    })
    await expect(service.deleteVersion(31, { name: 'tester' }))
      .rejects.toBeInstanceOf(BadRequestException)
    await expect(service.deleteVersion(31, { name: 'tester' }))
      .rejects.toThrow(/terbit \(PUBLISHED\) tidak dapat dihapus/i)
    expect(deletedIds).toHaveLength(0)
  })

  it('menolak versi yang masih dipakai kontrak (menyebut jumlahnya)', async () => {
    const { service, deletedIds } = makeService({
      version: archivedVersion(70),
      usedByContracts: 2,
    })
    await expect(service.deleteVersion(70, { name: 'tester' }))
      .rejects.toThrow(/dipakai oleh 2 kontrak, tidak bisa dihapus/i)
    expect(deletedIds).toHaveLength(0)
  })

  it('menghapus versi ARCHIVED yang tidak dipakai + mencatat activity log', async () => {
    const { service, logs, deletedIds } = makeService({
      version: archivedVersion(72),
      usedByContracts: 0,
    })
    await service.deleteVersion(72, { name: 'tester' })

    expect(deletedIds).toEqual([72])
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      action: 'DELETE',
      module: 'Template Kontrak',
      targetLabel: 'Versi 3',
      performedBy: 'tester',
    })
  })

  it('menghapus versi DRAFT yang tidak dipakai', async () => {
    const { service, deletedIds } = makeService({
      version: { ...archivedVersion(81), status: 'DRAFT', versionNumber: 4 },
      usedByContracts: 0,
    })
    await service.deleteVersion(81, { name: 'tester' })
    expect(deletedIds).toEqual([81])
  })

  it('melempar NotFoundException bila versi tidak ada', async () => {
    const { service } = makeService({ version: null })
    await expect(service.deleteVersion(999, { name: 'tester' }))
      .rejects.toBeInstanceOf(NotFoundException)
  })
})
