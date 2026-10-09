<script setup lang="ts">
import { DASHBOARD_WIDGET_MAP } from './registry'

const widget = DASHBOARD_WIDGET_MAP.activity!
const { engagement, pending } = useDashboardEngagement()

// Skeleton sampai mount supaya SSR & hydration identik (fetch lazy).
const mounted = useMounted()
const isLoading = computed(() => pending.value || !mounted.value)

const activity = computed(() => engagement.value?.activity ?? [])

const actionMeta: Record<string, { icon: string, class: string }> = {
  CREATE: { icon: 'i-lucide-plus', class: 'bg-green-500/10 text-green-500' },
  UPDATE: { icon: 'i-lucide-pencil', class: 'bg-blue-500/10 text-blue-500' },
  DELETE: { icon: 'i-lucide-trash-2', class: 'bg-red-500/10 text-red-500' },
  LOGIN: { icon: 'i-lucide-log-in', class: 'bg-slate-500/10 text-slate-500' },
  LOGOUT: { icon: 'i-lucide-log-out', class: 'bg-slate-500/10 text-slate-500' }
}

function actionIcon(action: string) {
  return actionMeta[action]?.icon ?? 'i-lucide-activity'
}

function actionClass(action: string) {
  return actionMeta[action]?.class ?? 'bg-elevated text-muted'
}

const now = useNow({ interval: 60000 })

function relativeTime(ts: string) {
  const diff = now.value.getTime() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <DashboardWidgetShell :widget="widget" :body-ui="'p-0'">
    <template #badge>
      <span class="inline-flex items-center rounded-full bg-elevated px-2 py-0.5 text-xs font-medium text-muted">
        ADMIN
      </span>
    </template>

    <div class="max-h-80 overflow-y-auto p-4">
      <div v-if="isLoading" class="space-y-2">
        <div v-for="i in 4" :key="`act-skel-${i}`" class="h-9 animate-pulse rounded bg-accented" />
      </div>

      <div v-else-if="activity.length === 0" class="flex flex-col items-center gap-2 py-8 text-muted">
        <UIcon name="i-lucide-history" class="size-8 opacity-40" />
        <p class="text-sm">
          Belum ada aktivitas tercatat
        </p>
      </div>

      <ol v-else class="relative space-y-3">
        <li v-for="(item, i) in activity" :key="item.id" class="flex gap-3">
          <div class="flex flex-col items-center">
            <span :class="['flex size-7 shrink-0 items-center justify-center rounded-full', actionClass(item.action)]">
              <UIcon :name="actionIcon(item.action)" class="size-3.5" />
            </span>
            <span v-if="i < activity.length - 1" class="mt-1 w-px flex-1 bg-default" />
          </div>
          <div class="min-w-0 flex-1 pb-1">
            <p class="truncate text-sm text-highlighted">
              {{ item.targetLabel }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ item.performedBy }} · {{ item.module }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ relativeTime(item.timestamp) }}
            </p>
          </div>
        </li>
      </ol>

      <div class="mt-3 border-t border-default pt-3 text-right">
        <UButton
          label="Lihat semua log"
          icon="i-lucide-arrow-right"
          color="neutral"
          variant="ghost"
          size="xs"
          to="/settings/activity-log"
          trailing-icon
        />
      </div>
    </div>
  </DashboardWidgetShell>
</template>
