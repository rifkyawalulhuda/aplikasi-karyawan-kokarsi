<script setup lang="ts">
import {
  NOTIFICATION_CATEGORY_ORDER,
  NOTIFICATION_TIME_GROUPS,
  notificationCategoryMeta,
  notificationTimeGroup
} from '~/utils/notification-meta'
import type { AppNotification } from '~/composables/useNotifications'

const props = defineProps<{
  collapsed?: boolean
}>()

const {
  unreadCount,
  summary,
  fetchSummary,
  markAllRead,
  markMany,
  dismissMany,
  deleteAll
} = useNotifications()

const feed = useNotificationFeed({ limit: 15 })
const {
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isEmpty,
  filters,
  loadMore,
  markRead,
  markUnread,
  togglePin,
  dismiss,
  open: openNotification,
  resetFilters
} = feed

const toast = useToast()
const { confirmActionToast } = useConfirmActionToast()

const open = ref(false)
const prefsOpen = ref(false)
const selectMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())
const activeIndex = ref(-1)

// ── Tab & chip kategori ───────────────────────────────────────────────────────
type TabKey = 'all' | 'unread' | 'critical'
const activeTab = ref<TabKey>('all')

const TABS: { key: TabKey, label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'unread', label: 'Belum dibaca' },
  { key: 'critical', label: 'Kritis' }
]

const categoryChips = computed(() => {
  const byCategory = summary.value.byCategory ?? {}
  const unreadByCategory = summary.value.unreadByCategory ?? {}
  return NOTIFICATION_CATEGORY_ORDER
    .map(key => ({
      key,
      ...notificationCategoryMeta(key),
      count: byCategory[key] ?? 0,
      unread: unreadByCategory[key] ?? 0
    }))
    .filter(chip => chip.count > 0)
})

function applyTab(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'all') {
    filters.unread = false
    filters.severity = null
  } else if (tab === 'unread') {
    filters.unread = true
    filters.severity = null
  } else {
    filters.unread = false
    filters.severity = 'CRITICAL'
  }
}

function toggleCategory(key: string) {
  filters.category = filters.category === key ? null : key
}

// ── Grup waktu + sematan ──────────────────────────────────────────────────────
interface Group {
  key: string
  label: string
  items: AppNotification[]
}

const groups = computed<Group[]>(() => {
  const pinned = items.value.filter(n => n.pinnedAt)
  const rest = items.value.filter(n => !n.pinnedAt)

  const result: Group[] = []
  if (pinned.length > 0) {
    result.push({ key: 'pinned', label: 'Disematkan', items: pinned })
  }
  for (const label of NOTIFICATION_TIME_GROUPS) {
    const bucket = rest.filter(n => notificationTimeGroup(n.createdAt) === label)
    if (bucket.length > 0) {
      result.push({ key: label, label, items: bucket })
    }
  }
  return result
})

const flatItems = computed(() => groups.value.flatMap(g => g.items))

// ── Badge & pulse ─────────────────────────────────────────────────────────────
const hasNewNotification = ref(false)
watch(unreadCount, (newVal, oldVal) => {
  if (newVal > oldVal) {
    hasNewNotification.value = true
    setTimeout(() => {
      hasNewNotification.value = false
    }, 2000)
  }
})

const badgeColor = computed(() => {
  const critical = summary.value.unreadBySeverity?.CRITICAL ?? 0
  return critical > 0 ? 'error' : 'warning'
})

const tooltipText = computed(() =>
  unreadCount.value > 0 ? `Notifikasi (${unreadCount.value})` : 'Notifikasi'
)

// ── Aksi item ─────────────────────────────────────────────────────────────────
async function handleOpen(item: AppNotification) {
  open.value = false
  await openNotification(item)
}

function handleDismiss(item: AppNotification) {
  dismiss(item).then((undo) => {
    if (!undo) return
    toast.add({
      title: 'Notifikasi disingkirkan',
      description: item.title,
      icon: 'i-lucide-bell-off',
      duration: 5000,
      actions: [{ label: 'Urungkan', onClick: () => undo() }]
    })
  })
}

