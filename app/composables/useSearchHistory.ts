import { searchHitKey, type SearchHit } from '~/utils/global-search'

/**
 * Riwayat & sematan pencarian global — disimpan di localStorage.
 *
 * Dipisah dari server karena sifatnya preferensi per-browser: tidak perlu
 * sinkronisasi, tidak menambah tabel, dan privasi terjaga. Kunci diberi prefix
 * id pengguna supaya dua akun di satu browser tidak saling membocorkan riwayat.
 *
 * Semua penulisan dibungkus try/catch: localStorage bisa tidak tersedia (mode
 * privat, kuota penuh) dan itu tidak boleh menggagalkan pencarian.
 */

const STORAGE_PREFIX = 'kokarsi.globalSearch.v1'
const MAX_RECENT_HITS = 8
const MAX_RECENT_QUERIES = 8
const MAX_PINNED = 12

interface SearchHistoryState {
  recent: SearchHit[]
  queries: string[]
  pinned: SearchHit[]
}

const recent = ref<SearchHit[]>([])
const queries = ref<string[]>([])
const pinned = ref<SearchHit[]>([])
let loadedKey: string | null = null

function storageKey(): string {
  const auth = useAuthStore()
  const id = auth.admin?.id ?? 'anon'
  return `${STORAGE_PREFIX}.${id}`
}

function persist() {
  if (import.meta.server) return
  try {
    const payload: SearchHistoryState = {
      recent: recent.value,
      queries: queries.value,
      pinned: pinned.value
    }
    localStorage.setItem(loadedKey ?? storageKey(), JSON.stringify(payload))
  } catch { /* localStorage tidak tersedia — abaikan */ }
}

/** Muat dari localStorage sekali per pengguna. */
function ensureLoaded() {
  if (import.meta.server) return
  const key = storageKey()
  if (loadedKey === key) return
  loadedKey = key
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) as Partial<SearchHistoryState> : {}
    recent.value = Array.isArray(parsed.recent) ? parsed.recent : []
    queries.value = Array.isArray(parsed.queries) ? parsed.queries.filter(q => typeof q === 'string') : []
    pinned.value = Array.isArray(parsed.pinned) ? parsed.pinned : []
  } catch {
    recent.value = []
    queries.value = []
    pinned.value = []
  }
}

function removeFrom(list: SearchHit[], key: string): SearchHit[] {
  return list.filter(item => searchHitKey(item) !== key)
}

export function useSearchHistory() {
  const pinnedKeys = computed(() => new Set(pinned.value.map(searchHitKey)))

  function isPinned(hit: SearchHit): boolean {
    return pinnedKeys.value.has(searchHitKey(hit))
  }

  /** Catat entitas yang dibuka (paling baru di depan, tanpa duplikat). */
  function recordHit(hit: SearchHit) {
    ensureLoaded()
    const key = searchHitKey(hit)
    recent.value = [hit, ...removeFrom(recent.value, key)].slice(0, MAX_RECENT_HITS)
    persist()
  }

  /** Catat query yang menghasilkan (hanya yang tidak kosong). */
  function recordQuery(query: string) {
    ensureLoaded()
    const q = query.trim()
    if (q.length < 2) return
    queries.value = [q, ...queries.value.filter(existing => existing.toLowerCase() !== q.toLowerCase())]
      .slice(0, MAX_RECENT_QUERIES)
    persist()
  }

  function togglePin(hit: SearchHit) {
    ensureLoaded()
    const key = searchHitKey(hit)
    if (pinnedKeys.value.has(key)) {
      pinned.value = removeFrom(pinned.value, key)
    } else {
      pinned.value = [hit, ...removeFrom(pinned.value, key)].slice(0, MAX_PINNED)
    }
    persist()
  }

  function removeRecentHit(hit: SearchHit) {
    ensureLoaded()
    recent.value = removeFrom(recent.value, searchHitKey(hit))
    persist()
  }

  function clearRecent() {
    ensureLoaded()
    recent.value = []
    queries.value = []
    persist()
  }

  function clearPinned() {
    ensureLoaded()
    pinned.value = []
    persist()
  }

  return {
    recent,
    queries,
    pinned,
    pinnedKeys,
    isPinned,
    recordHit,
    recordQuery,
    togglePin,
    removeRecentHit,
    clearRecent,
    clearPinned,
    ensureLoaded
  }
}
