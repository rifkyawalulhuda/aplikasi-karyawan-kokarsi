// `contract-templates.service.ts` meng-import `PrismaService`, yang membuat
// Prisma client saat modul dimuat. URL dummy cukup; koneksi nyata tidak dibuka
// karena test menyuntikkan client tiruan.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

/**
 * Regresi: admin tidak bisa menonaktifkan template bawaan.
 *
 * Dulu `ensureDefaultTemplates()` (dipanggil tiap `findAll()` / GET
 * `/api/contract-templates`) meng-`upsert` 9 template seed dengan blok `update`
 * yang memaksa `isActive: true` + `version: 1`. Akibatnya PUT "Nonaktifkan"
 * selalu tertimpa pada GET berikutnya, dan editan admin atas
 * name/description/jobRole/contractType ikut dikembalikan.
 *
 * Test ini mengunci kontrak baru:
 *  - seed hanya MEMBUAT template baru (`update` kosong), tidak pernah menimpa;
 *  - `update()` tanpa `isActive` tidak memaksa template menjadi aktif.
 */
interface TemplateRow {
  id: number
  code: string
  name: string
  family: string
  templateKey: string
  isActive: boolean
}

const pkwtDriver: TemplateRow = {
  id: 5,
  code: 'PKWT_DRIVER',
  name: 'PKWT Driver',
  family: 'PKWT',
  templateKey: 'PKWT_DRIVER',
  isActive: false,
}

function makeService() {
  const upsertCalls: any[] = []
  const updateCalls: any[] = []
  const logs: Array<Record<string, unknown>> = []

  // `findUnique` dipakai dua jalur: (a) di dalam loop seed setelah upsert —
  // mengembalikan null agar bootstrap versi dilewati; (b) `findOne()` sebelum
  // `update()`. Nilainya dapat diatur per-test lewat `setFindUnique`.
  let findUniqueResult: TemplateRow | null = null

  const client = {
    contractTemplate: {
      upsert: async (args: any) => { upsertCalls.push(args); return { id: 1 } },
      findUnique: async () => findUniqueResult,
      findMany: async () => [],
      update: async (args: any) => {
        updateCalls.push(args)
        return { ...pkwtDriver, ...args.data }
      },
    },
    contractType: {
      upsert: async () => ({}),
      findMany: async () => [],
    },
    jobRole: { findMany: async () => [] },
    contractTemplateVersion: { count: async () => 0 },
  }

  const prisma = {
    client,
    contractTemplate: client.contractTemplate,
    contractType: client.contractType,
    jobRole: client.jobRole,
  } as never
  const activityLog = { log: async (dto: Record<string, unknown>) => { logs.push(dto) } }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ContractTemplatesService } = require('./contract-templates.service')
  const service = new ContractTemplatesService(prisma, activityLog as never, {} as never)

  return {
    service,
    upsertCalls,
    updateCalls,
    logs,
    setFindUnique: (value: TemplateRow | null) => { findUniqueResult = value },
  }
}

describe('ContractTemplatesService.ensureDefaultTemplates', () => {
  it('membuat template seed dengan blok update KOSONG (tidak menimpa isActive/version/metadata admin)', async () => {
    const { service, upsertCalls } = makeService()

    await service.findAll()

    expect(upsertCalls).toHaveLength(9)
    for (const call of upsertCalls) {
      // `update: {}` → tidak ada satu pun field admin yang ditimpa.
      expect(call.update).toEqual({})
      // Pastikan `create` tetap lengkap (template baru masih dibuat benar).
      expect(call.create).toMatchObject({ code: call.where.code, isActive: true, version: 1 })
    }
  })

  it('tidak mengembalikan isActive pada blok update seed', async () => {
    const { service, upsertCalls } = makeService()

    await service.findAll()

    for (const call of upsertCalls) {
      expect(call.update).not.toHaveProperty('isActive')
      expect(call.update).not.toHaveProperty('version')
      expect(call.update).not.toHaveProperty('name')
      expect(call.update).not.toHaveProperty('description')
      expect(call.update).not.toHaveProperty('jobRoleId')
      expect(call.update).not.toHaveProperty('contractTypeId')
    }
  })
})

describe('ContractTemplatesService.update', () => {
  it('tidak memaksa isActive=true saat payload tidak menyertakan isActive', async () => {
    const { service, updateCalls, setFindUnique } = makeService()
    setFindUnique(pkwtDriver)

    await service.update(
      pkwtDriver.id,
      {
        code: pkwtDriver.code,
        name: pkwtDriver.name,
        family: pkwtDriver.family as never,
        templateKey: pkwtDriver.templateKey,
        description: 'Hanya mengubah deskripsi',
      },
      { name: 'tester', role: 'ADMIN' },
    )

    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].data.isActive).toBeUndefined()
  })

  it('tetap mengirim isActive=false saat admin menonaktifkan', async () => {
    const { service, updateCalls, setFindUnique } = makeService()
    setFindUnique(pkwtDriver)

    await service.update(
      pkwtDriver.id,
      {
        code: pkwtDriver.code,
        name: pkwtDriver.name,
        family: pkwtDriver.family as never,
        templateKey: pkwtDriver.templateKey,
        isActive: false,
      },
      { name: 'tester', role: 'ADMIN' },
    )

    expect(updateCalls[0].data.isActive).toBe(false)
  })
})
