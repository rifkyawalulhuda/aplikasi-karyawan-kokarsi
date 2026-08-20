<script setup lang="ts">
interface ExpiringItem { id: number; label: string; suffix: string; endDate: string | null }

interface DashboardStats {
  total: number
  aktif: number
  kontrakExpired: number
  resign: number
  phk: number
  expiringContracts: number
  byLocation: { name: string; count: number }[]
  byLevel: { name: string; count: number }[]
  bySp: { sp1: number; sp2: number; sp3: number }
  byContractFamily: { mitra: number; pkwt: number }
  byGender: { male: number; female: number }
  byEducation: { sma: number; d3: number; s1: number; s2: number }
  byDepartment: { name: string; count: number }[]
  recruitmentTrend: { year: number; count: number }[]
  offboardingTrend: { year: number; resign: number; phk: number }[]
  expiringSoon: {
    contracts: { count: number; items: ExpiringItem[] }
    vendorContracts: { count: number; items: ExpiringItem[] }
    legalKoperasi: { count: number; items: ExpiringItem[] }
    certifications: { count: number; items: ExpiringItem[] }
    activeWarnings: number
  }
}

const auth = useAuthStore()
const { data: stats, pending: statsLoading, error: statsError } = await useFetch<DashboardStats>('/api/dashboard-stats', { lazy: true })
const { unreadCount } = useNotifications()

// Agenda hari ini (untuk header Today Snapshot)
const today = new Date()
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const { data: todayAgenda } = await useFetch<any[]>('/api/calendar', {
  query: { start: todayStr, end: todayStr },
  lazy: true,
  credentials: 'include',
})
const todayAgendaCount = computed(() => todayAgenda.value?.length ?? 0)

// Total item yang perlu perhatian (untuk badge di header section)
const totalAttentionCount = computed(() => {
  const es = stats.value?.expiringSoon
  if (!es) return 0
  return (es.contracts?.count ?? 0)
    + (es.vendorContracts?.count ?? 0)
    + (es.legalKoperasi?.count ?? 0)
    + (es.certifications?.count ?? 0)
    + (es.activeWarnings ?? 0)
    + unreadCount.value
})

// --- Collapsible section state (persisted ke localStorage) ---
const sectionKpi        = useLocalStorage('dashboard-section-kpi', true)
const sectionPerhatian  = useLocalStorage('dashboard-section-perhatian', true)
const sectionCharts     = useLocalStorage('dashboard-section-charts', true)
const sectionDemografi  = useLocalStorage('dashboard-section-demografi', false)
const sectionDistribusi = useLocalStorage('dashboard-section-distribusi', false)
const sectionTrend      = useLocalStorage('dashboard-section-trend', false)
const sectionAksiCepat  = useLocalStorage('dashboard-section-aksi-cepat', true)

