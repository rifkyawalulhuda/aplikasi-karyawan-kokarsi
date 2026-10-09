import type { OrgChartDisplay, OrgChartDisplayKey } from '~/types/org-structure'

const STORAGE_KEY = 'org-chart-display'

const DEFAULTS: OrgChartDisplay = {
  photo: true,
  position: true,
  unitUsaha: true,
  status: true,
}

/**
 * Preferensi elemen yang ditampilkan pada Kartu Bagan.
 * - State dibagikan lewat `useState` (aman untuk SSR).
 * - Pilihan pengguna dipersist ke localStorage (per-browser).
 */
export function useOrgChartDisplay() {
  const display = useState<OrgChartDisplay>('org-chart-display', () => ({ ...DEFAULTS }))

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(display.value))
    } catch {
      // localStorage tidak tersedia (mode privat / quota) — abaikan.
    }
  }

  function hydrate() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<OrgChartDisplay>
      display.value = {
        photo: parsed.photo ?? DEFAULTS.photo,
        position: parsed.position ?? DEFAULTS.position,
        unitUsaha: parsed.unitUsaha ?? DEFAULTS.unitUsaha,
        status: parsed.status ?? DEFAULTS.status,
      }
    } catch {
      // Data rusak — pakai default.
    }
  }

  function set(key: OrgChartDisplayKey, value: boolean) {
    display.value = { ...display.value, [key]: value }
    persist()
  }

  function reset() {
    display.value = { ...DEFAULTS }
    persist()
  }

  // Terapkan preferensi tersimpan setelah mount agar tidak memicu hydration mismatch.
  onMounted(hydrate)

  return { display, set, reset }
}
