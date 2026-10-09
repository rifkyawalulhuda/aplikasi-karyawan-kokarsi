<script setup lang="ts">
import type { SpaceCard } from '~/types/space'
import { avatarColor, colorClass, formatDateShort, initials, isDueSoon, isOverdue, priorityConfig } from './board-meta'

const props = defineProps<{
  card: SpaceCard
  memberMap?: Record<number, string>
  columnName: string
  columnColor: string
}>()

const emit = defineEmits<{ click: [card: SpaceCard] }>()

const priority = computed(() => priorityConfig(props.card.priority))
const overdue = computed(() => isOverdue(props.card))
const dueSoon = computed(() => !overdue.value && isDueSoon(props.card))

const assignees = computed(() =>
  props.card.assigneeIds.map(id => ({
    id,
    name: props.memberMap?.[id],
    color: avatarColor(id),
    initials: initials(props.memberMap?.[id], id)
  }))
)

const checklistProgress = computed(() => {
  const items = props.card.checklists
  if (!items?.length) return null
  const done = items.filter(c => c.checked).length
  return `${done}/${items.length}`
})
</script>

<template>
  <div
    class="cursor-pointer border-b border-default px-4 py-3 transition-colors hover:bg-elevated/40 md:grid md:grid-cols-[1fr_130px_100px_120px_120px_70px] md:items-center md:gap-2 md:py-2.5"
    role="button"
    tabindex="0"
    @click="emit('click', card)"
    @keydown.enter="emit('click', card)"
  >
    <!-- Judul + label -->
    <div class="min-w-0">
      <p class="truncate text-sm font-medium text-highlighted">
        {{ card.title }}
      </p>
      <div v-if="card.labels?.length" class="mt-1 flex flex-wrap gap-1">
        <span
          v-for="label in card.labels.slice(0, 3)"
          :key="label"
          class="rounded-full bg-elevated px-1.5 text-[10px] text-muted"
        >{{ label }}</span>
      </div>
    </div>

    <!-- Baris meta (mobile): status, prioritas, due, assignee -->
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs md:contents">
      <!-- Status / kolom -->
      <div class="flex items-center gap-1.5">
        <div class="size-2 shrink-0 rounded-full" :class="colorClass(columnColor)" />
        <span class="truncate text-muted">{{ columnName }}</span>
      </div>

      <!-- Prioritas -->
      <div>
        <span
          v-if="priority.pillClass"
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          :class="priority.pillClass"
        >{{ priority.label }}</span>
        <span v-else class="text-xs text-muted">—</span>
      </div>

      <!-- Due -->
      <div>
        <span
          v-if="card.dueDate"
          class="text-xs font-medium"
          :class="overdue ? 'text-red-600 dark:text-red-400' : dueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted'"
        >{{ formatDateShort(card.dueDate) }}</span>
        <span v-else class="text-xs text-muted">—</span>
      </div>

      <!-- Assignee -->
      <div class="flex -space-x-1.5">
        <span
          v-for="a in assignees.slice(0, 4)"
          :key="a.id"
          class="flex size-6 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-white dark:ring-default"
          :class="a.color"
          :title="a.name ?? `User ${a.id}`"
        >{{ a.initials }}</span>
        <span
          v-if="assignees.length > 4"
          class="flex size-6 items-center justify-center rounded-full bg-elevated text-[9px] font-bold text-muted ring-1 ring-white dark:ring-default"
        >+{{ assignees.length - 4 }}</span>
        <span v-if="!assignees.length" class="text-xs text-muted">—</span>
      </div>

      <!-- Info -->
      <div class="flex items-center gap-2 text-[10px] text-muted">
        <span v-if="(card._count?.comments ?? 0) > 0" class="flex items-center gap-0.5">
          <UIcon name="i-lucide-message-circle" class="size-3" aria-hidden="true" />{{ card._count?.comments }}
        </span>
        <span v-if="checklistProgress" class="flex items-center gap-0.5">
          <UIcon name="i-lucide-check-square" class="size-3" aria-hidden="true" />{{ checklistProgress }}
        </span>
      </div>
    </div>
  </div>
</template>
