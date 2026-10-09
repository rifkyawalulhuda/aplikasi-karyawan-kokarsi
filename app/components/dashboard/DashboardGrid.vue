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
const { order, visibleWidgets, editing, setOrder } = useDashboardLayout()

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

// ── Drag & drop ─────────────────────────────────────────────────────────────
const gridRef = ref<HTMLElement | null>(null)

// Urutan transien: dimutasi selama drag; layout asli hanya ditulis saat drop.
const transientOrder = ref<string[]>([...order.value])
watch(order, (value) => {
  if (!drag.isDragging.value && !drag.grabbedId.value) transientOrder.value = [...value]
})

const flip = useFlip()

function gridWidgetEls(): HTMLElement[] {
  if (!gridRef.value) return []
  return [...gridRef.value.querySelectorAll<HTMLElement>('[data-widget-id]')]
}

/** Terapkan urutan baru + animasi FLIP. */
function applyOrder(ids: string[]) {
  const before = flip.first(gridWidgetEls())
  transientOrder.value = ids
  nextTick(() => flip.play(before, gridWidgetEls()))
}

const announceMsg = ref('')

const drag = useDashboardDrag({
  container: gridRef,
  order: transientOrder,
  isEnabled: editing,
  reorder: applyOrder,
  onDrop(id) {
    const next = transientOrder.value
    const changed = next.length !== order.value.length || next.some((x, i) => x !== order.value[i])
    if (!changed) return
    setOrder(next)
    const idx = next.indexOf(id)
    const title = DASHBOARD_WIDGET_MAP[id]?.title ?? id
    announceMsg.value = `${title} dipindah ke posisi ${idx + 1} dari ${next.length}.`
  },
  announce(message) {
    announceMsg.value = message
  }
})

provide(DASHBOARD_DRAG_KEY, drag)

const renderedWidgets = computed(() =>
  (editing.value ? transientOrder.value : visibleWidgets.value).filter(isAllowed)
)

function widgetProps(id: string) {
  return DATA_WIDGETS.has(id) ? { stats: props.stats, loading: props.loading } : {}
}
</script>

<template>
  <div>
    <div
      ref="gridRef"
      class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-6"
    >
      <component
        :is="COMPONENTS[id]"
        v-for="id in renderedWidgets"
        :key="id"
        v-bind="widgetProps(id)"
      />
    </div>

    <p class="sr-only" role="status" aria-live="polite">
      {{ announceMsg }}
    </p>
  </div>
</template>
