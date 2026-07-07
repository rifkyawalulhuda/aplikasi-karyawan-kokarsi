import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface GeneralSettingsPayload {
  cooperativeChairmanName: string
  organizationName: string
  appLogoUrl: string
  loginLeftBgColor?: string
  loginRightBgColor?: string
  loginLeftImageUrl?: string
  loginRightImageUrl?: string
  loginLeftOverlayOpacity?: string
  loginRightOverlayOpacity?: string
  loginLeftTextColor?: string
  loginRightTextColor?: string
}

@Injectable()
export class SettingsService {
  private readonly settingKeys = [
    'cooperativeChairmanName',
    'organizationName',
    'appLogoUrl',
    'loginLeftBgColor',
    'loginRightBgColor',
    'loginLeftImageUrl',
    'loginRightImageUrl',
    'loginLeftOverlayOpacity',
    'loginRightOverlayOpacity',
    'loginLeftTextColor',
    'loginRightTextColor',
  ]

  private readonly defaults: GeneralSettingsPayload = {
    cooperativeChairmanName: 'Hari Suhono',
    organizationName: 'Kokarsi PT. Sankyu',
    appLogoUrl: '',
    loginLeftBgColor: '',
    loginRightBgColor: '',
    loginLeftImageUrl: '',
    loginRightImageUrl: '',
    loginLeftOverlayOpacity: '7',
    loginRightOverlayOpacity: '0',
    loginLeftTextColor: '',
    loginRightTextColor: '',
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
      appLogoUrl: map.get('appLogoUrl') ?? this.defaults.appLogoUrl,
      loginLeftBgColor: map.get('loginLeftBgColor') ?? this.defaults.loginLeftBgColor,
      loginRightBgColor: map.get('loginRightBgColor') ?? this.defaults.loginRightBgColor,
      loginLeftImageUrl: map.get('loginLeftImageUrl') ?? this.defaults.loginLeftImageUrl,
      loginRightImageUrl: map.get('loginRightImageUrl') ?? this.defaults.loginRightImageUrl,
      loginLeftOverlayOpacity: map.get('loginLeftOverlayOpacity') ?? this.defaults.loginLeftOverlayOpacity,
      loginRightOverlayOpacity: map.get('loginRightOverlayOpacity') ?? this.defaults.loginRightOverlayOpacity,
      loginLeftTextColor: map.get('loginLeftTextColor') ?? this.defaults.loginLeftTextColor,
      loginRightTextColor: map.get('loginRightTextColor') ?? this.defaults.loginRightTextColor,
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
    if (payload.loginLeftBgColor !== undefined) {
      updates.push({ key: 'loginLeftBgColor', value: payload.loginLeftBgColor })
    }
    if (payload.loginRightBgColor !== undefined) {
      updates.push({ key: 'loginRightBgColor', value: payload.loginRightBgColor })
    }
    if (payload.loginLeftImageUrl !== undefined) {
      updates.push({ key: 'loginLeftImageUrl', value: payload.loginLeftImageUrl })
    }
    if (payload.loginRightImageUrl !== undefined) {
      updates.push({ key: 'loginRightImageUrl', value: payload.loginRightImageUrl })
    }
    if (payload.loginLeftOverlayOpacity !== undefined) {
      updates.push({ key: 'loginLeftOverlayOpacity', value: payload.loginLeftOverlayOpacity })
    }
    if (payload.loginRightOverlayOpacity !== undefined) {
      updates.push({ key: 'loginRightOverlayOpacity', value: payload.loginRightOverlayOpacity })
    }
    if (payload.loginLeftTextColor !== undefined) {
      updates.push({ key: 'loginLeftTextColor', value: payload.loginLeftTextColor })
    }
    if (payload.loginRightTextColor !== undefined) {
      updates.push({ key: 'loginRightTextColor', value: payload.loginRightTextColor })
    }

    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ key, value }) =>
          this.prisma.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
          })
        )
      )
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

  async updateLoginImage(side: 'left' | 'right', url: string, role?: string) {
    this.ensureAdmin(role)

    const key = side === 'left' ? 'loginLeftImageUrl' : 'loginRightImageUrl'

    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value: url },
      create: { key, value: url },
    })

    return this.getGeneralSettings()
  }
}
