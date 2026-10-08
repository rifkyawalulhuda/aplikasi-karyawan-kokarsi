import type { OrgChartViewState } from '~/types/org-structure'

const STORAGE_KEY = 'org-chart-view'

let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Persistensi state tampilan bagan (pan/zoom + node yang diciutkan) per periode.
 * Disimpan di localStorage (per-browser), key `org-chart-view`.
 */
export function useOrgChartView() {
  function readAll(): Record<string, OrgChartViewState> {
    if (!import.meta.client) return {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) as Record<string, OrgChartViewState> : {}
    } catch {
      return {}
    }
  }

  function load(periodKey: string): OrgChartViewState | null {
    const state = readAll()[periodKey]
    if (!state || typeof state.scale !== 'number') return null
    return state
  }

  /** Tulis tertunda (debounce) agar tidak menulis localStorage tiap frame saat pan/zoom. */
  function save(periodKey: string, state: OrgChartViewState) {
    if (!import.meta.client) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const all = readAll()
        all[periodKey] = state
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      } catch {
        // localStorage tidak tersedia — abaikan.
      }
    }, 300)
  }

  return { load, save }
}
