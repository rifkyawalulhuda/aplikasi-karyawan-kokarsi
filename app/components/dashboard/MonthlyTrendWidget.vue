<script setup lang="ts">
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import type { MonthlyTrendPoint, TrendComparison } from '~/types/dashboard'
import { DASHBOARD_WIDGET_MAP } from './registry'

const widget = DASHBOARD_WIDGET_MAP.monthlyTrend!

const months = ref(12)
const { trends, pending } = useDashboardTrends(months)

const mounted = useMounted()
const isLoading = computed(() => pending.value || !mounted.value)

const series = computed<MonthlyTrendPoint[]>(() => trends.value?.series ?? [])
const comparison = computed(() => trends.value?.comparison ?? null)

const xAccessor = (_d: MonthlyTrendPoint, i: number) => i
const yRecruitment = (d: MonthlyTrendPoint) => d.recruitment
const yOffboarding = (d: MonthlyTrendPoint) => d.resign + d.phk

const maxValue = computed(() => Math.max(...series.value.map(d => Math.max(d.recruitment, d.resign + d.phk)), 1))

const step = computed(() => (months.value <= 6 ? 1 : 2))
const tickValues = computed(() =>
  series.value.map((_, i) => i).filter(i => i % step.value === 0)
)
const tickFormat = (tick: number | Date) => series.value[Number(tick)]?.label ?? ''

const tooltip = (d: MonthlyTrendPoint) =>
  `<div style="font-weight:600">${d.label}</div><div>Rekrutmen: ${d.recruitment}</div><div>Offboarding: ${d.resign + d.phk}</div>`

const periodLabel = computed(() => `${months.value} bulan terakhir`)

function deltaMeta(c: TrendComparison | undefined) {
  if (!c || c.deltaPct === null) return { text: '—', class: 'text-muted', icon: 'i-lucide-minus' }
  if (c.deltaPct > 0) return { text: `+${c.deltaPct}%`, class: 'text-green-500', icon: 'i-lucide-trending-up' }
  if (c.deltaPct < 0) return { text: `${c.deltaPct}%`, class: 'text-red-500', icon: 'i-lucide-trending-down' }
  return { text: '0%', class: 'text-muted', icon: 'i-lucide-minus' }
}

const cards = computed(() => [
  {
    key: 'recruitment',
    label: 'Rekrutmen',
    icon: 'i-lucide-user-plus',
    data: comparison.value?.recruitment
  },
  {
    key: 'offboarding',
    label: 'Offboarding',
    icon: 'i-lucide-user-minus',
    data: comparison.value?.offboarding
  },
  {
    key: 'vehicleUsage',
    label: 'Pemakaian Kendaraan',
    icon: 'i-lucide-car-front',
    data: comparison.value?.vehicleUsage
  }
])
</script>

<template>
  <DashboardWidgetShell :widget="widget" :body-ui="'p-4 sm:p-5'">
    <template #actions>
      <div class="inline-flex rounded-lg border border-default bg-elevated/30 p-0.5" role="tablist" aria-label="Rentang periode tren">
        <button
          v-for="option in [6, 12]"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="months === option"
          :class="[
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            months === option ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-highlighted'
          ]"
          @click="months = option"
        >
          {{ option }} Bln
        </button>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- Perbandingan periode -->
      <div class="space-y-3">
        <p class="text-xs text-muted">
          Dibanding {{ months }} bulan sebelumnya
        </p>
        <div
          v-for="card in cards"
          :key="card.key"
          class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
        >
          <div class="flex min-w-0 items-center gap-2">
            <UIcon :name="card.icon" class="size-4 shrink-0 text-muted" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ card.label }}
              </p>
              <p class="text-xs text-muted">
                {{ card.data?.current ?? 0 }} <span class="text-dimmed">vs {{ card.data?.previous ?? 0 }}</span>
              </p>
            </div>
          </div>
          <span :class="['inline-flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums', deltaMeta(card.data).class]">
            <UIcon :name="deltaMeta(card.data).icon" class="size-4" />
            {{ deltaMeta(card.data).text }}
          </span>
        </div>
      </div>

      <!-- Grafik tren -->
      <div class="lg:col-span-2">
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-xs text-muted">{{ periodLabel }}</span>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 text-xs">
              <span class="size-2 shrink-0 rounded-full bg-blue-500" />
              <span class="text-muted">Rekrutmen</span>
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs">
              <span class="size-2 shrink-0 rounded-full bg-rose-500" />
              <span class="text-muted">Offboarding</span>
            </span>
          </div>
        </div>

        <div v-if="isLoading" class="h-52 animate-pulse rounded bg-accented" />
        <p v-else-if="series.length === 0" class="py-16 text-center text-sm text-muted">
          Belum ada data
        </p>
        <ClientOnly v-else>
          <VisXYContainer
            :data="series"
            :height="210"
            :y-domain="[0, maxValue]"
            :margin="{ top: 8, right: 8, bottom: 4, left: 4 }"
          >
            <VisLine
              :x="xAccessor"
              :y="yRecruitment"
              color="#3b82f6"
              :line-width="2"
            />
            <VisLine
              :x="xAccessor"
              :y="yOffboarding"
              color="#f43f5e"
              :line-width="2"
            />
            <VisAxis
              type="x"
              :tick-values="tickValues"
              :tick-format="tickFormat"
              :grid-line="false"
            />
            <VisAxis type="y" :num-ticks="4" :grid-line="true" />
            <VisCrosshair :template="tooltip" :color="() => '#3b82f6'" />
            <VisTooltip class-name="dashboard-chart-tooltip" />
          </VisXYContainer>

          <template #fallback>
            <div class="h-52 animate-pulse rounded bg-accented" />
          </template>
        </ClientOnly>
      </div>
    </div>
  </DashboardWidgetShell>
</template>