async function handleMarkAllRead() {
  await markAllRead()
  toast.add({
    title: 'Semua notifikasi ditandai dibaca',
    icon: 'i-lucide-check-check',
    duration: 3000
  })
}

function handleDeleteAll() {
  confirmActionToast({
    title: 'Hapus Semua Notifikasi',
    description: 'Semua notifikasi aktif akan disingkirkan. Anda dapat mengurungkannya.',
    icon: 'i-lucide-trash-2',
    color: 'error',
    confirmLabel: 'Hapus Semua',
    confirmColor: 'error',
    onConfirm: async () => {
      await deleteAll()
      resetFilters()
      toast.add({
        title: 'Semua notifikasi dihapus',
        icon: 'i-lucide-trash-2',
        duration: 3000
      })
    }
  })
}

// ── Mode pilih (bulk) ─────────────────────────────────────────────────────────
function enterSelectMode() {
  selectMode.value = true
  selectedIds.value = new Set()
}

function exitSelectMode() {
  selectMode.value = false
  selectedIds.value = new Set()
}

function toggleSelected(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function isGroupFullySelected(group: Group) {
  return group.items.length > 0 && group.items.every(n => selectedIds.value.has(n.id))
}

function toggleGroup(group: Group) {
  const next = new Set(selectedIds.value)
  const all = isGroupFullySelected(group)
  for (const item of group.items) {
    if (all) next.delete(item.id)
    else next.add(item.id)
  }
  selectedIds.value = next
}

const selectedCount = computed(() => selectedIds.value.size)

async function bulkMarkRead() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  await markMany(ids, true)
  exitSelectMode()
  toast.add({ title: `${ids.length} notifikasi ditandai dibaca`, icon: 'i-lucide-check', duration: 3000 })
}

async function bulkDismiss() {
  const ids = [...selectedIds.value]
  if (ids.length === 0) return
  await dismissMany(ids)
  exitSelectMode()
  toast.add({ title: `${ids.length} notifikasi disingkirkan`, icon: 'i-lucide-bell-off', duration: 3000 })
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
const listEl = ref<HTMLElement | null>(null)

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listEl.value?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, flatItems.value.length - 1)
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    scrollActiveIntoView()
  } else if (event.key === 'Enter' && activeIndex.value >= 0) {
    const item = flatItems.value[activeIndex.value]
    if (item) {
      event.preventDefault()
      handleOpen(item)
    }
  }
}

watch([() => filters.category, activeTab], () => {
  activeIndex.value = -1
})

// ── Preferensi: minta izin notifikasi OS saat diaktifkan ──────────────────────
function openPreferences() {
  prefsOpen.value = true
}

async function requestOsPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

// Sinkronkan ringkasan saat panel dibuka
watch(open, (value) => {
  if (value) {
    fetchSummary()
    activeIndex.value = -1
  } else {
    exitSelectMode()
  }
})

onMounted(() => {
  requestOsPermission()
})
</script>

