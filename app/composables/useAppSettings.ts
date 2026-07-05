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
    return `http://localhost:3001${settings.value.appLogoUrl}`
  })

  const organizationName = computed(() => {
    return settings.value?.organizationName || 'Kokarsi PT. Sankyu'
  })

  const cooperativeChairmanName = computed(() => {
    return settings.value?.cooperativeChairmanName || 'Hari Suhono'
  })

  if (!fetched) {
    fetchSettings()
  }

  return {
    settings,
    logoUrl,
    organizationName,
    cooperativeChairmanName,
    refresh,
  }
}
