<script setup lang="ts">
import type { Component } from 'vue'
import type { DashboardStats } from '~/types/dashboard'
import { DASHBOARD_WIDGET_MAP } from './registry'
import ActivityFeedWidget from './ActivityFeedWidget.vue'
import AttentionWidget from './AttentionWidget.vue'
import BirthdayWidget from './BirthdayWidget.vue'
import DemographicsWidget from './DemographicsWidget.vue'
import DistributionWidget from './DistributionWidget.vue'
import EducationDeptWidget from './EducationDeptWidget.vue'
import KpiWidget from './KpiWidget.vue'
import MonthlyTrendWidget from './MonthlyTrendWidget.vue'
import MyTasksWidget from './MyTasksWidget.vue'
import QuickActionsWidget from './QuickActionsWidget.vue'
import TrendWidget from './TrendWidget.vue'
import VehicleWidget from './VehicleWidget.vue'

const props = defineProps<{
  stats?: DashboardStats | null
  loading?: boolean
}>()

const auth = useAuthStore()
const { order, visibleWidgets, editing } = useDashboardLayout()

const COMPONENTS: Record<string, Component> = {
  kpi: KpiWidget,
  attention: AttentionWidget,
  vehicle: VehicleWidget,
  birthdays: BirthdayWidget,
  tasks: MyTasksWidget,
  activity: ActivityFeedWidget,
  distribution: DistributionWidget,
  demographics: DemographicsWidget,
  education: EducationDeptWidget,
  trend: TrendWidget,
  monthlyTrend: MonthlyTrendWidget,
  quick: QuickActionsWidget
}

/** Widget yang menerima data statistik; sisanya tidak (agar tidak jadi atribut liar). */
const DATA_WIDGETS = new Set(['kpi', 'attention', 'vehicle', 'distribution', 'demographics', 'education', 'trend'])

function isAllowed(id: string) {
  const def = DASHBOARD_WIDGET_MAP[id]
  if (!def) return false
  if (def.adminOnly && !auth.canManageMasterData) return false
  return true
}

const renderedWidgets = computed(() =>
  (editing.value ? order.value : visibleWidgets.value).filter(isAllowed)
)

function widgetProps(id: string) {
  return DATA_WIDGETS.has(id) ? { stats: props.stats, loading: props.loading } : {}
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-6">
    <component
      :is="COMPONENTS[id]"
      v-for="id in renderedWidgets"
      :key="id"
      v-bind="widgetProps(id)"
    />
  </div>
</template>
