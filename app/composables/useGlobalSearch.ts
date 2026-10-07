import { SEARCH_CATEGORIES, countHits, type SearchCategoryKey, type SearchResponse } from '~/utils/global-search'

/**
 * Orkestrasi data pencarian global.
 *
 * Satu endpoint terpadu (`/api/search/unified`) menggantikan fan-out 9 request
 * lama. Debounce 200ms + pembatalan berbasis id permintaan mencegah hasil basi
 * menimpa hasil baru saat pengguna mengetik cepat.
 *
 * `limit` bertingkat (5 → 15 → 30 → 50) memberi "muat lebih banyak" tanpa
 * memuat seluruh tabel di ketikan pertama.
 */

export const SEARCH_LIMIT_STEPS = [5, 15, 30, 50] as const
export const SEARCH_MIN_QUERY = 2
const DEBOUNCE_MS = 200

export function useGlobalSearch() {
  const query = ref('')
  const limitIndex = ref(0)
  const activeCategory = ref<'all' | SearchCategoryKey>('all')
  const loading = ref(false)
  const error = ref('')
  const response = ref<SearchResponse | null>(null)
  const activeIndex = ref(0)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let requestSeq = 0

  const currentLimit = computed(() => SEARCH_LIMIT_STEPS[Math.min(limitIndex.value, SEARCH_LIMIT_STEPS.length - 1)])
  const canLoadMore = computed(() => limitIndex.value < SEARCH_LIMIT_STEPS.length - 1)
  const hasQuery = computed(() => query.value.trim().length >= SEARCH_MIN_QUERY)

  /** Kategori yang punya hasil, sesuai urutan produk (Karyawan dulu). */
  const visibleCategories = computed(() => {
    const categories = response.value?.categories ?? {}
    return SEARCH_CATEGORIES
      .map(meta => ({ ...meta, result: categories[meta.key] }))
      .filter(entry => (entry.result?.items?.length ?? 0) > 0)
  })

  const totalResults = computed(() => countHits(response.value))

  /** Baris datar untuk navigasi keyboard (mengikuti tab aktif). */
  const flatHits = computed(() => {
    if (!response.value) return []
    const categories = activeCategory.value === 'all'
      ? visibleCategories.value
      : visibleCategories.value.filter(entry => entry.key === activeCategory.value)
    return categories.flatMap(entry => entry.result?.items ?? [])
  })

  function reset() {
    response.value = null
    error.value = ''
    activeIndex.value = 0
  }

  async function fetchResults() {
    if (!hasQuery.value) {
      reset()
      return
    }
    const seq = ++requestSeq
    loading.value = true
    error.value = ''
    try {
      const data = await $fetch<SearchResponse>('/api/search/unified', {
        query: { q: query.value.trim(), limit: currentLimit.value },
        credentials: 'include'
      })
      if (seq !== requestSeq) return
      response.value = data
      // Pertahankan pilihan kategori bila masih ada hasilnya; kalau tidak, kembali ke Semua.
      if (activeCategory.value !== 'all' && !data?.categories?.[activeCategory.value]?.items?.length) {
        activeCategory.value = 'all'
      }
      activeIndex.value = 0
    } catch (e) {
      if (seq !== requestSeq) return
      response.value = null
      error.value = apiErrorMessage(e, 'Gagal mencari')
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  watch(query, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    activeIndex.value = 0
    debounceTimer = setTimeout(fetchResults, DEBOUNCE_MS)
  })

  /** Naikkan limit lalu ambil ulang (dipakai tombol "Muat lebih banyak"). */
  async function loadMore() {
    if (!canLoadMore.value) return
    limitIndex.value += 1
    await fetchResults()
  }

  function setCategory(key: 'all' | SearchCategoryKey) {
    activeCategory.value = key
    activeIndex.value = 0
  }

  function moveActive(delta: number) {
    const count = flatHits.value.length
    if (!count) return
    const next = (activeIndex.value + delta + count) % count
    activeIndex.value = next
  }

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    requestSeq++
  })

  return {
    query,
    activeCategory,
    activeIndex,
    loading,
    error,
    response,
    visibleCategories,
    totalResults,
    flatHits,
    currentLimit,
    canLoadMore,
    hasQuery,
    fetchResults,
    loadMore,
    setCategory,
    moveActive,
    reset
  }
}
