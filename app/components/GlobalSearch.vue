<script setup lang="ts">
import {
  searchHitCopyValue,
  searchHitIcon,
  searchHitKey,
  searchHitRoute,
  type SearchCategoryKey,
  type SearchHit
} from '~/utils/global-search'
import { SEARCH_LIMIT_STEPS, useGlobalSearch } from '~/composables/useGlobalSearch'

/**
 * Global Search — command palette.
 *
 * Kenapa dibangun di atas `UModal` (Reka Dialog) dan bukan `UDashboardSearch`:
 * palette ini butuh dua panel (daftar + pratinjau), tab kategori, aksi cepat per
 * hasil, riwayat/sematan, dan panel bantuan pintasan — semuanya tidak muat di
 * komponen bawaan. Gaya visual tetap mengikuti token Nuxt UI (primary, elevated,
 * border-default) supaya menyatu dengan sisa aplikasi.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const open = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const isMobile = useMediaQuery('(max-width: 767px)')
const isAdmin = computed(() => auth.admin?.role === 'ADMIN')

const search = useGlobalSearch()
const history = useSearchHistory()
const { editing: dashboardEditing, reset: resetDashboard, applyPreset: applyDashboardPreset } = useDashboardLayout()
const dashboardRefreshBus = useEventBus('dashboard:refresh')

const cheatSheetOpen = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

/** Entri seragam untuk daftar & navigasi keyboard. */
interface Entry {
  id: string
  group: string
  icon: string
  title: string
  subtitle?: string
  meta?: string[]
  color?: string
  hit?: SearchHit
  route?: string | null
  run?: () => void
}

interface Section {
  key: string
  label: string
  icon?: string
  entries: Entry[]
  /** Kategori ini masih punya hasil tambahan di server. */
  hasMore?: boolean
}

function openRoute(route: string | null | undefined, newTab = false) {
  if (!route) return
  if (newTab) window.open(route, '_blank', 'noopener')
  else router.push(route)
  open.value = false
}

