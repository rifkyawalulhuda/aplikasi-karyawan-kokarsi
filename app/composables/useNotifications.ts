export interface AppNotification {
  id: number
  category: 'KONTRAK_KARYAWAN' | 'SERTIFIKASI_IJIN' | 'KONTRAK_VENDOR' | 'LEGAL_KOPERASI' | 'AGENDA' | 'SPACE'
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
  expiryDate: string
  userId?: number | null
  userType?: string | null
  createdAt: string
}

// Module-level singleton state — shared across all composable instances
const notifications = ref<AppNotification[]>([])
const unreadCount = ref(0)
const isLoading = ref(false)
let intervalId: ReturnType<typeof setInterval> | null = null // kept for reference, unused
let eventSource: EventSource | null = null
let previousCount: number | null = null // untuk skip fetch jika count tidak berubah

export function useNotifications() {
  // Identitas user login untuk filter per-user
  function getIdentity() {
    const auth = useAuthStore()
    const id = auth.admin?.id
    const type = auth.admin?.accountType
    return { id, type }
  }

  async function fetchNotifications(limit = 10) {
    isLoading.value = true
    try {
      const { id, type } = getIdentity()
      const query: Record<string, string | number> = { limit }
      if (id !== undefined && type) {
        query.userId = id
        query.userType = type
      }
      const data = await $fetch<AppNotification[]>(`/api/notifications`, {
        query,
        credentials: 'include',
      })
      notifications.value = data
    }
    catch {
      notifications.value = []
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const { id, type } = getIdentity()
      const query: Record<string, string | number> = {}
      if (id !== undefined && type) {
        query.userId = id
        query.userType = type
      }
      const data = await $fetch<{ count: number }>('/api/notifications/count', {
        query,
        credentials: 'include',
      })
      unreadCount.value = data.count
    }
    catch {
      unreadCount.value = 0
    }
  }

  async function markAllRead() {
    try {
      const { id, type } = getIdentity()
      const query: Record<string, string | number> = {}
      if (id !== undefined && type) {
        query.userId = id
        query.userType = type
      }
      await $fetch('/api/notifications/read-all', {
        method: 'POST',
        query,
        credentials: 'include',
      })
      await Promise.all([fetchNotifications(), fetchUnreadCount()])
    }
    catch {
      // silently fail — UI state unchanged on error
    }
  }

  async function markOneRead(id: number) {
    try {
      const { id: userId, type } = getIdentity()
      const query: Record<string, string | number> = {}
      if (userId !== undefined && type) {
        query.userId = userId
        query.userType = type
      }
      await $fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        query,
        credentials: 'include',
      })
      // Update local state optimistically without a full refetch
      const target = notifications.value.find(n => n.id === id)
      if (target && !target.isRead) {
        target.isRead = true
        target.readAt = new Date().toISOString()
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    }
    catch {
      // silently fail — UI state unchanged on error
    }
  }

  function connectSSE() {
    if (eventSource) return // already connected
    if (typeof window === 'undefined') return // SSR guard
    eventSource = new EventSource('/api/notifications/stream', {
      withCredentials: true,
    })
    eventSource.onmessage = async (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as { count: number }
        if (typeof payload.count === 'number') {
          const changed = payload.count !== previousCount
          previousCount = payload.count
          unreadCount.value = payload.count
          if (payload.count > 0 && changed) {
            await fetchNotifications()
          }
        }
      }
      catch {
        // ignore malformed messages
      }
    }
    eventSource.onerror = () => {
      // EventSource auto-reconnects — no manual intervention needed
    }
  }

  function disconnectSSE() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  // Aliases for backward compatibility
  async function deleteAll() {
    try {
      await $fetch('/api/notifications/delete-all', {
        method: 'DELETE',
        credentials: 'include',
      })
      // Clear local state immediately
      notifications.value = []
      unreadCount.value = 0
    }
    catch {
      // silently fail
    }
  }

  const startPolling = connectSSE
  const stopPolling = disconnectSSE

  // Auto-connect SSE and clean up when composable is used inside a component
  if (getCurrentInstance()) {
    onMounted(() => connectSSE())
    onUnmounted(() => disconnectSSE())
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    fetchUnreadCount,
    markAllRead,
    markOneRead,
    deleteAll,
    connectSSE,
    disconnectSSE,
    startPolling,
    stopPolling,
  }
}
