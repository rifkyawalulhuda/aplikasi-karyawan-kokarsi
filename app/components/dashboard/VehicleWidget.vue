<script setup lang="ts">
import type { DashboardStats, VehicleUsageItem } from '~/types/dashboard'
import { DASHBOARD_CARD_UI, DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.vehicle!
const vehiclePeriod = ref<'today' | 'nextSevenDays'>('today')

function jamWib(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value))
}

function tanggalWib(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long'
  }).format(new Date(value))
}

function dateKeyWib(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const activeVehiclePeriod = computed(() => props.stats?.vehicleUsage?.[vehiclePeriod.value] ?? {
  total: 0,
  active: 0,
  cancelled: 0,
  items: [] as VehicleUsageItem[]
})

const groupedVehicleSchedule = computed(() => {
  const groups: { key: string, label: string, isToday: boolean, items: VehicleUsageItem[] }[] = []
  for (const item of activeVehiclePeriod.value.items) {
    const key = dateKeyWib(item.usedAt)
    let group = groups.find(existing => existing.key === key)
    if (!group) {
      group = {
        key,
        label: tanggalWib(item.usedAt),
        isToday: vehiclePeriod.value === 'nextSevenDays' && key === dateKeyWib(new Date().toISOString()),
        items: []
      }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
})

function vehicleBarWidth(count: number) {
  const counts = props.stats?.vehicleUsage?.vehicleCounts ?? []
  const max = Math.max(...counts.map(c => c.count), 1)
  return `${Math.round((count / max) * 100)}%`
}

const periodLabel = computed(() => vehiclePeriod.value === 'today' ? 'Hari Ini' : '7 Hari')
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <template #badge>
      <span
        v-if="!loading && activeVehiclePeriod.total > 0"
        class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
      >{{ activeVehiclePeriod.total }} {{ vehiclePeriod === 'today' ? 'hari ini' : '7 hari' }}</span>
    </template>

    <template #actions>
      <div class="inline-flex rounded-lg border border-default bg-elevated/30 p-0.5" role="tablist" aria-label="Periode pemakaian kendaraan">
        <button
          type="button"
          role="tab"
          :aria-selected="vehiclePeriod === 'today'"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            vehiclePeriod === 'today' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-highlighted'
          ]"
          @click="vehiclePeriod = 'today'"
        >
          Hari Ini
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="vehiclePeriod === 'nextSevenDays'"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            vehiclePeriod === 'nextSevenDays' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-highlighted'
          ]"
          @click="vehiclePeriod = 'nextSevenDays'"
        >
          7 Hari
        </button>
      </div>
    </template>

    <!-- KPI periode -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <template v-if="loading">
        <UCard v-for="i in 3" :key="`veh-skel-${i}`" :ui="DASHBOARD_CARD_UI">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
              <div class="h-8 w-1/2 animate-pulse rounded bg-accented" />
              <div class="h-3 w-3/4 animate-pulse rounded bg-accented" />
            </div>
            <div class="size-10 shrink-0 animate-pulse rounded-xl bg-accented" />
          </div>
        </UCard>
      </template>
      <template v-else>
        <UCard class="hover:ring-1 hover:ring-default" :ui="DASHBOARD_CARD_UI">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-xs font-medium uppercase tracking-wide text-muted">
                Pemakaian {{ periodLabel }}
              </p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-highlighted sm:text-3xl">
                <DashboardCountUp :value="activeVehiclePeriod.total" />
              </p>
              <p class="mt-1 truncate text-xs text-muted">
                Seluruh catatan periode
              </p>
            </div>
            <div class="shrink-0 rounded-xl bg-primary/10 p-2.5 ring ring-inset ring-primary/20">
              <UIcon name="i-lucide-calendar-clock" class="size-5 text-primary" />
            </div>
          </div>
        </UCard>
        <UCard class="hover:ring-1 hover:ring-default" :ui="DASHBOARD_CARD_UI">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-xs font-medium uppercase tracking-wide text-muted">
                Terjadwal {{ periodLabel }}
              </p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-highlighted sm:text-3xl">
                <DashboardCountUp :value="activeVehiclePeriod.active" />
              </p>
              <p class="mt-1 truncate text-xs text-muted">
                Pemakaian yang masih berlaku
              </p>
            </div>
            <div class="shrink-0 rounded-xl bg-green-500/10 p-2.5 ring ring-inset ring-green-500/20">
              <UIcon name="i-lucide-circle-check" class="size-5 text-green-500" />
            </div>
          </div>
        </UCard>
        <UCard class="hover:ring-1 hover:ring-default" :ui="DASHBOARD_CARD_UI">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-xs font-medium uppercase tracking-wide text-muted">
                Batal {{ periodLabel }}
              </p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-highlighted sm:text-3xl">
                <DashboardCountUp :value="activeVehiclePeriod.cancelled" />
              </p>
              <p class="mt-1 truncate text-xs text-muted">
                Pemakaian yang dibatalkan
              </p>
            </div>
            <div class="shrink-0 rounded-xl bg-red-500/10 p-2.5 ring ring-inset ring-red-500/20">
              <UIcon name="i-lucide-ban" class="size-5 text-red-500" />
            </div>
          </div>
        </UCard>
      </template>
    </div>

    <!-- Jadwal + distribusi -->
    <div class="mt-4 grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
      <UCard class="xl:col-span-2" :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-list-ordered" class="size-4 text-primary" />
              <span class="text-sm font-semibold text-highlighted">Jadwal Pemakaian {{ vehiclePeriod === 'today' ? 'Hari Ini' : '7 Hari ke Depan' }}</span>
            </div>
            <UBadge variant="subtle" color="neutral" size="sm">
              {{ activeVehiclePeriod.total }} jadwal
            </UBadge>
          </div>
        </template>

        <template v-if="loading">
          <div class="space-y-3">
            <div v-for="i in 3" :key="`veh-row-skel-${i}`" class="h-10 animate-pulse rounded bg-accented" />
          </div>
        </template>
        <template v-else-if="!activeVehiclePeriod.items.length">
          <div class="flex flex-col items-center gap-2 py-8 text-muted">
            <UIcon name="i-lucide-car-front" class="size-8 opacity-40" />
            <p class="text-sm">
              Tidak ada pemakaian kendaraan {{ vehiclePeriod === 'today' ? 'hari ini' : 'dalam 7 hari ke depan' }}
            </p>
          </div>
        </template>
        <template v-else>
          <div class="max-h-96 space-y-4 overflow-y-auto pr-1">
            <div v-for="group in groupedVehicleSchedule" :key="group.key">
              <div class="sticky top-0 z-10 mb-1 flex items-center gap-2 bg-default/95 py-1.5 backdrop-blur-sm">
                <span class="text-xs font-semibold text-highlighted">{{ group.label }}</span>
                <UBadge
                  v-if="group.isToday"
                  label="Hari Ini"
                  color="primary"
                  variant="subtle"
                  size="xs"
                />
                <span class="text-xs text-muted">{{ group.items.length }} jadwal</span>
              </div>
              <div class="divide-y divide-default rounded-lg border border-default/70 px-3">
                <div v-for="item in group.items" :key="item.id" class="flex items-center gap-3 py-2.5">
                  <span class="w-12 shrink-0 text-sm font-semibold tabular-nums text-highlighted">{{ jamWib(item.usedAt) }}</span>
                  <div class="min-w-0 flex-1">
                    <OperasionalVehiclePlate :vehicle-number="item.vehicleNumber" size="sm" />
                    <p class="mt-1 truncate text-xs text-muted">
                      {{ item.driver }} · {{ item.destination }}
                    </p>
                  </div>
                  <UBadge
                    :label="item.status === 'BATAL' ? 'Batal' : 'Terjadwal'"
                    :color="item.status === 'BATAL' ? 'error' : 'success'"
                    variant="subtle"
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              label="Lihat Semua Pemakaian"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="subtle"
              to="/operasional/pemakaian-kendaraan"
              trailing-icon
            />
          </div>
        </template>
      </UCard>

      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-truck" class="size-4 text-primary" />
            <span class="text-sm font-semibold text-highlighted">Pemakaian per Kendaraan</span>
          </div>
        </template>

        <template v-if="loading">
          <div class="space-y-4">
            <div v-for="i in 2" :key="`veh-count-skel-${i}`" class="space-y-2">
              <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
              <div class="h-1.5 animate-pulse rounded-full bg-accented" />
            </div>
          </div>
        </template>
        <template v-else-if="!(stats?.vehicleUsage?.vehicleCounts?.length)">
          <p class="py-6 text-center text-sm text-muted">
            Belum ada data pemakaian
          </p>
        </template>
        <template v-else>
          <div class="space-y-4 py-1">
            <div v-for="vc in stats?.vehicleUsage?.vehicleCounts ?? []" :key="vc.vehicleNumber" class="space-y-1.5">
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate font-medium text-highlighted">{{ vc.vehicleNumber }}</span>
                <span class="shrink-0 tabular-nums text-muted">{{ vc.count }}×</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-accented">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-500"
                  :style="{ width: vehicleBarWidth(vc.count) }"
                />
              </div>
            </div>
            <p class="text-xs text-muted">
              Total pemakaian bulan ini
            </p>
          </div>
        </template>
      </UCard>
    </div>
  </DashboardWidgetShell>
</template>
