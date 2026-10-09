<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import * as z from 'zod'
import type { CalendarDate } from '@internationalized/date'
import type { DatePreset, DateRange, OperationalVehicleUsage } from '~/utils/vehicle-usage'
import {
  formatTimeWib,
  groupUsagesByDay,
  jakartaDateKey,
  presetRange,
  usageStats
} from '~/utils/vehicle-usage'

definePageMeta({ layout: 'default' })

type Usage = OperationalVehicleUsage

const toast = useToast()
const auth = useAuthStore()
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()
const { confirmActionToast } = useConfirmActionToast()
const { exportOperationalVehicleUsagesExcel } = useExport()

const vehicles = ['Xenia B 2845 FON', 'Grand max B 9043 FCM'] as const
const vehicleItems: { label: string, value: string }[] = vehicles.map(value => ({ label: value, value }))

const usages = ref<Usage[]>([])
const loading = ref(false)
const saving = ref(false)
const cancelling = ref<number | null>(null)

const searchQuery = ref('')
const statusFilter = ref<'all' | 'active' | 'cancelled'>('all')
const datePreset = ref<DatePreset>('all')
const rangeOpen = ref(false)
const rangeStartCal = shallowRef<CalendarDate | null>(null)
const rangeEndCal = shallowRef<CalendarDate | null>(null)

const sorting = ref<{ key: string, direction: 'asc' | 'desc' }>({ key: 'usedAt', direction: 'desc' })
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]

const formOpen = ref(false)
const exportOpen = ref(false)
const exportMode = ref<'all' | 'month'>('all')
const exportMonth = ref(new Date().getMonth() + 1)
const exportYear = ref(new Date().getFullYear())

// Detail drawer
const detailOpen = ref(false)
const detailUsage = ref<Usage | null>(null)

const dateCal = shallowRef<CalendarDate | null>(toCalDate(new Date().toISOString().slice(0, 10)))
const schema = z.object({
  usedDate: z.string().min(1, 'Tanggal wajib diisi'),
  usedTime: z.string().min(1, 'Jam wajib diisi'),
  vehicleNumber: z.string().min(1, 'No. Polisi wajib dipilih'),
  driver: z.string().min(1, 'Driver wajib diisi'),
  destination: z.string().min(1, 'Destination wajib diisi'),
  user: z.string().min(1, 'User wajib diisi'),
  requester: z.string().min(1, 'Requester wajib diisi')
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({
  usedDate: new Date().toISOString().slice(0, 10),
  usedTime: '',
  vehicleNumber: vehicles[0]!,
  driver: '',
  destination: '',
  user: '',
  requester: ''
})
watch(dateCal, (value) => {
  state.usedDate = fromCalDate(value)
})

// ── Rentang tanggal ──────────────────────────────────────────────────────────
const range = computed<DateRange | null>(() => {
  if (datePreset.value === 'custom') {
    if (!rangeStartCal.value) return null
    const start = fromCalDate(rangeStartCal.value)
    const end = rangeEndCal.value ? fromCalDate(rangeEndCal.value) : start
    return { start, end }
  }
  return presetRange(datePreset.value)
})

const rangeLabel = computed(() => {
  if (datePreset.value !== 'custom') return 'Rentang tanggal'
  if (!rangeStartCal.value) return 'Rentang tanggal'
  const start = formatDisplay(rangeStartCal.value)
  return rangeEndCal.value ? `${start} - ${formatDisplay(rangeEndCal.value)}` : start
})

watch(rangeStartCal, (value) => {
  if (rangeEndCal.value && value && rangeEndCal.value.compare(value) < 0) rangeEndCal.value = null
})

function choosePreset(preset: DatePreset) {
  datePreset.value = preset
  if (preset !== 'custom') {
    rangeStartCal.value = null
    rangeEndCal.value = null
  }
}

function openCustomRange() {
  datePreset.value = 'custom'
  rangeOpen.value = true
}

const hasActiveFilters = computed(() =>
  searchQuery.value.trim().length > 0
  || statusFilter.value !== 'all'
  || datePreset.value !== 'all'
)

function resetFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  datePreset.value = 'all'
  rangeStartCal.value = null
  rangeEndCal.value = null
}

// ── Filter / urut / paginasi ─────────────────────────────────────────────────
const filteredUsages = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('id-ID')
  const activeRange = range.value

  return usages.value.filter((item) => {
    const matchesSearch = !query || [item.vehicleNumber, item.driver, item.destination, item.user, item.requester]
      .some(value => value.toLocaleLowerCase('id-ID').includes(query))
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'cancelled' ? item.status === 'BATAL' : item.status === null)
    const matchesRange = !activeRange
      || (jakartaDateKey(item.usedAt) >= activeRange.start && jakartaDateKey(item.usedAt) <= activeRange.end)
    return matchesSearch && matchesStatus && matchesRange
  })
})

