import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateEmailConfigDto } from './dto/update-email-config.dto'

export interface EmailNotificationConfigDto {
  isEnabled: boolean
  triggerWindows: number[]
  recipients: { id: number; name: string; email: string }[]
}

@Injectable()
export class EmailNotificationConfigService {
  constructor(private prisma: PrismaService) {}

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

    return {
      isEnabled,
      triggerWindows,
      recipients: recipients.map((r) => ({
        id: r.userAccount.id,
        name: r.userAccount.name,
        email: r.userAccount.email,
      })),
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

    // Audit log
    const description = `Update config: enabled=${dto.isEnabled}, windows=[${deduped.join(',')}], recipients=[${dto.recipientUserIds.join(',')}]`
    await this.prisma.emailNotificationConfigLog.create({
      data: { changedBy: username, description },
    })

    return this.getConfig()
  }
}
