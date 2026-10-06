/**
 * Edit kontrak (Fase 4) — memastikan `PUT /contracts/:id` tidak menghapus data
 * tambahan template dan tidak membiarkan snapshot basi.
 *
 * Dua perilaku di bawah tidak terlihat dari tipe: (1) modal edit selalu mengirim
 * `templateData`, jadi backend harus bisa membedakan "tidak diubah" (undefined)
 * dari "dikosongkan" (`{}`); (2) tanpa membangun ulang snapshot, PDF tetap
 * mencetak tanggal/kompensasi lama karena renderer membaca `resolvedTemplateData`.
 */
import { ContractsService } from './contracts.service'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))

function makeService(existing: Record<string, any>, snapshot: any) {
  const update = jest.fn().mockResolvedValue({ ...existing, id: 7 })
  const prisma = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update
    },
    employee: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    contractTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 5, name: 'Template', isActive: true }) }
  }
  const templateSnapshot = {
    buildSnapshot: jest.fn().mockResolvedValue(snapshot)
  }
  const service = new ContractsService(
    prisma as any,
    { invalidate: jest.fn() } as any,
    { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    templateSnapshot as any
  )
  return { service, update, templateSnapshot }
}

const existingContract = {
  id: 7,
  employeeId: 3,
  contractNo: '001/MITRA/2026',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  signedDate: null,
  status: 'AKTIF',
  contractTypeId: 2,
  templateId: 5,
  baseCompensation: 5000000,
  templateData: { ktp_issued_date: '2026-03-12T00:00:00.000Z' },
  documentUrl: null,
  employee: { employmentStatus: 'AKTIF' }
}

const updateDto = {
  employeeId: 3,
  startDate: '2026-02-01',
  endDate: '2026-12-31',
  contractTypeId: 2,
  templateId: 5,
  signedDate: '2026-02-01',
  baseCompensation: 6000000
}

describe('ContractsService.update — data tambahan template', () => {
  it('mempertahankan templateData lama bila form tidak mengirimkannya', async () => {
    const { service, update, templateSnapshot } = makeService(existingContract, null)

    await service.update(7, { ...updateDto } as any, { name: 'Admin', role: 'ADMIN' })

    expect(templateSnapshot.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 5,
        templateData: existingContract.templateData,
        contract: expect.objectContaining({
          contractNo: '001/MITRA/2026',
          baseCompensation: 6000000
        })
      })
    )
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ templateData: existingContract.templateData })
    }))
  })

  it('memakai templateData kiriman form bila ada', async () => {
    const { service, update } = makeService(existingContract, null)
    const sent = { ktp_issued_date: '2026-04-01T00:00:00.000Z' }

    await service.update(7, { ...updateDto, templateData: sent } as any, { name: 'Admin', role: 'ADMIN' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ templateData: sent })
    }))
  })

  it('menyimpan snapshot hasil build ulang agar PDF tidak memakai nilai lama', async () => {
    const snapshot = {
      templateVersionId: 11,
      templateSnapshot: { templateId: 5, contentDefinition: { sections: [] } },
      resolvedTemplateData: { 'custom.ktp_issued_date': { value: '2026-04-01', displayValue: '1 April 2026' } }
    }
    const { service, update } = makeService(existingContract, snapshot)

    await service.update(7, { ...updateDto, templateData: { ktp_issued_date: '2026-04-01' } } as any, { name: 'Admin', role: 'ADMIN' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        templateVersionId: 11,
        resolvedTemplateData: snapshot.resolvedTemplateData
      })
    }))
  })

  it('tidak menimpa snapshot lama saat template tidak punya versi terbit', async () => {
    // Template legacy → buildSnapshot() mengembalikan null. Kalau null ditulis ke
    // DB, kontrak yang sudah punya dokumen kehilangan binding & resolved data-nya.
    const { service, update } = makeService(existingContract, null)

    await service.update(7, { ...updateDto } as any, { name: 'Admin', role: 'ADMIN' })

    const data = update.mock.calls[0][0].data
    expect(data).not.toHaveProperty('templateVersionId')
    expect(data).not.toHaveProperty('templateSnapshot')
    expect(data).not.toHaveProperty('resolvedTemplateData')
  })
})
const renewDto = {
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  contractTypeId: 2,
  signedDate: '2026-01-01',
  baseCompensation: 5500000
}

