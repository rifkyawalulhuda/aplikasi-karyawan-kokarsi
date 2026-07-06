import type { GeneralSettings } from '~/types'

const settings = ref<GeneralSettings | null>(null)
let fetched = false

export function useAppSettings() {
  async function fetchSettings() {
    try {
      settings.value = await $fetch<GeneralSettings>('/api/settings/general', { credentials: 'include' })
    } catch {
      settings.value = null
    }
    fetched = true
  }

  async function refresh() {
    fetched = false
    await fetchSettings()
  }

  const logoUrl = computed(() => {
    if (!settings.value?.appLogoUrl) return ''
    return settings.value.appLogoUrl || ''
  })

  const organizationName = computed(() => {
    return settings.value?.organizationName || 'Kokarsi PT. Sankyu'
  })

  const cooperativeChairmanName = computed(() => {
    return settings.value?.cooperativeChairmanName || 'Hari Suhono'
  })

  const loginLeftBgColor = computed(() => settings.value?.loginLeftBgColor || '')
  const loginRightBgColor = computed(() => settings.value?.loginRightBgColor || '')

  const loginLeftImageUrl = computed(() => {
    if (!settings.value?.loginLeftImageUrl) return ''
    return settings.value.loginLeftImageUrl
  })

  const loginRightImageUrl = computed(() => {
    if (!settings.value?.loginRightImageUrl) return ''
    return settings.value.loginRightImageUrl
  })

  const loginLeftOverlayOpacity = computed(() => Number(settings.value?.loginLeftOverlayOpacity ?? '7'))
  const loginRightOverlayOpacity = computed(() => Number(settings.value?.loginRightOverlayOpacity ?? '0'))

  const loginLeftTextColor = computed(() => settings.value?.loginLeftTextColor || '')
  const loginRightTextColor = computed(() => settings.value?.loginRightTextColor || '')

  if (!fetched) {
    fetchSettings()
  }

  return {
    settings,
    logoUrl,
    organizationName,
    cooperativeChairmanName,
    loginLeftBgColor,
    loginRightBgColor,
    loginLeftImageUrl,
    loginRightImageUrl,
    loginLeftOverlayOpacity,
    loginRightOverlayOpacity,
    loginLeftTextColor,
    loginRightTextColor,
    refresh,
  }
}