<template>
  <div>
    <!-- Trigger: rail (collapsed) -->
    <UTooltip v-if="props.collapsed" :text="tooltipText" :content="{ side: 'right' }">
      <div class="relative">
        <UButton
          icon="i-lucide-bell"
          color="neutral"
          variant="ghost"
          square
          :aria-label="`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`"
          :class="{ 'animate-bounce': hasNewNotification }"
          @click="open = true"
        />
        <span
          v-if="unreadCount > 0"
          class="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 pointer-events-none z-10"
          :class="badgeColor === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </div>
    </UTooltip>

    <!-- Trigger: sidebar (expanded) -->
    <div v-else class="relative">
      <UButton
        icon="i-lucide-bell"
        color="neutral"
        variant="ghost"
        square
        :aria-label="`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`"
        :class="{ 'animate-bounce': hasNewNotification }"
        @click="open = true"
      />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 pointer-events-none z-10"
        :class="badgeColor === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </div>

    <!-- Panel -->
    <USlideover
      v-model:open="open"
      side="right"
      :unmount-on-hide="true"
      :ui="{ content: 'w-full sm:max-w-[400px]', body: 'p-0 flex-1 overflow-y-auto' }"
    >
      <template #header>
        <div class="flex w-full items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <UIcon name="i-lucide-bell" class="size-4 text-muted" />
            <h2 class="text-sm font-semibold text-highlighted">
              Notifikasi
            </h2>
            <UBadge
              v-if="unreadCount > 0"
              :color="badgeColor"
              variant="subtle"
              size="sm"
            >
              {{ unreadCount }}
            </UBadge>
          </div>

          <div class="flex items-center gap-0.5">
            <template v-if="!selectMode">
              <UTooltip text="Tandai semua dibaca">
                <UButton
                  icon="i-lucide-check-check"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="unreadCount === 0"
                  aria-label="Tandai semua dibaca"
                  @click="handleMarkAllRead"
                />
              </UTooltip>
              <UTooltip text="Pilih beberapa">
                <UButton
                  icon="i-lucide-list-checks"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="items.length === 0"
                  aria-label="Mode pilih"
                  @click="enterSelectMode"
                />
              </UTooltip>
              <UTooltip text="Preferensi notifikasi">
                <UButton
                  icon="i-lucide-settings-2"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Preferensi notifikasi"
                  @click="openPreferences"
                />
              </UTooltip>
              <UDropdownMenu
                :items="[
                  [{ label: 'Lihat semua notifikasi', icon: 'i-lucide-external-link', to: '/notifications' }],
                  [{ label: 'Hapus semua', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: handleDeleteAll }]
                ]"
              >
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Menu lain"
                />
              </UDropdownMenu>
            </template>
            <UButton
              v-else
              label="Batal"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="exitSelectMode"
            />
          </div>
        </div>
      </template>

      <template #body>
        <div class="flex h-full flex-col" @keydown="onKeydown">
          <!-- Tabs -->
          <div class="flex items-center gap-1 border-b border-default px-3 pt-2">
            <button
              v-for="tab in TABS"
              :key="tab.key"
              type="button"
              class="relative px-2.5 py-2 text-xs font-medium transition-colors"
              :class="activeTab === tab.key ? 'text-primary' : 'text-muted hover:text-default'"
              @click="applyTab(tab.key)"
            >
              {{ tab.label }}
              <span
                v-if="activeTab === tab.key"
                class="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
              />
            </button>
          </div>

          <!-- Pencarian + chip kategori -->
          <div class="space-y-2 border-b border-default px-3 py-2.5">
            <UInput
              v-model="filters.q"
              icon="i-lucide-search"
              placeholder="Cari notifikasi…"
              size="sm"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
            >
              <template v-if="filters.q" #trailing>
                <UButton
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Bersihkan pencarian"
                  @click="filters.q = ''"
                />
              </template>
            </UInput>

            <div v-if="categoryChips.length > 0" class="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
              <UButton
                v-for="chip in categoryChips"
                :key="chip.key"
                size="xs"
                :color="filters.category === chip.key ? chip.color : 'neutral'"
                :variant="filters.category === chip.key ? 'solid' : 'subtle'"
                class="shrink-0"
                @click="toggleCategory(chip.key)"
              >
                <UIcon :name="chip.icon" class="size-3.5" />
                {{ chip.short }}
                <span class="opacity-70">{{ chip.count }}</span>
              </UButton>
            </div>
          </div>

          <!-- Daftar -->
          <div ref="listEl" class="flex-1 overflow-y-auto">
            <!-- Loading skeleton -->
            <div v-if="isLoading" class="space-y-1 p-3">
              <div v-for="n in 5" :key="n" class="flex items-start gap-3 rounded-lg p-3">
                <USkeleton class="size-8 shrink-0 rounded-full" />
                <div class="flex-1 space-y-2">
                  <USkeleton class="h-3 w-2/5 rounded" />
                  <USkeleton class="h-3 w-4/5 rounded" />
                  <USkeleton class="h-2.5 w-1/4 rounded" />
                </div>
              </div>
            </div>

            <!-- Error -->
            <div v-else-if="error" class="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <UIcon name="i-lucide-cloud-off" class="size-8 text-muted opacity-60" />
              <p class="text-sm text-muted">
                {{ error }}
              </p>
              <UButton
                label="Coba lagi"
                icon="i-lucide-refresh-cw"
                size="xs"
                color="neutral"
                variant="subtle"
                @click="feed.fetchFirstPage()"
              />
            </div>

            <!-- Kosong -->
            <div v-else-if="isEmpty" class="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <UIcon name="i-lucide-bell-off" class="size-9 text-muted opacity-40" />
              <p class="text-sm font-medium text-default">
                {{ feed.hasActiveFilters.value ? 'Tidak ada hasil' : 'Tidak ada notifikasi aktif' }}
              </p>
              <p class="max-w-[16rem] text-xs text-muted">
                {{ feed.hasActiveFilters.value ? 'Coba ubah filter atau kata kunci pencarian.' : 'Anda akan diberi tahu saat ada dokumen yang mendekati kedaluwarsa.' }}
              </p>
              <UButton
                v-if="feed.hasActiveFilters.value"
                label="Reset filter"
                size="xs"
                color="neutral"
                variant="subtle"
                @click="resetFilters()"
              />
            </div>

            <!-- Grup -->
            <div v-else class="pb-2">
              <div v-for="group in groups" :key="group.key">
                <div class="sticky top-0 z-10 flex items-center justify-between bg-default/95 px-3 py-1.5 backdrop-blur">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {{ group.label }}
                  </span>
                  <UButton
                    v-if="selectMode"
                    size="xs"
                    color="neutral"
                    variant="link"
                    :label="isGroupFullySelected(group) ? 'Batal pilih' : 'Pilih semua'"
                    @click="toggleGroup(group)"
                  />
                </div>

                <ul class="divide-y divide-default">
                  <li
                    v-for="item in group.items"
                    :key="item.id"
                    :data-active="flatItems[activeIndex]?.id === item.id"
                  >
                    <NotificationItem
                      :item="item"
                      :select-mode="selectMode"
                      :selected="selectedIds.has(item.id)"
                      :active="flatItems[activeIndex]?.id === item.id"
                      @open="handleOpen"
                      @toggle-select="toggleSelected(item.id)"
                      @mark-read="markRead"
                      @mark-unread="markUnread"
                      @pin="togglePin"
                      @dismiss="handleDismiss"
                    />
                  </li>
                </ul>
              </div>

              <!-- Muat lebih banyak -->
              <div v-if="hasMore" class="px-3 pt-2">
                <UButton
                  label="Muat lebih banyak"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  block
                  :loading="isLoadingMore"
                  @click="loadMore"
                />
              </div>
            </div>
          </div>

          <!-- Bar aksi bulk -->
          <div
            v-if="selectMode"
            class="flex items-center justify-between gap-2 border-t border-default bg-elevated/60 px-3 py-2"
          >
            <span class="text-xs text-muted">
              {{ selectedCount }} dipilih
            </span>
            <div class="flex items-center gap-1.5">
              <UButton
                label="Tandai dibaca"
                icon="i-lucide-check"
                size="xs"
                color="neutral"
                variant="subtle"
                :disabled="selectedCount === 0"
                @click="bulkMarkRead"
              />
              <UButton
                label="Singkirkan"
                icon="i-lucide-bell-off"
                size="xs"
                color="error"
                variant="subtle"
                :disabled="selectedCount === 0"
                @click="bulkDismiss"
              />
            </div>
          </div>

          <!-- Footer -->
          <div v-else class="border-t border-default px-3 py-2">
            <UButton
              to="/notifications"
              size="xs"
              variant="ghost"
              color="primary"
              label="Lihat semua notifikasi"
              trailing-icon="i-lucide-arrow-right"
              class="w-full justify-center"
              @click="open = false"
            />
          </div>
        </div>
      </template>
    </USlideover>

    <NotificationPreferencesDialog v-model:open="prefsOpen" />
  </div>
</template>
