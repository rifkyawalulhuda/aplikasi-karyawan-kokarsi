import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailerooService } from '../maileroo/maileroo.service'
import { ExternalEmailRecipientDto, TestEmailDto, UpdateEmailConfigDto } from './dto/update-email-config.dto'

export interface ExternalEmailRecipient {
  id: number
  email: string
  name: string
}

export interface EmailNotificationConfigDto {
  isEnabled: boolean
  triggerWindows: number[]
  recipientUserIds: number[]
  externalRecipients: ExternalEmailRecipient[]
}

export interface EmailNotificationStatusDto {
  mailerConfigured: boolean
  fromEmail: string
  fromName: string
}

export interface EmailNotificationHistoryDto {
  id: number
  changedBy: string
  description: string
  createdAt: Date
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

@Injectable()
export class EmailNotificationConfigService {
  constructor(
    private prisma: PrismaService,
    private maileroo: MailerooService,
  ) {}

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN role can modify email notification config')
    }
  }

  async getConfig(): Promise<EmailNotificationConfigDto> {
    const [enabledRow, windowsRow, recipients] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: 'emailNotificationEnabled' } }),
      this.prisma.appSetting.findUnique({ where: { key: 'emailNotificationWindows' } }),
      this.prisma.emailNotificationRecipient.findMany({
        include: {
          userAccount: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ])

    const isEnabled = enabledRow ? enabledRow.value === 'true' : true

    const triggerWindows: number[] =
      windowsRow && windowsRow.value
        ? windowsRow.value
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : [90, 60, 30, 7, 0]

    const recipientUserIds: number[] = []
    const externalRecipients: ExternalEmailRecipient[] = []

    for (const r of recipients) {
      if (r.userAccount) {
        recipientUserIds.push(r.userAccount.id)
      } else if (r.email) {
        externalRecipients.push({ id: r.id, email: r.email, name: r.name ?? r.email })
      }
    }

    return {
      isEnabled,
      triggerWindows,
      recipientUserIds,
      externalRecipients,
    }
  }

  async updateConfig(
    dto: UpdateEmailConfigDto,
    username: string,
    role?: string,
  ): Promise<EmailNotificationConfigDto> {
    this.ensureAdmin(role)

    // Deduplicate and filter out negative values (0 is valid: means "on expiry day")
    const deduped = [...new Set(dto.triggerWindows)].filter((n) => n >= 0)

    const external = this.normalizeExternalRecipients(dto.externalRecipients ?? [])

    // Cegah email manual yang bentrok dengan email akun user terpilih.
    const accountEmails = new Set<string>()
    if (dto.recipientUserIds.length > 0) {
      const users = await this.prisma.userAccount.findMany({
        where: { id: { in: dto.recipientUserIds } },
        select: { email: true },
      })
      for (const u of users) accountEmails.add(u.email.trim().toLowerCase())
    }
    const clash = external.find((e) => accountEmails.has(e.email.toLowerCase()))
    if (clash) {
      throw new BadRequestException(`Email ${clash.email} sudah dipakai oleh akun user yang dipilih`)
    }

    await Promise.all([
      this.prisma.appSetting.upsert({
        where: { key: 'emailNotificationEnabled' },
        update: { value: dto.isEnabled.toString() },
        create: { key: 'emailNotificationEnabled', value: dto.isEnabled.toString() },
      }),
      this.prisma.appSetting.upsert({
        where: { key: 'emailNotificationWindows' },
        update: { value: deduped.join(',') },
        create: { key: 'emailNotificationWindows', value: deduped.join(',') },
      }),
    ])

    // Replace all recipients
    await this.prisma.emailNotificationRecipient.deleteMany()

    if (dto.recipientUserIds.length > 0) {
      await this.prisma.emailNotificationRecipient.createMany({
        data: dto.recipientUserIds.map((userAccountId) => ({ userAccountId })),
        skipDuplicates: true,
      })
    }

    if (external.length > 0) {
      await this.prisma.emailNotificationRecipient.createMany({
        data: external.map((e) => ({
          email: e.email,
          name: e.name || e.email.split('@')[0],
        })),
      })
    }

    // Audit log
    const description = `Update config: enabled=${dto.isEnabled}, windows=[${deduped.join(',')}], recipients=[${dto.recipientUserIds.join(',')}], external=[${external.map((e) => e.email).join(',')}]`
    await this.prisma.emailNotificationConfigLog.create({
      data: { changedBy: username, description },
    })

    return this.getConfig()
  }

  /** Validasi + normalisasi email manual: format valid, unik (case-insensitive). */
  private normalizeExternalRecipients(input: ExternalEmailRecipientDto[]): { email: string; name: string }[] {
    const seen = new Set<string>()
    const result: { email: string; name: string }[] = []

    for (const raw of input) {
      const email = (raw.email ?? '').trim().toLowerCase()
      if (!EMAIL_REGEX.test(email)) {
        throw new BadRequestException(`Format email tidak valid: ${raw.email}`)
      }
      if (seen.has(email)) continue
      seen.add(email)
      result.push({ email, name: (raw.name ?? '').trim() })
    }

    return result
  }

  async getAllUsers(): Promise<{ id: number; name: string; email: string }[]> {
    const users = await this.prisma.userAccount.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })
    return users
  }

  async getHistory(limit = 8): Promise<EmailNotificationHistoryDto[]> {
    const rows = await this.prisma.emailNotificationConfigLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map((r) => ({
      id: r.id,
      changedBy: r.changedBy,
      description: r.description,
      createdAt: r.createdAt,
    }))
  }

  getStatus(): EmailNotificationStatusDto {
    const apiKey = process.env.MAILEROO_API_KEY
    return {
      mailerConfigured: !!apiKey && apiKey.trim() !== '',
      fromEmail: process.env.MAILEROO_FROM_EMAIL || '',
      fromName: process.env.MAILEROO_FROM_NAME || '',
    }
  }

  async sendTestEmail(dto: TestEmailDto, role?: string): Promise<{ sent: number; total: number; ok: boolean }> {
    this.ensureAdmin(role)

    const recipients = this.normalizeExternalRecipients(dto.recipients)
    if (recipients.length === 0) {
      throw new BadRequestException('Tidak ada penerima untuk uji email')
    }

    const ok = await this.maileroo.sendTestEmail(
      recipients.map((r) => ({ email: r.email, name: r.name || undefined })),
    )

    if (!ok) {
      throw new BadRequestException('Gagal mengirim email uji. Periksa konfigurasi MAILEROO_API_KEY.')
    }

    return { sent: recipients.length, total: recipients.length, ok }
  }

  // --- Cron helper methods ---

  async isEnabled(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: 'emailNotificationEnabled' },
    })
    return row ? row.value === 'true' : true
  }

  async getTriggerWindows(): Promise<number[]> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: 'emailNotificationWindows' },
    })
    if (!row || !row.value) return [90, 60, 30, 7, 0]
    return row.value
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= 0)
  }

  async getActiveRecipients(): Promise<{ email: string; name: string }[]> {
    const rows = await this.prisma.emailNotificationRecipient.findMany({
      include: {
        userAccount: { select: { email: true, name: true } },
      },
    })
    return rows
      .map((r) => {
        if (r.userAccount) return { email: r.userAccount.email, name: r.userAccount.name }
        return { email: r.email ?? '', name: r.name ?? r.email ?? '' }
      })
      .filter((u) => u.email && u.email.trim() !== '')
  }

  async hasSent(sourceType: string, sourceId: number, triggerDay: number): Promise<boolean> {
    const row = await this.prisma.emailNotificationSentLog.findUnique({
      where: { sourceType_sourceId_triggerDay: { sourceType, sourceId, triggerDay } },
    })
    return row !== null
  }

  async recordSent(sourceType: string, sourceId: number, triggerDay: number): Promise<void> {
    await this.prisma.emailNotificationSentLog.upsert({
      where: { sourceType_sourceId_triggerDay: { sourceType, sourceId, triggerDay } },
      update: { sentAt: new Date() },
      create: { sourceType, sourceId, triggerDay },
    })
  }
}
