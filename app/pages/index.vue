<script setup lang="ts">
interface DashboardStats {
  total: number
  aktif: number
  kontrakExpired: number
  resign: number
  phk: number
  expiringContracts: number
  byLocation: { name: string; count: number }[]
  byLevel: { name: string; count: number }[]
}

const auth = useAuthStore()
const { data: stats } = await useFetch<DashboardStats>('/api/dashboard-stats', { lazy: true })

const statCards = computed(() => [
  {
    title: 'Total Karyawan',
    icon: 'i-lucide-users',
    value: stats.value?.total ?? 0,
    description: 'Seluruh karyawan terdaftar',
    color: 'text-primary',
    bg: 'bg-primary/10',
    ring: 'ring-primary/20'
  },
  {
    title: 'Status Aktif',
    icon: 'i-lucide-user-check',
    value: stats.value?.aktif ?? 0,
    description: 'Karyawan dengan kontrak aktif',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    ring: 'ring-green-500/20'
  },
  {
    title: 'Kontrak Expired',
    icon: 'i-lucide-file-warning',
    value: stats.value?.kontrakExpired ?? 0,
    description: 'Karyawan tanpa kontrak aktif',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/20'
  },
  {
    title: 'Status Resign',
    icon: 'i-lucide-log-out',
    value: stats.value?.resign ?? 0,
    description: 'Keluar secara resign',
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    ring: 'ring-slate-500/20'
  },
  {
    title: 'Status PHK',
    icon: 'i-lucide-user-round-x',
    value: stats.value?.phk ?? 0,
    description: 'Keluar karena PHK',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    ring: 'ring-rose-500/20'
  },
  {
    title: 'Kontrak Akan Habis',
    icon: 'i-lucide-alarm-clock',
    value: stats.value?.expiringContracts ?? 0,
    description: 'Dalam 30 hari ke depan',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/20'
  }
])

// Donut chart untuk status karyawan
const donutData = computed(() => {
  const total = stats.value?.total ?? 0
  const r = 40
  const cx = 60
  const cy = 60
  const circ = 2 * Math.PI * r
  const segments = [
    { key: 'aktif', label: 'Aktif', count: stats.value?.aktif ?? 0, color: 'stroke-green-500', bg: 'bg-green-500' },
    { key: 'kontrakExpired', label: 'Kontrak Expired', count: stats.value?.kontrakExpired ?? 0, color: 'stroke-amber-500', bg: 'bg-amber-500' },
    { key: 'resign', label: 'Resign', count: stats.value?.resign ?? 0, color: 'stroke-slate-500', bg: 'bg-slate-500' },
    { key: 'phk', label: 'PHK', count: stats.value?.phk ?? 0, color: 'stroke-rose-500', bg: 'bg-rose-500' },
  ]

  let used = 0
  const mappedSegments = segments.map((segment) => {
    const length = total > 0 ? (segment.count / total) * circ : 0
    const offset = circ * 0.25 - used
    used += length
    const pct = total > 0 ? Math.round((segment.count / total) * 100) : 0
    return { ...segment, length, offset, pct }
  })

  return { r, cx, cy, circ, total, segments: mappedSegments }
})

