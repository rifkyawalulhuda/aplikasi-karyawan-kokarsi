import type { SpaceEvent } from '~/types/space'

export function useSpaceSSE(spaceId: Ref<number | null>) {
  const events = ref<SpaceEvent[]>([])
  const connected = ref(false)
  let eventSource: EventSource | null = null

  function connect(id: number) {
    // EventSource only available in browser, not during SSR
    if (!import.meta.client) return

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    const url = `/api/spaces/${id}/stream`
    eventSource = new EventSource(url, { withCredentials: true })

    eventSource.onopen = () => {
      connected.value = true
    }

    eventSource.onmessage = (e) => {
      try {
        const event: SpaceEvent = JSON.parse(e.data)
        events.value.push(event)
        if (events.value.length > 100) events.value.shift()
      } catch {
        // non-fatal parse error
      }
    }

    eventSource.onerror = () => {
      connected.value = false
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (spaceId.value) connect(spaceId.value)
      }, 3000)
    }
  }

  function disconnect() {
    eventSource?.close()
    eventSource = null
    connected.value = false
    events.value = []
  }

  watch(spaceId, (id) => {
    if (id) {
      connect(id)
    } else {
      disconnect()
    }
  }, { immediate: true })

  onUnmounted(() => disconnect())

  return { events, connected }
}