// ── Sumber entri statis (navigasi + aksi dashboard) ──────────────────────────
const NAV_ENTRIES = computed<Entry[]>(() => {
  const items: Array<{ label: string, icon: string, to: string }> = [
    { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
    { label: 'Data Karyawan', icon: 'i-lucide-users', to: '/karyawan' },
    { label: 'Kontrak', icon: 'i-lucide-file-text', to: '/kontrak' },
    { label: 'Kalender', icon: 'i-lucide-calendar-days', to: '/kalender' },
    { label: 'Pemakaian Kendaraan', icon: 'i-lucide-car-front', to: '/operasional/pemakaian-kendaraan' },
    { label: 'Space', icon: 'i-lucide-kanban', to: '/spaces' },
    { label: 'Dok. Karyawan', icon: 'i-lucide-id-card', to: '/dokumen/dok-karyawan' },
    { label: 'Surat Peringatan', icon: 'i-lucide-alert-triangle', to: '/dokumen/surat-peringatan' },
    { label: 'Sertifikasi & Ijin', icon: 'i-lucide-file-badge', to: '/dokumen/sertifikasi-ijin' },
    { label: 'Kontrak Customer/Vendor', icon: 'i-lucide-building-2', to: '/dokumen-legal/kontrak-vendor' },
    { label: 'Legal Koperasi', icon: 'i-lucide-file-signature', to: '/dokumen-legal/legal-koperasi' },
    { label: 'Akte Dokumen', icon: 'i-lucide-scroll-text', to: '/dokumen-legal/akte-dokumen' },
    { label: 'Arsip Umum', icon: 'i-lucide-archive', to: '/dokumen-legal/arsip-umum' },
    { label: 'Pengaturan', icon: 'i-lucide-settings', to: '/settings' },
    // Menu khusus ADMIN — disembunyikan untuk PENGELOLA agar tidak menyesatkan
    // (rutenya memang diblokir middleware, jadi menampilkannya hanya buntu).
    ...(isAdmin.value
      ? [
          { label: 'Master Data', icon: 'i-lucide-database', to: '/settings/master-data' },
          { label: 'Template Kontrak', icon: 'i-lucide-file-cog', to: '/settings/contract-templates' },
          { label: 'User', icon: 'i-lucide-user-cog', to: '/settings/users' },
          { label: 'Log Aktivitas', icon: 'i-lucide-history', to: '/settings/activity-log' }
        ]
      : [])
  ]
  return items.map(item => ({
    id: `nav:${item.to}`,
    group: 'Navigasi',
    icon: item.icon,
    title: item.label,
    route: item.to
  }))
})

const ACTION_ENTRIES = computed<Entry[]>(() => {
  const actions: Entry[] = []
  if (router.currentRoute.value.path === '/') {
    actions.push(
      { id: 'act:refresh', group: 'Aksi Dashboard', icon: 'i-lucide-refresh-cw', title: 'Muat ulang data dashboard', run: () => dashboardRefreshBus.emit() },
      { id: 'act:widgets', group: 'Aksi Dashboard', icon: 'i-lucide-sliders-horizontal', title: dashboardEditing.value ? 'Selesai atur widget' : 'Atur widget dashboard', run: () => { dashboardEditing.value = !dashboardEditing.value } },
      { id: 'act:preset-ringkas', group: 'Aksi Dashboard', icon: 'i-lucide-minimize-2', title: 'Preset: Ringkas', run: () => applyDashboardPreset('ringkas') },
      { id: 'act:preset-standar', group: 'Aksi Dashboard', icon: 'i-lucide-layout-dashboard', title: 'Preset: Standar', run: () => applyDashboardPreset('standar') },
      { id: 'act:preset-lengkap', group: 'Aksi Dashboard', icon: 'i-lucide-maximize-2', title: 'Preset: Lengkap', run: () => applyDashboardPreset('lengkap') },
      { id: 'act:reset', group: 'Aksi Dashboard', icon: 'i-lucide-rotate-ccw', title: 'Reset susunan widget', run: () => resetDashboard() }
    )
  }
  return actions
})

/** Entri dari sebuah hasil pencarian. */
function hitEntry(hit: SearchHit, group: string): Entry {
  return {
    id: `hit:${searchHitKey(hit)}`,
    group,
    icon: searchHitIcon(hit),
    title: hit.title,
    subtitle: hit.subtitle,
    meta: hit.meta,
    hit,
    route: searchHitRoute(hit)
  }
}

// ── Seksi yang dirender ──────────────────────────────────────────────────────
const sections = computed<Section[]>(() => {
  if (search.hasQuery.value) {
    const cats = search.activeCategory.value === 'all'
      ? search.visibleCategories.value
      : search.visibleCategories.value.filter(c => c.key === search.activeCategory.value)
    return cats.map(c => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      entries: (c.result?.items ?? []).map(hit => hitEntry(hit, c.label)),
      hasMore: c.result?.hasMore
    }))
  }

  const result: Section[] = []
  if (history.pinned.value.length) {
    result.push({
      key: 'pinned',
      label: 'Disematkan',
      icon: 'i-lucide-star',
      entries: history.pinned.value.map(hit => hitEntry(hit, 'Disematkan'))
    })
  }
  if (history.recent.value.length) {
    result.push({
      key: 'recent',
      label: 'Terakhir dibuka',
      icon: 'i-lucide-history',
      entries: history.recent.value.map(hit => hitEntry(hit, 'Terakhir dibuka'))
    })
  }
  if (history.queries.value.length) {
    result.push({
      key: 'queries',
      label: 'Pencarian terakhir',
      icon: 'i-lucide-search',
      entries: history.queries.value.map(q => ({
        id: `q:${q}`,
        group: 'Pencarian terakhir',
        icon: 'i-lucide-corner-down-left',
        title: q,
        run: () => { search.query.value = q }
      }))
    })
  }
  if (NAV_ENTRIES.value.length) {
    result.push({ key: 'nav', label: 'Navigasi', icon: 'i-lucide-compass', entries: NAV_ENTRIES.value })
  }
  if (ACTION_ENTRIES.value.length) {
    result.push({ key: 'actions', label: 'Aksi Dashboard', icon: 'i-lucide-sparkles', entries: ACTION_ENTRIES.value })
  }
  return result
})

