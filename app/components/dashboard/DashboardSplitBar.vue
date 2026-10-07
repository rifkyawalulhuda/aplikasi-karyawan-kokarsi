<script setup lang="ts">
import type { DashboardChartDatum } from '~/types/dashboard'

const props = withDefaults(defineProps<{
  data: DashboardChartDatum[]
  totalLabel?: string
  unit?: string
}>(), {
  totalLabel: 'Total',
  unit: 'orang'
})

const total = computed(() => props.data.reduce((sum, d) => sum + d.value, 0))

function pct(value: number) {
  return total.value > 0 ? Math.round((value / total.value) * 100) : 0
}

const ariaLabel = computed(() =>
  `${props.totalLabel}: ${props.data.map(d => `${d.label} ${pct(d.value)}%`).join(', ')}`
)
</script>

<template>
  <div class="space-y-4 py-1">
    <div class="flex justify-between text-xs text-muted">
      <span>{{ totalLabel }}</span>
      <span>{{ total }} total</span>
    </div>

    <div class="flex h-5 w-full overflow-hidden rounded-full" role="img" :aria-label="ariaLabel">
      <div
        v-for="d in data"
        :key="d.label"
        class="h-full transition-all duration-700 first:rounded-l-full last:rounded-r-full"
        :style="{ width: `${pct(d.value)}%`, backgroundColor: d.color }"
        :title="`${d.label}: ${d.value} ${unit} (${pct(d.value)}%)`"
      />
    </div>

    <div class="space-y-2">
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
