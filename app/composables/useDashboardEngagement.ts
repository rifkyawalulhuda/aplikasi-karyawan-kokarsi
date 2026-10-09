import { createSharedComposable } from '@vueuse/core'
import type { DashboardEngagement } from '~/types/dashboard'

/**
 * Data engagement dashboard (ulang tahun, anniversary, aktivitas, tugas,
 * pengumuman). Di-share antar widget supaya endpoint dipanggil sekali saja.
 */
export const useDashboardEngagement = createSharedComposable(() => {
  const { data, pending, error, refresh } = useFetch<DashboardEngagement>('/api/dashboard/engagement', {
    lazy: true,
    credentials: 'include'
  })

  return { engagement: data, pending, error, refresh }
})
