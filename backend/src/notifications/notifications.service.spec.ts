jest.mock('../prisma/prisma.service', () => ({ PrismaService: jest.fn() }))

import { NotificationsService } from './notifications.service'

function createService(prisma: Record<string, any> = {}) {
  const notification = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 1 }),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 1 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    ...prisma.notification,
  }
  const notificationPreference = {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve(create)),
    ...prisma.notificationPreference,
  }
  const service = new NotificationsService({ notification, notificationPreference } as any)
  return { service, notification, notificationPreference }
}

describe('NotificationsService', () => {
  describe('findAll', () => {
    it('mengecualikan notifikasi resolved & dismissed dan mengurutkan pinned lebih dulu', async () => {
      const { service, notification } = createService({
        notification: { findMany: jest.fn().mockResolvedValue([]) },
      })

      await service.findAll({ limit: 10, userId: 7, userType: 'user_account' })

      const args = notification.findMany.mock.calls[0][0]
      expect(args.where).toMatchObject({
        resolvedAt: null,
        dismissedAt: null,
        userId: 7,
        userType: 'user_account',
      })
      expect(args.orderBy).toEqual([
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ])
      // Ambil limit+1 untuk mendeteksi hasMore
      expect(args.take).toBe(11)
    })

    it('menerapkan filter kategori, severity, unread, dan pencarian', async () => {
      const { service, notification } = createService()

      await service.findAll({
        limit: 20,
        category: 'LEGAL_KOPERASI',
        severity: 'CRITICAL',
        unread: true,
        q: 'iso',
      })

      const where = notification.findMany.mock.calls[0][0].where
      expect(where.category).toBe('LEGAL_KOPERASI')
      expect(where.severity).toBe('CRITICAL')
      expect(where.isRead).toBe(false)
      expect(where.OR).toEqual([
        { title: { contains: 'iso', mode: 'insensitive' } },
        { message: { contains: 'iso', mode: 'insensitive' } },
      ])
    })

    it('memakai cursor dengan skip 1 dan melaporkan hasMore + nextCursor', async () => {
      const rows = Array.from({ length: 6 }, (_, i) => ({ id: 100 - i }))
      const { service, notification } = createService({
        notification: { findMany: jest.fn().mockResolvedValue(rows) },
      })

      const result = await service.findAll({ limit: 5, cursor: 500 })

      const args = notification.findMany.mock.calls[0][0]
      expect(args.cursor).toEqual({ id: 500 })
      expect(args.skip).toBe(1)
      expect(result.items).toHaveLength(5)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe(rows[4].id)
    })

    it('membatasi limit maksimum 50', async () => {
      const { service, notification } = createService()

      await service.findAll({ limit: 999 })

      expect(notification.findMany.mock.calls[0][0].take).toBe(51)
    })
  })

  describe('getSummary', () => {
    it('mengagregasikan total, unread, severity, dan kategori', async () => {
      const { service, notification } = createService({
        notification: {
          count: jest.fn()
            .mockResolvedValueOnce(16)
            .mockResolvedValueOnce(4),
          groupBy: jest.fn()
            .mockResolvedValueOnce([{ severity: 'WARNING', _count: { _all: 15 } }, { severity: 'CRITICAL', _count: { _all: 1 } }])
            .mockResolvedValueOnce([{ severity: 'CRITICAL', _count: { _all: 1 } }])
            .mockResolvedValueOnce([{ category: 'LEGAL_KOPERASI', _count: { _all: 3 } }])
            .mockResolvedValueOnce([{ category: 'LEGAL_KOPERASI', _count: { _all: 2 } }]),
        },
      })

      const summary = await service.getSummary(7, 'user_account')

      expect(summary.total).toBe(16)
      expect(summary.unread).toBe(4)
      expect(summary.bySeverity).toMatchObject({ WARNING: 15, CRITICAL: 1 })
      expect(summary.unreadBySeverity).toMatchObject({ CRITICAL: 1 })
      expect(summary.byCategory.LEGAL_KOPERASI).toBe(3)
      expect(summary.byCategory.SPACE).toBe(0)
      expect(summary.unreadByCategory.LEGAL_KOPERASI).toBe(2)
    })
  })

  describe('mutasi per item', () => {
    it('menolak notifikasi milik user lain (404)', async () => {
      const { service } = createService({
        notification: { findFirst: jest.fn().mockResolvedValue(null) },
      })

      await expect(service.dismiss(99, 7, 'user_account')).rejects.toThrow('Notification not found')
    })

    it('markUnread mengembalikan status baca', async () => {
      const { service, notification } = createService()

      await service.markUnread(5, 7, 'user_account')

      expect(notification.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { isRead: false, readAt: null },
      })
    })

    it('dismiss & undoDismiss menulis/mengosongkan dismissedAt', async () => {
      const { service, notification } = createService()

      await service.dismiss(5, 7, 'user_account')
      expect(notification.update).toHaveBeenLastCalledWith({
        where: { id: 5 },
        data: { dismissedAt: expect.any(Date) },
      })

      await service.undoDismiss(5, 7, 'user_account')
      expect(notification.update).toHaveBeenLastCalledWith({
        where: { id: 5 },
        data: { dismissedAt: null },
      })
    })

    it('setPinned menulis/mengosongkan pinnedAt', async () => {
      const { service, notification } = createService()

      await service.setPinned(5, true, 7, 'user_account')
      expect(notification.update).toHaveBeenLastCalledWith({
        where: { id: 5 },
        data: { pinnedAt: expect.any(Date) },
      })

      await service.setPinned(5, false, 7, 'user_account')
      expect(notification.update).toHaveBeenLastCalledWith({
        where: { id: 5 },
        data: { pinnedAt: null },
      })
    })

    it('markMany & dismissMany hanya menyentuh id yang diminta', async () => {
      const { service, notification } = createService()

      await service.markMany([1, 2], true, 7, 'user_account')
      expect(notification.updateMany).toHaveBeenCalledWith({
        where: { resolvedAt: null, dismissedAt: null, userId: 7, userType: 'user_account', id: { in: [1, 2] } },
        data: { isRead: true, readAt: expect.any(Date) },
      })

      await service.dismissMany([3], 7, 'user_account')
      expect(notification.updateMany).toHaveBeenLastCalledWith({
        where: { resolvedAt: null, dismissedAt: null, userId: 7, userType: 'user_account', id: { in: [3] } },
        data: { dismissedAt: expect.any(Date) },
      })
    })

    it('markMany/dismissMany tanpa id tidak memanggil database', async () => {
      const { service, notification } = createService()

      await expect(service.markMany([], true)).resolves.toEqual({ count: 0 })
      await expect(service.dismissMany([])).resolves.toEqual({ count: 0 })
      expect(notification.updateMany).not.toHaveBeenCalled()
    })

    it('deleteAll memakai dismissedAt, bukan resolvedAt', async () => {
      const { service, notification } = createService()

      await service.deleteAll(7, 'user_account')

      expect(notification.updateMany).toHaveBeenCalledWith({
        where: { resolvedAt: null, dismissedAt: null, userId: 7, userType: 'user_account' },
        data: { dismissedAt: expect.any(Date) },
      })
    })
  })

  describe('preferences', () => {
    it('mengembalikan default saat preferensi belum ada', async () => {
      const { service } = createService()

      const pref = await service.getPreference(7, 'user_account')

      expect(pref).toMatchObject({
        mutedCategories: [],
        quietHoursStart: null,
        quietHoursEnd: null,
        soundEnabled: false,
        osNotificationEnabled: true,
      })
    })

    it('menyaring kategori tidak dikenal saat menyimpan', async () => {
      const { service, notificationPreference } = createService()

      await service.updatePreference(7, 'user_account', {
        mutedCategories: ['SPACE', 'TIDAK_ADA', 'AGENDA'],
        quietHoursStart: '21:00',
        quietHoursEnd: '07:00',
        soundEnabled: true,
      })

      const args = notificationPreference.upsert.mock.calls[0][0]
      expect(args.create.mutedCategories).toEqual(['SPACE', 'AGENDA'])
      expect(args.update.mutedCategories).toEqual(['SPACE', 'AGENDA'])
      expect(args.create.quietHoursStart).toBe('21:00')
      expect(args.create.soundEnabled).toBe(true)
    })
  })
})
