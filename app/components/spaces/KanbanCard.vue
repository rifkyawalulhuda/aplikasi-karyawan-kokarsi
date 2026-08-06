<script setup lang="ts">
import type { SpaceCard, CardPriority } from '~/types/space'

const props = defineProps<{
  card: SpaceCard
  spaceId: number
}>()

const emit = defineEmits<{
  click: [card: SpaceCard]
}>()

const PRIORITY_CONFIG: Record<CardPriority, { label: string; color: string; icon: string }> = {
  NONE: { label: '', color: '', icon: '' },
  LOW: { label: 'Low', color: 'text-blue-500', icon: 'i-lucide-arrow-down' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-500', icon: 'i-lucide-minus' },
  HIGH: { label: 'High', color: 'text-orange-500', icon: 'i-lucide-arrow-up' },
  URGENT: { label: 'Urgent', color: 'text-red-500', icon: 'i-lucide-alert-circle' },
}

const LABEL_COLORS = [
  'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800', 'bg-red-200 text-red-800',
  'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800',
]

function labelColor(label: string): string {
  const idx = label.charCodeAt(0) % LABEL_COLORS.length
  return LABEL_COLORS[idx]
}

const checklistProgress = computed(() => {
  if (!props.card.checklists?.length) return null
  const total = props.card.checklists.length
  const done = props.card.checklists.filter(c => c.checked).length
  return { total, done, pct: Math.round((done / total) * 100) }
})

const isDueSoon = computed(() => {
  if (!props.card.dueDate) return false
  const due = new Date(props.card.dueDate)
  const now = new Date()
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 2 && diff >= 0
})

const isOverdue = computed(() => {
  if (!props.card.dueDate) return false
  return new Date(props.card.dueDate) < new Date()
})

const priority = computed(() => PRIORITY_CONFIG[props.card.priority])
</script>

<template>
  <div
    class="group relative cursor-pointer rounded-lg border border-default bg-default p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    :class="card.coverColor ? `border-l-4 border-l-${card.coverColor}-400` : ''"
    @click="emit('click', card)"
  >
    <!-- Labels -->
    <div v-if="card.labels?.length" class="mb-2 flex flex-wrap gap-1">
      <span
        v-for="label in card.labels"
        :key="label"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="labelColor(label)"
      >{{ label }}</span>
    </div>

    <!-- Title -->
    <p class="text-sm font-medium text-highlighted leading-snug">{{ card.title }}</p>

    <!-- Meta row -->
    <div class="mt-2.5 flex flex-wrap items-center gap-2">
      <!-- Priority -->
      <div v-if="priority.icon" class="flex items-center gap-0.5">
        <UIcon :name="priority.icon" class="size-3" :class="priority.color" />
      </div>

      <!-- Due date -->
      <div
        v-if="card.dueDate"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
        :class="isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : isDueSoon ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          : 'text-muted'"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ new Date(card.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
      </div>

      <!-- Checklist progress -->
      <div v-if="checklistProgress" class="flex items-center gap-1 text-[10px] text-muted">
        <UIcon name="i-lucide-check-square" class="size-3" />
        {{ checklistProgress.done }}/{{ checklistProgress.total }}
      </div>

      <!-- Comment count -->
      <div v-if="(card._count?.comments ?? 0) > 0" class="flex items-center gap-1 text-[10px] text-muted">
        <UIcon name="i-lucide-message-circle" class="size-3" />
        {{ card._count?.comments }}
      </div>

      <!-- Attachment count -->
      <div v-if="(card._count?.attachments ?? 0) > 0" class="flex items-center gap-1 text-[10px] text-muted">
        <UIcon name="i-lucide-paperclip" class="size-3" />
        {{ card._count?.attachments }}
      </div>

      <!-- Assignee avatars -->
      <div v-if="card.assigneeIds?.length" class="ml-auto flex -space-x-1.5">
        <div
          v-for="id in card.assigneeIds.slice(0, 3)"
          :key="id"
          class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary ring-1 ring-white dark:ring-default"
        >
          {{ id }}
        </div>
        <div v-if="card.assigneeIds.length > 3" class="flex size-5 items-center justify-center rounded-full bg-elevated text-[9px] text-muted ring-1 ring-white dark:ring-default">
          +{{ card.assigneeIds.length - 3 }}
        </div>
      </div>
    </div>

    <!-- Checklist progress bar -->
    <div v-if="checklistProgress && checklistProgress.total > 0" class="mt-2">
      <div class="h-1 w-full rounded-full bg-elevated">
        <div
          class="h-1 rounded-full bg-primary transition-all"
          :class="checklistProgress.pct === 100 ? 'bg-green-500' : 'bg-primary'"
          :style="`width: ${checklistProgress.pct}%`"
        />
      </div>
    </div>
  </div>
</template>
