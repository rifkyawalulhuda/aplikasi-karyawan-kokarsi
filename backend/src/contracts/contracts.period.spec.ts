/**
 * Blocker periode kontrak: `endDate` harus LEBIH BESAR dari `startDate`.
 *
 * Ditegakkan di server karena form saja tidak cukup — API bisa dipanggil
 * langsung. Sebelum ini `@IsDateString()` adalah satu-satunya validasi tanggal,
 * jadi `endDate < startDate` tersimpan dan kontraknya langsung Expired dengan
 * durasi negatif.
 *
 * Aturan yang dikunci test ini:
 *  - `endDate > startDate` → diterima;
 *  - `endDate == startDate` → ditolak (kontrak satu hari tidak sah);
 *  - `endDate < startDate` → ditolak;
 *  - berlaku untuk create, update, dan renew.
 */
import { BadRequestException } from '@nestjs/common'
import { ContractsService } from './contracts.service'
import { CONTRACT_PERIOD_ERROR, contractPeriodError } from '../shared/contract-period'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))

function makeService() {
  const create = jest.fn().mockResolvedValue({ id: 1 })
  const update = jest.fn().mockResolvedValue({ id: 1 })
  const prisma = {
    contract: {
      findUnique: jest.fn().mockResolvedValue({
        id: 7,
        employeeId: 3,
        templateId: 5,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'AKTIF',
        documentUrl: null,
        templateData: null,
        employee: { employmentStatus: 'AKTIF' },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create,
      update,
    },
    employee: {
      findUnique: jest.fn().mockResolvedValue({
        id: 3,
        employmentStatus: 'AKTIF',
        offboarding: null,
        // `syncEmployeeStatus` membaca `employee.contracts`; tanpa array kosong
        // `resolveEmploymentStatus` gagal menelusuri daftar kontrak.
        contracts: [],
      }),
      update: jest.fn(),
    },
    contractTemplate: { findUnique: jest.fn().mockResolvedValue({ id: 5, name: 'Template', isActive: true }) },
    warningLetter: { findFirst: jest.fn().mockResolvedValue(null) },
  }

  const service = new ContractsService(
    prisma as any,
    { invalidate: jest.fn() } as any,
    { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    { buildSnapshot: jest.fn().mockResolvedValue(null) } as any,
  )

  return { service, prisma, create, update }
}

const validDto = {
  employeeId: 3,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  contractTypeId: 2,
  templateId: 5,
  signedDate: '2026-01-01',
  baseCompensation: 5_000_000,
}

describe('contractPeriodError', () => {
  it('menerima tanggal selesai setelah tanggal mulai', () => {
    expect(contractPeriodError('2026-01-01', '2026-12-31')).toBeNull()
  })

  it('menerima selisih satu hari', () => {
    expect(contractPeriodError('2026-01-01', '2026-01-02')).toBeNull()
  })

  it('menolak tanggal selesai SAMA dengan tanggal mulai', () => {
    expect(contractPeriodError('2026-01-01', '2026-01-01')).toBe(CONTRACT_PERIOD_ERROR)
  })

  it('menolak tanggal selesai lebih kecil dari tanggal mulai', () => {
    expect(contractPeriodError('2026-12-31', '2026-01-01')).toBe(CONTRACT_PERIOD_ERROR)
  })

  it('mengabaikan jam pada timestamp ISO (hari yang sama tetap ditolak)', () => {
    // Dua timestamp di hari kalender yang sama, beda jam → tetap dianggap sama.
    expect(contractPeriodError('2026-01-01T00:00:00', '2026-01-01T23:59:59')).toBe(CONTRACT_PERIOD_ERROR)
  })

  it('mengabaikan jam saat selisihnya satu hari', () => {
    expect(contractPeriodError('2026-01-01T23:30:00', '2026-01-02T00:30:00')).toBeNull()
  })

  it('menolak tanggal yang tidak dapat diurai', () => {
    expect(contractPeriodError('bukan-tanggal', '2026-01-02')).toBe(CONTRACT_PERIOD_ERROR)
  })
})

describe('ContractsService — blocker periode pada create', () => {
  it('menolak kontrak dengan tanggal selesai sebelum tanggal mulai', async () => {
    const { service, create } = makeService()

    await expect(service.create({ ...validDto, startDate: '2026-12-31', endDate: '2026-01-01' } as any, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(CONTRACT_PERIOD_ERROR)

    expect(create).not.toHaveBeenCalled()
  })

  it('menolak kontrak berdurasi nol hari', async () => {
    const { service, create } = makeService()

    await expect(service.create({ ...validDto, startDate: '2026-05-01', endDate: '2026-05-01' } as any, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(CONTRACT_PERIOD_ERROR)

    expect(create).not.toHaveBeenCalled()
  })

  it('menerima periode sah', async () => {
    const { service, create } = makeService()

    await expect(service.create(validDto as any, { name: 'admin', role: 'ADMIN' })).resolves.toBeDefined()
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('ContractsService — blocker periode pada update', () => {
  it('menolak edit yang membalik urutan tanggal', async () => {
    const { service, update } = makeService()

    await expect(service.update(7, { ...validDto, startDate: '2026-12-31', endDate: '2026-01-01' } as any, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(BadRequestException)

    expect(update).not.toHaveBeenCalled()
  })

  it('menolak edit yang membuat tanggal selesai sama dengan tanggal mulai', async () => {
    const { service, update } = makeService()

    await expect(service.update(7, { ...validDto, startDate: '2026-03-01', endDate: '2026-03-01' } as any, { name: 'admin', role: 'ADMIN' }))
      .rejects.toThrow(CONTRACT_PERIOD_ERROR)

    expect(update).not.toHaveBeenCalled()
  })
})

describe('ContractsService — blocker periode pada renew', () => {
  it('menolak perpanjangan yang membalik urutan tanggal', async () => {
    const { service, create } = makeService()

    await expect(service.renew(7, { ...validDto, startDate: '2027-12-31', endDate: '2027-01-01' } as any))
      .rejects.toThrow(CONTRACT_PERIOD_ERROR)

    expect(create).not.toHaveBeenCalled()
  })
})
