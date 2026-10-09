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

function formatNumber(value: number) {
  return value.toLocaleString('id-ID')
}

const ariaLabel = computed(() =>
  `${props.totalLabel}: ${props.data.map(d => `${d.label} ${pct(d.value)}%`).join(', ')}`
)

// ── Tooltip interaktif ──────────────────────────────────────────────────────
const barRef = ref<HTMLElement | null>(null)
const hovered = ref<{ datum: DashboardChartDatum, x: number, y: number } | null>(null)

function onSegmentMove(e: MouseEvent, datum: DashboardChartDatum) {
  const el = barRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  hovered.value = { datum, x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onBarLeave() {
  hovered.value = null
}
</script>

<template>
  <div class="space-y-4 py-1">
    <div class="flex justify-between text-xs text-muted">
      <span>{{ totalLabel }}</span>
      <span>{{ formatNumber(total) }} total</span>
    </div>

    <div ref="barRef" class="relative" @mouseleave="onBarLeave">
      <div class="flex h-5 w-full overflow-hidden rounded-full" role="img" :aria-label="ariaLabel">
        <div
          v-for="d in data"
          :key="d.label"
          class="h-full cursor-pointer transition-all duration-700 first:rounded-l-full last:rounded-r-full hover:brightness-110"
          :style="{ width: `${pct(d.value)}%`, backgroundColor: d.color }"
          @mousemove="onSegmentMove($event, d)"
        />
      </div>

      <Transition name="split-tt" :duration="120">
        <div
          v-if="hovered"
          class="pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-white/95 px-2.5 py-2 text-xs shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900/95 dark:ring-zinc-700"
          :style="{
            left: `${hovered.x}px`,
            top: `${hovered.y}px`,
            transform: 'translate(-50%, calc(-100% - 8px))'
          }"
        >
          <div class="flex items-center gap-1.5 font-semibold text-highlighted">
            <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: hovered.datum.color }" />
            {{ hovered.datum.label }}
          </div>
          <div class="mt-1 flex items-baseline gap-1.5 text-muted">
            <span class="font-bold tabular-nums text-highlighted">{{ formatNumber(hovered.datum.value) }}</span>
            <span>{{ unit }}</span>
            <span>·</span>
            <span class="tabular-nums">{{ pct(hovered.datum.value) }}% dari {{ formatNumber(total) }}</span>
          </div>
        </div>
      </Transition>
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

<style scoped>
.split-tt-enter-active,
.split-tt-leave-active {
  transition: opacity 0.12s ease;
}
.split-tt-enter-from,
.split-tt-leave-to {
  opacity: 0;
}
</style>