function makeRenewService(parent: Record<string, any>, snapshot: any) {
  const create = jest.fn().mockImplementation(({ data }: any) => ({ id: 99, ...data }))
  const prisma = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(parent),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create
    },
    employee: {
      findUnique: jest.fn().mockResolvedValue({
        id: parent.employeeId,
        employmentStatus: 'AKTIF',
        contracts: [],
        offboarding: null
      }),
      update: jest.fn()
    },
    warningLetter: { findFirst: jest.fn().mockResolvedValue(null) },
    contractTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 5, name: 'Template', isActive: true }) }
  }
  const templateSnapshot = {
    buildSnapshot: jest.fn().mockResolvedValue(snapshot)
  }
  const service = new ContractsService(
    prisma as any,
    { invalidate: jest.fn() } as any,
    { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    templateSnapshot as any
  )
  return { service, create, templateSnapshot }
}

const snapshotResult = {
  templateVersionId: 11,
  templateSnapshot: { templateId: 5, contentDefinition: { sections: [] } },
  resolvedTemplateData: { 'custom.ktp_issued_date': { value: '2026-03-12', displayValue: '12 Maret 2026' } }
}

const expiringParent = {
  id: 42,
  employeeId: 3,
  contractNo: '001/MITRA/2025',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  signedDate: null,
  status: 'AKTIF',
  contractTypeId: 2,
  templateId: 5,
  baseCompensation: 5000000,
  templateData: { ktp_issued_date: '2026-03-12T00:00:00.000Z' },
  documentUrl: null,
  employee: { employmentStatus: 'AKTIF' }
}

describe('ContractsService.renew — templateId & snapshot', () => {
  it('mewarisi templateId kontrak induk bila API tidak mengirimkannya', async () => {
    // Jalur ini tidak reachable dari UI (RenewContractModal menandai templateId
    // wajib), tapi API-nya bebas. Sebelum fallback ini ada, kontrak perpanjangan
    // lahir dengan templateId null + snapshot null → field dinamis hilang.
    const { service, create, templateSnapshot } = makeRenewService(expiringParent, snapshotResult)

    await service.renew(42, { ...renewDto } as any)

    expect(templateSnapshot.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 5, templateData: expiringParent.templateData })
    )
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        templateId: 5,
        templateVersionId: 11,
        resolvedTemplateData: snapshotResult.resolvedTemplateData
      })
    }))
  })

  it('tetap memakai templateId kiriman klien bila ada', async () => {
    const { service, create, templateSnapshot } = makeRenewService(expiringParent, snapshotResult)

    await service.renew(42, { ...renewDto, templateId: 7 } as any)

    expect(templateSnapshot.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 7 })
    )
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ templateId: 7 })
    }))
  })

  it('memakai templateData kiriman form dan mengabaikan warisan induk', async () => {
    const { service, templateSnapshot } = makeRenewService(expiringParent, snapshotResult)
    const sent = { ktp_issued_date: '2026-05-01T00:00:00.000Z' }

    await service.renew(42, { ...renewDto, templateId: 5, templateData: sent } as any)

    expect(templateSnapshot.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ templateData: sent })
    )
  })

  it('tetap memperpanjang kontrak legacy yang template induknya belum terbit', async () => {
    // Template legacy → buildSnapshot() null. Perpanjangan harus tetap berhasil
    // (tidak melempar), hanya tanpa snapshot.
    const { service, create } = makeRenewService(expiringParent, null)

    await service.renew(42, { ...renewDto } as any)

    const data = create.mock.calls[0][0].data
    expect(data.templateId).toBe(5)
    expect(data.templateVersionId).toBeUndefined()
    expect(data.templateData).toEqual(expiringParent.templateData)
  })
})

