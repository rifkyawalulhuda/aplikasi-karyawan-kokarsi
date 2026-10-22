import { toValue, type MaybeRefOrGetter } from 'vue'

export interface ContractDraftSnapshot<T> {
  savedAt: number
  data: T
}

const DRAFT_PREFIX = 'kokarsi:contract-draft:'

export function useContractDraft<T>(key: MaybeRefOrGetter<string>) {
  const storageKey = computed(() => `${DRAFT_PREFIX}${toValue(key)}`)

  function read(): ContractDraftSnapshot<T> | null {
    if (!import.meta.client) return null
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (!raw) return null
      const parsed = JSON.parse(raw) as ContractDraftSnapshot<T>
      if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.data) return null
      return parsed
    } catch {
      return null
    }
  }

  function save(data: T) {
    if (!import.meta.client) return
    try {
      localStorage.setItem(storageKey.value, JSON.stringify({ savedAt: Date.now(), data }))
    } catch {
      return
    }
  }

  function clear() {
    if (!import.meta.client) return
    try {
      localStorage.removeItem(storageKey.value)
    } catch {
      return
    }
  }

  return { read, save, clear }
}

export function formatDraftAge(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}