const sortedUsages = computed(() => {
  const sort = sorting.value
  return [...filteredUsages.value].sort((a, b) => {
    if (sort.key === 'usedAt') {
      const aTime = new Date(a.usedAt).getTime()
      const bTime = new Date(b.usedAt).getTime()
      const aInvalid = Number.isNaN(aTime)
      const bInvalid = Number.isNaN(bTime)
      if (aInvalid !== bInvalid) return aInvalid ? 1 : -1
      if (!aInvalid && !bInvalid) {
        const timeResult = aTime - bTime
        if (timeResult !== 0) return sort.direction === 'asc' ? timeResult : -timeResult
      }
      const idResult = a.id - b.id
      return sort.direction === 'asc' ? idResult : -idResult
    }

    const aValue = sort.key === 'status' ? (a.status ?? '') : String((a as Record<string, unknown>)[sort.key] ?? '')
    const bValue = sort.key === 'status' ? (b.status ?? '') : String((b as Record<string, unknown>)[sort.key] ?? '')
    const result = aValue.localeCompare(bValue, 'id', { sensitivity: 'base' })
    return sort.direction === 'asc' ? result : -result
  })
})

const stats = computed(() => usageStats(filteredUsages.value))

const pagedUsages = computed(() => {
  const { pageIndex, pageSize } = pagination.value
  return sortedUsages.value.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
})

const groupedPaged = computed(() => groupUsagesByDay(pagedUsages.value))

watch([searchQuery, statusFilter, datePreset, rangeStartCal, rangeEndCal], () => {
  pagination.value.pageIndex = 0
})

watch(() => pagination.value.pageSize, () => {
  pagination.value.pageIndex = 0
})

function toggleSort(key: string) {
  if (sorting.value?.key !== key) {
    sorting.value = { key, direction: 'asc' }
    return
  }
  sorting.value = { key, direction: sorting.value.direction === 'asc' ? 'desc' : 'asc' }
}

function sortIcon(key: string) {
  if (sorting.value?.key !== key) return 'i-lucide-arrow-up-down'
  return sorting.value.direction === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
}

const headerCols: { label: string, key: string, sortable: boolean }[] = [
  { label: 'Waktu', key: 'usedAt', sortable: true },
  { label: 'Kendaraan', key: 'vehicleNumber', sortable: true },
  { label: 'Perjalanan', key: 'driver', sortable: true },
  { label: 'Pengguna', key: 'user', sortable: true },
  { label: 'Status', key: 'status', sortable: true },
  { label: 'Aksi', key: '', sortable: false }
]

// ── Aksi baris ───────────────────────────────────────────────────────────────
function openDetail(item: Usage) {
  detailUsage.value = item
  detailOpen.value = true
}

function rowMenuItems(item: Usage) {
  const items: { label: string, icon: string, onSelect: () => void }[] = [
    { label: 'Lihat detail', icon: 'i-lucide-eye', onSelect: () => openDetail(item) }
  ]
  if (item.status !== 'BATAL') {
    items.push({ label: 'Batalkan pemakaian', icon: 'i-lucide-ban', onSelect: () => confirmCancel(item) })
  }
  return [items]
}

function confirmCancel(item: Usage) {
  confirmActionToast({
    title: 'Batalkan pemakaian kendaraan?',
    description: 'Data yang dibatalkan tidak dapat dikembalikan dan tidak dapat dibatalkan ulang.',
    confirmLabel: 'Batalkan Pemakaian',
    confirmColor: 'error',
    onConfirm: () => cancelUsage(item)
  })
}

async function cancelUsage(item: Usage) {
  cancelling.value = item.id
  try {
    await $fetch(`/api/operational-vehicle-usages/${item.id}/cancel`, { method: 'POST' })
    toast.add({ title: 'Pemakaian kendaraan dibatalkan', color: 'success' })
    detailOpen.value = false
    await fetchUsages()
  } catch (error) {
    toast.add({ title: 'Gagal membatalkan pemakaian', description: apiErrorMessage(error), color: 'error' })
  } finally {
    cancelling.value = null
  }
}

