/**
 * Kelayakan "Perpanjang" dihitung di server supaya tombol di modal Riwayat
 * Kontrak & Preview Dokumen tidak pernah menawarkan aksi yang pasti ditolak
 * `renew()`.
 *
 * Test ini mengunci dua hal:
 *  1. urutan alasan pada `evaluateRenewEligibility` (status → sudah diperpanjang
 *     → SP3 → kontrak aktif lain), dan
 *  2. penempelan `renewEligibility` pada respons riwayat & detail kontrak.
 */
import { ContractsService, evaluateRenewEligibility } from './contracts.service'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))

const DAY = 86_400_000

/** Tanggal relatif terhadap hari ini agar status hasil hitung dapat diprediksi. */
function daysFromNow(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() + days * DAY)
}

function makeService(overrides: {
  contracts?: any[]
  detail?: any
  successorCount?: number
  otherActiveCount?: number
  sp3?: { id: number } | null
} = {}) {
  const findMany = jest.fn().mockResolvedValue(overrides.contracts ?? [])
  const findUnique = jest.fn().mockResolvedValue(overrides.detail ?? null)
  const count = jest.fn().mockImplementation(async (args: any) => {
    if (args?.where?.parentContractId !== undefined) return overrides.successorCount ?? 0
    return overrides.otherActiveCount ?? 0
  })
  const findFirst = jest.fn().mockResolvedValue(overrides.sp3 ?? null)

  const prisma = {
    contract: { findMany, findUnique, count },
    warningLetter: { findFirst },
    employee: { findUnique: jest.fn().mockResolvedValue({ id: 3, employeeNo: 'E-3', fullName: 'Budi', fotoKaryawan: null }) },
  }

  const service = new ContractsService(
    prisma as any,
    { invalidate: jest.fn() } as any,
    { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    { buildSnapshot: jest.fn().mockResolvedValue(null) } as any,
  )

  return { service, findMany, findUnique, count, findFirst }
}

function contract(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    employeeId: 3,
    contractNo: '001/PKWT/2026',
    startDate: daysFromNow(-300),
    endDate: daysFromNow(20),
    status: 'AKTIF',
    parentContractId: null,
    employee: { employmentStatus: 'AKTIF' },
    ...overrides,
  }
}

describe('evaluateRenewEligibility', () => {
  const eligibleBase = {
    status: 'AKAN_HABIS' as const,
    hasSuccessor: false,
    hasActiveSp3: false,
    hasOtherActiveContract: false,
  }

  it('mengizinkan kontrak Akan Habis tanpa penghalang', () => {
    expect(evaluateRenewEligibility(eligibleBase)).toEqual({ eligible: true })
  })

  it('mengizinkan kontrak Expired tanpa penghalang', () => {
    expect(evaluateRenewEligibility({ ...eligibleBase, status: 'EXPIRED' })).toEqual({ eligible: true })
  })

  it('menolak status di luar Akan Habis/Expired dengan alasan status', () => {
    for (const status of ['AKTIF', 'DRAFT', 'SELESAI', 'DIBATALKAN'] as const) {
      const result = evaluateRenewEligibility({ ...eligibleBase, status })
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('Akan Habis atau Expired')
    }
  })

  it('menolak kontrak yang sudah punya penerus', () => {
    const result = evaluateRenewEligibility({ ...eligibleBase, hasSuccessor: true })
    expect(result).toEqual({ eligible: false, reason: 'Kontrak ini sudah diperpanjang.' })
  })

  it('menolak saat SP3 karyawan masih aktif', () => {
    const result = evaluateRenewEligibility({ ...eligibleBase, hasActiveSp3: true })
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('SP3')
  })

  it('menolak saat karyawan masih punya kontrak aktif lain', () => {
    const result = evaluateRenewEligibility({ ...eligibleBase, hasOtherActiveContract: true })
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('kontrak aktif lain')
  })

  it('mendahulukan alasan "sudah diperpanjang" di atas kontrak aktif lain (penerusnya sendiri)', () => {
    const result = evaluateRenewEligibility({
      ...eligibleBase,
      hasSuccessor: true,
      hasOtherActiveContract: true,
    })
    expect(result.reason).toBe('Kontrak ini sudah diperpanjang.')
  })
})

