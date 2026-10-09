export interface AppNotification {
  id: number
  category: string
  severity: 'WARNING' | 'CRITICAL'
  title: string
  message: string
  sourceType: string
  sourceId: number
  triggerDay: number
  deeplink: string
  isRead: boolean
  readAt: string | null
  resolvedAt: string | null
  dismissedAt: string | null
  pinnedAt: string | null
  expiryDate: string
  userId?: number | null
  userType?: string | null
  createdAt: string
}

export interface NotificationSummary {
  total: number
  unread: number
  bySeverity: Record<string, number>
  unreadBySeverity: Record<string, number>
  byCategory: Record<string, number>
  unreadByCategory: Record<string, number>
}

export interface NotificationPreference {
  mutedCategories: string[]
  quietHoursStart: string | null
  quietHoursEnd: string | null
  soundEnabled: boolean
  osNotificationEnabled: boolean
}

export interface NotificationFilters {
  category: string | null
  severity: string | null
  unread: boolean
  q: string
}

export interface NotificationPage {
  items: AppNotification[]
  hasMore: boolean
  nextCursor: number | null
}

const EMPTY_SUMMARY: NotificationSummary = {
  total: 0,
  unread: 0,
  bySeverity: { WARNING: 0, CRITICAL: 0 },
  unreadBySeverity: { WARNING: 0, CRITICAL: 0 },
  byCategory: {},
  unreadByCategory: {}
}

// ── Shared singleton state (badge, summary, preferences, realtime) ─────────────
const unreadCount = ref(0)
const summary = ref<NotificationSummary>({ ...EMPTY_SUMMARY })
const preference = ref<NotificationPreference | null>(null)
const revision = ref(0)

let eventSource: EventSource | null = null
let sseConsumers = 0
let previousCount: number | null = null
const seenIds = new Set<number>()
let primed = false

/** Cek quiet hours di klien (dipakai untuk notifikasi OS & suara). */
export function isWithinQuietHours(
  pref: NotificationPreference | null,
  now = new Date()
): boolean {
  const start = pref?.quietHoursStart
  const end = pref?.quietHoursEnd
  if (!start || !end) return false
  const [sh = NaN, sm = NaN] = start.split(':').map(Number)
  const [eh = NaN, em = NaN] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return false
  const cur = now.getHours() * 60 + now.getMinutes()
  const s = sh * 60 + sm
  const e = eh * 60 + em
  if (s === e) return false
  return s < e ? cur >= s && cur < e : cur >= s || cur < e
}

/** Nada notifikasi singkat via WebAudio — tanpa aset biner. */
function playChime() {
  if (typeof window === 'undefined') return
  const Ctx = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  try {
    const ctx: AudioContext = new Ctx()
    const start = ctx.currentTime
    const notes = [880, 1174.66]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const at = start + i * 0.13
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.32)
    })
    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 900)
  } catch {
    // AudioContext tidak tersedia / diblokir — abaikan
  }
}

function showOsNotification(item: AppNotification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const notification = new Notification(item.title, {
      body: item.message,
      tag: `kokarsi-notif-${item.id}`,
      icon: '/favicon.ico'
    })
    notification.onclick = () => {
      window.focus()
      if (item.deeplink) window.location.href = item.deeplink
    }
  } catch {
    // Gagal menampilkan notifikasi OS — abaikan
  }
}

/** Kirim notifikasi OS + suara untuk item baru (hormati preferensi & quiet hours). */
function deliverNewNotifications(items: AppNotification[]) {
  const pref = preference.value
  const quiet = isWithinQuietHours(pref)
  for (const item of items) {
    const bypassQuiet = item.severity === 'CRITICAL'
    if (pref?.osNotificationEnabled !== false && (!quiet || bypassQuiet)) {
      showOsNotification(item)
    }
    if (pref?.soundEnabled && (!quiet || bypassQuiet)) {
      playChime()
    }
  }
}

// ── Module-level data access (dipakai singleton maupun feed) ───────────────────

async function fetchUnreadCount() {
  try {
    const data = await $fetch<{ count: number }>('/api/notifications/count', {
      credentials: 'include'
    })
    unreadCount.value = data.count
  } catch {
    unreadCount.value = 0
  }
}

async function fetchSummary() {
  try {
    const data = await $fetch<NotificationSummary>('/api/notifications/summary', {
      credentials: 'include'
    })
    summary.value = data
    unreadCount.value = data.unread
  } catch {
    summary.value = { ...EMPTY_SUMMARY }
    unreadCount.value = 0
  }
}

async function fetchPreference() {
  try {
    preference.value = await $fetch<NotificationPreference>('/api/notifications/preferences', {
      credentials: 'include'
    })
  } catch {
    preference.value = null
  }
}

