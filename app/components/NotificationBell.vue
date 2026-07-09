<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()

const {
  notifications,
  unreadCount,
  isLoading,
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markOneRead,
} = useNotifications()

onMounted(() => {
  fetchNotifications()
  fetchUnreadCount()
})

const badgeColor = computed(() => {
  const unread = notifications.value.filter(n => !n.isRead && !n.resolvedAt)
  if (unread.some(n => n.severity === 'CRITICAL')) return 'error'
  if (unread.some(n => n.severity === 'WARNING')) return 'warning'
  return null
})

const categoryIconMap: Record<string, string> = {
  KONTRAK_KARYAWAN: 'i-lucide-file-text',
  SERTIFIKASI_IJIN: 'i-lucide-file-badge',
  KONTRAK_VENDOR: 'i-lucide-building-2',
  LEGAL_KOPERASI: 'i-lucide-file-signature',
}

function getCategoryIcon(category: string) {
  return categoryIconMap[category] ?? 'i-lucide-bell'
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

const router = useRouter()
async function handleNotifClick(notif: any) {
  await markOneRead(notif.id)
  await router.push(notif.deeplink)
}
</script>

<template>
  <UPopover :content="{ side: 'right', sideOffset: 8 }">
    <!-- Trigger: UButton langsung sebagai child pertama agar UPopover menjadikannya trigger -->
    <UButton
      icon="i-lucide-bell"
      color="neutral"
      variant="ghost"
      square
      :aria-label="`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`"
      class="relative"
    >
      <template v-if="unreadCount > 0" #trailing>
        <span
          class="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 pointer-events-none"
          :class="badgeColor === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </template>
    </UButton>

    <!-- Dropdown panel -->
    <template #content>
      <div class="w-80">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-default">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm text-default">Notifikasi</span>
            <span
              v-if="unreadCount > 0"
              class="text-[10px] font-bold rounded-full px-1.5 py-0.5"
              :class="badgeColor === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300'"
            >
              {{ unreadCount }}
            </span>
          </div>
          <UButton
            v-if="unreadCount > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            label="Tandai dibaca"
            @click="markAllRead"
          />
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin text-muted text-xl" />
        </div>

        <!-- Empty state -->
        <div v-else-if="notifications.filter(n => !n.resolvedAt).length === 0" class="flex flex-col items-center justify-center py-8 px-4 text-center">
          <UIcon name="i-lucide-bell-off" class="text-muted text-2xl mb-2" />
          <p class="text-sm text-muted">Tidak ada notifikasi aktif</p>
        </div>

        <!-- Notification list -->
        <div v-else class="max-h-80 overflow-y-auto divide-y divide-default">
          <button
            v-for="notif in notifications.filter(n => !n.resolvedAt).slice(0, 10)"
            :key="notif.id"
            type="button"
            class="w-full text-left px-4 py-3 hover:bg-elevated/50 transition-colors flex items-start gap-3 min-h-11"
            :class="{ 'bg-primary/5': !notif.isRead }"
            @click="handleNotifClick(notif)"
          >
            <!-- Unread dot -->
            <div class="mt-1.5 flex-shrink-0 w-2">
              <div v-if="!notif.isRead" class="w-2 h-2 rounded-full bg-primary" />
            </div>
            <!-- Icon -->
            <UIcon
              :name="getCategoryIcon(notif.category)"
              class="mt-0.5 flex-shrink-0"
              :class="notif.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'"
            />
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium truncate" :class="notif.isRead ? 'text-muted' : 'text-default'">
                {{ notif.title }}
              </p>
              <p class="text-xs text-muted mt-0.5 line-clamp-2">{{ notif.message }}</p>
              <p class="text-[10px] text-muted mt-1">{{ relativeTime(notif.createdAt) }}</p>
            </div>
          </button>
        </div>

        <!-- Footer -->
        <div class="border-t border-default px-4 py-2">
          <UButton
            to="/notifications"
            size="xs"
            variant="ghost"
            color="primary"
            label="Lihat Semua Notifikasi"
            trailing-icon="i-lucide-arrow-right"
            class="w-full justify-center"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