const flatEntries = computed(() => sections.value.flatMap(section => section.entries))
const activeEntry = computed<Entry | null>(() => flatEntries.value[search.activeIndex.value] ?? null)
const previewHit = computed<SearchHit | null>(() => activeEntry.value?.hit ?? null)

/** Kategori yang punya hasil (untuk chips). */
const chipCategories = computed(() =>
  search.visibleCategories.value.map(c => ({ key: c.key, label: c.label, count: c.result?.items?.length ?? 0 }))
)

// ── Aksi ─────────────────────────────────────────────────────────────────────
function runEntry(entry: Entry | null, newTab = false) {
  if (!entry) return
  if (entry.run) {
    entry.run()
    return
  }
  if (entry.hit) history.recordHit(entry.hit)
  openRoute(entry.route, newTab)
}

function commitQuery() {
  if (search.query.value.trim().length >= 2) history.recordQuery(search.query.value)
}

async function copyValue(value: string | null | undefined) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `Disalin: ${value}`, color: 'success' })
  } catch {
    toast.add({ title: 'Gagal menyalin', color: 'error' })
  }
}

function relatedContract(hit: SearchHit) {
  const key = hit.code || hit.employeeName || hit.title
  if (key) openRoute(`/kontrak?search=${encodeURIComponent(key)}`)
}

function contactEmployee(hit: SearchHit, channel: 'email' | 'wa') {
  const phone = (hit.phone ?? '').replace(/[^\d]/g, '').replace(/^0/, '62')
  if (channel === 'email' && hit.email) window.location.href = `mailto:${hit.email}`
  else if (channel === 'wa' && phone) window.open(`https://wa.me/${phone}`, '_blank', 'noopener')
}

// ── Pencarian teks (highlight) ───────────────────────────────────────────────
function highlightParts(text: string, q: string): Array<{ text: string, match: boolean }> {
  const query = q.trim()
  if (query.length < 2) return [{ text, match: false }]
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index < 0) return [{ text, match: false }]
  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + query.length), match: true },
    { text: text.slice(index + query.length), match: false }
  ].filter(part => part.text.length > 0)
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
function scrollActiveIntoView() {
  nextTick(() => {
    listEl.value?.querySelector<HTMLElement>('[data-active-entry="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function onInputKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      search.moveActive(1)
      scrollActiveIntoView()
      break
    case 'ArrowUp':
      event.preventDefault()
      search.moveActive(-1)
      scrollActiveIntoView()
      break
    case 'Enter':
      event.preventDefault()
      commitQuery()
      runEntry(activeEntry.value, event.ctrlKey || event.metaKey)
      break
    case 'Tab': {
      // Tab antar kategori (fokus tetap di input agar mengetik tidak terputus).
      if (chipCategories.value.length < 2) return
      event.preventDefault()
      const keys: Array<'all' | SearchCategoryKey> = ['all', ...chipCategories.value.map(c => c.key)]
      const current = keys.indexOf(search.activeCategory.value)
      const step = event.shiftKey ? -1 : 1
      const next = (current + step + keys.length) % keys.length
      search.setCategory(keys[next]!)
      break
    }
    case 'Escape':
      if (cheatSheetOpen.value) {
        cheatSheetOpen.value = false
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (search.query.value) {
        search.query.value = ''
        event.preventDefault()
        event.stopPropagation()
      }
      break
    default:
      if (event.key === '?') {
        cheatSheetOpen.value = !cheatSheetOpen.value
        event.preventDefault()
      } else if (/^[1-9]$/.test(event.key) && chipCategories.value.length) {
        const target = chipCategories.value[Number(event.key) - 1]
        if (target) {
          search.setCategory(target.key)
          event.preventDefault()
        }
      }
  }
}

// ── Siklus buka/tutup ────────────────────────────────────────────────────────
function focusInput() {
  nextTick(() => inputEl.value?.focus())
}

watch(open, (isOpen) => {
  if (isOpen) {
    history.ensureLoaded()
    focusInput()
  } else {
    cheatSheetOpen.value = false
    search.reset()
    search.query.value = ''
  }
})

onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      open.value = true
    }
  }
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
})
</script>