// Progress bar colors
const locationColors = ['bg-primary', 'bg-blue-400', 'bg-cyan-500', 'bg-indigo-500']
const levelColors = ['bg-violet-500', 'bg-purple-400', 'bg-fuchsia-500', 'bg-pink-500']
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <span class="text-xs text-muted hidden sm:block">
            {{ new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
          </span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 sm:p-6 space-y-6">

        <!-- Stat Cards -->
        <div class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
          <UCard
            v-for="(card, i) in statCards"
            :key="i"
            class="cursor-default hover:ring-1 hover:ring-default transition-all duration-200"
            :ui="{ body: 'p-4 sm:p-5' }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-medium text-muted uppercase tracking-wide truncate">{{ card.title }}</p>
                <p class="text-2xl sm:text-3xl font-bold text-highlighted mt-1 tabular-nums">{{ card.value }}</p>
                <p class="text-xs text-muted mt-1 truncate">{{ card.description }}</p>
              </div>
              <div :class="['p-2.5 rounded-xl ring ring-inset shrink-0', card.bg, card.ring]">
                <UIcon :name="card.icon" :class="['size-5', card.color]" />
              </div>
            </div>
          </UCard>
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">

          <!-- Donut Chart: Status Karyawan -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-pie-chart" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Status Karyawan</span>
              </div>
            </template>

            <div class="flex flex-col items-center gap-4">
              <!-- SVG Donut -->
              <div class="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <!-- Background circle -->
                  <circle
                    :cx="donutData.cx"
                    :cy="donutData.cy"
                    :r="donutData.r"
                    fill="none"
                    class="stroke-accented"
                    stroke-width="16"
                  />
                  <circle
                    v-for="segment in donutData.segments"
                    v-show="segment.count > 0"
                    :key="segment.key"
                    :cx="donutData.cx"
                    :cy="donutData.cy"
                    :r="donutData.r"
                    fill="none"
                    :class="segment.color"
                    stroke-width="16"
                    stroke-linecap="round"
                    :stroke-dasharray="`${segment.length} ${donutData.circ}`"
                    :stroke-dashoffset="segment.offset"
                    style="transition: stroke-dasharray 0.6s ease"
                  />
                  <!-- Center text -->
                  <text x="60" y="56" text-anchor="middle" class="fill-highlighted" font-size="18" font-weight="700">
                    {{ donutData.total }}
                  </text>
                  <text x="60" y="71" text-anchor="middle" class="fill-muted" font-size="9">
                    Total
                  </text>
                </svg>
              </div>

              <!-- Legend -->
              <div class="w-full space-y-2">
                <div
                  v-for="segment in donutData.segments"
                  :key="segment.key"
                  class="flex items-center justify-between text-sm"
                >
                  <div class="flex items-center gap-2">
                    <span :class="['size-2.5 rounded-full shrink-0', segment.bg]" />
                    <span class="text-muted">{{ segment.label }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-highlighted tabular-nums">{{ segment.count }}</span>
                    <span class="text-xs text-muted tabular-nums">({{ segment.pct }}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Bar: Distribusi Lokasi Kerja -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-map-pin" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Lokasi Kerja</span>
              </div>
            </template>

            <div class="space-y-3.5">
              <template v-if="(stats?.byLocation?.length ?? 0) > 0">
                <div
                  v-for="(item, i) in stats?.byLocation"
                  :key="item.name"
                  class="space-y-1.5"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted truncate max-w-[70%]">{{ item.name }}</span>
                    <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700', locationColors[i % locationColors.length]]"
                      :style="{ width: `${(item.count / (stats?.total || 1)) * 100}%` }"
                    />
                  </div>
                </div>
              </template>
              <p v-else class="text-sm text-muted text-center py-4">Belum ada data</p>
            </div>
          </UCard>

          <!-- Bar: Distribusi Level Jabatan -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-bar-chart-2" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Level Jabatan</span>
              </div>
            </template>

            <div class="space-y-3.5">
              <template v-if="(stats?.byLevel?.length ?? 0) > 0">
                <div
                  v-for="(item, i) in stats?.byLevel"
                  :key="item.name"
                  class="space-y-1.5"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted truncate max-w-[70%]">{{ item.name }}</span>
                    <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700', levelColors[i % levelColors.length]]"
                      :style="{ width: `${(item.count / (stats?.total || 1)) * 100}%` }"
                    />
                  </div>
                </div>
              </template>
              <p v-else class="text-sm text-muted text-center py-4">Belum ada data</p>
            </div>
          </UCard>

        </div>

        <!-- Quick Actions -->
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <template #header>
            <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
              <UIcon name="i-lucide-zap" class="size-4 text-muted" />
              <span class="text-sm font-semibold text-highlighted">Akses Cepat</span>
            </div>
          </template>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <UButton
              to="/karyawan"
              color="neutral"
              variant="subtle"
              icon="i-lucide-users"
              label="Data Karyawan"
              class="justify-start cursor-pointer"
            />
            <UButton
              to="/kontrak"
              color="neutral"
              variant="subtle"
              icon="i-lucide-file-text"
              label="Kontrak"
              class="justify-start cursor-pointer"
            />
            <UButton
              to="/settings/master-data"
              color="neutral"
              variant="subtle"
              icon="i-lucide-database"
              label="Master Data"
              class="justify-start cursor-pointer"
            />
            <UButton
              to="/settings"
              color="neutral"
              variant="subtle"
              icon="i-lucide-settings"
              label="Pengaturan"
              class="justify-start cursor-pointer"
            />
          </div>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
