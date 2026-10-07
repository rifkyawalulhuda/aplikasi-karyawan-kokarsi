<script setup lang="ts">
import { VisDonut, VisDonutSelectors, VisSingleContainer, VisTooltip } from '@unovis/vue'
import type { DashboardChartDatum } from '~/types/dashboard'

const props = withDefaults(defineProps<{
  data: DashboardChartDatum[]
  height?: number
  arcWidth?: number
  unit?: string
  centerSubLabel?: string
  showLegend?: boolean
}>(), {
  height: 148,
  arcWidth: 24,
  unit: 'orang',
  centerSubLabel: 'Total',
  showLegend: true
})

const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0))

function pct(value: number) {
  return total.value > 0 ? Math.round((value / total.value) * 100) : 0
}

const valueAccessor = (d: DashboardChartDatum) => d.value
const colorAccessor = (d: DashboardChartDatum) => d.color

const triggers = computed(() => ({
  [VisDonutSelectors.segment]: (d: DashboardChartDatum) =>
    `<div style="font-weight:600">${d.label}</div><div>${d.value} ${props.unit} (${pct(d.value)}%)</div>`
}))

const ariaLabel = computed(() =>
  `Diagram lingkaran: ${props.data.map(d => `${d.label} ${d.value}`).join(', ')}`
)
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <ClientOnly>
      <div class="w-full" role="img" :aria-label="ariaLabel">
        <VisSingleContainer :data="data" :height="height">
          <VisDonut
            :value="valueAccessor"
            :color="colorAccessor"
            :arc-width="arcWidth"
            :central-label="String(total)"
            :central-sub-label="centerSubLabel"
          />
          <VisTooltip :triggers="triggers" />
        </VisSingleContainer>
      </div>

      <template #fallback>
        <div class="flex items-center justify-center" :style="{ height: `${height}px` }">
          <div class="size-24 animate-pulse rounded-full bg-accented" />
        </div>
      </template>
    </ClientOnly>

    <div v-if="showLegend" class="w-full space-y-1.5">
      <div v-for="d in data" :key="d.label" class="flex items-center justify-between text-sm">
        <div class="flex min-w-0 items-center gap-2">
          <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: d.color }" />
          <span class="truncate text-muted">{{ d.label }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="font-semibold tabular-nums text-highlighted">{{ d.value }}</span>
          <span class="text-xs tabular-nums text-muted">({{ pct(d.value) }}%)</span>
        </div>
      </div>
    </div>
  </div>
</template>