async function updatePreference(patch: Partial<NotificationPreference>) {
  const data = await $fetch<NotificationPreference>('/api/notifications/preferences', {
    method: 'PUT',
    body: patch,
    credentials: 'include'
  })
  preference.value = data
  return data
}

/** Tarik data terbaru + deteksi notifikasi baru untuk notifikasi OS/suara. */
async function refresh() {
  await Promise.all([fetchSummary(), fetchUnreadCount()])
  if (!primed) return
  try {
    const page = await $fetch<NotificationPage>('/api/notifications', {
      query: { limit: 5 },
      credentials: 'include'
    })
    const fresh = page.items.filter(item => !seenIds.has(item.id))
    page.items.forEach(item => seenIds.add(item.id))
    if (fresh.length > 0) deliverNewNotifications(fresh.slice(0, 3))
  } catch {
    // abaikan
  }
}

/** Isi daftar "sudah pernah dilihat" agar notifikasi lama tidak memicu alert. */
async function primeSeen() {
  try {
    const page = await $fetch<NotificationPage>('/api/notifications', {
      query: { limit: 30 },
      credentials: 'include'
    })
    page.items.forEach(item => seenIds.add(item.id))
  } catch {
    // abaikan
  }
  primed = true
}

async function markAllRead() {
  await $fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
  await fetchSummary()
  revision.value++
}

async function markMany(ids: number[], isRead = true) {
  if (ids.length === 0) return
  await $fetch('/api/notifications/mark-many', {
    method: 'POST',
    body: { ids, isRead },
    credentials: 'include'
  })
  await fetchSummary()
  revision.value++
}

async function dismissMany(ids: number[]) {
  if (ids.length === 0) return
  await $fetch('/api/notifications/dismiss-many', {
    method: 'POST',
    body: { ids },
    credentials: 'include'
  })
  await fetchSummary()
  revision.value++
}

async function deleteAll() {
  await $fetch('/api/notifications/delete-all', { method: 'DELETE', credentials: 'include' })
  await fetchSummary()
  revision.value++
}

function connectSSE() {
  if (typeof window === 'undefined') return
  sseConsumers++
  if (eventSource) return
  eventSource = new EventSource('/api/notifications/stream', { withCredentials: true })
  eventSource.onmessage = async (e: MessageEvent) => {
    try {
      const payload = JSON.parse(e.data) as { count: number }
      if (typeof payload.count !== 'number') return
      const changed = payload.count !== previousCount
      previousCount = payload.count
      unreadCount.value = payload.count
      if (changed) {
        await refresh()
        revision.value++
      }
    } catch {
      // abaikan pesan yang tidak valid
    }
  }
  eventSource.onerror = () => {
    // EventSource akan reconnect otomatis
  }
}

function disconnectSSE() {
  sseConsumers = Math.max(0, sseConsumers - 1)
  if (sseConsumers === 0 && eventSource) {
    eventSource.close()
    eventSource = null
  }
}

export function useNotifications() {
  // Auto-connect saat dipakai di dalam komponen + prime daftar seen sekali.
  if (getCurrentInstance()) {
    onMounted(async () => {
      await Promise.all([fetchSummary(), fetchPreference()])
      if (!primed) await primeSeen()
      connectSSE()
    })
    onUnmounted(() => disconnectSSE())
  }

  return {
    unreadCount,
    summary,
    preference,
    revision,
    fetchUnreadCount,
    fetchSummary,
    fetchPreference,
    updatePreference,
    refresh,
    primeSeen,
    markAllRead,
    markMany,
    dismissMany,
    deleteAll,
    connectSSE,
    disconnectSSE
  }
}

/**
 * Feed notifikasi independen (bell panel & halaman /notifications).
 * Setiap pemanggilan menghasilkan state sendiri; badge/summary tetap singleton.
 */