describe('ContractsService.findHistoryByEmployee — renewEligibility', () => {
  it('menempelkan kelayakan per kontrak dan menyembunyikan perpanjangan kontrak yang sudah punya penerus', async () => {
    const parent = contract({
      id: 10,
      endDate: daysFromNow(-5),
      status: 'AKTIF',
      parentContractId: null,
    })
    const child = contract({
      id: 11,
      startDate: daysFromNow(-4),
      endDate: daysFromNow(360),
      status: 'AKTIF',
      parentContractId: 10,
    })
    const { service } = makeService({ contracts: [child, parent] })

    const result = await service.findHistoryByEmployee(3)
    const byId = new Map(result.contracts.map((c: any) => [c.id, c]))

    // Induk: sudah Expired dan punya penerus → tidak boleh diperpanjang lagi.
    expect(byId.get(10).status).toBe('EXPIRED')
    expect(byId.get(10).renewEligibility).toEqual({
      eligible: false,
      reason: 'Kontrak ini sudah diperpanjang.',
    })

    // Penerus masih Aktif → tombol Perpanjang tidak relevan.
    expect(byId.get(11).status).toBe('AKTIF')
    expect(byId.get(11).renewEligibility.eligible).toBe(false)
  })

  it('menandai kontrak Akan Habis sebagai layak diperpanjang', async () => {
    const soon = contract({ id: 20, endDate: daysFromNow(10) })
    const { service } = makeService({ contracts: [soon] })

    const result = await service.findHistoryByEmployee(3)

    expect(result.contracts[0].status).toBe('AKAN_HABIS')
    expect(result.contracts[0].renewEligibility).toEqual({ eligible: true })
  })

  it('memblokir semua kontrak saat SP3 karyawan masih aktif', async () => {
    const soon = contract({ id: 21, endDate: daysFromNow(10) })
    const { service } = makeService({ contracts: [soon], sp3: { id: 99 } })

    const result = await service.findHistoryByEmployee(3)

    expect(result.contracts[0].renewEligibility.eligible).toBe(false)
    expect(result.contracts[0].renewEligibility.reason).toContain('SP3')
  })

  it('memblokir perpanjangan saat ada kontrak aktif lain pada karyawan yang sama', async () => {
    const expired = contract({ id: 30, endDate: daysFromNow(-2), status: 'AKTIF' })
    const otherActive = contract({
      id: 31,
      startDate: daysFromNow(-1),
      endDate: daysFromNow(300),
      status: 'AKTIF',
    })
    const { service } = makeService({ contracts: [expired, otherActive] })

    const result = await service.findHistoryByEmployee(3)
    const expiredRow = result.contracts.find((c: any) => c.id === 30)

    expect(expiredRow.status).toBe('EXPIRED')
    expect(expiredRow.renewEligibility.reason).toContain('kontrak aktif lain')
  })
})

describe('ContractsService.findOne — renewEligibility', () => {
  it('menyertakan kelayakan pada detail kontrak (dipakai modal Preview Dokumen)', async () => {
    const detail = contract({ id: 40, endDate: daysFromNow(-1), status: 'AKTIF' })
    const { service, count, findFirst } = makeService({ detail })

    const result = await service.findOne(40, { withRenewEligibility: true })

    expect(result.status).toBe('EXPIRED')
    expect(result.renewEligibility).toEqual({ eligible: true })
    expect(count).toHaveBeenCalledTimes(2)
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('menolak kelayakan saat kontrak sudah punya penerus', async () => {
    const detail = contract({ id: 41, endDate: daysFromNow(-1), status: 'AKTIF' })
    const { service } = makeService({ detail, successorCount: 1 })

    const result = await service.findOne(41, { withRenewEligibility: true })

    expect(result.renewEligibility).toEqual({
      eligible: false,
      reason: 'Kontrak ini sudah diperpanjang.',
    })
  })

  it('menolak kelayakan saat masih ada kontrak aktif lain', async () => {
    const detail = contract({ id: 42, endDate: daysFromNow(-1), status: 'AKTIF' })
    const { service } = makeService({ detail, otherActiveCount: 1 })

    const result = await service.findOne(42, { withRenewEligibility: true })

    expect(result.renewEligibility.eligible).toBe(false)
    expect(result.renewEligibility.reason).toContain('kontrak aktif lain')
  })
})
