<script setup lang="ts">
import {
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_CATEGORY_ORDER,
  NOTIFICATION_TIME_GROUPS,
  notificationTimeGroup
} from '~/utils/notification-meta'
import type { AppNotification } from '~/composables/useNotifications'

definePageMeta({ layout: 'default' })

const {
  unreadCount,
  summary,
  markAllRead,
  markMany,
  dismissMany,
  deleteAll
} = useNotifications()

const feed = useNotificationFeed({ limit: 20 })
const {
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isEmpty,
  hasActiveFilters,
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

const prefsOpen = ref(false)
const selectMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())

const categoryOptions = computed(() => [
  { label: 'Semua Kategori', value: null as string | null },
  ...NOTIFICATION_CATEGORY_ORDER.map(key => ({
    label: NOTIFICATION_CATEGORY_META[key].label,
    value: key as string | null
  }))
])

const severityOptions = [
  { label: 'Semua Tingkat', value: null as string | null },
  { label: 'Peringatan', value: 'WARNING' as string | null },
  { label: 'Kritis', value: 'CRITICAL' as string | null }
]

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
  if (pinned.length > 0) result.push({ key: 'pinned', label: 'Disematkan', items: pinned })
  for (const label of NOTIFICATION_TIME_GROUPS) {
    const bucket = rest.filter(n => notificationTimeGroup(n.createdAt) === label)
    if (bucket.length > 0) result.push({ key: label, label, items: bucket })
  }
  return result
})

// ── Aksi ──────────────────────────────────────────────────────────────────────
async function handleOpen(item: AppNotification) {
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

const isMarkingAll = ref(false)
async function handleMarkAllRead() {
  isMarkingAll.value = true
  try {
    await markAllRead()
    toast.add({ title: 'Semua notifikasi ditandai dibaca', icon: 'i-lucide-check-check', duration: 3000 })
  } finally {
    isMarkingAll.value = false
  }
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
      toast.add({ title: 'Semua notifikasi dihapus', icon: 'i-lucide-trash-2', duration: 3000 })
    }
  })
}

// ── Mode pilih ────────────────────────────────────────────────────────────────
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

// ── Ringkasan ─────────────────────────────────────────────────────────────────
const stats = computed(() => [
  { label: 'Total Aktif', value: summary.value.total, color: 'neutral' as const, icon: 'i-lucide-inbox' },
  { label: 'Belum Dibaca', value: summary.value.unread, color: 'primary' as const, icon: 'i-lucide-mail' },
  { label: 'Kritis', value: summary.value.bySeverity?.CRITICAL ?? 0, color: 'error' as const, icon: 'i-lucide-circle-alert' },
  { label: 'Peringatan', value: summary.value.bySeverity?.WARNING ?? 0, color: 'warning' as const, icon: 'i-lucide-triangle-alert' }
])
</script>

