<script setup lang="ts">
import type { DashboardStats } from '~/types/dashboard'

const { data: stats, pending: statsLoading, error: statsError, refresh } = await useFetch<DashboardStats>('/api/dashboard-stats', { lazy: true })

const refreshing = ref(false)
const lastUpdated = ref<Date | null>(null)

watch(stats, (value) => {
  if (value) lastUpdated.value = new Date()
})

async function handleRefresh() {
  refreshing.value = true
  try {
    await refresh()
    lastUpdated.value = new Date()
  } finally {
    refreshing.value = false
  }
}

// Refresh dari command palette (Cmd+K → Aksi Dashboard → Muat ulang)
const refreshBus = useEventBus('dashboard:refresh')
onMounted(() => refreshBus.on(handleRefresh))
onUnmounted(() => refreshBus.off(handleRefresh))

// Auto-refresh ringan: tiap 5 menit, hanya saat tab terlihat.
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (visibility.value === 'visible') handleRefresh()
}, 5 * 60 * 1000)

// Agenda hari ini (WIB)
const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const { data: todayAgenda } = await useFetch<{ id: number }[]>('/api/calendar', {
  query: { start: todayStr, end: todayStr },
  lazy: true,
  credentials: 'include'
})
const todayAgendaCount = computed(() => todayAgenda.value?.length ?? 0)
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-5 p-4 sm:p-6">
        <UAlert
          v-if="statsError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Gagal memuat data dashboard"
          description="Pastikan server backend berjalan, lalu klik Muat ulang."
        />

        <DashboardHero
          :loading="statsLoading"
          :refreshing="refreshing"
          :last-updated="lastUpdated"
          :agenda-count="todayAgendaCount"
          @refresh="handleRefresh"
        />

        <DashboardGrid :stats="stats" :loading="statsLoading" />
      </div>
    </template>
  </UDashboardPanel>
</template>
