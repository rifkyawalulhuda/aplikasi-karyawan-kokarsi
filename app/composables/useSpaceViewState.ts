export type SpaceView = 'board' | 'list' | 'docs'
export type DueFilter = 'all' | 'overdue' | 'soon'

/** Query yang dipakai view Space — dipisah agar tidak menyentuh query lain. */
const VIEW_KEYS = ['view', 'q', 'assignee', 'priority', 'label', 'due', 'column'] as const

export interface SpaceViewState {
  view: Ref<SpaceView>
  setView: (view: SpaceView) => void
  q: Ref<string>
  setQ: (value: string) => void
  assigneeIds: Ref<number[]>
  setAssignee: (ids: number[]) => void
  priorities: Ref<string[]>
  setPriorities: (values: string[]) => void
  labels: Ref<string[]>
  setLabels: (values: string[]) => void
  due: Ref<DueFilter>
  setDue: (value: DueFilter) => void
  columnIds: Ref<number[]>
  setColumn: (ids: number[]) => void
  hasFilters: ComputedRef<boolean>
  clearFilters: () => void
}

function toArray(value: unknown): string[] {
  if (value == null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw.flatMap(v => String(v).split(',')).map(s => s.trim()).filter(Boolean)
}

function toNumbers(values: string[]): number[] {
  return values.map(v => Number(v)).filter(n => Number.isFinite(n))
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

/**
 * State view & filter Space yang tersinkron ke URL query.
 *
 * `?view=list&q=xyz&assignee=1&assignee=2&priority=HIGH&due=overdue`
 *
 * Semua perubahan memakai `router.replace` (tidak menumpuk riwayat), sehingga
 * refresh, share link, dan tombol back tetap benar.
 */
export function useSpaceViewState(): SpaceViewState {
  const route = useRoute()
  const router = useRouter()

  const view = computed<SpaceView>(() => {
    const v = route.query.view
    return v === 'list' || v === 'docs' ? v : 'board'
  })

  const q = computed(() => String(route.query.q ?? ''))
  const assigneeIds = computed(() => unique(toNumbers(toArray(route.query.assignee))))
  const priorities = computed(() => unique(toArray(route.query.priority)))
  const labels = computed(() => unique(toArray(route.query.label)))
  const columnIds = computed(() => unique(toNumbers(toArray(route.query.column))))
  const due = computed<DueFilter>(() => {
    const v = route.query.due
    return v === 'overdue' || v === 'soon' ? v : 'all'
  })

  const hasFilters = computed(() =>
    q.value.trim().length > 0
    || assigneeIds.value.length > 0
    || priorities.value.length > 0
    || labels.value.length > 0
    || columnIds.value.length > 0
    || due.value !== 'all'
  )

  /** Tulis query baru; key yang dikosongkan dihilangkan agar URL tetap rapi. */
  function setQuery(patch: Record<string, string | number | (string | number)[] | null>) {
    const keys = new Set([...Object.keys(route.query), ...Object.keys(patch)])
    const next: Record<string, unknown> = {}
    for (const key of keys) {
      if (!(key in patch)) {
        next[key] = route.query[key]
        continue
      }
      const value = patch[key]
      const isEmpty = value == null
        || value === ''
        || (Array.isArray(value) && value.length === 0)
      if (!isEmpty) next[key] = value
    }
    router.replace({ query: next as never }).catch(() => {})
  }

  function setView(v: SpaceView) {
    setQuery({ view: v === 'board' ? null : v })
  }

  function setQ(value: string) {
    setQuery({ q: value.trim() ? value : null })
  }

  function setAssignee(ids: number[]) {
    setQuery({ assignee: ids.length ? ids : null })
  }

  function setPriorities(values: string[]) {
    setQuery({ priority: values.length ? values : null })
  }

  function setLabels(values: string[]) {
    setQuery({ label: values.length ? values : null })
  }

  function setColumn(ids: number[]) {
    setQuery({ column: ids.length ? ids : null })
  }

  function setDue(value: DueFilter) {
    setQuery({ due: value === 'all' ? null : value })
  }

  function clearFilters() {
    const keys = new Set([...Object.keys(route.query)])
    const next: Record<string, unknown> = {}
    for (const key of keys) {
      const isViewKey = VIEW_KEYS.includes(key as typeof VIEW_KEYS[number])
      if (!isViewKey || key === 'view') next[key] = route.query[key]
    }
    router.replace({ query: next as never }).catch(() => {})
  }

  return {
    view,
    setView,
    q,
    setQ,
    assigneeIds,
    setAssignee,
    priorities,
    setPriorities,
    labels,
    setLabels,
    due,
    setDue,
    columnIds,
    setColumn,
    hasFilters,
    clearFilters
  }
}

/** Terapkan semua filter + pencarian pada satu kartu. */
export interface FilterableCard {
  title: string
  description?: string | null
  priority: string
  dueDate?: string | null
  assigneeIds: number[]
  labels: string[]
  columnId: number
  labelNames?: string
}

export function applyCardFilters(
  cards: FilterableCard[],
  state: Pick<SpaceViewState, 'q' | 'assigneeIds' | 'priorities' | 'labels' | 'due' | 'columnIds'>
): FilterableCard[] {
  const term = state.q.value.trim().toLowerCase()
  const assignees = state.assigneeIds.value
  const priorities = state.priorities.value
  const labels = state.labels.value
  const columns = state.columnIds.value
  const due = state.due.value
  const now = Date.now()
  const DAY = 86_400_000

  return cards.filter((card) => {
    if (term) {
      const haystack = `${card.title} ${card.description ?? ''} ${card.labelNames ?? ''}`.toLowerCase()
      if (!haystack.includes(term)) return false
    }
    if (assignees.length && !card.assigneeIds.some(id => assignees.includes(id))) return false
    if (priorities.length && !priorities.includes(card.priority)) return false
    if (labels.length && !card.labels.some(l => labels.includes(l))) return false
    if (columns.length && !columns.includes(card.columnId)) return false
    if (due !== 'all') {
      if (!card.dueDate) return false
      const diff = (new Date(card.dueDate).getTime() - now) / DAY
      if (due === 'overdue' && diff >= 0) return false
      if (due === 'soon' && (diff < 0 || diff > 2)) return false
    }
    return true
  })
}