// ── Data ─────────────────────────────────────────────────────────────────────
async function fetchUsages() {
  loading.value = true
  try {
    usages.value = await $fetch<Usage[]>('/api/operational-vehicle-usages')
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode === 401) {
      await auth.logout()
      return
    }
    toast.add({ title: 'Gagal memuat catatan', description: apiErrorMessage(error), color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (auth.isLoggedIn) fetchUsages()
})

function resetForm() {
  dateCal.value = toCalDate(new Date().toISOString().slice(0, 10))
  state.usedDate = new Date().toISOString().slice(0, 10)
  state.usedTime = ''
  state.vehicleNumber = vehicles[0]!
  state.driver = ''
  state.destination = ''
  state.user = ''
  state.requester = ''
}

async function submit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    await $fetch('/api/operational-vehicle-usages', {
      method: 'POST',
      body: {
        usedAt: `${event.data.usedDate}T${event.data.usedTime}:00+07:00`,
        vehicleNumber: event.data.vehicleNumber,
        driver: event.data.driver,
        destination: event.data.destination,
        user: event.data.user,
        requester: event.data.requester
      }
    })
    toast.add({ title: 'Pemakaian kendaraan berhasil ditambahkan', color: 'success' })
    formOpen.value = false
    resetForm()
    await fetchUsages()
  } catch (error) {
    toast.add({ title: 'Gagal menambahkan pemakaian kendaraan', description: apiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Export ───────────────────────────────────────────────────────────────────
const exportMonthItems = Array.from({ length: 12 }, (_, i) => ({
  label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2020, i, 1)),
  value: i + 1
}))
const yearItems = Array.from({ length: 7 }, (_, i) => {
  const year = new Date().getFullYear() - 3 + i
  return { label: String(year), value: year }
})

function doExport() {
  const ok = exportMode.value === 'month'
    ? exportOperationalVehicleUsagesExcel(sortedUsages.value, exportMonth.value, exportYear.value)
    : exportOperationalVehicleUsagesExcel(sortedUsages.value)
  if (!ok) toast.add({ title: 'Tidak ada data untuk diekspor', color: 'warning' })
  else exportOpen.value = false
}

const presets: { value: DatePreset, label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
  { value: 'all', label: 'Semua' }
]

const GRID_CLASS = 'lg:grid lg:grid-cols-[5.5rem_minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(9rem,1.2fr)_6.5rem_5.5rem] lg:items-center lg:gap-3'
</script>

<template>
  <UDashboardPanel id="operasional-pemakaian-kendaraan">
    <template #header>
      <UDashboardNavbar title="Catatan Pemakaian Mobil Operasional">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Export"
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            @click="exportOpen = true"
          />
          <UButton
            label="Tambah Data"
            icon="i-lucide-plus"
            color="primary"
            @click="formOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- KPI -->
      <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium uppercase tracking-wide text-muted">Total</span>
            <UIcon name="i-lucide-clipboard-list" class="size-4 text-muted" aria-hidden="true" />
          </div>
          <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">
            <DashboardCountUp :value="stats.total" />
          </p>
          <p class="mt-1 text-xs text-muted">
            Catatan sesuai filter
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium uppercase tracking-wide text-muted">Terjadwal</span>
            <UIcon name="i-lucide-circle-check" class="size-4 text-success" aria-hidden="true" />
          </div>
          <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">
            <DashboardCountUp :value="stats.scheduled" />
          </p>
          <p class="mt-1 text-xs text-muted">
            Pemakaian berlaku
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium uppercase tracking-wide text-muted">Batal</span>
            <UIcon
              name="i-lucide-ban"
              class="size-4"
              :class="stats.cancelled > 0 ? 'text-error' : 'text-muted'"
              aria-hidden="true"
            />
          </div>
          <p class="mt-2 text-2xl font-bold tabular-nums" :class="stats.cancelled > 0 ? 'text-error' : 'text-highlighted'">
            <DashboardCountUp :value="stats.cancelled" />
          </p>
          <p class="mt-1 text-xs text-muted">
            Dibatalkan
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium uppercase tracking-wide text-muted">Kendaraan</span>
            <UIcon name="i-lucide-car-front" class="size-4 text-muted" aria-hidden="true" />
          </div>
          <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">
            <DashboardCountUp :value="stats.vehicles" />
          </p>
          <p class="mt-1 text-xs text-muted">
            Unit terpakai
          </p>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <UInput
          v-model="searchQuery"
          class="w-full sm:max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari driver, tujuan, user, atau requester..."
        />
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Semua Status', value: 'all' },
            { label: 'Terjadwal', value: 'active' },
            { label: 'Batal', value: 'cancelled' }
          ]"
          class="min-w-36"
        />
        <div class="inline-flex rounded-lg border border-default bg-elevated/30 p-0.5" role="group" aria-label="Filter periode">
          <button
            v-for="preset in presets"
            :key="preset.value"
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="datePreset === preset.value
              ? 'bg-primary text-inverted shadow-sm'
              : 'text-muted hover:text-highlighted'"
            :aria-pressed="datePreset === preset.value"
            @click="choosePreset(preset.value)"
          >
            {{ preset.label }}
          </button>
        </div>
        <UPopover v-model:open="rangeOpen">
          <UButton
            :icon="datePreset === 'custom' ? 'i-lucide-calendar-check' : 'i-lucide-calendar-range'"
            color="neutral"
            :variant="datePreset === 'custom' ? 'soft' : 'outline'"
            class="min-w-44 justify-start font-normal"
            @click="openCustomRange"
          >
            {{ rangeLabel }}
          </UButton>
          <template #content>
            <div class="flex flex-col gap-3 p-2 sm:flex-row">
              <div>
                <p class="px-2 pb-1 text-xs font-medium text-muted">
                  Dari tanggal
                </p>
                <CalendarPicker v-model="rangeStartCal" />
              </div>
              <div>
                <p class="px-2 pb-1 text-xs font-medium text-muted">
                  Sampai tanggal
                </p>
                <CalendarPicker v-model="rangeEndCal" :min-date="rangeStartCal" />
              </div>
            </div>
            <div class="flex justify-end border-t border-default px-3 py-2">
              <UButton
                label="Terapkan"
                size="sm"
                color="primary"
                :disabled="!rangeStartCal"
                @click="rangeOpen = false"
              />
            </div>
          </template>
        </UPopover>
        <UButton
          v-if="hasActiveFilters"
          label="Reset"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="resetFilters"
        />
      </div>

      <!-- Memuat -->
      <div v-if="loading" class="space-y-3">
        <USkeleton v-for="i in 6" :key="`sk-${i}`" class="h-14 w-full rounded-lg" />
      </div>

      <!-- Kosong -->
      <div v-else-if="!sortedUsages.length" class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default py-14 text-muted">
        <UIcon name="i-lucide-car-front" class="size-10 opacity-40" aria-hidden="true" />
        <p class="text-sm">
          Belum ada data pemakaian kendaraan
        </p>
        <UButton
          v-if="hasActiveFilters"
          label="Reset filter"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="resetFilters"
        />
      </div>

      <!-- Log per hari -->
      <div v-else class="space-y-5">
        <!-- Header kolom (desktop) -->
        <div
          class="hidden border-b border-default px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted lg:grid lg:grid-cols-[5.5rem_minmax(8rem,1fr)_minmax(11rem,1.5fr)_minmax(9rem,1.2fr)_6.5rem_5.5rem] lg:gap-3"
        >
          <template v-for="col in headerCols" :key="col.key || 'actions'">
            <button
              v-if="col.sortable"
              type="button"
              class="inline-flex items-center gap-1.5 text-left uppercase tracking-wide transition-colors hover:text-primary"
              @click="toggleSort(col.key)"
            >
              <span>{{ col.label }}</span>
              <UIcon :name="sortIcon(col.key)" class="size-3.5" aria-hidden="true" />
            </button>
            <div v-else>
              {{ col.label }}
            </div>
          </template>
        </div>

        <section v-for="group in groupedPaged" :key="group.key">
          <!-- Header hari -->
          <div class="sticky top-0 z-10 flex items-center gap-2 rounded-md bg-default/95 px-2 py-2 backdrop-blur">
            <span class="text-sm font-semibold text-highlighted">{{ group.label }}</span>
            <UBadge
              v-if="group.isToday"
              label="Hari Ini"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <span class="ml-auto text-xs text-muted">{{ group.items.length }} pemakaian</span>
            <span v-if="group.cancelled" class="text-xs text-error">· {{ group.cancelled }} batal</span>
          </div>

          <div class="mt-1 divide-y divide-default rounded-xl border border-default">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="cursor-pointer px-4 py-3 transition-colors hover:bg-elevated/40 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              :class="[GRID_CLASS, item.status === 'BATAL' ? 'opacity-75' : '']"
              role="button"
              tabindex="0"
              :aria-label="`Lihat detail pemakaian ${item.vehicleNumber} oleh ${item.driver}`"
              @click="openDetail(item)"
              @keydown.enter.prevent="openDetail(item)"
              @keydown.space.prevent="openDetail(item)"
            >
              <!-- Waktu + kendaraan -->
              <div class="flex flex-wrap items-center gap-2 lg:contents">
                <span class="font-mono text-sm font-semibold tabular-nums text-highlighted">{{ formatTimeWib(item.usedAt) }}</span>
                <OperasionalVehiclePlate :vehicle-number="item.vehicleNumber" size="sm" />
              </div>

              <!-- Perjalanan -->
              <div class="mt-2 min-w-0 lg:mt-0">
                <p class="truncate text-sm font-medium text-highlighted">
                  {{ item.driver }}
                </p>
                <p class="flex items-center gap-1 truncate text-xs text-muted">
                  <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" aria-hidden="true" />
                  {{ item.destination }}
                </p>
              </div>

              <!-- Pengguna -->
              <div class="mt-2 min-w-0 lg:mt-0">
                <p class="truncate text-sm text-highlighted">
                  {{ item.user }}
                </p>
                <p class="truncate text-xs text-muted">
                  Req: {{ item.requester }}
                </p>
              </div>

              <!-- Status + aksi -->
              <div class="mt-3 flex items-center justify-between gap-2 lg:contents">
                <div>
                  <UBadge :color="item.status === 'BATAL' ? 'error' : 'success'" variant="subtle" size="sm">
                    {{ item.status === 'BATAL' ? 'Batal' : 'Terjadwal' }}
                  </UBadge>
                </div>
                <div class="flex items-center justify-end gap-1.5">
                  <UButton
                    v-if="item.status !== 'BATAL'"
                    label="Batalkan"
                    icon="i-lucide-ban"
                    color="error"
                    variant="soft"
                    size="xs"
                    :loading="cancelling === item.id"
                    @click.stop="confirmCancel(item)"
                  />
                  <UDropdownMenu :items="rowMenuItems(item)">
                    <UButton
                      icon="i-lucide-more-horizontal"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :aria-label="`Aksi lain untuk pemakaian ${item.vehicleNumber}`"
                      @click.stop
                    />
                  </UDropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Paginasi -->
      <div class="mt-4 flex items-center justify-between gap-3 border-t border-default pt-4">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            {{ sortedUsages.length }} pemakaian
          </div>
          <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
            class="w-20"
            aria-label="Jumlah baris per halaman"
          />
        </div>
        <UPagination
          :key="`pagination-${pagination.pageSize}`"
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="sortedUsages.length"
          @update:page="(page: number) => pagination.pageIndex = page - 1"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Drawer detail -->
  <OperasionalUsageDetailDrawer
    v-model:open="detailOpen"
    :usage="detailUsage"
    @cancel="confirmCancel"
  />

  <!-- Modal Tambah -->
  <UModal v-model:open="formOpen" title="Tambah Pemakaian Kendaraan" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="submit"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Tanggal" name="usedDate" required>
            <UPopover>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!dateCal && 'text-muted'"
              >
                {{ dateCal ? formatDisplay(dateCal) : 'Pilih tanggal' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="dateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Jam" name="usedTime" required>
            <UInput v-model="state.usedTime" type="time" class="w-full" />
          </UFormField>
          <UFormField label="No. Polisi" name="vehicleNumber" required>
            <USelect v-model="state.vehicleNumber" :items="vehicleItems" class="w-full" />
          </UFormField>
          <UFormField label="Driver" name="driver" required>
            <UInput v-model="state.driver" class="w-full" />
          </UFormField>
          <UFormField label="Destination" name="destination" required>
            <UInput v-model="state.destination" class="w-full" />
          </UFormField>
          <UFormField label="User" name="user" required>
            <UInput v-model="state.user" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Requester" name="requester" required>
          <UInput v-model="state.requester" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="formOpen = false"
          />
          <UButton
            type="submit"
            label="Simpan"
            color="primary"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <!-- Modal Export -->
  <UModal v-model:open="exportOpen" title="Export Excel" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Export mengikuti filter yang aktif ({{ sortedUsages.length }} catatan).
        </p>
        <UFormField label="Periode">
          <USelect v-model="exportMode" :items="[{ label: 'Sesuai filter', value: 'all' }, { label: 'Bulan tertentu', value: 'month' }]" class="w-full" />
        </UFormField>
        <div v-if="exportMode === 'month'" class="grid grid-cols-2 gap-3">
          <UFormField label="Bulan">
            <USelect v-model="exportMonth" :items="exportMonthItems" class="w-full" />
          </UFormField>
          <UFormField label="Tahun">
            <USelect v-model="exportYear" :items="yearItems" class="w-full" />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="exportOpen = false"
        />
        <UButton
          label="Export Excel"
          icon="i-lucide-file-spreadsheet"
          color="primary"
          @click="doExport"
        />
      </div>
    </template>
  </UModal>
</template>
