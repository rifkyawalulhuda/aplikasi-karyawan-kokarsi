import { Injectable, NotFoundException } from '@nestjs/common'
import { Subject, Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'
import { Prisma, NotificationPreference } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { startOfDay } from '../shared/date-utils'

interface SseClient {
  subject: Subject<MessageEvent>
  userId: number
  userType: string
}

interface Recipient {
  userId?: number
  userType?: string
}

export interface NotificationQuery {
  limit?: number
  cursor?: number
  category?: string
  severity?: string
  unread?: boolean
  q?: string
  userId?: number
  userType?: string
}

export interface NotificationPreferenceInput {
  mutedCategories?: string[]
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  soundEnabled?: boolean
  osNotificationEnabled?: boolean
}

const NOTIFICATION_CATEGORIES = [
  'KONTRAK_KARYAWAN',
  'SERTIFIKASI_IJIN',
  'KONTRAK_VENDOR',
  'LEGAL_KOPERASI',
  'AGENDA',
  'SPACE',
  'ARSIP_UMUM',
] as const

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private readonly clients = new Set<SseClient>()

  subscribe(userId: number, userType: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>()
    const client: SseClient = { subject, userId, userType }
    this.clients.add(client)
    return subject.asObservable().pipe(
      finalize(() => this.clients.delete(client)),
    )
  }

  private async broadcastUnreadCount(): Promise<void> {
    try {
      for (const client of this.clients) {
        const count = await this.getUnreadCount(client.userId, client.userType)
        const event: MessageEvent = { data: JSON.stringify({ count }) } as MessageEvent
        client.subject.next(event)
      }
    } catch {
      // non-fatal
    }
  }

  // Dipakai modul lain (Space dll) untuk broadcast count ke semua koneksi SSE
  async broadcastUnreadToClients(): Promise<void> {
    await this.broadcastUnreadCount()
  }

  // Daftar semua akun login aktif: master_admin + user_account
  private async getActiveUsers(): Promise<{ userId: number; userType: string }[]> {
    const [admins, accounts] = await Promise.all([
      this.prisma.masterAdmin.findMany({ select: { id: true } }),
      this.prisma.userAccount.findMany({ select: { id: true } }),
    ])
    return [
      ...admins.map(a => ({ userId: a.id, userType: 'master_admin' as const })),
      ...accounts.map(u => ({ userId: u.id, userType: 'user_account' as const })),
    ]
  }

  // ── Agenda Notifications ────────────────────────────────────────────────────

  /**
   * Cron H-0: kirim notifikasi pagi untuk agenda hari ini — per penerima (user_account).
   */
  async generateMorningAgendaNotifications(): Promise<{ created: number }> {
    const today = startOfDay(new Date())
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    let created = 0

    const agendas = await this.prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: today, lt: tomorrow },
        notifyMorningSent: false,
        assignedUserIds: { isEmpty: false },
      },
    })

    const prefMap = await this.getPreferenceMap(
      agendas.flatMap(a => a.assignedUserIds.map(userId => ({ userId, userType: 'user_account' }))),
    )

    for (const agenda of agendas) {
      for (const userId of this.filterAgendaRecipients(agenda.assignedUserIds, prefMap)) {
        const sourceType = `agenda_morning_${userId}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'AGENDA',
              severity: 'WARNING',
              title: 'Agenda Hari Ini',
              message: `${agenda.title} — ${agenda.startDate.toISOString().slice(0, 10)} pukul ${agenda.startTime}`,
              sourceType,
              sourceId: agenda.id,
              triggerDay: 0,
              deeplink: '/kalender',
              expiryDate: agenda.startDate,
              userId,
              userType: 'user_account',
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
      await this.prisma.calendarEvent.update({
        where: { id: agenda.id },
        data: { notifyMorningSent: true },
      })
    }

    if (created > 0) await this.broadcastUnreadCount()
    return { created }
  }

  /**
   * Cron 5 menit sebelum: kirim notifikasi reminder agenda — per penerima (user_account).
   */
  async generateBeforeAgendaNotifications(): Promise<{ created: number }> {
    const now = new Date()
    const today = startOfDay(now)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    let created = 0

    const windowStart = new Date(now.getTime() + 4 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 6 * 60 * 1000)
    const timeStart = `${String(windowStart.getHours()).padStart(2, '0')}:${String(windowStart.getMinutes()).padStart(2, '0')}`
    const timeEnd = `${String(windowEnd.getHours()).padStart(2, '0')}:${String(windowEnd.getMinutes()).padStart(2, '0')}`

    const agendas = await this.prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: today, lt: tomorrow },
        startTime: { gte: timeStart, lte: timeEnd },
        notifyBeforeSent: false,
        assignedUserIds: { isEmpty: false },
      },
    })

    const prefMap = await this.getPreferenceMap(
      agendas.flatMap(a => a.assignedUserIds.map(userId => ({ userId, userType: 'user_account' }))),
    )

    for (const agenda of agendas) {
      for (const userId of this.filterAgendaRecipients(agenda.assignedUserIds, prefMap)) {
        const sourceType = `agenda_before_${userId}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'AGENDA',
              severity: 'CRITICAL',
              title: 'Agenda Dimulai 5 Menit Lagi',
              message: `${agenda.title} — pukul ${agenda.startTime}`,
              sourceType,
              sourceId: agenda.id,
              triggerDay: 0,
              deeplink: '/kalender',
              expiryDate: agenda.startDate,
              userId,
              userType: 'user_account',
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
      await this.prisma.calendarEvent.update({
        where: { id: agenda.id },
        data: { notifyBeforeSent: true },
      })
    }

    if (created > 0) await this.broadcastUnreadCount()
    return { created }
  }

  /**
   * Dipanggil saat agenda baru dibuat/diupdate dengan assigned users.
   * Membuat notifikasi per-user dan broadcast via SSE untuk real-time update.
   */
  async generateAgendaCreatedNotifications(
    agendaId: number,
    title: string,
    startDate: string,
    startTime: string | null,
    assignedUserIds: number[],
    createdByName: string,
  ): Promise<{ created: number }> {
    let created = 0
    const prefMap = await this.getPreferenceMap(
      assignedUserIds.map(userId => ({ userId, userType: 'user_account' })),
    )
    for (const userId of this.filterAgendaRecipients(assignedUserIds, prefMap)) {
      const sourceType = `agenda_created_${agendaId}_${userId}`
      try {
        await this.prisma.notification.create({
          data: {
            category: 'AGENDA',
            severity: 'WARNING',
            title: 'Agenda Baru Ditugaskan',
            message: `${createdByName} menugaskan agenda "${title}" — ${startDate}${startTime ? ' pukul ' + startTime : ''}`,
            sourceType,
            sourceId: agendaId,
            triggerDay: 0,
            deeplink: `/kalender?openId=${agendaId}`,
            expiryDate: new Date(startDate),
            userId,
            userType: 'user_account',
          },
        })
        created++
      } catch (e: any) {
        if (e.code !== 'P2002') throw e
      }
    }
    if (created > 0) await this.broadcastUnreadCount()
    return { created }
  }

  // ── Per-user queries ─────────────────────────────────────────────────────────

  /** Scope filter: active (belum resolved & belum dismissed) + kepemilikan user. */
  private scopeWhere(userId?: number, userType?: string): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = { resolvedAt: null, dismissedAt: null }
    if (userId !== undefined && userType) {
      where.userId = userId
      where.userType = userType
    }
    return where
  }

  /**
   * Daftar notifikasi aktif dengan filter, pencarian, dan pagination cursor.
   * Urutan: disematkan (pinned) dulu, lalu terbaru. Cursor memakai id unik
   * sebagai tiebreaker sehingga posisi stabil saat item ditandai dibaca.
   */
  async findAll(query: NotificationQuery = {}) {
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50)
    const where = this.scopeWhere(query.userId, query.userType)

    if (query.category) where.category = query.category as Prisma.NotificationWhereInput['category']
    if (query.severity) where.severity = query.severity as Prisma.NotificationWhereInput['severity']
    if (query.unread) where.isRead = false
    if (query.q?.trim()) {
      const q = query.q.trim()
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ]
    }

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows

    return {
      items,
      hasMore,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    }
  }

  /** Ringkasan agregat untuk badge & chip kategori (bukan dari halaman pertama). */
  async getSummary(userId?: number, userType?: string) {
    const base = this.scopeWhere(userId, userType)

    const [total, unread, bySeverity, unreadBySeverity, byCategory, unreadByCategory] =
      await Promise.all([
        this.prisma.notification.count({ where: base }),
        this.prisma.notification.count({ where: { ...base, isRead: false } }),
        this.prisma.notification.groupBy({ by: ['severity'], where: base, _count: { _all: true } }),
        this.prisma.notification.groupBy({
          by: ['severity'],
          where: { ...base, isRead: false },
          _count: { _all: true },
        }),
        this.prisma.notification.groupBy({ by: ['category'], where: base, _count: { _all: true } }),
        this.prisma.notification.groupBy({
          by: ['category'],
          where: { ...base, isRead: false },
          _count: { _all: true },
        }),
      ])

    const severity = { WARNING: 0, CRITICAL: 0 } as Record<string, number>
    for (const row of bySeverity) severity[row.severity] = row._count._all

    const unreadSeverity = { WARNING: 0, CRITICAL: 0 } as Record<string, number>
    for (const row of unreadBySeverity) unreadSeverity[row.severity] = row._count._all

    const categories: Record<string, number> = {}
    for (const cat of NOTIFICATION_CATEGORIES) categories[cat] = 0
    for (const row of byCategory) categories[row.category] = row._count._all

    const unreadCategories: Record<string, number> = {}
    for (const cat of NOTIFICATION_CATEGORIES) unreadCategories[cat] = 0
    for (const row of unreadByCategory) unreadCategories[row.category] = row._count._all

    return {
      total,
      unread,
      bySeverity: severity,
      unreadBySeverity: unreadSeverity,
      byCategory: categories,
      unreadByCategory: unreadCategories,
    }
  }

  async getUnreadCount(userId?: number, userType?: string): Promise<number> {
    const where = this.scopeWhere(userId, userType)
    return this.prisma.notification.count({ where: { ...where, isRead: false } })
  }

  /** Pastikan baris ada dan milik user; lempar 404 bila bukan. */
  private async findOwned(id: number, userId?: number, userType?: string) {
    const where: Prisma.NotificationWhereInput = { id }
    if (userId !== undefined && userType) {
      where.userId = userId
      where.userType = userType
    }
    const existing = await this.prisma.notification.findFirst({ where })
    if (!existing) throw new NotFoundException('Notification not found')
    return existing
  }

  async markAllRead(userId?: number, userType?: string) {
    const where = { ...this.scopeWhere(userId, userType), isRead: false }
    const result = await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    })
    await this.broadcastUnreadCount()
    return result
  }

  async markOneRead(id: number, userId?: number, userType?: string) {
    await this.findOwned(id, userId, userType)
    const result = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
    await this.broadcastUnreadCount()
    return result
  }

  async markUnread(id: number, userId?: number, userType?: string) {
    await this.findOwned(id, userId, userType)
    const result = await this.prisma.notification.update({
      where: { id },
      data: { isRead: false, readAt: null },
    })
    await this.broadcastUnreadCount()
    return result
  }

  /** Singkirkan satu notifikasi dari daftar (soft, bisa di-undo). */
  async dismiss(id: number, userId?: number, userType?: string) {
    await this.findOwned(id, userId, userType)
    const result = await this.prisma.notification.update({
      where: { id },
      data: { dismissedAt: new Date() },
    })
    await this.broadcastUnreadCount()
    return result
  }

  async undoDismiss(id: number, userId?: number, userType?: string) {
    await this.findOwned(id, userId, userType)
    const result = await this.prisma.notification.update({
      where: { id },
      data: { dismissedAt: null },
    })
    await this.broadcastUnreadCount()
    return result
  }

  /** Bulk: tandai banyak notifikasi dibaca / belum dibaca. */
  async markMany(ids: number[], isRead: boolean, userId?: number, userType?: string) {
    if (ids.length === 0) return { count: 0 }
    const where = { ...this.scopeWhere(userId, userType), id: { in: ids } }
    const result = await this.prisma.notification.updateMany({
      where,
      data: { isRead, readAt: isRead ? new Date() : null },
    })
    await this.broadcastUnreadCount()
    return result
  }

  /** Bulk: singkirkan banyak notifikasi sekaligus. */
  async dismissMany(ids: number[], userId?: number, userType?: string) {
    if (ids.length === 0) return { count: 0 }
    const where = { ...this.scopeWhere(userId, userType), id: { in: ids } }
    const result = await this.prisma.notification.updateMany({
      where,
      data: { dismissedAt: new Date() },
    })
    await this.broadcastUnreadCount()
    return result
  }

  async setPinned(id: number, pinned: boolean, userId?: number, userType?: string) {
    await this.findOwned(id, userId, userType)
    const result = await this.prisma.notification.update({
      where: { id },
      data: { pinnedAt: pinned ? new Date() : null },
    })
    return result
  }

  async deleteAll(userId?: number, userType?: string) {
    const where = this.scopeWhere(userId, userType)
    const result = await this.prisma.notification.updateMany({
      where,
      data: { dismissedAt: new Date() },
    })
    await this.broadcastUnreadCount()
    return { deleted: result.count }
  }

  // ── Preferences (per-user) ───────────────────────────────────────────────────

  async getPreference(userId: number, userType: string) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_userType: { userId, userType } },
    })
    if (pref) return pref
    return {
      id: 0,
      userId,
      userType,
      mutedCategories: [] as string[],
      quietHoursStart: null as string | null,
      quietHoursEnd: null as string | null,
      soundEnabled: false,
      osNotificationEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async updatePreference(
    userId: number,
    userType: string,
    input: NotificationPreferenceInput,
  ) {
    const data: Prisma.NotificationPreferenceUncheckedCreateInput = {
      userId,
      userType,
    }
    if (input.mutedCategories !== undefined) {
      data.mutedCategories = input.mutedCategories.filter(c =>
        (NOTIFICATION_CATEGORIES as readonly string[]).includes(c),
      )
    }
    if (input.quietHoursStart !== undefined) data.quietHoursStart = input.quietHoursStart
    if (input.quietHoursEnd !== undefined) data.quietHoursEnd = input.quietHoursEnd
    if (input.soundEnabled !== undefined) data.soundEnabled = input.soundEnabled
    if (input.osNotificationEnabled !== undefined) {
      data.osNotificationEnabled = input.osNotificationEnabled
    }

    const { userId: _u, userType: _t, ...update } = data
    return this.prisma.notificationPreference.upsert({
      where: { userId_userType: { userId, userType } },
      create: data,
      update,
    })
  }

  // ── Preference enforcement (dipakai generator) ───────────────────────────────

  private async getPreferenceMap(
    recipients: Recipient[],
  ): Promise<Map<string, NotificationPreference>> {
    const ids = recipients.map(r => r.userId).filter((v): v is number => typeof v === 'number')
    const types = recipients.map(r => r.userType).filter((v): v is string => typeof v === 'string')
    const map = new Map<string, NotificationPreference>()
    if (ids.length === 0 || types.length === 0) return map

    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: ids }, userType: { in: types } },
    })
    for (const p of prefs) map.set(`${p.userId}:${p.userType}`, p)
    return map
  }

  private isQuietHours(
    pref: Pick<NotificationPreference, 'quietHoursStart' | 'quietHoursEnd'>,
    now = new Date(),
  ): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = pref
    if (!start || !end) return false
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return false
    const cur = now.getHours() * 60 + now.getMinutes()
    const s = sh * 60 + sm
    const e = eh * 60 + em
    if (s === e) return false
    return s < e ? cur >= s && cur < e : cur >= s || cur < e
  }

  /**
   * Saring penerima: buang yang mem-mute kategori tsb, dan (opsional) yang
   * sedang dalam quiet hours untuk notifikasi non-CRITICAL.
   */
  private filterRecipients(
    recipients: Recipient[],
    prefMap: Map<string, NotificationPreference>,
    category: string,
    severity: 'WARNING' | 'CRITICAL',
    enforceQuietHours = true,
  ): Recipient[] {
    return recipients.filter((r) => {
      const pref = prefMap.get(`${r.userId}:${r.userType}`)
      if (!pref) return true
      if (pref.mutedCategories?.includes(category)) return false
      if (enforceQuietHours && severity !== 'CRITICAL' && this.isQuietHours(pref)) return false
      return true
    })
  }

  /**
   * Agenda bersifat time-critical (pengingat 5 menit sebelum / pagi hari),
   * jadi hanya mute kategori yang ditegakkan di generator; quiet hours
   * ditangani di klien (menahan notifikasi OS & suara).
   */
  private filterAgendaRecipients(
    userIds: number[],
    prefMap: Map<string, NotificationPreference>,
  ): number[] {
    return this.filterRecipients(
      userIds.map(userId => ({ userId, userType: 'user_account' })),
      prefMap,
      'AGENDA',
      'WARNING',
      false,
    ).map(r => r.userId as number)
  }

  // ── Expiry reminder generation (per-user copies) ────────────────────────────

  async generateNotifications(): Promise<{ created: number; resolved: number }> {
    const TRIGGER_DAYS = [90, 60, 30, 7, 0]
    const today = startOfDay(new Date())
    const activeUsers = await this.getActiveUsers()
    let created = 0
    let resolved = 0

    const recipients = activeUsers.length > 0 ? activeUsers : [{ userId: undefined as number | undefined, userType: undefined as string | undefined }]
    const prefMap = await this.getPreferenceMap(recipients)

    for (const triggerDay of TRIGGER_DAYS) {
      const targetDate = new Date(today.getTime() + triggerDay * 24 * 60 * 60 * 1000)
      const severity = triggerDay <= 7 ? 'CRITICAL' : 'WARNING'
      const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

      // 1. KONTRAK_KARYAWAN - contracts table
      const contracts = await this.prisma.contract.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          status: { in: ['AKTIF', 'AKAN_HABIS'] },
        },
        include: { employee: { select: { id: true, fullName: true } } },
      })
      for (const c of contracts) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        for (const r of this.filterRecipients(recipients, prefMap, 'KONTRAK_KARYAWAN', severity)) {
          const sourceType = `contract_${r.userId ?? 'all'}`
          try {
            await this.prisma.notification.create({
              data: {
                category: 'KONTRAK_KARYAWAN',
                severity,
                title: `Kontrak Karyawan ${triggerDay === 0 ? 'Expired' : 'Akan Habis'}`,
                message: `Kontrak ${c.employee.fullName} (${c.contractNo}) berakhir ${daysText}`,
                sourceType,
                sourceId: c.id,
                triggerDay,
                deeplink: `/kontrak?openId=${c.id}`,
                expiryDate: c.endDate,
                userId: r.userId,
                userType: r.userType,
              },
            })
            created++
          } catch (e: any) {
            if (e.code !== 'P2002') throw e
          }
        }
      }

      // 2. SERTIFIKASI_IJIN - employee_documents table
      const docs = await this.prisma.employeeDocument.findMany({
        where: {
          expiryDate: { gte: targetDate, lt: nextDay },
          status: { not: 'EXPIRED' },
        },
        include: {
          employee: { select: { fullName: true } },
          documentType: { select: { name: true } },
        },
      })
      for (const d of docs) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        for (const r of this.filterRecipients(recipients, prefMap, 'SERTIFIKASI_IJIN', severity)) {
          const sourceType = `employee_document_${r.userId ?? 'all'}`
          try {
            await this.prisma.notification.create({
              data: {
                category: 'SERTIFIKASI_IJIN',
                severity,
                title: `Sertifikasi/Ijin ${triggerDay === 0 ? 'Expired' : 'Akan Expired'}`,
                message: `${d.documentType?.name ?? 'Dokumen'} milik ${d.employee.fullName} berakhir ${daysText}`,
                sourceType,
                sourceId: d.id,
                triggerDay,
                deeplink: `/dokumen/sertifikasi-ijin?openId=${d.id}`,
                expiryDate: d.expiryDate!,
                userId: r.userId,
                userType: r.userType,
              },
            })
            created++
          } catch (e: any) {
            if (e.code !== 'P2002') throw e
          }
        }
      }

      // 3. KONTRAK_VENDOR - vendor_contracts table
      const vendors = await this.prisma.vendorContract.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          status: { in: ['AKTIF', 'AKAN_BERAKHIR'] },
          renewedTo: null,
        },
        include: { company: { select: { name: true } } },
      })
      for (const v of vendors) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        const companyName = v.company?.name ?? 'Vendor'
        for (const r of this.filterRecipients(recipients, prefMap, 'KONTRAK_VENDOR', severity)) {
          const sourceType = `vendor_contract_${r.userId ?? 'all'}`
          try {
            await this.prisma.notification.create({
              data: {
                category: 'KONTRAK_VENDOR',
                severity,
                title: `Kontrak Vendor ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
                message: `Kontrak ${companyName} (${v.documentNumber}) berakhir ${daysText}`,
                sourceType,
                sourceId: v.id,
                triggerDay,
                deeplink: `/dokumen-legal/kontrak-vendor?openId=${v.id}`,
                expiryDate: v.endDate!,
                userId: r.userId,
                userType: r.userType,
              },
            })
            created++
          } catch (e: any) {
            if (e.code !== 'P2002') throw e
          }
        }
      }

      // 4. LEGAL_KOPERASI - legal_koperasi table
      const legals = await this.prisma.legalKoperasi.findMany({
        where: {
          endDate: { gte: targetDate, lt: nextDay },
          needsRenewal: true,
          status: { not: 'EXPIRED' },
          renewedTo: null,
        },
      })
      for (const lk of legals) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        for (const r of this.filterRecipients(recipients, prefMap, 'LEGAL_KOPERASI', severity)) {
          const sourceType = `legal_koperasi_${r.userId ?? 'all'}`
          try {
            await this.prisma.notification.create({
              data: {
                category: 'LEGAL_KOPERASI',
                severity,
                title: `Legal Koperasi ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
                message: `${lk.documentName} berakhir ${daysText}`,
                sourceType,
                sourceId: lk.id,
                triggerDay,
                deeplink: `/dokumen-legal/legal-koperasi?openId=${lk.id}`,
                expiryDate: lk.endDate!,
                userId: r.userId,
                userType: r.userType,
              },
            })
            created++
          } catch (e: any) {
            if (e.code !== 'P2002') throw e
          }
        }
      }

      // 5. ARSIP_UMUM - general_archives table (hanya arsip dengan tanggal berakhir)
      const archives = await this.prisma.generalArchive.findMany({
        where: { expiryDate: { gte: targetDate, lt: nextDay } },
      })
      for (const archive of archives) {
        const daysText = triggerDay === 0 ? 'hari ini' : `${triggerDay} hari lagi`
        for (const r of this.filterRecipients(recipients, prefMap, 'ARSIP_UMUM', severity)) {
          const sourceType = `general_archive_${r.userId ?? 'all'}`
          try {
            await this.prisma.notification.create({
              data: {
                category: 'ARSIP_UMUM',
                severity,
                title: `Arsip Umum ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
                message: `${archive.documentName} berakhir ${daysText}`,
                sourceType,
                sourceId: archive.id,
                triggerDay,
                deeplink: `/dokumen-legal/arsip-umum?openId=${archive.id}`,
                expiryDate: archive.expiryDate!,
                userId: r.userId,
                userType: r.userType,
              },
            })
            created++
          } catch (e: any) {
            if (e.code !== 'P2002') throw e
          }
        }
      }
    }

    // ── Catch-all pass (per-user) ──────────────────────────────────────────────
    const CATCHALL_DAY = -1

    // Sertifikasi & Ijin: status AKAN_EXPIRED
    const akanExpiredDocs = await this.prisma.employeeDocument.findMany({
      where: {
        status: 'AKAN_EXPIRED',
        expiryDate: { gte: today },
      },
      include: {
        employee: { select: { fullName: true } },
        documentType: { select: { name: true } },
      },
    })
    for (const d of akanExpiredDocs) {
      const daysLeft = Math.ceil((startOfDay(d.expiryDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      for (const r of this.filterRecipients(recipients, prefMap, 'SERTIFIKASI_IJIN', catchallSeverity)) {
        const sourceType = `employee_document_${r.userId ?? 'all'}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'SERTIFIKASI_IJIN',
              severity: catchallSeverity,
              title: 'Sertifikasi/Ijin Akan Expired',
              message: `${d.documentType?.name ?? 'Dokumen'} milik ${d.employee.fullName} berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
              sourceType,
              sourceId: d.id,
              triggerDay: CATCHALL_DAY,
              deeplink: `/dokumen/sertifikasi-ijin?openId=${d.id}`,
              expiryDate: d.expiryDate!,
              userId: r.userId,
              userType: r.userType,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
    }

    // Kontrak karyawan: endDate dalam 90 hari ke depan (upsert per-user)
    const soon90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    const akanHabisContracts = await this.prisma.contract.findMany({
      where: {
        endDate: { gte: today, lte: soon90 },
        status: { notIn: ['SELESAI', 'DIBATALKAN'] },
        childContracts: { none: {} },
      },
      include: { employee: { select: { id: true, fullName: true } } },
    })
    for (const c of akanHabisContracts) {
      const daysLeft = Math.ceil((startOfDay(c.endDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      for (const r of this.filterRecipients(recipients, prefMap, 'KONTRAK_KARYAWAN', catchallSeverity)) {
        const sourceType = `contract_${r.userId ?? 'all'}`
        const notifData = {
          category: 'KONTRAK_KARYAWAN' as const,
          severity: catchallSeverity as 'CRITICAL' | 'WARNING',
          title: 'Kontrak Karyawan Akan Habis',
          message: `Kontrak ${c.employee.fullName} (${c.contractNo}) berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
          sourceType,
          sourceId: c.id,
          triggerDay: CATCHALL_DAY,
          deeplink: `/kontrak?openId=${c.id}`,
          expiryDate: c.endDate,
          userId: r.userId,
          userType: r.userType,
        }
        const existing = await this.prisma.notification.findUnique({
          where: { sourceType_sourceId_triggerDay: { sourceType, sourceId: c.id, triggerDay: CATCHALL_DAY } },
        })
        if (existing) {
          await this.prisma.notification.update({
            where: { id: existing.id },
            data: { ...notifData, resolvedAt: null },
          })
        } else {
          await this.prisma.notification.create({ data: notifData })
          created++
        }
      }
    }

    // Vendor/Customer: status AKAN_BERAKHIR
    const akanBerakhirVendors = await this.prisma.vendorContract.findMany({
      where: {
        status: 'AKAN_BERAKHIR',
        endDate: { gte: today },
        renewedTo: null,
      },
      include: { company: { select: { name: true } } },
    })
    for (const v of akanBerakhirVendors) {
      const daysLeft = Math.ceil((startOfDay(v.endDate!).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      const companyName = v.company?.name ?? 'Vendor'
      for (const r of this.filterRecipients(recipients, prefMap, 'KONTRAK_VENDOR', catchallSeverity)) {
        const sourceType = `vendor_contract_${r.userId ?? 'all'}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'KONTRAK_VENDOR',
              severity: catchallSeverity,
              title: 'Kontrak Vendor Akan Berakhir',
              message: `Kontrak ${companyName} (${v.documentNumber}) berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
              sourceType,
              sourceId: v.id,
              triggerDay: CATCHALL_DAY,
              deeplink: `/dokumen-legal/kontrak-vendor?openId=${v.id}`,
              expiryDate: v.endDate!,
              userId: r.userId,
              userType: r.userType,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
    }

    // Legal Koperasi: status AKAN_BERAKHIR
    const akanBerakhirLegals = await this.prisma.legalKoperasi.findMany({
      where: {
        status: 'AKAN_BERAKHIR',
        endDate: { gte: today },
        needsRenewal: true,
        renewedTo: null,
      },
    })
    for (const lk of akanBerakhirLegals) {
      const daysLeft = Math.ceil((startOfDay(lk.endDate!).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      for (const r of this.filterRecipients(recipients, prefMap, 'LEGAL_KOPERASI', catchallSeverity)) {
        const sourceType = `legal_koperasi_${r.userId ?? 'all'}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'LEGAL_KOPERASI',
              severity: catchallSeverity,
              title: 'Legal Koperasi Akan Berakhir',
              message: `${lk.documentName} berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
              sourceType,
              sourceId: lk.id,
              triggerDay: CATCHALL_DAY,
              deeplink: `/dokumen-legal/legal-koperasi?openId=${lk.id}`,
              expiryDate: lk.endDate!,
              userId: r.userId,
              userType: r.userType,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
    }

    // Auto-resolve: contracts that have child contracts or status = SELESAI
    const renewedContracts = await this.prisma.contract.findMany({
      where: { OR: [{ childContracts: { some: {} } }, { status: 'SELESAI' }] },
      select: { id: true },
    })
    if (renewedContracts.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: { startsWith: 'contract_' },
          sourceId: { in: renewedContracts.map(c => c.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: legal koperasi yang sudah diperpanjang
    const renewedLegals = await this.prisma.legalKoperasi.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedLegals.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: { startsWith: 'legal_koperasi_' },
          sourceId: { in: renewedLegals.map(l => l.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: vendor contracts yang sudah diperpanjang
    const renewedVendors = await this.prisma.vendorContract.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedVendors.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: { startsWith: 'vendor_contract_' },
          sourceId: { in: renewedVendors.map(v => v.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    await this.broadcastUnreadCount()

    return { created, resolved }
  }
}