describe('ContractsService — guard template nonaktif', () => {
  const INACTIVE = { id: 9, name: 'PKWT Driver', isActive: false }
  const ACTIVE = { id: 9, name: 'PKWT Driver', isActive: true }

  function build(opts: { templateFor?: (id: number) => any, parent?: any, existing?: any }) {
    const findUniqueTemplate = jest.fn().mockImplementation(({ where }: any) =>
      Promise.resolve(opts.templateFor ? opts.templateFor(where.id) : null),
    )
    const prisma = {
      contractTemplate: { findUnique: findUniqueTemplate },
      contract: {
        findUnique: jest.fn().mockResolvedValue(opts.existing ?? opts.parent ?? null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }: any) => ({ id: 99, ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => ({ ...(opts.existing ?? {}), ...data })),
      },
      employee: { findUnique: jest.fn().mockResolvedValue({ employmentStatus: 'AKTIF', offboarding: null, contracts: [] }), update: jest.fn() },
      warningLetter: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const service = new ContractsService(
      prisma as any,
      { invalidate: jest.fn() } as any,
      { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { buildSnapshot: jest.fn().mockResolvedValue(null) } as any,
    )
    return { service, findUniqueTemplate }
  }

  it('menolak membuat kontrak baru dengan template nonaktif', async () => {
    const { service } = build({ templateFor: () => INACTIVE })

    await expect(service.create(
      { employeeId: 1, templateId: 9, startDate: '2026-01-01', endDate: '2026-12-31' } as any,
      { name: 'Admin', role: 'ADMIN' },
    )).rejects.toThrow(/nonaktif/i)
  })

  it('mengizinkan kontrak baru dengan template aktif', async () => {
    const { service } = build({ templateFor: () => ACTIVE })

    await expect(service.create(
      { employeeId: 1, templateId: 9, startDate: '2026-01-01', endDate: '2026-12-31' } as any,
      { name: 'Admin', role: 'ADMIN' },
    )).resolves.toBeDefined()
  })

  it('menolak perpanjangan yang BERGANTI ke template nonaktif', async () => {
    const parent = { ...expiringParent, templateId: 5 }
    const { service } = build({ templateFor: () => INACTIVE, parent })

    await expect(service.renew(42, { ...renewDto, templateId: 9 } as any))
      .rejects.toThrow(/nonaktif/i)
  })

  it('mengizinkan perpanjangan yang mewarisi template induk walau template nonaktif', async () => {
    // Template = template induk → dikecualikan, guard tidak pernah query template.
    const parent = { ...expiringParent, templateId: 9 }
    const { service, findUniqueTemplate } = build({ templateFor: () => INACTIVE, parent })

    await service.renew(42, { ...renewDto } as any)

    expect(findUniqueTemplate).not.toHaveBeenCalled()
  })

  it('mengizinkan edit kontrak yang tetap memakai template nonaktif yang sama', async () => {
    const existing = { ...existingContract, templateId: 9 }
    const { service, findUniqueTemplate } = build({ templateFor: () => INACTIVE, existing })

    await service.update(7, { ...updateDto, templateId: 9 } as any, { name: 'Admin', role: 'ADMIN' })

    expect(findUniqueTemplate).not.toHaveBeenCalled()
  })

  it('menolak edit yang BERGANTI ke template nonaktif', async () => {
    const existing = { ...existingContract, templateId: 5 }
    const { service } = build({ templateFor: () => INACTIVE, existing })

    await expect(service.update(7, { ...updateDto, templateId: 9 } as any, { name: 'Admin', role: 'ADMIN' }))
      .rejects.toThrow(/nonaktif/i)
  })
})
