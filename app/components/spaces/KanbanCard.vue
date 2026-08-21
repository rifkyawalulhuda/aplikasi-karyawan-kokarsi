<script setup lang="ts">
import type { SpaceCard, CardPriority } from '~/types/space'

const props = defineProps<{
  card: SpaceCard
  spaceId: number
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{
  click: [card: SpaceCard]
}>()

// ── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<CardPriority, { label: string; icon: string; pillClass: string }> = {
  NONE: { label: '', icon: '', pillClass: '' },
  LOW: {
    label: 'Low',
    icon: 'i-lucide-arrow-down',
    pillClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  MEDIUM: {
    label: 'Medium',
    icon: 'i-lucide-minus',
    pillClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  HIGH: {
    label: 'High',
    icon: 'i-lucide-arrow-up',
    pillClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
  URGENT: {
    label: 'Urgent',
    icon: 'i-lucide-alert-circle',
    pillClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
}

const priority = computed(() => PRIORITY_CONFIG[props.card.priority])

// ── Labels ───────────────────────────────────────────────────────────────────
const LABEL_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
]

function labelColor(label: string): string {
  const idx = label.charCodeAt(0) % LABEL_COLORS.length
  return LABEL_COLORS[idx] ?? LABEL_COLORS[0]!
}

// ── Cover color ──────────────────────────────────────────────────────────────
const COVER_COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6', sky: '#0ea5e9', teal: '#14b8a6', green: '#22c55e',
  yellow: '#f59e0b', orange: '#f97316', red: '#ef4444', pink: '#ec4899',
  purple: '#a855f7', indigo: '#6366f1', gray: '#9ca3af', slate: '#64748b',
}

const coverColorStyle = computed(() => {
  if (!props.card.coverColor) return ''
  return { background: COVER_COLOR_MAP[props.card.coverColor] ?? COVER_COLOR_MAP.blue }
})

// ── Checklist ────────────────────────────────────────────────────────────────
const checklistProgress = computed(() => {
  if (!props.card.checklists?.length) return null
  const total = props.card.checklists.length
  const done = props.card.checklists.filter(c => c.checked).length
  return { total, done, pct: Math.round((done / total) * 100) }
})

// ── Due date ─────────────────────────────────────────────────────────────────
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

// ── Description preview (opsi B: hanya jika tidak ada metadata lain) ─────────
const showDescription = computed(() => {
  if (!props.card.description) return false
  if (props.card.labels?.length) return false
  if (props.card.dueDate) return false
  if (checklistProgress.value?.total) return false
  return true
})

// ── Assignee ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/25 dark:text-pink-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/25 dark:text-teal-200',
]

function assigneeColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
}

function assigneeName(id: number): string {
  const name = props.memberMap?.[id]
  if (!name) return `U${id}`
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
</script>

<template>
  <div
    class="group relative cursor-pointer overflow-hidden rounded-lg border border-default bg-default p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-black/8 hover:ring-1 hover:ring-primary/15"
    @click="emit('click', card)"
  >
    <!-- Cover color bar -->
    <div
      v-if="coverColorStyle"
      class="absolute inset-x-0 top-0 h-1"
      :style="coverColorStyle"
    />

    <!-- Labels + priority row -->
    <div class="mb-2 flex flex-wrap items-center gap-1.5">
      <!-- Priority pill -->
      <span
        v-if="priority.pillClass"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        :class="priority.pillClass"
      >
        <UIcon :name="priority.icon" class="size-2.5" />
        {{ priority.label }}
      </span>

      <!-- Labels -->
      <span
        v-for="label in card.labels ?? []"
        :key="label"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="labelColor(label)"
      >{{ label }}</span>
    </div>

    <!-- Title -->
    <p class="text-sm font-semibold text-highlighted leading-snug">{{ card.title }}</p>

    <!-- Description preview (hanya jika tidak ada metadata lain) -->
    <p
      v-if="showDescription"
      class="mt-1 line-clamp-2 text-xs leading-5 text-muted"
    >{{ card.description }}</p>

    <!-- Checklist progress inline with counter -->
    <div v-if="checklistProgress && checklistProgress.total > 0" class="mt-2.5 flex items-center gap-2">
      <div class="h-1 flex-1 rounded-full bg-elevated">
        <div
          class="h-1 rounded-full transition-all duration-300"
          :class="checklistProgress.pct === 100 ? 'bg-green-500' : 'bg-primary'"
          :style="`width:${checklistProgress.pct}%`"
        />
      </div>
      <span class="shrink-0 text-[10px] font-medium text-muted">
        {{ checklistProgress.done }}/{{ checklistProgress.total }}
      </span>
    </div>

    <!-- Meta row: due, counts + assignees -->
    <div class="mt-2.5 flex flex-wrap items-center gap-2.5">
      <!-- Overdue pulsing -->
      <div
        v-if="isOverdue"
        class="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"
      >
        <span class="relative flex size-1.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span class="relative inline-flex size-1.5 rounded-full bg-red-500" />
        </span>
        {{ new Date(card.dueDate!).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
      </div>

      <!-- Due soon -->
      <div
        v-else-if="card.dueDate"
        class="flex items-center gap-1 text-[10px] font-medium"
        :class="isDueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted'"
      >
        <UIcon name="i-lucide-calendar" class="size-3" />
        {{ new Date(card.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
      </div>

      <!-- Comment count -->
      <div
        v-if="(card._count?.comments ?? 0) > 0"
        class="flex items-center gap-1 text-[10px] text-muted"
      >
        <UIcon name="i-lucide-message-circle" class="size-3" />
        {{ card._count?.comments }}
      </div>

      <!-- Attachment count -->
      <div
        v-if="(card._count?.attachments ?? 0) > 0"
        class="flex items-center gap-1 text-[10px] text-muted"
      >
        <UIcon name="i-lucide-paperclip" class="size-3" />
        {{ card._count?.attachments }}
      </div>

      <!-- Assignee avatars (kanan) -->
      <div v-if="card.assigneeIds?.length" class="ml-auto flex -space-x-1.5">
        <div
          v-for="id in card.assigneeIds.slice(0, 3)"
          :key="id"
          class="flex size-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-white dark:ring-default"
          :class="assigneeColor(id)"
          :title="memberMap?.[id] ?? `User ${id}`"
        >{{ assigneeName(id) }}</div>
        <div
          v-if="card.assigneeIds.length > 3"
          class="flex size-5 items-center justify-center rounded-full bg-elevated text-[9px] font-bold text-muted ring-1 ring-white dark:ring-default"
        >+{{ card.assigneeIds.length - 3 }}</div>
      </div>
    </div>
  </div>
</template>