import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface GeneralSettingsPayload {
  cooperativeChairmanName: string
  organizationName: string
  appLogoUrl: string
}

@Injectable()
export class SettingsService {
  private readonly settingKeys = ['cooperativeChairmanName', 'organizationName', 'appLogoUrl']

  private readonly defaults: GeneralSettingsPayload = {
    cooperativeChairmanName: 'Hari Suhono',
    organizationName: 'Kokarsi PT. Sankyu',
    appLogoUrl: '',
  }

  constructor(private prisma: PrismaService) {}

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah Pengaturan Umum')
    }
  }

  async getGeneralSettings(): Promise<GeneralSettingsPayload> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: this.settingKeys } },
    }) as Array<{ key: string; value: string }>

    const map = new Map(rows.map(row => [row.key, row.value]))

    return {
      cooperativeChairmanName: map.get('cooperativeChairmanName') || this.defaults.cooperativeChairmanName,
      organizationName: map.get('organizationName') || this.defaults.organizationName,
      appLogoUrl: map.get('appLogoUrl') || this.defaults.appLogoUrl,
    }
  }

  async updateGeneralSettings(payload: Partial<GeneralSettingsPayload>, role?: string) {
    this.ensureAdmin(role)

    const updates: Array<{ key: string; value: string }> = []

    if (payload.cooperativeChairmanName !== undefined) {
      updates.push({ key: 'cooperativeChairmanName', value: payload.cooperativeChairmanName.trim() })
    }
    if (payload.organizationName !== undefined) {
      updates.push({ key: 'organizationName', value: payload.organizationName.trim() })
    }

    for (const { key, value } of updates) {
      await this.prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    return this.getGeneralSettings()
  }

  async updateLogo(logoUrl: string, role?: string) {
    this.ensureAdmin(role)

    await this.prisma.appSetting.upsert({
      where: { key: 'appLogoUrl' },
      update: { value: logoUrl },
      create: { key: 'appLogoUrl', value: logoUrl },
    })

    return this.getGeneralSettings()
  }
}
