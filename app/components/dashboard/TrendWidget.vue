<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import type { DashboardStats } from '~/types/dashboard'
import { DASHBOARD_CARD_UI, DASHBOARD_WIDGET_MAP } from './registry'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const widget = DASHBOARD_WIDGET_MAP.trend!

interface RecruitmentDatum { year: number, count: number }
interface OffboardingDatum { year: number, resign: number, phk: number }

const recruitment = computed<RecruitmentDatum[]>(() => props.stats?.recruitmentTrend ?? [])
const offboarding = computed<OffboardingDatum[]>(() => props.stats?.offboardingTrend ?? [])

const recruitmentMax = computed(() => Math.max(...recruitment.value.map(d => d.count), 1))
const offboardingMax = computed(() => Math.max(...offboarding.value.map(d => Math.max(d.resign, d.phk)), 1))

const xRecruit = (d: RecruitmentDatum) => d.year
const yRecruit = (d: RecruitmentDatum) => d.count
const xOffboard = (d: OffboardingDatum) => d.year
const yResign = (d: OffboardingDatum) => d.resign
const yPhk = (d: OffboardingDatum) => d.phk

const fmtYear = (t: number | Date) => String(t)

const recruitmentTooltip = (d: RecruitmentDatum) =>
  `<div style="font-weight:600">${d.year}</div><div>${d.count} rekrutmen</div>`

const offboardingTooltip = (d: OffboardingDatum) =>
  `<div style="font-weight:600">${d.year}</div><div>Resign: ${d.resign}</div><div>PHK: ${d.phk}</div>`

const recruitmentTicks = computed(() => recruitment.value.map(d => d.year))
const offboardingTicks = computed(() => offboarding.value.map(d => d.year))
</script>

<template>
  <DashboardWidgetShell :widget="widget" variant="bare">
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
      <!-- Trend Rekrutmen -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-trending-up" class="size-4 text-blue-500" />
            <span class="text-sm font-semibold text-highlighted">Trend Rekrutmen per Tahun</span>
          </div>
        </template>

        <div v-if="loading" class="h-44 animate-pulse rounded bg-accented" />
        <p v-else-if="recruitment.length === 0" class="py-10 text-center text-sm text-muted">
          Belum ada data
        </p>
        <ClientOnly v-else>
          <VisXYContainer
            :data="recruitment"
            :height="180"
            :y-domain="[0, recruitmentMax]"
            :margin="{ top: 8, right: 8, bottom: 4, left: 4 }"
          >
            <VisArea
              :x="xRecruit"
              :y="yRecruit"
              color="#3b82f6"
              :opacity="0.14"
              :line-width="2"
            />
            <VisAxis
              type="x"
              :tick-values="recruitmentTicks"
              :tick-format="fmtYear"
              :grid-line="false"
            />
            <VisAxis type="y" :num-ticks="4" :grid-line="true" />
            <VisCrosshair :template="recruitmentTooltip" color="#3b82f6" />
            <VisTooltip />
          </VisXYContainer>

          <template #fallback>
            <div class="h-44 animate-pulse rounded bg-accented" />
          </template>
        </ClientOnly>
      </UCard>

      <!-- Trend Offboarding -->
      <UCard :ui="DASHBOARD_CARD_UI">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-trending-down" class="size-4 text-rose-500" />
            <span class="text-sm font-semibold text-highlighted">Trend Offboarding per Tahun</span>
          </div>
        </template>

        <div v-if="loading" class="h-44 animate-pulse rounded bg-accented" />
        <p v-else-if="offboarding.length === 0" class="py-10 text-center text-sm text-muted">
          Belum ada data
        </p>
        <ClientOnly v-else>
          <VisXYContainer
            :data="offboarding"
            :height="180"
            :y-domain="[0, offboardingMax]"
            :margin="{ top: 8, right: 8, bottom: 4, left: 4 }"
          >
            <VisLine
              :x="xOffboard"
              :y="yResign"
              color="#94a3b8"
              :line-width="2"
            />
            <VisLine
              :x="xOffboard"
              :y="yPhk"
              color="#f43f5e"
              :line-width="2"
            />
            <VisAxis
              type="x"
              :tick-values="offboardingTicks"
              :tick-format="fmtYear"
              :grid-line="false"
            />
            <VisAxis type="y" :num-ticks="4" :grid-line="true" />
            <VisCrosshair :template="offboardingTooltip" :color="() => '#f43f5e'" />
            <VisTooltip />
          </VisXYContainer>

          <template #fallback>
            <div class="h-44 animate-pulse rounded bg-accented" />
          </template>
        </ClientOnly>

        <div class="mt-2 flex gap-4">
          <div class="flex items-center gap-1.5 text-xs">
            <span class="size-2 shrink-0 rounded-full bg-slate-400" />
            <span class="text-muted">Resign</span>
          </div>
          <div class="flex items-center gap-1.5 text-xs">
            <span class="size-2 shrink-0 rounded-full bg-rose-500" />
            <span class="text-muted">PHK</span>
          </div>
        </div>
      </UCard>
    </div>
  </DashboardWidgetShell>
</template>