<template>
  <UModal
    v-model:open="open"
    :fullscreen="isMobile"
    unmount-on-hide
    :ui="{
      content: isMobile ? '' : 'sm:max-w-3xl w-full',
      overlay: 'backdrop-blur-sm'
    }"
  >
    <template #content>
      <div
        class="flex flex-col overflow-hidden bg-default"
        :class="isMobile ? 'h-full' : 'max-h-[85vh] rounded-lg ring ring-default'"
      >
        <!-- ── Header: input + cheat-sheet ── -->
        <div class="flex items-center gap-2 border-b border-default px-3 py-3">
          <UIcon name="i-lucide-search" class="size-5 shrink-0 text-muted" />
          <input
            ref="inputEl"
            v-model="search.query.value"
            type="text"
            class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            placeholder="Cari karyawan, kontrak, dokumen, atau perintah…"
            autocomplete="off"
            spellcheck="false"
            aria-label="Cari"
            @keydown="onInputKeydown"
          >
          <UIcon v-if="search.loading.value" name="i-lucide-loader-circle" class="size-4 shrink-0 animate-spin text-muted" />
          <UButton
            v-if="search.query.value"
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            aria-label="Bersihkan pencarian"
            @click="search.query.value = ''"
          />
          <UTooltip text="Pintasan keyboard">
            <UButton
              icon="i-lucide-keyboard"
              size="xs"
              variant="ghost"
              color="neutral"
              aria-label="Pintasan keyboard"
              @click="cheatSheetOpen = !cheatSheetOpen"
            />
          </UTooltip>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            aria-label="Tutup pencarian"
            @click="open = false"
          />
        </div>

        <!-- ── Chips kategori (saat ada hasil) ── -->
        <div v-if="search.hasQuery.value && chipCategories.length" class="flex flex-wrap items-center gap-1.5 border-b border-default px-3 py-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition"
            :class="search.activeCategory.value === 'all' ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated'"
            @click="search.setCategory('all')"
          >
            Semua
            <span class="rounded-full bg-default px-1.5 text-[10px] tabular-nums">{{ search.totalResults.value }}</span>
          </button>
          <button
            v-for="(cat, i) in chipCategories"
            :key="cat.key"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition"
            :class="search.activeCategory.value === cat.key ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated'"
            @click="search.setCategory(cat.key)"
          >
            <span v-if="i < 9" class="text-[10px] text-dimmed">{{ i + 1 }}</span>
            {{ cat.label }}
            <span class="rounded-full bg-default px-1.5 text-[10px] tabular-nums">{{ cat.count }}</span>
          </button>
        </div>

        <!-- ── Isi: daftar + pratinjau ── -->
        <div class="flex min-h-0 flex-1">
          <div ref="listEl" class="min-w-0 flex-1 overflow-y-auto p-2">
            <!-- Error -->
            <div v-if="search.error.value" class="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <UIcon name="i-lucide-cloud-off" class="size-7 text-error" />
              <p class="text-sm text-error">
                {{ search.error.value }}
              </p>
              <UButton
                size="xs"
                variant="soft"
                label="Coba lagi"
                icon="i-lucide-refresh-cw"
                @click="search.fetchResults"
              />
            </div>

            <!-- Skeleton -->
            <div v-else-if="search.loading.value && !flatEntries.length" class="space-y-1 p-1">
              <div v-for="n in 6" :key="n" class="flex items-center gap-3 rounded-md px-3 py-2.5">
                <div class="size-8 shrink-0 animate-pulse rounded-md bg-elevated" />
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="h-3 w-2/5 animate-pulse rounded bg-elevated" />
                  <div class="h-2.5 w-1/3 animate-pulse rounded bg-elevated" />
                </div>
              </div>
            </div>

            <!-- Hasil -->
            <template v-else-if="flatEntries.length">
              <div v-for="section in sections" :key="section.key" class="mb-1">
                <div class="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-dimmed">
                  <UIcon v-if="section.icon" :name="section.icon" class="size-3.5" />
                  {{ section.label }}
                </div>
                <button
                  v-for="entry in section.entries"
                  :key="entry.id"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition"
                  :class="flatEntries.indexOf(entry) === search.activeIndex.value ? 'bg-elevated' : 'hover:bg-elevated/60'"
                  :data-active-entry="flatEntries.indexOf(entry) === search.activeIndex.value ? 'true' : 'false'"
                  @mouseenter="search.activeIndex.value = flatEntries.indexOf(entry)"
                  @click="runEntry(entry)"
                >
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated text-muted">
                    <UIcon :name="entry.icon" class="size-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-highlighted">
                      <template v-for="(part, pi) in highlightParts(entry.title, search.query.value)" :key="pi">
                        <mark v-if="part.match" class="rounded bg-primary/20 px-0.5 text-inherit">{{ part.text }}</mark>
                        <template v-else>{{ part.text }}</template>
                      </template>
                    </span>
                    <span v-if="entry.subtitle || entry.meta?.length" class="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <span v-if="entry.subtitle" class="truncate">{{ entry.subtitle }}</span>
                      <template v-if="entry.meta?.length">
                        <span v-if="entry.subtitle" class="text-dimmed">·</span>
                        <span class="truncate">{{ entry.meta.join(' · ') }}</span>
                      </template>
                    </span>
                  </span>

                  <!-- Aksi cepat per hasil -->
                  <span v-if="entry.hit" class="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <UTooltip text="Buka di tab baru">
                      <UButton
                        icon="i-lucide-external-link"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        aria-label="Buka di tab baru"
                        @click.stop="runEntry(entry, true)"
                      />
                    </UTooltip>
                    <UTooltip v-if="searchHitCopyValue(entry.hit)" text="Salin nomor">
                      <UButton
                        icon="i-lucide-copy"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        aria-label="Salin nomor"
                        @click.stop="copyValue(searchHitCopyValue(entry.hit))"
                      />
                    </UTooltip>
                    <UTooltip :text="history.isPinned(entry.hit) ? 'Lepas sematan' : 'Sematkan'">
                      <UButton
                        :icon="history.isPinned(entry.hit) ? 'i-lucide-star' : 'i-lucide-star-off'"
                        size="xs"
                        variant="ghost"
                        :color="history.isPinned(entry.hit) ? 'warning' : 'neutral'"
                        aria-label="Sematkan"
                        @click.stop="history.togglePin(entry.hit!)"
                      />
                    </UTooltip>
                  </span>
                  <UIcon
                    v-else
                    name="i-lucide-corner-down-left"
                    class="size-3.5 shrink-0 text-dimmed opacity-0 transition group-hover:opacity-100"
                  />
                </button>
                <button
                  v-if="section.hasMore && search.canLoadMore.value"
                  type="button"
                  class="mt-1 w-full rounded-md px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/5"
                  @click="search.loadMore"
                >
                  Muat lebih banyak {{ section.label }} ({{ SEARCH_LIMIT_STEPS.join(' → ') }})
                </button>
              </div>
            </template>

            <!-- Kosong: ada query tapi tidak ada hasil -->
            <div v-else-if="search.hasQuery.value" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <UIcon name="i-lucide-search-x" class="size-8 text-muted" />
              <p class="text-sm font-medium">
                Tidak ada hasil untuk “{{ search.query.value }}”
              </p>
              <p class="max-w-xs text-xs text-muted">
                Coba kata kunci lain, atau periksa ejaan. Pencarian mencakup nama, NIK, nomor kontrak, dan nomor dokumen.
              </p>
            </div>

            <!-- Kosong total (tanpa riwayat & tanpa query) -->
            <div v-else-if="!flatEntries.length" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <UIcon name="i-lucide-search" class="size-8 text-muted" />
              <p class="text-sm font-medium">
                Mulai mengetik untuk mencari
              </p>
              <p class="max-w-xs text-xs text-muted">
                Karyawan, kontrak, surat peringatan, sertifikasi, dan dokumen legal — atau lompat ke menu.
              </p>
            </div>
          </div>

          <!-- Pratinjau (desktop): ringkasan entitas terpilih -->
          <aside v-if="!isMobile && previewHit" class="hidden w-72 shrink-0 overflow-y-auto border-l border-default p-4 lg:block">
            <div class="flex items-start gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="searchHitIcon(previewHit)" class="size-5" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-highlighted">
                  {{ previewHit.title }}
                </p>
                <p v-if="previewHit.subtitle" class="text-xs text-muted">
                  {{ previewHit.subtitle }}
                </p>
              </div>
            </div>
            <dl v-if="previewHit.meta?.length || previewHit.code || previewHit.email || previewHit.phone" class="mt-4 space-y-2 text-xs">
              <div v-for="(m, mi) in previewHit.meta" :key="mi" class="flex justify-between gap-3">
                <dt class="text-muted">
                  Info
                </dt>
                <dd class="text-right text-default">
                  {{ m }}
                </dd>
              </div>
              <div v-if="previewHit.code" class="flex justify-between gap-3">
                <dt class="text-muted">
                  Nomor
                </dt>
                <dd class="text-right font-medium tabular-nums text-default">
                  {{ previewHit.code }}
                </dd>
              </div>
              <div v-if="previewHit.email" class="flex justify-between gap-3">
                <dt class="text-muted">
                  Email
                </dt>
                <dd class="truncate text-right text-default">
                  {{ previewHit.email }}
                </dd>
              </div>
              <div v-if="previewHit.phone" class="flex justify-between gap-3">
                <dt class="text-muted">
                  Telepon
                </dt>
                <dd class="text-right text-default">
                  {{ previewHit.phone }}
                </dd>
              </div>
            </dl>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <UButton
                size="xs"
                label="Buka"
                icon="i-lucide-arrow-right"
                @click="runEntry(activeEntry)"
              />
              <UButton
                size="xs"
                variant="soft"
                color="neutral"
                label="Salin nomor"
                icon="i-lucide-copy"
                :disabled="!searchHitCopyValue(previewHit)"
                @click="copyValue(searchHitCopyValue(previewHit))"
              />
              <UButton
                v-if="previewHit.type === 'employee'"
                size="xs"
                variant="soft"
                color="neutral"
                label="Kontrak"
                icon="i-lucide-file-text"
                @click="relatedContract(previewHit)"
              />
              <UButton
                v-if="previewHit.email"
                size="xs"
                variant="soft"
                color="neutral"
                icon="i-lucide-mail"
                aria-label="Email"
                @click="contactEmployee(previewHit, 'email')"
              />
              <UButton
                v-if="previewHit.phone"
                size="xs"
                variant="soft"
                color="neutral"
                icon="i-lucide-message-circle"
                aria-label="WhatsApp"
                @click="contactEmployee(previewHit, 'wa')"
              />
            </div>
          </aside>
        </div>

        <!-- ── Footer: pintasan + panel bantuan ── -->
        <div class="border-t border-default px-3 py-2">
          <div v-if="cheatSheetOpen" class="grid gap-1.5 pb-2 text-xs sm:grid-cols-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Navigasi hasil</span><span class="flex gap-1"><UKbd value="arrowup" /><UKbd value="arrowdown" /></span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Buka</span><UKbd value="enter" />
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Buka di tab baru</span><span class="flex gap-1"><UKbd value="ctrl" /><UKbd value="enter" /></span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Pindah kategori</span><span class="flex gap-1"><UKbd value="tab" /><UKbd value="shift" /><UKbd value="tab" /></span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Lompat ke kategori 1-9</span><span class="text-muted">1…9</span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Tutup / bersihkan</span><UKbd value="escape" />
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Buka pencarian</span><span class="flex gap-1"><UKbd value="ctrl" /><UKbd>K</UKbd></span>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-muted">Panel bantuan</span><UKbd>?</UKbd>
            </div>
          </div>
          <div class="flex items-center justify-between gap-2 text-xs text-muted">
            <span class="truncate">
              <template v-if="search.hasQuery.value">{{ search.totalResults.value }} hasil · “{{ search.query.value }}”</template>
              <template v-else>Ketik untuk mencari, atau pilih menu di atas</template>
            </span>
            <button type="button" class="shrink-0 font-medium text-primary hover:underline" @click="cheatSheetOpen = !cheatSheetOpen">
              {{ cheatSheetOpen ? 'Sembunyikan pintasan' : 'Pintasan keyboard (?)' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
