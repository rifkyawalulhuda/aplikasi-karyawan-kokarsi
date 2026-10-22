/**
 * Hapus dokumen tanda tangan kontrak.
 *
 * `update()` mengunci `startDate`, `endDate`, `baseCompensation`, dan
 * `employeeId` selama `documentUrl` terisi, sementara sebelumnya tidak ada
 * jalur untuk mengosongkannya — kontrak jadi terkunci permanen. Spec ini
 * menjaga kontrak perilaku `clearDocument()`: kolom DB dikosongkan, file fisik
 * dihapus, dan tindakan tercatat di log aktivitas.
 */
import { ContractsService } from './contracts.service'
import { deleteUploadedFile } from '../shared/file-cleanup.util'

jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))
jest.mock('../shared/file-cleanup.util', () => ({ deleteUploadedFile: jest.fn() }))

function makeService(existing: Record<string, any>) {
  const update = jest.fn().mockResolvedValue({ ...existing, documentUrl: null })
  const log = jest.fn().mockResolvedValue(undefined)
  const prisma = {
    contract: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update
    }
  }
  const service = new ContractsService(
    prisma as any,
    { invalidate: jest.fn() } as any,
    { generateNotifications: jest.fn().mockResolvedValue(undefined) } as any,
    { log } as any,
    { buildSnapshot: jest.fn() } as any
  )
  return { service, update, log }
}

const contractWithDocument = {
  id: 7,
  employeeId: 3,
  contractNo: '001/MITRA/2026',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  signedDate: new Date('2026-01-01'),
  status: 'AKTIF',
  contractTypeId: 2,
  templateId: 5,
  baseCompensation: 5000000,
  templateData: null,
  documentUrl: '/uploads/contracts/scanned/contract-123.pdf',
  employee: { employmentStatus: 'AKTIF' }
}

describe('ContractsService.clearDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('mengosongkan documentUrl lalu menghapus file fisik', async () => {
    const { service, update } = makeService(contractWithDocument)

    await service.clearDocument(7, { name: 'Admin', role: 'ADMIN' })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7 },
      data: { documentUrl: null }
    }))
    expect(deleteUploadedFile).toHaveBeenCalledWith('/uploads/contracts/scanned/contract-123.pdf')
  })

  it('mencatat penghapusan dokumen di log aktivitas', async () => {
    const { service, log } = makeService(contractWithDocument)

    await service.clearDocument(7, { name: 'Admin', role: 'ADMIN' })

    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE',
      module: 'Kontrak',
      targetLabel: '001/MITRA/2026',
      performedBy: 'Admin'
    }))
    expect(log.mock.calls[0][0].detail).toContain('contract-123.pdf')
  })

  it('menolak bila kontrak tidak punya dokumen', async () => {
    const { service, update } = makeService({ ...contractWithDocument, documentUrl: null })

    await expect(service.clearDocument(7, { name: 'Admin', role: 'ADMIN' }))
      .rejects.toThrow('Kontrak ini tidak memiliki dokumen untuk dihapus.')
    expect(update).not.toHaveBeenCalled()
    expect(deleteUploadedFile).not.toHaveBeenCalled()
  })
})