const allSections = [sectionKpi, sectionPerhatian, sectionCharts, sectionDemografi, sectionDistribusi, sectionTrend, sectionAksiCepat]
const allExpanded = computed(() => allSections.every(s => s.value === true))
function toggleAll() {
  const next = !allExpanded.value
  allSections.forEach(s => s.value = next)
}

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
  },
  {
    title: 'Sertifikasi Akan Expired',
    icon: 'i-lucide-file-badge',
    value: stats.value?.expiringSoon?.certifications?.count ?? 0,
    description: 'Dalam 30 hari ke depan',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    ring: 'ring-orange-500/20'
  },
  {
    title: 'SP Aktif',
    icon: 'i-lucide-alert-triangle',
    value: stats.value?.expiringSoon?.activeWarnings ?? 0,
    description: 'Surat peringatan masih berlaku',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    ring: 'ring-purple-500/20'
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
const educationColors = ['bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500']
const departmentColors = ['bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500']

// --- New chart computed data ---

// SP donut data
const spDonutData = computed(() => {
  const d = stats.value?.bySp
  return [
    { label: 'SP 1', value: d?.sp1 ?? 0, color: '#f59e0b' },
    { label: 'SP 2', value: d?.sp2 ?? 0, color: '#ef4444' },
    { label: 'SP 3', value: d?.sp3 ?? 0, color: '#7f1d1d' },
  ]
})

// SP donut segments — menggunakan SVG path arc untuk presisi penuh
const spDonutSegments = computed(() => {
  const total = spDonutData.value.reduce((s, d) => s + d.value, 0)
  if (total === 0) return []
  const cx = 60, cy = 60, r = 40
  let currentAngle = -90 // mulai dari posisi 12 jam
  return spDonutData.value
    .filter(d => d.value > 0)
    .map(d => {
      const pct = d.value / total
      const sweepAngle = pct * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + sweepAngle
      currentAngle = endAngle
      // Konversi sudut ke koordinat
      const rad = (a: number) => (a * Math.PI) / 180
      const x1 = cx + r * Math.cos(rad(startAngle))
      const y1 = cy + r * Math.sin(rad(startAngle))
      const x2 = cx + r * Math.cos(rad(endAngle))
      const y2 = cy + r * Math.sin(rad(endAngle))
      const largeArc = sweepAngle > 180 ? 1 : 0
      // Kalau full circle (100%), gambar 2 semicircle
      if (pct >= 0.9999) {
        const xMid = cx + r * Math.cos(rad(startAngle + 180))
        const yMid = cy + r * Math.sin(rad(startAngle + 180))
        return {
          ...d,
          d: `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 0 1 ${xMid.toFixed(3)} ${yMid.toFixed(3)} A ${r} ${r} 0 0 1 ${x1.toFixed(3)} ${y1.toFixed(3)}`
        }
      }
      return {
        ...d,
        d: `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`
      }
    })
})

// Contract family donut data
const contractFamilyDonutData = computed(() => {
  const d = stats.value?.byContractFamily
  return [
    { label: 'PKWT', value: d?.pkwt ?? 0, color: '#3b82f6' },
    { label: 'MITRA', value: d?.mitra ?? 0, color: '#8b5cf6' },
  ]
})

// Gender donut data
const genderDonutData = computed(() => {
  const g = stats.value?.byGender
  return [
    { label: 'Laki-laki', value: g?.male ?? 0, color: '#3b82f6' },
    { label: 'Perempuan', value: g?.female ?? 0, color: '#ec4899' },
  ]
})

// Education bar data
const educationData = computed(() => {
  const e = stats.value?.byEducation
  return [
    { label: 'SMA', count: e?.sma ?? 0 },
    { label: 'D3', count: e?.d3 ?? 0 },
    { label: 'S1', count: e?.s1 ?? 0 },
    { label: 'S2', count: e?.s2 ?? 0 },
  ].filter(x => x.count > 0)
})

// Max count helpers for bar widths
const educationMax = computed(() => Math.max(...educationData.value.map(x => x.count), 1))

// Sorted department (descending by count)
const sortedDepartments = computed(() =>
  [...(stats.value?.byDepartment ?? [])].sort((a, b) => b.count - a.count)
)
const departmentMax = computed(() => Math.max(...(sortedDepartments.value.map(x => x.count) ?? [1]), 1))

// Recruitment + Offboarding trend helpers
const recruitmentMax = computed(() => Math.max(...(stats.value?.recruitmentTrend?.map(x => x.count) ?? [1]), 1))
const offboardingMax = computed(() => {
  const data = stats.value?.offboardingTrend ?? []
  return Math.max(...data.map(x => x.resign + x.phk), 1)
})

// --- Tooltip interaktif ---
interface TooltipData { x: number; y: number; label: string; value: string; extra?: string }
const tooltipDonut     = ref<TooltipData | null>(null)
const tooltipSp        = ref<TooltipData | null>(null)
const tooltipKontrak   = ref<TooltipData | null>(null)
const tooltipGender    = ref<TooltipData | null>(null)
const tooltipRekrutmen = ref<TooltipData | null>(null)
const tooltipOffboard  = ref<TooltipData | null>(null)
const tooltipBar       = ref<TooltipData | null>(null)

// Elemen refs untuk kalkulasi posisi tooltip relatif
const donutWrapRef    = ref<HTMLElement | null>(null)
const spWrapRef       = ref<HTMLElement | null>(null)
const kontrakWrapRef  = ref<HTMLElement | null>(null)
const genderWrapRef   = ref<HTMLElement | null>(null)
const rekrutmenWrapRef= ref<HTMLElement | null>(null)
const offboardWrapRef = ref<HTMLElement | null>(null)

function getRelPos(e: MouseEvent, el: HTMLElement | null) {
  if (!el) return { x: 0, y: 0 }
  const r = el.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted hidden sm:block">
              {{ new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
            </span>
            <NuxtLink
              v-if="todayAgendaCount > 0"
              to="/kalender"
              class="hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <UIcon name="i-lucide-calendar-days" class="size-3.5" />
              {{ todayAgendaCount }} agenda hari ini
            </NuxtLink>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 sm:p-6 space-y-6">

        <!-- Error state -->
        <UAlert
          v-if="statsError"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          title="Gagal memuat data dashboard"
          description="Pastikan server backend berjalan dan coba refresh halaman."
        />

        <!-- Collapse/Uncollapse All -->
        <div class="flex justify-end">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-highlighted hover:bg-accented/50 transition-colors duration-150 cursor-pointer"
            @click="toggleAll"
          >
            <UIcon
              name="i-lucide-chevrons-up-down"
              class="size-3.5"
            />
            {{ allExpanded ? 'Collapse All' : 'Expand All' }}
          </button>
        </div>

        <!-- Section: Ringkasan KPI -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionKpi = !sectionKpi"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-layout-dashboard" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Ringkasan KPI</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionKpi }"
          />
        </button>

        <div v-show="sectionKpi">
        <!-- Stat Cards -->
        <div class="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
          <!-- Skeleton loading -->
          <template v-if="statsLoading">
            <UCard
              v-for="i in 6"
              :key="`skel-${i}`"
              :ui="{ body: 'p-4 sm:p-5' }"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="h-3 bg-accented rounded w-2/3 animate-pulse" />
                  <div class="h-8 bg-accented rounded w-1/2 animate-pulse" />
                  <div class="h-3 bg-accented rounded w-3/4 animate-pulse" />
                </div>
                <div class="p-2.5 rounded-xl bg-accented shrink-0 w-10 h-10 animate-pulse" />
              </div>
            </UCard>
          </template>
          <!-- Actual cards -->
          <template v-else>
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
          </template>
        </div>
        </div><!-- end v-show sectionKpi -->

        <!-- Section: Perlu Perhatian -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionPerhatian = !sectionPerhatian"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bell-ring" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Perlu Perhatian</span>
            <span
              v-if="!statsLoading && totalAttentionCount > 0"
              class="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500"
            >{{ totalAttentionCount }}</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionPerhatian }"
          />
        </button>

        <div v-show="sectionPerhatian">
        <!-- Attention cards grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <template v-if="statsLoading">
            <UCard v-for="i in 4" :key="`att-skel-${i}`" :ui="{ body: 'p-4' }">
              <div class="space-y-2">
                <div class="h-4 bg-accented rounded w-1/2 animate-pulse" />
                <div class="h-3 bg-accented rounded w-3/4 animate-pulse" />
                <div class="h-3 bg-accented rounded w-2/3 animate-pulse" />
              </div>
            </UCard>
          </template>
          <template v-else>
            <!-- Kontrak Karyawan -->
            <DashboardAttentionCard
              title="Kontrak Akan Habis"
              :count="stats?.expiringSoon?.contracts?.count ?? 0"
              :items="stats?.expiringSoon?.contracts?.items ?? []"
              icon="i-lucide-file-text"
              color-class="text-red-500 bg-red-500/10"
              to="/kontrak"
            />
            <!-- Kontrak Vendor -->
            <DashboardAttentionCard
              title="Kontrak Vendor"
              :count="stats?.expiringSoon?.vendorContracts?.count ?? 0"
              :items="stats?.expiringSoon?.vendorContracts?.items ?? []"
              icon="i-lucide-building-2"
              color-class="text-orange-500 bg-orange-500/10"
              to="/dokumen-legal/kontrak-vendor"
            />
            <!-- Legal Koperasi -->
            <DashboardAttentionCard
              title="Legal Koperasi"
              :count="stats?.expiringSoon?.legalKoperasi?.count ?? 0"
              :items="stats?.expiringSoon?.legalKoperasi?.items ?? []"
              icon="i-lucide-file-signature"
              color-class="text-amber-500 bg-amber-500/10"
              to="/dokumen-legal/legal-koperasi"
            />
            <!-- Sertifikasi & Ijin -->
            <DashboardAttentionCard
              title="Sertifikasi Akan Expired"
              :count="stats?.expiringSoon?.certifications?.count ?? 0"
              :items="stats?.expiringSoon?.certifications?.items ?? []"
              icon="i-lucide-file-badge"
              color-class="text-sky-500 bg-sky-500/10"
              to="/dokumen/sertifikasi-ijin"
            />
            <!-- Surat Peringatan -->
            <DashboardAttentionCard
              title="Surat Peringatan Aktif"
              :count="stats?.expiringSoon?.activeWarnings ?? 0"
              :items="[]"
              icon="i-lucide-alert-triangle"
              color-class="text-purple-500 bg-purple-500/10"
              to="/dokumen/surat-peringatan"
            />
            <!-- Notifikasi -->
            <DashboardAttentionCard
              title="Notifikasi"
              :count="unreadCount"
              :items="[]"
              icon="i-lucide-bell"
              color-class="text-green-500 bg-green-500/10"
              to="/notifications"
            />
          </template>
        </div>
        </div><!-- end v-show sectionPerhatian -->

        <!-- Section: Distribusi & Status -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionCharts = !sectionCharts"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-3" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Distribusi & Status</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionCharts }"
          />
        </button>

        <div v-show="sectionCharts">
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
              <div ref="donutWrapRef" class="relative" @mouseleave="tooltipDonut = null">
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
                    :stroke-width="tooltipDonut?.label === segment.label ? 20 : 16"
                    stroke-linecap="round"
                    :stroke-dasharray="`${segment.length} ${donutData.circ}`"
                    :stroke-dashoffset="segment.offset"
                    style="transition: stroke-width 0.15s ease, stroke-dasharray 0.6s ease; cursor: pointer"
                    @mousemove="(e: MouseEvent) => { const p = getRelPos(e, donutWrapRef); tooltipDonut = { x: p.x, y: p.y, label: segment.label, value: `${segment.count} orang`, extra: `${segment.pct}%` } }"
                  />
                  <!-- Center text -->
                  <text x="60" y="56" text-anchor="middle" font-size="18" font-weight="700" style="fill: var(--ui-text-highlighted)">
                    {{ donutData.total }}
                  </text>
                  <text x="60" y="71" text-anchor="middle" font-size="9" style="fill: var(--ui-text-muted)">
                    Total
                  </text>
                </svg>
                <!-- Tooltip -->
                <Transition name="tt">
                  <div
                    v-if="tooltipDonut"
                    class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                    :style="{ left: tooltipDonut.x + 'px', top: tooltipDonut.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                  >
                    <div class="font-semibold text-highlighted">{{ tooltipDonut.label }}</div>
                    <div class="text-muted">{{ tooltipDonut.value }}</div>
                    <div v-if="tooltipDonut.extra" class="text-muted">{{ tooltipDonut.extra }}</div>
                  </div>
                </Transition>
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

          <!-- Bar: Distribusi Site -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-map-pin" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Site</span>
              </div>
            </template>

            <div class="space-y-3.5">
              <template v-if="(stats?.byLocation?.length ?? 0) > 0">
                <div
                  v-for="(item, i) in stats?.byLocation"
                  :key="item.name"
                  class="space-y-1.5 group/bar cursor-default rounded-md px-1 py-0.5 hover:bg-accented/40 transition-colors duration-150"
                >
                   <div class="flex items-center justify-between text-xs">
                    <span class="text-muted truncate max-w-[60%]">{{ item.name }}</span>
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                      <span class="text-muted tabular-nums">({{ stats?.total ? Math.round((item.count / stats.total) * 100) : 0 }}%)</span>
                    </div>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700 group-hover/bar:brightness-125', locationColors[i % locationColors.length]]"
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
                  class="space-y-1.5 group/bar cursor-default rounded-md px-1 py-0.5 hover:bg-accented/40 transition-colors duration-150"
                >
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted truncate max-w-[60%]">{{ item.name }}</span>
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                      <span class="text-muted tabular-nums">({{ stats?.total ? Math.round((item.count / stats.total) * 100) : 0 }}%)</span>
                    </div>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700 group-hover/bar:brightness-125', levelColors[i % levelColors.length]]"
                      :style="{ width: `${(item.count / (stats?.total || 1)) * 100}%` }"
                    />
                  </div>
                </div>
              </template>
              <p v-else class="text-sm text-muted text-center py-4">Belum ada data</p>
            </div>
          </UCard>

        </div>
        </div><!-- end v-show sectionCharts -->

        <!-- Section: Demografi Karyawan -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionDemografi = !sectionDemografi"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users-round" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Demografi Karyawan</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionDemografi }"
          />
        </button>

        <div v-show="sectionDemografi">
        <!-- Row 3: SP / Contract Family / Gender Donuts -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

          <!-- SP Chart -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-alert-triangle" class="size-4 text-amber-500" />
                <span class="text-sm font-semibold text-highlighted">Surat Peringatan</span>
              </div>
            </template>
            <template v-if="spDonutData.every(d => d.value === 0)">
              <p class="text-sm text-muted text-center py-6">Tidak ada data</p>
            </template>
            <template v-else>
              <!-- SVG Donut -->
              <div ref="spWrapRef" class="flex justify-center relative" @mouseleave="tooltipSp = null">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="40" fill="none" class="stroke-accented" stroke-width="16" />
                  <path
                    v-for="seg in spDonutSegments"
                    :key="seg.label"
                    :d="seg.d"
                    fill="none"
                    :stroke="seg.color"
                    :stroke-width="tooltipSp?.label === seg.label ? 20 : 16"
                    stroke-linecap="butt"
                    style="cursor: pointer; transition: stroke-width 0.15s ease"
                    @mousemove="(e: MouseEvent) => { const p = getRelPos(e, spWrapRef); const total = spDonutData.reduce((s,d)=>s+d.value,0); tooltipSp = { x: p.x, y: p.y, label: seg.label, value: `${seg.value} orang`, extra: total > 0 ? `${Math.round(seg.value/total*100)}%` : '' } }"
                  />
                </svg>
                <!-- Tooltip -->
                <Transition name="tt">
                  <div
                    v-if="tooltipSp"
                    class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                    :style="{ left: tooltipSp.x + 'px', top: tooltipSp.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                  >
                    <div class="font-semibold text-highlighted">{{ tooltipSp.label }}</div>
                    <div class="text-muted">{{ tooltipSp.value }}</div>
                    <div v-if="tooltipSp.extra" class="text-muted">{{ tooltipSp.extra }}</div>
                  </div>
                </Transition>
              </div>
              <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <div v-for="item in spDonutData" :key="item.label" class="flex items-center gap-1.5 text-xs">
                  <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
                  <span class="text-muted">{{ item.label }}</span>
                  <span class="font-medium text-highlighted">{{ item.value }}</span>
                </div>
              </div>
            </template>
          </UCard>

          <!-- Contract Family Chart — Split Bar -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-file-text" class="size-4 text-primary" />
                <span class="text-sm font-semibold text-highlighted">Distribusi Kontrak</span>
              </div>
            </template>
            <template v-if="contractFamilyDonutData.every(d => d.value === 0)">
              <p class="text-sm text-muted text-center py-6">Tidak ada data</p>
            </template>
            <template v-else>
              <div class="space-y-4 py-2">
                <!-- Total label -->
                <div class="flex justify-between text-xs text-muted mb-1">
                  <span>Tipe Kontrak</span>
                  <span>{{ contractFamilyDonutData.reduce((s, d) => s + d.value, 0) }} total</span>
                </div>
                <!-- Split bar wrapper — relative untuk tooltip -->
                <div ref="kontrakWrapRef" class="relative" @mouseleave="tooltipKontrak = null">
                  <div class="w-full h-5 rounded-full overflow-hidden flex">
                    <div
                      v-for="item in contractFamilyDonutData"
                      :key="item.label"
                      class="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full hover:brightness-110 cursor-pointer"
                      :style="{
                        width: `${(item.value / contractFamilyDonutData.reduce((s, d) => s + d.value, 0)) * 100}%`,
                        backgroundColor: item.color
                      }"
                      @mousemove="(e: MouseEvent) => { const p = getRelPos(e, kontrakWrapRef); const total = contractFamilyDonutData.reduce((s,d)=>s+d.value,0); tooltipKontrak = { x: p.x, y: p.y, label: item.label, value: `${item.value} orang`, extra: total > 0 ? `${Math.round(item.value/total*100)}%` : '' } }"
                    />
                  </div>
                  <!-- Tooltip di luar overflow-hidden -->
                  <Transition name="tt">
                    <div
                      v-if="tooltipKontrak"
                      class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                      :style="{ left: tooltipKontrak.x + 'px', top: tooltipKontrak.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                    >
                      <div class="font-semibold text-highlighted">{{ tooltipKontrak.label }}</div>
                      <div class="text-muted">{{ tooltipKontrak.value }}</div>
                      <div v-if="tooltipKontrak.extra" class="text-muted">{{ tooltipKontrak.extra }}</div>
                    </div>
                  </Transition>
                </div>
                <!-- Legend -->
                <div class="space-y-2.5 mt-3">
                  <div
                    v-for="item in contractFamilyDonutData"
                    :key="item.label"
                    class="flex items-center justify-between text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
                      <span class="text-muted">{{ item.label }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-highlighted tabular-nums">{{ item.value }}</span>
                      <span class="text-xs text-muted tabular-nums">({{ contractFamilyDonutData.reduce((s, d) => s + d.value, 0) > 0 ? Math.round((item.value / contractFamilyDonutData.reduce((s, d) => s + d.value, 0)) * 100) : 0 }}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </UCard>

          <!-- Gender Chart — Split Bar -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-users" class="size-4 text-pink-500" />
                <span class="text-sm font-semibold text-highlighted">Distribusi Gender</span>
              </div>
            </template>
            <template v-if="genderDonutData.every(d => d.value === 0)">
              <p class="text-sm text-muted text-center py-6">Tidak ada data</p>
            </template>
            <template v-else>
              <div class="space-y-4 py-2">
                <!-- Total label -->
                <div class="flex justify-between text-xs text-muted mb-1">
                  <span>Gender</span>
                  <span>{{ genderDonutData.reduce((s, d) => s + d.value, 0) }} total</span>
                </div>
                <!-- Split bar -->
                <!-- Split bar wrapper — relative untuk tooltip -->
                <div ref="genderWrapRef" class="relative" @mouseleave="tooltipGender = null">
                  <div class="w-full h-5 rounded-full overflow-hidden flex">
                    <div
                      v-for="item in genderDonutData"
                      :key="item.label"
                      class="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full hover:brightness-110 cursor-pointer"
                      :style="{
                        width: `${(item.value / genderDonutData.reduce((s, d) => s + d.value, 0)) * 100}%`,
                        backgroundColor: item.color
                      }"
                      @mousemove="(e: MouseEvent) => { const p = getRelPos(e, genderWrapRef); const total = genderDonutData.reduce((s,d)=>s+d.value,0); tooltipGender = { x: p.x, y: p.y, label: item.label, value: `${item.value} orang`, extra: total > 0 ? `${Math.round(item.value/total*100)}%` : '' } }"
                    />
                  </div>
                  <!-- Tooltip di luar overflow-hidden -->
                  <Transition name="tt">
                    <div
                      v-if="tooltipGender"
                      class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                      :style="{ left: tooltipGender.x + 'px', top: tooltipGender.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                    >
                      <div class="font-semibold text-highlighted">{{ tooltipGender.label }}</div>
                      <div class="text-muted">{{ tooltipGender.value }}</div>
                      <div v-if="tooltipGender.extra" class="text-muted">{{ tooltipGender.extra }}</div>
                    </div>
                  </Transition>
                </div>
                <!-- Legend -->
                <div class="space-y-2.5 mt-3">
                  <div
                    v-for="item in genderDonutData"
                    :key="item.label"
                    class="flex items-center justify-between text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
                      <span class="text-muted">{{ item.label }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-highlighted tabular-nums">{{ item.value }}</span>
                      <span class="text-xs text-muted tabular-nums">({{ genderDonutData.reduce((s, d) => s + d.value, 0) > 0 ? Math.round((item.value / genderDonutData.reduce((s, d) => s + d.value, 0)) * 100) : 0 }}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </UCard>

        </div>
        </div><!-- end v-show sectionDemografi -->

        <!-- Section: Distribusi Pendidikan & Departemen -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionDistribusi = !sectionDistribusi"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-graduation-cap" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Distribusi Pendidikan & Departemen</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionDistribusi }"
          />
        </button>

        <div v-show="sectionDistribusi">
        <!-- Row 4: Education + Department bars -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <!-- Education Bar -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-graduation-cap" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Pendidikan Terakhir</span>
              </div>
            </template>
            <div class="space-y-3.5">
              <template v-if="educationData.length > 0">
                <div v-for="(item, i) in educationData" :key="item.label" class="space-y-1.5 group/bar cursor-default rounded-md px-1 py-0.5 hover:bg-accented/40 transition-colors duration-150">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted">{{ item.label }}</span>
                    <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700 group-hover/bar:brightness-125', educationColors[i % educationColors.length]]"
                      :style="{ width: `${(item.count / educationMax) * 100}%` }"
                    />
                  </div>
                </div>
              </template>
              <p v-else class="text-sm text-muted text-center py-4">Belum ada data</p>
            </div>
          </UCard>

          <!-- Department Bar -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
                <span class="text-sm font-semibold text-highlighted">Departemen</span>
              </div>
            </template>
            <div class="space-y-3.5">
              <template v-if="(stats?.byDepartment?.length ?? 0) > 0">
                <div v-for="(item, i) in sortedDepartments" :key="item.name" class="space-y-1.5 group/bar cursor-default rounded-md px-1 py-0.5 hover:bg-accented/40 transition-colors duration-150">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-muted truncate max-w-[60%]">{{ item.name }}</span>
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-highlighted tabular-nums">{{ item.count }}</span>
                      <span class="text-muted tabular-nums">({{ stats?.total ? Math.round((item.count / stats.total) * 100) : 0 }}%)</span>
                    </div>
                  </div>
                  <div class="h-2 bg-accented rounded-full overflow-hidden">
                    <div
                      :class="['h-full rounded-full transition-all duration-700 group-hover/bar:brightness-125', departmentColors[i % departmentColors.length]]"
                      :style="{ width: `${(item.count / departmentMax) * 100}%` }"
                    />
                  </div>
                </div>
              </template>
              <p v-else class="text-sm text-muted text-center py-4">Belum ada data</p>
            </div>
          </UCard>

        </div>
        </div><!-- end v-show sectionDistribusi -->

        <!-- Section: Trend Rekrutmen & Offboarding -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionTrend = !sectionTrend"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-trending-up" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Trend Rekrutmen & Offboarding</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionTrend }"
          />
        </button>

        <div v-show="sectionTrend">
        <!-- Row 5: Recruitment + Offboarding Trend bars -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <!-- Recruitment Trend — Line Chart -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-trending-up" class="size-4 text-blue-500" />
                <span class="text-sm font-semibold text-highlighted">Trend Rekrutmen per Tahun</span>
              </div>
            </template>
            <template v-if="(stats?.recruitmentTrend?.length ?? 0) === 0">
              <p class="text-sm text-muted text-center py-4">Belum ada data</p>
            </template>
            <template v-else>
              <div ref="rekrutmenWrapRef" class="relative w-full" style="height: 120px;" @mouseleave="tooltipRekrutmen = null">
                <svg class="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <!-- Grid lines -->
                  <line x1="0" y1="0" x2="300" y2="0" class="stroke-accented" stroke-width="0.5" />
                  <line x1="0" y1="50" x2="300" y2="50" class="stroke-accented" stroke-width="0.5" stroke-dasharray="4,4" />
                  <line x1="0" y1="100" x2="300" y2="100" class="stroke-accented" stroke-width="0.5" />
                  <!-- Vertical guideline -->
                  <line
                    v-if="tooltipRekrutmen"
                    :x1="tooltipRekrutmen.extra"
                    y1="0"
                    :x2="tooltipRekrutmen.extra"
                    y2="100"
                    stroke="#3b82f6"
                    stroke-width="0.5"
                    stroke-dasharray="2,2"
                    opacity="0.5"
                  />
                  <!-- Area fill -->
                  <path
                    :d="(() => {
                      const data = stats?.recruitmentTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      const points = data.map((d, i) => `${i * xStep},${100 - (d.count / recruitmentMax) * 90}`)
                      return `M ${points[0]} L ${points.slice(1).join(' L ')} L ${(n-1)*xStep},100 L 0,100 Z`
                    })()"
                    fill="rgba(59,130,246,0.12)"
                  />
                  <!-- Line -->
                  <polyline
                    :points="(() => {
                      const data = stats?.recruitmentTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      return data.map((d, i) => `${i * xStep},${100 - (d.count / recruitmentMax) * 90}`).join(' ')
                    })()"
                    fill="none"
                    stroke="#3b82f6"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <!-- Dots -->
                  <template v-for="(item, i) in stats?.recruitmentTrend" :key="item.year">
                    <circle
                      :cx="(stats?.recruitmentTrend?.length ?? 1) > 1 ? i * (300 / ((stats?.recruitmentTrend?.length ?? 1) - 1)) : 150"
                      :cy="100 - (item.count / recruitmentMax) * 90"
                      :r="tooltipRekrutmen?.label === String(item.year) ? 5 : 3"
                      fill="#3b82f6"
                      class="stroke-background"
                      stroke-width="1.5"
                      style="cursor: pointer; transition: r 0.15s ease"
                      @mousemove.stop="(e: MouseEvent) => {
                        const n = stats?.recruitmentTrend?.length ?? 1
                        const cx = n > 1 ? i * (300 / (n - 1)) : 150
                        const p = getRelPos(e, rekrutmenWrapRef)
                        tooltipRekrutmen = { x: p.x, y: p.y, label: String(item.year), value: `${item.count} rekrutmen`, extra: String(cx) }
                      }"
                    />
                  </template>
                </svg>
                <!-- Tooltip -->
                <Transition name="tt">
                  <div
                    v-if="tooltipRekrutmen"
                    class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                    :style="{ left: tooltipRekrutmen.x + 'px', top: tooltipRekrutmen.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                  >
                    <div class="font-semibold text-highlighted">{{ tooltipRekrutmen.label }}</div>
                    <div class="text-muted">{{ tooltipRekrutmen.value }}</div>
                  </div>
                </Transition>
              </div>
              <!-- X-axis labels + values -->
              <div class="flex justify-between mt-2 px-0.5">
                <div
                  v-for="item in stats?.recruitmentTrend"
                  :key="item.year"
                  class="flex flex-col items-center gap-0.5"
                >
                  <span class="text-xs font-semibold text-blue-500 tabular-nums">{{ item.count }}</span>
                  <span class="text-xs text-muted tabular-nums">{{ item.year }}</span>
                </div>
              </div>
            </template>
          </UCard>

          <!-- Offboarding Trend — Line Chart -->
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <template #header>
              <div class="flex items-center gap-2 px-4 pt-4 pb-0 sm:px-5">
                <UIcon name="i-lucide-trending-down" class="size-4 text-rose-500" />
                <span class="text-sm font-semibold text-highlighted">Trend Offboarding per Tahun</span>
              </div>
            </template>
            <template v-if="(stats?.offboardingTrend?.length ?? 0) === 0">
              <p class="text-sm text-muted text-center py-4">Belum ada data</p>
            </template>
            <template v-else>
              <div ref="offboardWrapRef" class="relative w-full" style="height: 120px;" @mouseleave="tooltipOffboard = null">
                <svg class="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <!-- Grid lines -->
                  <line x1="0" y1="0" x2="300" y2="0" class="stroke-accented" stroke-width="0.5" />
                  <line x1="0" y1="50" x2="300" y2="50" class="stroke-accented" stroke-width="0.5" stroke-dasharray="4,4" />
                  <line x1="0" y1="100" x2="300" y2="100" class="stroke-accented" stroke-width="0.5" />
                  <!-- Vertical guideline -->
                  <line
                    v-if="tooltipOffboard"
                    :x1="tooltipOffboard.extra"
                    y1="0"
                    :x2="tooltipOffboard.extra"
                    y2="100"
                    stroke="#94a3b8"
                    stroke-width="0.5"
                    stroke-dasharray="2,2"
                    opacity="0.5"
                  />
                  <!-- Resign area -->
                  <path
                    :d="(() => {
                      const data = stats?.offboardingTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      const points = data.map((d, i) => `${i * xStep},${100 - (d.resign / offboardingMax) * 90}`)
                      return `M ${points[0]} L ${points.slice(1).join(' L ')} L ${(n-1)*xStep},100 L 0,100 Z`
                    })()"
                    fill="rgba(148,163,184,0.15)"
                  />
                  <!-- Resign line -->
                  <polyline
                    :points="(() => {
                      const data = stats?.offboardingTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      return data.map((d, i) => `${i * xStep},${100 - (d.resign / offboardingMax) * 90}`).join(' ')
                    })()"
                    fill="none"
                    stroke="#94a3b8"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <!-- PHK area -->
                  <path
                    :d="(() => {
                      const data = stats?.offboardingTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      const points = data.map((d, i) => `${i * xStep},${100 - (d.phk / offboardingMax) * 90}`)
                      return `M ${points[0]} L ${points.slice(1).join(' L ')} L ${(n-1)*xStep},100 L 0,100 Z`
                    })()"
                    fill="rgba(244,63,94,0.12)"
                  />
                  <!-- PHK line -->
                  <polyline
                    :points="(() => {
                      const data = stats?.offboardingTrend ?? []
                      const n = data.length
                      if (n < 2) return ''
                      const xStep = 300 / (n - 1)
                      return data.map((d, i) => `${i * xStep},${100 - (d.phk / offboardingMax) * 90}`).join(' ')
                    })()"
                    fill="none"
                    stroke="#f43f5e"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                  <!-- Resign dots -->
                  <template v-for="(item, i) in stats?.offboardingTrend" :key="`resign-${item.year}`">
                    <circle
                      :cx="(stats?.offboardingTrend?.length ?? 1) > 1 ? i * (300 / ((stats?.offboardingTrend?.length ?? 1) - 1)) : 150"
                      :cy="100 - (item.resign / offboardingMax) * 90"
                      :r="tooltipOffboard?.label === String(item.year) ? 5 : 3"
                      fill="#94a3b8"
                      class="stroke-background"
                      stroke-width="1.5"
                      style="cursor: pointer; transition: r 0.15s ease"
                      @mousemove.stop="(e: MouseEvent) => {
                        const n = stats?.offboardingTrend?.length ?? 1
                        const cx = n > 1 ? i * (300 / (n - 1)) : 150
                        const p = getRelPos(e, offboardWrapRef)
                        tooltipOffboard = { x: p.x, y: p.y, label: String(item.year), value: `Resign: ${item.resign}`, extra: String(cx) }
                      }"
                    />
                  </template>
                  <!-- PHK dots -->
                  <template v-for="(item, i) in stats?.offboardingTrend" :key="`phk-${item.year}`">
                    <circle
                      :cx="(stats?.offboardingTrend?.length ?? 1) > 1 ? i * (300 / ((stats?.offboardingTrend?.length ?? 1) - 1)) : 150"
                      :cy="100 - (item.phk / offboardingMax) * 90"
                      :r="tooltipOffboard?.label === String(item.year) ? 5 : 3"
                      fill="#f43f5e"
                      class="stroke-background"
                      stroke-width="1.5"
                      style="cursor: pointer; transition: r 0.15s ease"
                      @mousemove.stop="(e: MouseEvent) => {
                        const n = stats?.offboardingTrend?.length ?? 1
                        const cx = n > 1 ? i * (300 / (n - 1)) : 150
                        const p = getRelPos(e, offboardWrapRef)
                        tooltipOffboard = { x: p.x, y: p.y, label: String(item.year), value: `PHK: ${item.phk}`, extra: String(cx) }
                      }"
                    />
                  </template>
                </svg>
                <!-- Tooltip -->
                <Transition name="tt">
                  <div
                    v-if="tooltipOffboard"
                    class="absolute z-50 pointer-events-none bg-white dark:bg-neutral-900 border border-default rounded-lg shadow-lg px-2.5 py-1.5 text-xs whitespace-nowrap"
                    :style="{ left: tooltipOffboard.x + 'px', top: tooltipOffboard.y + 'px', transform: 'translate(-50%, calc(-100% - 8px))' }"
                  >
                    <div class="font-semibold text-highlighted">{{ tooltipOffboard.label }}</div>
                    <div class="text-muted">{{ tooltipOffboard.value }}</div>
                  </div>
                </Transition>
              </div>
              <!-- X-axis labels -->
              <div class="flex justify-between mt-2 px-0.5">
                <span
                  v-for="item in stats?.offboardingTrend"
                  :key="item.year"
                  class="text-xs text-muted tabular-nums"
                >{{ item.year }}</span>
              </div>
              <!-- Legend -->
              <div class="mt-2 flex gap-4">
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="size-2 rounded-full bg-slate-400 shrink-0" />
                  <span class="text-muted">Resign</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="size-2 rounded-full bg-rose-500 shrink-0" />
                  <span class="text-muted">PHK</span>
                </div>
              </div>
            </template>
          </UCard>

        </div>
        </div><!-- end v-show sectionTrend -->

        <!-- Section: Akses Cepat -->
        <button
          type="button"
          class="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-accented/50 transition-colors duration-150 group cursor-pointer"
          @click="sectionAksiCepat = !sectionAksiCepat"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-zap" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Akses Cepat</span>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': !sectionAksiCepat }"
          />
        </button>

        <div v-show="sectionAksiCepat">
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
        </div><!-- end v-show sectionAksiCepat -->

      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.tt-enter-active,
.tt-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.tt-enter-from,
.tt-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-100% - 4px));
}
</style>
