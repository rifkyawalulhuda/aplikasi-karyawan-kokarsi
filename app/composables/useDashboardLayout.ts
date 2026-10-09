import type { ComputedRef, Ref } from 'vue'
import { createSharedComposable } from '@vueuse/core'
import { DASHBOARD_WIDGET_IDS } from '~/components/dashboard/registry'

export interface DashboardLayoutState {
  /** Urutan id widget yang ditampilkan/diatur. */
  order: string[]
  /** Id widget yang disembunyikan user. */
  hidden: string[]
}

export type DashboardLayoutPreset = 'ringkas' | 'standar' | 'lengkap'

const PRESET_VISIBLE: Record<DashboardLayoutPreset, string[]> = {
  ringkas: ['kpi', 'attention', 'quick'],
  standar: ['kpi', 'attention', 'vehicle', 'distribution', 'quick'],
  lengkap: [...DASHBOARD_WIDGET_IDS]
}

/** Bersihkan layout tersimpan: buang id tak dikenal, tambahkan widget baru di akhir. */
export function normalizeLayout(raw: Partial<DashboardLayoutState> | null | undefined): DashboardLayoutState {
  const known = new Set(DASHBOARD_WIDGET_IDS)
  const order = (Array.isArray(raw?.order) ? raw!.order : []).filter(id => known.has(id))
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (!order.includes(id)) order.push(id)
  }
  const hidden = (Array.isArray(raw?.hidden) ? raw!.hidden : []).filter(id => known.has(id))
  return { order, hidden }
}

interface UseDashboardLayout {
  order: ComputedRef<string[]>
  hidden: ComputedRef<string[]>
  visibleWidgets: ComputedRef<string[]>
  editing: Ref<boolean>
  isVisible: (id: string) => boolean
  canMove: (id: string, dir: -1 | 1) => boolean
  move: (id: string, dir: -1 | 1) => void
  setOrder: (ids: string[]) => void
  toggleHidden: (id: string) => void
  reset: () => void
  applyPreset: (preset: DashboardLayoutPreset) => void
}

/**
 * Susunan widget dashboard, tersimpan per-user di localStorage.
 *
 * `createSharedComposable` menjamin satu sumber state untuk hero (tombol Atur)
 * dan grid (render widget) sekaligus — tanpa store Pinia tambahan.
 */
export const useDashboardLayout = createSharedComposable((): UseDashboardLayout => {
  const auth = useAuthStore()

  // Cookie (bukan localStorage) supaya nilai yang dirender server dan client
  // identik — localStorage tidak tersedia saat SSR sehingga memicu hydration
  // mismatch pada susunan widget.
  const storageKey = `dashboard-layout-${auth.admin?.id ?? 'guest'}`

  const raw = useCookie<DashboardLayoutState>(storageKey, {
    default: () => ({ order: [...DASHBOARD_WIDGET_IDS], hidden: [] }),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })

  const normalized = computed(() => normalizeLayout(raw.value))
  const order = computed(() => normalized.value.order)
  const hidden = computed(() => normalized.value.hidden)

  const isVisible = (id: string) => !hidden.value.includes(id)
  const visibleWidgets = computed(() => order.value.filter(isVisible))

  const editing = ref(false)

  function persist(next: DashboardLayoutState) {
    raw.value = normalizeLayout(next)
  }

  function canMove(id: string, dir: -1 | 1): boolean {
    const i = order.value.indexOf(id)
    const j = i + dir
    return i >= 0 && j >= 0 && j < order.value.length
  }

  function move(id: string, dir: -1 | 1) {
    const next = [...order.value]
    const i = next.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= next.length) return
    const [item] = next.splice(i, 1)
    next.splice(j, 0, item!)
    persist({ order: next, hidden: hidden.value })
  }

  /** Ganti urutan sekaligus (dipakai drag & drop saat drop). */
  function setOrder(ids: string[]) {
    persist({ order: ids, hidden: hidden.value })
  }

  function toggleHidden(id: string) {
    const next = hidden.value.includes(id)
      ? hidden.value.filter(x => x !== id)
      : [...hidden.value, id]
    persist({ order: order.value, hidden: next })
  }

  function reset() {
    persist({ order: [...DASHBOARD_WIDGET_IDS], hidden: [] })
  }

  function applyPreset(preset: DashboardLayoutPreset) {
    const visible = new Set(PRESET_VISIBLE[preset])
    persist({
      order: [...DASHBOARD_WIDGET_IDS],
      hidden: DASHBOARD_WIDGET_IDS.filter(id => !visible.has(id))
    })
  }

  return {
    order,
    hidden,
    visibleWidgets,
    editing,
    isVisible,
    canMove,
    move,
    setOrder,
    toggleHidden,
    reset,
    applyPreset
  }
})