export function useNotificationFeed(options: { limit?: number } = {}) {
  const pageSize = options.limit ?? 20
  const items = ref<AppNotification[]>([])
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMore = ref(false)
  const nextCursor = ref<number | null>(null)
  const error = ref<string | null>(null)

  const filters = reactive<NotificationFilters>({
    category: null,
    severity: null,
    unread: false,
    q: ''
  })

  function buildQuery(): Record<string, string | number> {
    const query: Record<string, string | number> = { limit: pageSize }
    if (filters.category) query.category = filters.category
    if (filters.severity) query.severity = filters.severity
    if (filters.unread) query.unread = 'true'
    if (filters.q.trim()) query.q = filters.q.trim()
    return query
  }

  async function fetchFirstPage() {
    isLoading.value = true
    error.value = null
    try {
      const data = await $fetch<NotificationPage>('/api/notifications', {
        query: buildQuery(),
        credentials: 'include'
      })
      items.value = data.items
      hasMore.value = data.hasMore
      nextCursor.value = data.nextCursor
    } catch (e: unknown) {
      const message = (e as { data?: { message?: string } })?.data?.message
      error.value = message ?? 'Gagal memuat notifikasi'
      items.value = []
      hasMore.value = false
      nextCursor.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || nextCursor.value === null || isLoadingMore.value) return
    isLoadingMore.value = true
    try {
      const data = await $fetch<NotificationPage>('/api/notifications', {
        query: { ...buildQuery(), cursor: nextCursor.value },
        credentials: 'include'
      })
      items.value = [...items.value, ...data.items]
      hasMore.value = data.hasMore
      nextCursor.value = data.nextCursor
    } catch {
      // biarkan daftar yang ada; pengguna dapat mencoba lagi
    } finally {
      isLoadingMore.value = false
    }
  }

  function patchLocal(id: number, patch: Partial<AppNotification>) {
    const target = items.value.find(n => n.id === id)
    if (target) Object.assign(target, patch)
  }

  async function markRead(item: AppNotification) {
    if (item.isRead) return
    patchLocal(item.id, { isRead: true, readAt: new Date().toISOString() })
    try {
      await $fetch(`/api/notifications/${item.id}/read`, { method: 'POST', credentials: 'include' })
      await fetchSummary()
    } catch {
      patchLocal(item.id, { isRead: false, readAt: null })
    }
  }

  async function markUnread(item: AppNotification) {
    if (!item.isRead) return
    patchLocal(item.id, { isRead: false, readAt: null })
    try {
      await $fetch(`/api/notifications/${item.id}/unread`, { method: 'POST', credentials: 'include' })
      await fetchSummary()
    } catch {
      patchLocal(item.id, { isRead: true, readAt: new Date().toISOString() })
    }
  }

  async function togglePin(item: AppNotification) {
    const pinned = !item.pinnedAt
    patchLocal(item.id, { pinnedAt: pinned ? new Date().toISOString() : null })
    try {
      await $fetch(`/api/notifications/${item.id}/pin`, {
        method: 'POST',
        body: { pinned },
        credentials: 'include'
      })
      await fetchFirstPage()
    } catch {
      patchLocal(item.id, { pinnedAt: pinned ? null : new Date().toISOString() })
    }
  }

  /** Singkirkan item; kembalikan fungsi undo bila berhasil, null bila gagal. */
  async function dismiss(item: AppNotification) {
    const index = items.value.findIndex(n => n.id === item.id)
    if (index === -1) return null
    items.value = items.value.filter(n => n.id !== item.id)
    try {
      await $fetch(`/api/notifications/${item.id}/dismiss`, {
        method: 'POST',
        credentials: 'include'
      })
      await fetchSummary()
      return () => restore(item)
    } catch {
      items.value = [...items.value.slice(0, index), item, ...items.value.slice(index)]
      return null
    }
  }

  async function restore(_item: AppNotification) {
    try {
      await $fetch(`/api/notifications/${_item.id}/undo-dismiss`, {
        method: 'POST',
        credentials: 'include'
      })
      await fetchSummary()
      await fetchFirstPage()
    } catch {
      // abaikan
    }
  }

  /** Navigasi ke deeplink sambil menandai dibaca. */
  async function open(item: AppNotification) {
    await markRead(item)
    if (item.deeplink) await navigateTo(item.deeplink)
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => [filters.category, filters.severity, filters.unread] as const,
    () => {
      fetchFirstPage()
    }
  )
  watch(
    () => filters.q,
    () => {
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        fetchFirstPage()
      }, 250)
    }
  )
  watch(revision, () => {
    fetchFirstPage()
  })

  if (getCurrentInstance()) {
    onMounted(() => {
      fetchFirstPage()
    })
    onUnmounted(() => {
      if (searchTimer) clearTimeout(searchTimer)
    })
  }

  const isEmpty = computed(() => !isLoading.value && items.value.length === 0)

  const hasActiveFilters = computed(
    () =>
      Boolean(filters.category)
      || Boolean(filters.severity)
      || filters.unread
      || Boolean(filters.q.trim())
  )

  function resetFilters() {
    filters.category = null
    filters.severity = null
    filters.unread = false
    filters.q = ''
  }

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isEmpty,
    hasActiveFilters,
    filters,
    fetchFirstPage,
    loadMore,
    markRead,
    markUnread,
    togglePin,
    dismiss,
    restore,
    open,
    resetFilters
  }
}
