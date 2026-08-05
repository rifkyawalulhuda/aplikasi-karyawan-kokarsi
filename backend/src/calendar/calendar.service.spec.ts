jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))

import { CalendarService } from './calendar.service'

describe('CalendarService', () => {
  it('menolak agenda dengan tanggal selesai sebelum tanggal mulai', async () => {
    const service = new CalendarService({} as any)

    await expect(service.create({
      title: 'Agenda invalid',
      startDate: '2026-08-10',
      endDate: '2026-08-09',
      color: 'blue',
    }, 'Admin')).rejects.toThrow('Tanggal selesai tidak boleh sebelum tanggal mulai')
  })

  it('mengagregasikan agenda dan sumber masa berlaku ke format kalender', async () => {
    const prisma = {
      calendarEvent: { findMany: jest.fn().mockResolvedValue([{ id: 1, title: 'Rapat', startDate: new Date('2026-08-05'), endDate: new Date('2026-08-05'), color: 'green', createdByName: 'Admin' }]) },
      contract: { findMany: jest.fn().mockResolvedValue([{ id: 2, contractNo: 'K-1', endDate: new Date('2026-08-07'), status: 'AKAN_HABIS', employee: { fullName: 'Budi' } }]) },
      employeeDocument: { findMany: jest.fn().mockResolvedValue([]) },
      vendorContract: { findMany: jest.fn().mockResolvedValue([]) },
      legalKoperasi: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const service = new CalendarService(prisma as any)

    await expect(service.getCalendarData('2026-08-01', '2026-08-31')).resolves.toEqual([
      expect.objectContaining({ id: 'agenda-1', type: 'agenda', readOnly: false }),
      expect.objectContaining({ id: 'employee_contract-2', type: 'employee_contract', readOnly: true }),
    ])
  })
})
