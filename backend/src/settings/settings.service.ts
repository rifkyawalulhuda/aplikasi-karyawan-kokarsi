import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface GeneralSettingsPayload {
  cooperativeChairmanName: string
}

@Injectable()
export class SettingsService {
  private readonly defaults: GeneralSettingsPayload = {
    cooperativeChairmanName: 'Hari Suhono',
  }

  constructor(private prisma: PrismaService) {}

  private ensureAdmin(role?: string) {
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Role Pengelola Koperasi tidak dapat mengubah Pengaturan Umum')
    }
  }

  async getGeneralSettings(): Promise<GeneralSettingsPayload> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: ['cooperativeChairmanName'] } },
    }) as Array<{ key: string; value: string }>

    const map = new Map(rows.map(row => [row.key, row.value]))

    return {
      cooperativeChairmanName: map.get('cooperativeChairmanName') || this.defaults.cooperativeChairmanName,
    }
  }

  async updateGeneralSettings(payload: GeneralSettingsPayload, role?: string) {
    this.ensureAdmin(role)

    await this.prisma.appSetting.upsert({
      where: { key: 'cooperativeChairmanName' },
      update: { value: payload.cooperativeChairmanName.trim() },
      create: { key: 'cooperativeChairmanName', value: payload.cooperativeChairmanName.trim() },
    })

    return this.getGeneralSettings()
  }
}
