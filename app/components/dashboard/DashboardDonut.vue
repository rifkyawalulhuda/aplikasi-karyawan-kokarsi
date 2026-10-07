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

function formatNumber(value: number) {
  return value.toLocaleString('id-ID')
}

/** Cegah label (mis. nama departemen) merusak markup tooltip. */
function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const valueAccessor = (d: DashboardChartDatum) => d.value
const colorAccessor = (d: DashboardChartDatum) => d.color

/**
 * Datum yang terikat pada tiap segmen donut adalah objek ARC dari Unovis —
 * datum aslinya tersimpan di properti `data`. Mengakses `arc.label` langsung
 * menghasilkan `undefined` (inilah bug tooltip "Undefined").
 */
interface DonutArcDatum {
  data?: DashboardChartDatum
  value?: number
}

/**
 * Tooltip informatif: titik warna + label, nilai + satuan, dan porsi terhadap
 * total. Mewarisi warna teks dari Unovis (`currentColor`) agar ikut tema;
 * garis sekunder cukup diredupkan dengan `opacity`.
 */
function tooltipTemplate(arc: DonutArcDatum): string | null {
  const d = arc?.data
  if (!d) return null
  const share = pct(d.value)
  return `
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;line-height:1.2">
      <span style="flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:${d.color}"></span>
      <span>${escapeHtml(d.label)}</span>
    </div>
    <div style="margin-top:4px;display:flex;align-items:baseline;gap:5px;font-size:12px;line-height:1.2">
      <span style="font-weight:700;font-variant-numeric:tabular-nums">${formatNumber(d.value)}</span>
      <span style="opacity:.7">${escapeHtml(props.unit)}</span>
      <span style="opacity:.7">·</span>
      <span style="opacity:.7;font-variant-numeric:tabular-nums">${share}% dari ${formatNumber(total.value)}</span>
    </div>
  `
}

const triggers = computed(() => ({
  [VisDonutSelectors.segment]: (arc: DonutArcDatum) => tooltipTemplate(arc)
}))

const ariaLabel = computed(() =>
  `Diagram lingkaran: ${props.data.map(d => `${d.label} ${d.value} ${props.unit} (${pct(d.value)}%)`).join(', ')}`
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
          <VisTooltip class-name="dashboard-chart-tooltip" :triggers="triggers" />
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
