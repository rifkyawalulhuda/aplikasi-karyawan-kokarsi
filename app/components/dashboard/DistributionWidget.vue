<script setup lang="ts">
import type { DashboardChartDatum, DashboardStats } from '~/types/dashboard'
import { DASHBOARD_CARD_UI, DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.distribution!

const statusDonut = computed<DashboardChartDatum[]>(() => [
  { label: 'Aktif', value: props.stats?.aktif ?? 0, color: '#22c55e' },
  { label: 'Kontrak Expired', value: props.stats?.kontrakExpired ?? 0, color: '#f59e0b' },
  { label: 'Resign', value: props.stats?.resign ?? 0, color: '#64748b' },
  { label: 'PHK', value: props.stats?.phk ?? 0, color: '#f43f5e' }
])

const locationColors = ['bg-primary', 'bg-blue-400', 'bg-cyan-500', 'bg-indigo-500']
const levelColors = ['bg-violet-500', 'bg-purple-400', 'bg-fuchsia-500', 'bg-pink-500']

const siteItems = computed(() => (props.stats?.byLocation ?? []).map(l => ({
  label: l.name,
  value: l.count,
  to: `/karyawan?site=${encodeURIComponent(l.name)}`
})))
const levelItems = computed(() => (props.stats?.byLevel ?? []).map(l => ({ label: l.name, value: l.count })))
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-6">
      <!-- Status Karyawan -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-pie-chart" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Status Karyawan</span>
          </div>
        </template>
        <div v-if="loading" class="flex items-center justify-center py-10">
          <div class="size-24 animate-pulse rounded-full bg-accented" />
        </div>
        <DashboardDonut v-else :data="statusDonut" />
      </UCard>

      <!-- Distribusi Site -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-map-pin" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Site</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="`site-skel-${i}`" class="space-y-2">
            <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
            <div class="h-2 animate-pulse rounded-full bg-accented" />
          </div>
        </div>
        <DashboardBarList
          v-else
          :items="siteItems"
          :colors="locationColors"
          :total="stats?.total ?? 0"
          width-mode="total"
          empty-text="Belum ada data"
        />
      </UCard>

      <!-- Distribusi Level Jabatan -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-2" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Level Jabatan</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="`level-skel-${i}`" class="space-y-2">
            <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
            <div class="h-2 animate-pulse rounded-full bg-accented" />
          </div>
        </div>
        <DashboardBarList
          v-else
          :items="levelItems"
          :colors="levelColors"
          :total="stats?.total ?? 0"
          width-mode="total"
          empty-text="Belum ada data"
        />
      </UCard>
    </div>
  </DashboardWidgetShell>
</template>
