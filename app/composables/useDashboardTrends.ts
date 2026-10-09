import type { DashboardMonthlyTrends } from '~/types/dashboard'

/**
 * Tren bulanan + perbandingan periode sebelumnya. `months` reaktif sehingga
 * mengubah pemilih periode otomatis memuat ulang data.
 */
export function useDashboardTrends(months: Ref<number>) {
  const { data, pending, error, refresh } = useFetch<DashboardMonthlyTrends>('/api/dashboard/trends', {
    lazy: true,
    credentials: 'include',
    query: { months }
  })

  return { trends: data, pending, error, refresh }
}
