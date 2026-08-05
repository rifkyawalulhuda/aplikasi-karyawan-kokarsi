import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { startOfDay } from '../shared/date-utils'
import { Subject, Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private readonly clients = new Set<Subject<MessageEvent>>()

  subscribe(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>()
    this.clients.add(subject)
    return subject.asObservable().pipe(
      finalize(() => this.clients.delete(subject)),
    )
  }

  broadcast(count: number): void {
    const event: MessageEvent = { data: JSON.stringify({ count }) } as MessageEvent
    this.clients.forEach(s => s.next(event))
  }

  private async broadcastUnreadCount(): Promise<void> {
    try {
      const currentCount = await this.getUnreadCount()
      this.broadcast(currentCount)
    } catch {
      // non-fatal
    }
  }

  // ── Agenda Notifications ────────────────────────────────────────────────────

  /**
   * Cron H-0: kirim notifikasi pagi untuk agenda hari ini.
   * Dipanggil oleh AgendaNotificationScheduler setiap menit — cek jam dari AppSetting.
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

    for (const agenda of agendas) {
      for (const userId of agenda.assignedUserIds) {
        const sourceKey = `agenda_morning_${agenda.id}_${userId}`
        try {
          await this.prisma.notification.create({
            data: {
              category: 'AGENDA',
              severity: 'WARNING',
              title: 'Agenda Hari Ini',
              message: `${agenda.title} — ${agenda.startDate.toISOString().slice(0, 10)} pukul ${agenda.startTime}`,
              sourceType: 'agenda_morning',
              sourceId: agenda.id,
              triggerDay: 0,
              deeplink: '/kalender',
              expiryDate: agenda.startDate,
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
   * Cron 5 menit sebelum: kirim notifikasi reminder untuk agenda yang startTime-nya
   * 5 menit dari sekarang (window ±1 menit untuk toleransi polling).
   */
  async generateBeforeAgendaNotifications(): Promise<{ created: number }> {
    const now = new Date()
    const today = startOfDay(now)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    let created = 0

    // Hitung window waktu: 4–6 menit dari sekarang
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

    for (const agenda of agendas) {
      for (const userId of agenda.assignedUserIds) {
        try {
          await this.prisma.notification.create({
            data: {
              category: 'AGENDA',
              severity: 'CRITICAL',
              title: 'Agenda Dimulai 5 Menit Lagi',
              message: `${agenda.title} — pukul ${agenda.startTime}`,
              sourceType: 'agenda_before',
              sourceId: agenda.id,
              triggerDay: 0,
              deeplink: '/kalender',
              expiryDate: agenda.startDate,
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

  async findAll(limit = 10) {
    return this.prisma.notification.findMany({
      where: { resolvedAt: null },
      orderBy: [
        { severity: 'desc' }, // CRITICAL > WARNING (alphabetically desc)
        { createdAt: 'desc' },
      ],
      take: limit,
    })
  }

  async getUnreadCount(): Promise<number> {
    return this.prisma.notification.count({
      where: { isRead: false, resolvedAt: null },
    })
  }

  async markAllRead() {
    return this.prisma.notification.updateMany({
      where: { isRead: false, resolvedAt: null },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markOneRead(id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async generateNotifications(): Promise<{ created: number; resolved: number }> {
    const TRIGGER_DAYS = [90, 60, 30, 7, 0]
    const today = startOfDay(new Date())
    let created = 0
    let resolved = 0

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
        try {
          await this.prisma.notification.create({
            data: {
              category: 'KONTRAK_KARYAWAN',
              severity,
              title: `Kontrak Karyawan ${triggerDay === 0 ? 'Expired' : 'Akan Habis'}`,
              message: `Kontrak ${c.employee.fullName} (${c.contractNo}) berakhir ${daysText}`,
              sourceType: 'contract',
              sourceId: c.id,
              triggerDay,
              deeplink: `/karyawan/${c.employee.id}`,
              expiryDate: c.endDate,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
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
        try {
          await this.prisma.notification.create({
            data: {
              category: 'SERTIFIKASI_IJIN',
              severity,
              title: `Sertifikasi/Ijin ${triggerDay === 0 ? 'Expired' : 'Akan Expired'}`,
              message: `${d.documentType?.name ?? 'Dokumen'} milik ${d.employee.fullName} berakhir ${daysText}`,
              sourceType: 'employee_document',
              sourceId: d.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen/dok-karyawan?status=EXPIRED'
                  : '/dokumen/dok-karyawan?status=AKAN_EXPIRED',
              expiryDate: d.expiryDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
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
        try {
          await this.prisma.notification.create({
            data: {
              category: 'KONTRAK_VENDOR',
              severity,
              title: `Kontrak Vendor ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
              message: `Kontrak ${companyName} (${v.documentNumber}) berakhir ${daysText}`,
              sourceType: 'vendor_contract',
              sourceId: v.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen-legal/kontrak-vendor?status=EXPIRED'
                  : '/dokumen-legal/kontrak-vendor?status=AKAN_BERAKHIR',
              expiryDate: v.endDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
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
        try {
          await this.prisma.notification.create({
            data: {
              category: 'LEGAL_KOPERASI',
              severity,
              title: `Legal Koperasi ${triggerDay === 0 ? 'Expired' : 'Akan Berakhir'}`,
              message: `${lk.documentName} berakhir ${daysText}`,
              sourceType: 'legal_koperasi',
              sourceId: lk.id,
              triggerDay,
              deeplink:
                triggerDay === 0
                  ? '/dokumen-legal/legal-koperasi?status=EXPIRED'
                  : '/dokumen-legal/legal-koperasi?status=AKAN_BERAKHIR',
              expiryDate: lk.endDate!,
            },
          })
          created++
        } catch (e: any) {
          if (e.code !== 'P2002') throw e
        }
      }
    }

    // ── Catch-all pass ────────────────────────────────────────────────────────
    // Dokumen yang sudah AKAN_EXPIRED/AKAN_HABIS/AKAN_BERAKHIR tapi tanggalnya
    // tidak tepat jatuh di H-90/60/30/7/0 (e.g. sudah lewat trigger point).
    // Gunakan triggerDay = -1 sebagai sentinel agar tidak konflik @@unique.
    const CATCHALL_DAY = -1

    // Sertifikasi & Ijin: status AKAN_EXPIRED dan belum punya notifikasi aktif
    const akanExpiredDocs = await this.prisma.employeeDocument.findMany({
      where: {
        status: 'AKAN_EXPIRED',
        expiryDate: { gte: today }, // belum expired hari ini
      },
      include: {
        employee: { select: { fullName: true } },
        documentType: { select: { name: true } },
      },
    })
    for (const d of akanExpiredDocs) {
      const daysLeft = Math.ceil((startOfDay(d.expiryDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      try {
        await this.prisma.notification.create({
          data: {
            category: 'SERTIFIKASI_IJIN',
            severity: catchallSeverity,
            title: 'Sertifikasi/Ijin Akan Expired',
            message: `${d.documentType?.name ?? 'Dokumen'} milik ${d.employee.fullName} berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
            sourceType: 'employee_document',
            sourceId: d.id,
            triggerDay: CATCHALL_DAY,
            deeplink: '/dokumen/dok-karyawan?status=AKAN_EXPIRED',
            expiryDate: d.expiryDate!,
          },
        })
        created++
      } catch (e: any) {
        if (e.code !== 'P2002') throw e // P2002 = sudah ada, skip
      }
    }

    // Kontrak karyawan: endDate dalam 90 hari ke depan (query by date, bukan DB status)
    // DB status belum tentu up-to-date — computed status dihitung dari endDate
    const soon90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    const akanHabisContracts = await this.prisma.contract.findMany({
      where: {
        endDate: { gte: today, lte: soon90 },
        status: { notIn: ['SELESAI', 'DIBATALKAN'] },
        childContracts: { none: {} }, // exclude yang sudah diperpanjang
      },
        include: { employee: { select: { id: true, fullName: true } } },
    })
    for (const c of akanHabisContracts) {
      const daysLeft = Math.ceil((startOfDay(c.endDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      const catchallSeverity = daysLeft <= 7 ? 'CRITICAL' : 'WARNING'
      const notifData = {
        category: 'KONTRAK_KARYAWAN' as const,
        severity: catchallSeverity as 'CRITICAL' | 'WARNING',
        title: 'Kontrak Karyawan Akan Habis',
        message: `Kontrak ${c.employee.fullName} (${c.contractNo}) berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
        sourceType: 'contract',
        sourceId: c.id,
        triggerDay: CATCHALL_DAY,
        deeplink: `/karyawan/${c.employee.id}`,
        expiryDate: c.endDate,
      }
      // upsert agar pesan selalu up-to-date saat endDate diubah
      const existing = await this.prisma.notification.findUnique({
        where: { sourceType_sourceId_triggerDay: { sourceType: 'contract', sourceId: c.id, triggerDay: CATCHALL_DAY } },
      })
      if (existing) {
        await this.prisma.notification.update({
          where: { id: existing.id },
          data: { ...notifData, resolvedAt: null, isRead: false, readAt: null },
        })
      } else {
        await this.prisma.notification.create({ data: notifData })
        created++
      }
    }

    // Vendor/Customer: status AKAN_BERAKHIR dan belum punya notifikasi aktif
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
      try {
        await this.prisma.notification.create({
          data: {
            category: 'KONTRAK_VENDOR',
            severity: catchallSeverity,
            title: 'Kontrak Vendor Akan Berakhir',
            message: `Kontrak ${companyName} (${v.documentNumber}) berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
            sourceType: 'vendor_contract',
            sourceId: v.id,
            triggerDay: CATCHALL_DAY,
            deeplink: '/dokumen-legal/kontrak-vendor?status=AKAN_BERAKHIR',
            expiryDate: v.endDate!,
          },
        })
        created++
      } catch (e: any) {
        if (e.code !== 'P2002') throw e
      }
    }

    // Legal Koperasi: status AKAN_BERAKHIR dan belum punya notifikasi aktif
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
      try {
        await this.prisma.notification.create({
          data: {
            category: 'LEGAL_KOPERASI',
            severity: catchallSeverity,
            title: 'Legal Koperasi Akan Berakhir',
            message: `${lk.documentName} berakhir ${daysLeft <= 0 ? 'hari ini' : `${daysLeft} hari lagi`}`,
            sourceType: 'legal_koperasi',
            sourceId: lk.id,
            triggerDay: CATCHALL_DAY,
            deeplink: '/dokumen-legal/legal-koperasi?status=AKAN_BERAKHIR',
            expiryDate: lk.endDate!,
          },
        })
        created++
      } catch (e: any) {
        if (e.code !== 'P2002') throw e
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
          sourceType: 'contract',
          sourceId: { in: renewedContracts.map(c => c.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: legal koperasi that have been renewed (renewedTo is not null)
    const renewedLegals = await this.prisma.legalKoperasi.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedLegals.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: 'legal_koperasi',
          sourceId: { in: renewedLegals.map(l => l.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Auto-resolve: vendor contracts that have been renewed (renewedTo is not null)
    const renewedVendors = await this.prisma.vendorContract.findMany({
      where: { renewedTo: { isNot: null } },
      select: { id: true },
    })
    if (renewedVendors.length > 0) {
      const r = await this.prisma.notification.updateMany({
        where: {
          sourceType: 'vendor_contract',
          sourceId: { in: renewedVendors.map(v => v.id) },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      resolved += r.count
    }

    // Broadcast unread count to all connected SSE clients
    try {
      const currentCount = await this.getUnreadCount()
      this.broadcast(currentCount)
    } catch {
      // non-fatal — SSE broadcast failure should not affect notification generation
    }

    return { created, resolved }
  }
}
