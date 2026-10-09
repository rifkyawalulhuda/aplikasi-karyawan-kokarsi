<script setup lang="ts">
import type { EngagementTask } from '~/types/dashboard'
import { DASHBOARD_WIDGET_MAP } from './registry'

const widget = DASHBOARD_WIDGET_MAP.tasks!
const { engagement, pending } = useDashboardEngagement()

// Skeleton sampai mount supaya SSR & hydration identik (fetch lazy).
const mounted = useMounted()
const isLoading = computed(() => pending.value || !mounted.value)

const tasks = computed(() => engagement.value?.tasks ?? [])
const announcements = computed(() => engagement.value?.announcements ?? [])

const priorityMeta: Record<string, { label: string, class: string }> = {
  URGENT: { label: 'Urgent', class: 'bg-red-500/10 text-red-500' },
  HIGH: { label: 'High', class: 'bg-orange-500/10 text-orange-500' },
  MEDIUM: { label: 'Medium', class: 'bg-amber-500/10 text-amber-500' },
  LOW: { label: 'Low', class: 'bg-sky-500/10 text-sky-500' },
  NONE: { label: '—', class: 'bg-elevated text-muted' }
}

function priorityLabel(priority: string) {
  return priorityMeta[priority]?.label ?? priority
}

function priorityClass(priority: string) {
  return priorityMeta[priority]?.class ?? 'bg-elevated text-muted'
}

function dueLabel(task: EngagementTask) {
  if (!task.dueDate) return null
  const due = new Date(task.dueDate)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays < 0) return { text: `Lewat ${Math.abs(diffDays)} hari`, class: 'text-red-500' }
  if (diffDays === 0) return { text: 'Hari ini', class: 'text-amber-500' }
  if (diffDays === 1) return { text: 'Besok', class: 'text-amber-500' }
  return {
    text: due.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    class: 'text-muted'
  }
}
</script>

<template>
  <DashboardWidgetShell :widget="widget" :body-ui="'p-0'">
    <template #badge>
      <span
        v-if="tasks.length > 0"
        class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
      >{{ tasks.length }} tugas</span>
    </template>

    <div class="max-h-80 space-y-4 overflow-y-auto p-4">
      <div v-if="isLoading" class="space-y-2">
        <div v-for="i in 3" :key="`task-skel-${i}`" class="h-10 animate-pulse rounded bg-accented" />
      </div>

      <template v-else>
        <!-- Tugas -->
        <div v-if="tasks.length === 0" class="flex flex-col items-center gap-2 py-6 text-muted">
          <UIcon name="i-lucide-list-checks" class="size-8 opacity-40" />
          <p class="text-sm">
            Tidak ada tugas yang ditugaskan ke Anda
          </p>
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="rounded-lg border border-default p-3 transition-colors hover:bg-elevated/40"
          >
            <div class="flex items-start justify-between gap-2">
              <NuxtLink
                :to="`/spaces/${task.spaceId}`"
                class="min-w-0 flex-1 text-sm font-medium text-highlighted hover:text-primary"
              >{{ task.title }}</NuxtLink>
              <span
                :class="['shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', priorityClass(task.priority)]"
              >{{ priorityLabel(task.priority) }}</span>
            </div>
            <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-kanban" class="size-3" />
                {{ task.spaceName }} · {{ task.columnName }}
              </span>
              <span v-if="dueLabel(task)" :class="dueLabel(task)?.class" class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-calendar-clock" class="size-3" />
                {{ dueLabel(task)?.text }}
              </span>
            </div>
          </li>
        </ul>

        <!-- Pengumuman -->
        <div v-if="announcements.length > 0" class="border-t border-default pt-3">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Pengumuman Tim
          </p>
          <ul class="space-y-2">
            <li
              v-for="ann in announcements"
              :key="ann.id"
              class="rounded-lg bg-elevated/40 p-3"
            >
              <p class="line-clamp-3 text-sm text-highlighted">
                {{ ann.content }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ ann.createdByName }} · {{ ann.spaceName }} ·
                {{ new Date(ann.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
              </p>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </DashboardWidgetShell>
</template>
