<script setup lang="ts">
import type { SpaceCard } from '~/types/space'

const props = defineProps<{
  card: SpaceCard
  memberMap?: Record<number, string>
  columnName: string
  columnColor: string
}>()

const emit = defineEmits<{ click: [card: SpaceCard] }>()

const PRIORITY_CONFIG: Record<string, { label: string; pillClass: string }> = {
  NONE: { label: '—', pillClass: 'text-muted' },
  LOW: { label: 'Low', pillClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  MEDIUM: { label: 'Medium', pillClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  HIGH: { label: 'High', pillClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  URGENT: { label: 'Urgent', pillClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const COLUMN_COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500', indigo: 'bg-indigo-500',
  slate: 'bg-slate-500',
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700', 'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700',
]

function assigneeColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length] }

function assigneeName(id: number): string {
  const name = props.memberMap?.[id]
  if (!name) return `U${id}`
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const isOverdue = computed(() => props.card.dueDate ? new Date(props.card.dueDate) < new Date() : false)
const isDueSoon = computed(() => {
  if (!props.card.dueDate) return false
  const diff = (new Date(props.card.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 2
})

const priority = computed(() => PRIORITY_CONFIG[props.card.priority] ?? { label: '—', pillClass: '' })

const checklistProgress = computed(() => {
  if (!props.card.checklists?.length) return null
  const done = props.card.checklists.filter(c => c.checked).length
  return `${done}/${props.card.checklists.length}`
})
</script>

<template>
  <div
    class="grid cursor-pointer grid-cols-[1fr_120px_100px_130px_120px_60px] items-center gap-2 border-b border-default px-4 py-2.5 text-sm hover:bg-elevated/40 transition-colors"
    @click="emit('click', card)"
  >
    <!-- Title + labels -->
    <div class="min-w-0">
      <p class="truncate font-medium text-highlighted">{{ card.title }}</p>
      <div v-if="card.labels?.length" class="mt-0.5 flex flex-wrap gap-1">
        <span
          v-for="label in card.labels.slice(0, 3)"
          :key="label"
          class="rounded-full px-1.5 py-0 text-[10px] bg-elevated text-muted"
        >{{ label }}</span>
      </div>
    </div>

    <!-- Status/column -->
    <div class="flex items-center gap-1.5">
      <div class="size-2 shrink-0 rounded-full" :class="COLUMN_COLOR_MAP[columnColor] ?? 'bg-gray-400'" />
      <span class="truncate text-xs text-muted">{{ columnName }}</span>
    </div>

    <!-- Priority -->
    <div>
      <span
        v-if="priority.label !== '—'"
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        :class="priority.pillClass"
      >{{ priority.label }}</span>
      <span v-else class="text-muted text-xs">—</span>
    </div>

    <!-- Due date -->
    <div>
      <span
        v-if="card.dueDate"
        class="text-xs font-medium"
        :class="isOverdue ? 'text-red-600 dark:text-red-400' : isDueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted'"
      >
        {{ new Date(card.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
      </span>
      <span v-else class="text-muted text-xs">—</span>
    </div>

    <!-- Assignees -->
    <div class="flex -space-x-1.5">
      <div
        v-for="id in card.assigneeIds.slice(0, 4)"
        :key="id"
        class="flex size-6 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-white dark:ring-default"
        :class="assigneeColor(id)"
        :title="memberMap?.[id] ?? `User ${id}`"
      >{{ assigneeName(id) }}</div>
      <div
        v-if="card.assigneeIds.length > 4"
        class="flex size-6 items-center justify-center rounded-full bg-elevated text-[9px] font-bold text-muted ring-1 ring-white dark:ring-default"
      >+{{ card.assigneeIds.length - 4 }}</div>
      <span v-if="!card.assigneeIds.length" class="text-muted text-xs">—</span>
    </div>

    <!-- Meta counts -->
    <div class="flex items-center gap-2 text-[10px] text-muted">
      <span v-if="(card._count?.comments ?? 0) > 0" class="flex items-center gap-0.5">
        <UIcon name="i-lucide-message-circle" class="size-3" />{{ card._count?.comments }}
      </span>
      <span v-if="checklistProgress" class="flex items-center gap-0.5">
        <UIcon name="i-lucide-check-square" class="size-3" />{{ checklistProgress }}
      </span>
    </div>
  </div>
</template>
