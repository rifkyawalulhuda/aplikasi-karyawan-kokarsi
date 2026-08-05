import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { startOfDay } from '../shared/date-utils'

const DEFAULT_MORNING_HOUR = 7

@Injectable()
export class AgendaNotificationService {
  private readonly logger = new Logger(AgendaNotificationService.name)

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async getMorningHour(): Promise<number> {
    try {
      const setting = await this.prisma.appSetting.findUnique({
        where: { key: 'agenda_notification_morning_hour' },
      })
      if (setting) {
        const hour = parseInt(setting.value, 10)
        if (!isNaN(hour) && hour >= 0 && hour <= 23) return hour
      }
    } catch {
      // fallback ke default
    }
    return DEFAULT_MORNING_HOUR
  }

  // Polling setiap menit — cek jam pagi dan 5 menit sebelum agenda
  @Cron('* * * * *', { name: 'agenda-notification', timeZone: 'Asia/Jakarta' })
  async runAgendaNotifications() {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Notifikasi pagi: cek apakah jam sekarang = jam setting pagi (menit 0)
    const morningHour = await this.getMorningHour()
    if (currentHour === morningHour && currentMinute === 0) {
      const result = await this.notificationsService.generateMorningAgendaNotifications()
        .catch(err => {
          this.logger.error(`Morning agenda notification failed: ${err?.message}`)
          return { created: 0 }
        })
      if (result.created > 0) {
        this.logger.log(`Morning agenda notifications: ${result.created} created`)
      }
    }

    // Notifikasi 5 menit sebelum: jalankan setiap menit
    const result = await this.notificationsService.generateBeforeAgendaNotifications()
      .catch(err => {
        this.logger.error(`Before agenda notification failed: ${err?.message}`)
        return { created: 0 }
      })
    if (result.created > 0) {
      this.logger.log(`Before-agenda notifications: ${result.created} created`)
    }
  }

  // Auto-resolve notifikasi agenda yang sudah lewat (setiap hari jam 01:00)
  @Cron('0 1 * * *', { name: 'agenda-notification-resolve', timeZone: 'Asia/Jakarta' })
  async resolvePassedAgendaNotifications() {
    const yesterday = startOfDay(new Date())
    yesterday.setDate(yesterday.getDate() - 1)

    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          category: 'AGENDA',
          expiryDate: { lt: yesterday },
          resolvedAt: null,
        },
        data: { resolvedAt: new Date() },
      })
      if (result.count > 0) {
        this.logger.log(`Resolved ${result.count} passed agenda notification(s)`)
      }
    } catch (err: any) {
      this.logger.error(`Agenda notification resolve failed: ${err?.message}`)
    }
  }
}
