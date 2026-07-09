export interface AppNotification {
  id: number
  category: 'KONTRAK_KARYAWAN' | 'SERTIFIKASI_IJIN' | 'KONTRAK_VENDOR' | 'LEGAL_KOPERASI'
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
  createdAt: string
}

// Module-level singleton state — shared across all composable instances
const notifications = ref<AppNotification[]>([])
const unreadCount = ref(0)
const isLoading = ref(false)
let intervalId: ReturnType<typeof setInterval> | null = null

export function useNotifications() {
  async function fetchNotifications(limit = 10) {
    isLoading.value = true
    try {
      const data = await $fetch<AppNotification[]>(`/api/notifications`, {
        query: { limit },
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
      const data = await $fetch<{ count: number }>('/api/notifications/count', {
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
      await $fetch('/api/notifications/read-all', {
        method: 'POST',
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
      await $fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
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

  // Start polling for unread count every 5 minutes
  function startPolling() {
    if (intervalId !== null) return
    intervalId = setInterval(() => {
      fetchUnreadCount()
    }, 5 * 60 * 1000)
  }

  function stopPolling() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Auto-start polling and clean up when composable is used inside a component
  if (getCurrentInstance()) {
    onMounted(() => startPolling())
    onUnmounted(() => stopPolling())
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    fetchUnreadCount,
    markAllRead,
    markOneRead,
    startPolling,
    stopPolling,
  }
}
