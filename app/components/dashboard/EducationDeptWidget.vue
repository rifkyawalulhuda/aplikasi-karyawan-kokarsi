<script setup lang="ts">
import type { DashboardStats } from '~/types/dashboard'
import { DASHBOARD_CARD_UI, DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.education!

const educationColors = ['bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500']
const departmentColors = ['bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500']

const educationItems = computed(() => {
  const e = props.stats?.byEducation
  return [
    { label: 'SMA', value: e?.sma ?? 0 },
    { label: 'D3', value: e?.d3 ?? 0 },
    { label: 'S1', value: e?.s1 ?? 0 },
    { label: 'S2', value: e?.s2 ?? 0 }
  ].filter(x => x.value > 0)
})

const departmentItems = computed(() =>
  [...(props.stats?.byDepartment ?? [])]
    .sort((a, b) => b.count - a.count)
    .map(d => ({ label: d.name, value: d.count, to: `/karyawan?department=${encodeURIComponent(d.name)}` }))
)
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
      <!-- Pendidikan Terakhir -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-graduation-cap" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Pendidikan Terakhir</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="`edu-skel-${i}`" class="space-y-2">
            <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
            <div class="h-2 animate-pulse rounded-full bg-accented" />
          </div>
        </div>
        <DashboardBarList
          v-else
          :items="educationItems"
          :colors="educationColors"
          width-mode="max"
          :show-percent="false"
        />
      </UCard>

      <!-- Departemen -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
            <span class="text-sm font-semibold text-highlighted">Departemen</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="`dept-skel-${i}`" class="space-y-2">
            <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
            <div class="h-2 animate-pulse rounded-full bg-accented" />
          </div>
        </div>
        <DashboardBarList
          v-else
          :items="departmentItems"
          :colors="departmentColors"
          :total="stats?.total ?? 0"
          width-mode="max"
        />
      </UCard>
    </div>
  </DashboardWidgetShell>
</template>
