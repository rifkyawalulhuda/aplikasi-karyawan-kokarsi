<script setup lang="ts">
import type { DashboardChartDatum, DashboardStats } from '~/types/dashboard'
import { DASHBOARD_CARD_UI, DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.demographics!

const spDonut = computed<DashboardChartDatum[]>(() => {
  const d = props.stats?.bySp
  return [
    { label: 'SP 1', value: d?.sp1 ?? 0, color: '#f59e0b' },
    { label: 'SP 2', value: d?.sp2 ?? 0, color: '#ef4444' },
    { label: 'SP 3', value: d?.sp3 ?? 0, color: '#7f1d1d' }
  ]
})

const spEmpty = computed(() => spDonut.value.every(d => d.value === 0))

const contractFamily = computed<DashboardChartDatum[]>(() => {
  const d = props.stats?.byContractFamily
  return [
    { label: 'PKWT', value: d?.pkwt ?? 0, color: '#3b82f6' },
    { label: 'MITRA', value: d?.mitra ?? 0, color: '#8b5cf6' }
  ]
})

const gender = computed<DashboardChartDatum[]>(() => {
  const g = props.stats?.byGender
  return [
    { label: 'Laki-laki', value: g?.male ?? 0, color: '#3b82f6' },
    { label: 'Perempuan', value: g?.female ?? 0, color: '#ec4899' }
  ]
})
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-6">
      <!-- Surat Peringatan -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="size-4 text-amber-500" />
            <span class="text-sm font-semibold text-highlighted">Surat Peringatan</span>
          </div>
        </template>
        <div v-if="loading" class="flex items-center justify-center py-10">
          <div class="size-24 animate-pulse rounded-full bg-accented" />
        </div>
        <p v-else-if="spEmpty" class="py-6 text-center text-sm text-muted">
          Tidak ada data
        </p>
        <DashboardDonut v-else :data="spDonut" />
      </UCard>

      <!-- Distribusi Kontrak -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="size-4 text-primary" />
            <span class="text-sm font-semibold text-highlighted">Distribusi Kontrak</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3 py-2">
          <div class="h-5 animate-pulse rounded-full bg-accented" />
          <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
        </div>
        <DashboardSplitBar v-else :data="contractFamily" total-label="Tipe Kontrak" />
      </UCard>

      <!-- Distribusi Gender -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="size-4 text-pink-500" />
            <span class="text-sm font-semibold text-highlighted">Distribusi Gender</span>
          </div>
        </template>
        <div v-if="loading" class="space-y-3 py-2">
          <div class="h-5 animate-pulse rounded-full bg-accented" />
          <div class="h-3 w-2/3 animate-pulse rounded bg-accented" />
        </div>
        <DashboardSplitBar v-else :data="gender" total-label="Gender" />
      </UCard>
    </div>
  </DashboardWidgetShell>
</template>
