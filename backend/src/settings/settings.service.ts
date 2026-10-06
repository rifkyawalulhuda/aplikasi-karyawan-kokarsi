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
  agendaNotificationMorningHour?: string
  loginTagline?: string
  loginSubtitle?: string
  loginFeatures?: string
  loginGreetingEnabled?: string
  loginRememberMeEnabled?: string
  loginOrnamentsEnabled?: string
  loginFooterShowVersion?: string
  loginSupportTitle?: string
  loginSupportContact?: string
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
    'agendaNotificationMorningHour',
    'loginTagline',
    'loginSubtitle',
    'loginFeatures',
    'loginGreetingEnabled',
    'loginRememberMeEnabled',
    'loginOrnamentsEnabled',
    'loginFooterShowVersion',
    'loginSupportTitle',
    'loginSupportContact',
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
    agendaNotificationMorningHour: '7',
    loginTagline: 'Sistem Manajemen Karyawan',
    loginSubtitle: 'Platform internal untuk pengelolaan data karyawan, kontrak kerja, dan laporan operasional.',
    loginFeatures: JSON.stringify([
      { icon: 'i-lucide-users', text: 'Manajemen Data Karyawan' },
      { icon: 'i-lucide-file-text', text: 'Administrasi Kontrak Kerja' },
      { icon: 'i-lucide-bar-chart-3', text: 'Laporan & Ekspor Data' },
    ]),
    loginGreetingEnabled: '1',
    loginRememberMeEnabled: '1',
    loginOrnamentsEnabled: '1',
    loginFooterShowVersion: '1',
    loginSupportTitle: 'Butuh bantuan?',
    loginSupportContact: 'Hubungi Administrator IT Koperasi',
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
      agendaNotificationMorningHour: map.get('agendaNotificationMorningHour') ?? this.defaults.agendaNotificationMorningHour,
      loginTagline: map.get('loginTagline') ?? this.defaults.loginTagline,
      loginSubtitle: map.get('loginSubtitle') ?? this.defaults.loginSubtitle,
      loginFeatures: map.get('loginFeatures') ?? this.defaults.loginFeatures,
      loginGreetingEnabled: map.get('loginGreetingEnabled') ?? this.defaults.loginGreetingEnabled,
      loginRememberMeEnabled: map.get('loginRememberMeEnabled') ?? this.defaults.loginRememberMeEnabled,
      loginOrnamentsEnabled: map.get('loginOrnamentsEnabled') ?? this.defaults.loginOrnamentsEnabled,
      loginFooterShowVersion: map.get('loginFooterShowVersion') ?? this.defaults.loginFooterShowVersion,
      loginSupportTitle: map.get('loginSupportTitle') ?? this.defaults.loginSupportTitle,
      loginSupportContact: map.get('loginSupportContact') ?? this.defaults.loginSupportContact,
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

    // ── Konten & opsi halaman login ─────────────────────────────────────────
    const loginStringKeys: Array<keyof GeneralSettingsPayload> = [
      'loginTagline',
      'loginSubtitle',
      'loginGreetingEnabled',
      'loginRememberMeEnabled',
      'loginOrnamentsEnabled',
      'loginFooterShowVersion',
      'loginSupportTitle',
      'loginSupportContact',
    ]
    for (const key of loginStringKeys) {
      const value = payload[key]
      if (value !== undefined) {
        updates.push({ key, value })
      }
    }

    if (payload.loginFeatures !== undefined) {
      let sanitized = payload.loginFeatures
      if (sanitized.trim() !== '') {
        try {
          const parsed = JSON.parse(sanitized)
          if (!Array.isArray(parsed)) throw new Error('bukan array')
          sanitized = JSON.stringify(
            parsed
              .filter((item: unknown): item is { icon?: string, text?: string } => !!item && typeof item === 'object')
              .map((item: { icon?: string, text?: string }) => ({
                icon: typeof item.icon === 'string' ? item.icon : '',
                text: typeof item.text === 'string' ? item.text : '',
              }))
              .filter((item: { icon: string, text: string }) => item.text.trim() !== ''),
          )
        } catch {
          throw new Error('Format daftar fitur login tidak valid')
        }
      }
      updates.push({ key: 'loginFeatures', value: sanitized })
    }

    if (payload.agendaNotificationMorningHour !== undefined) {
      const hour = parseInt(payload.agendaNotificationMorningHour, 10)
      if (isNaN(hour) || hour < 0 || hour > 23) {
        throw new Error('Jam notifikasi pagi tidak valid (0-23)')
      }
      updates.push({ key: 'agendaNotificationMorningHour', value: String(hour) })
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