<template>
  <UDashboardPanel id="notifications">
    <template #header>
      <UDashboardNavbar title="Notifikasi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-1.5">
            <UButton
              v-if="!selectMode"
              label="Pilih"
              icon="i-lucide-list-checks"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="items.length === 0"
              @click="enterSelectMode"
            />
            <UButton
              v-else
              label="Batal"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="exitSelectMode"
            />
            <UButton
              v-if="unreadCount > 0 && !selectMode"
              label="Tandai Semua Dibaca"
              icon="i-lucide-check-check"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="isMarkingAll"
              @click="handleMarkAllRead"
            />
            <UButton
              icon="i-lucide-settings-2"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Preferensi notifikasi"
              @click="prefsOpen = true"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Hapus semua notifikasi"
              :disabled="summary.total === 0"
              @click="handleDeleteAll"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Stats -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="flex items-center gap-3 rounded-xl border border-default bg-elevated/30 px-4 py-3"
          >
            <div
              class="flex size-9 items-center justify-center rounded-lg"
              :class="{
                'bg-neutral-500/10 text-neutral-500': stat.color === 'neutral',
                'bg-primary/10 text-primary': stat.color === 'primary',
                'bg-red-500/10 text-red-500': stat.color === 'error',
                'bg-amber-500/10 text-amber-500': stat.color === 'warning'
              }"
            >
              <UIcon :name="stat.icon" class="size-4" />
            </div>
            <div class="min-w-0">
              <p class="text-lg font-semibold leading-none text-highlighted">
                {{ stat.value }}
              </p>
              <p class="mt-1 truncate text-xs text-muted">
                {{ stat.label }}
              </p>
            </div>
          </div>
        </div>

        <!-- Filter -->
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="filters.q"
            icon="i-lucide-search"
            placeholder="Cari notifikasi…"
            size="sm"
            class="min-w-56 flex-1"
          />
          <USelect
            v-model="filters.category"
            :items="categoryOptions"
            placeholder="Kategori"
            size="sm"
            class="min-w-44"
          />
          <USelect
            v-model="filters.severity"
            :items="severityOptions"
            placeholder="Tingkat"
            size="sm"
            class="min-w-36"
          />
          <UButton
            :color="filters.unread ? 'primary' : 'neutral'"
            :variant="filters.unread ? 'solid' : 'outline'"
            icon="i-lucide-mail"
            size="sm"
            label="Belum dibaca"
            @click="filters.unread = !filters.unread"
          />
          <UButton
            v-if="hasActiveFilters"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            label="Reset"
            @click="resetFilters()"
          />
        </div>

        <!-- Daftar -->
        <div class="overflow-hidden rounded-xl border border-default">
          <!-- Loading skeleton -->
          <div v-if="isLoading" class="divide-y divide-default">
            <div v-for="n in 6" :key="n" class="flex items-start gap-3 p-4">
              <USkeleton class="size-8 shrink-0 rounded-full" />
              <div class="flex-1 space-y-2">
                <USkeleton class="h-3 w-1/4 rounded" />
                <USkeleton class="h-3 w-3/5 rounded" />
                <USkeleton class="h-2.5 w-1/5 rounded" />
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <UIcon name="i-lucide-cloud-off" class="size-10 text-muted opacity-60" />
            <p class="text-sm text-muted">
              {{ error }}
            </p>
            <UButton
              label="Coba lagi"
              icon="i-lucide-refresh-cw"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="feed.fetchFirstPage()"
            />
          </div>

          <!-- Kosong -->
          <div v-else-if="isEmpty" class="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <UIcon name="i-lucide-bell-off" class="size-10 text-muted opacity-40" />
            <p class="text-sm font-medium text-default">
              {{ hasActiveFilters ? 'Tidak ada notifikasi yang cocok' : 'Tidak ada notifikasi aktif' }}
            </p>
            <p class="max-w-sm text-xs text-muted">
              {{ hasActiveFilters ? 'Coba ubah filter atau kata kunci pencarian.' : 'Anda akan diberi tahu saat ada dokumen yang mendekati kedaluwarsa.' }}
            </p>
            <UButton
              v-if="hasActiveFilters"
              label="Reset filter"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="resetFilters()"
            />
          </div>

          <!-- Grup -->
          <div v-else>
            <div v-for="group in groups" :key="group.key">
              <div class="flex items-center justify-between border-b border-default bg-elevated/50 px-4 py-2">
                <span class="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {{ group.label }}
                </span>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-muted">{{ group.items.length }}</span>
                  <UButton
                    v-if="selectMode"
                    size="xs"
                    color="neutral"
                    variant="link"
                    :label="isGroupFullySelected(group) ? 'Batal pilih' : 'Pilih semua'"
                    @click="toggleGroup(group)"
                  />
                </div>
              </div>
              <ul class="divide-y divide-default">
                <li v-for="item in group.items" :key="item.id">
                  <NotificationItem
                    :item="item"
                    :select-mode="selectMode"
                    :selected="selectedIds.has(item.id)"
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

            <div v-if="hasMore" class="border-t border-default p-3">
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

        <p class="text-xs text-muted">
          Menampilkan {{ items.length }} notifikasi aktif{{ hasMore ? ' (masih ada lagi)' : '' }}
        </p>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Bar aksi bulk -->
  <div
    v-if="selectMode"
    class="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit items-center gap-3 rounded-full border border-default bg-default px-4 py-2 shadow-lg"
  >
    <span class="text-xs text-muted">{{ selectedCount }} dipilih</span>
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

  <NotificationPreferencesDialog v-model:open="prefsOpen" />
</template>
