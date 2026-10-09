<script setup lang="ts">
import type { SpaceCard } from '~/types/space'
import { BOARD_DND_KEY } from '~/composables/useBoardDnd'
import {
  avatarColor, colorHex, formatDateShort, initials, isDueSoon, isOverdue, labelColor, priorityConfig
} from './board-meta'

const props = defineProps<{
  card: SpaceCard
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{ open: [card: SpaceCard] }>()

const dnd = inject(BOARD_DND_KEY)

const priority = computed(() => priorityConfig(props.card.priority))

const coverStyle = computed(() =>
  props.card.coverColor ? { backgroundColor: colorHex(props.card.coverColor) } : null
)

const checklistProgress = computed(() => {
  const items = props.card.checklists
  if (!items?.length) return null
  const done = items.filter(c => c.checked).length
  return { total: items.length, done, pct: Math.round((done / items.length) * 100) }
})

const overdue = computed(() => isOverdue(props.card))
const dueSoon = computed(() => !overdue.value && isDueSoon(props.card))

/** Deskripsi hanya tampil bila tidak ada metadata lain — jaga kartu tetap ringkas. */
const showDescription = computed(() => {
  if (!props.card.description) return false
  if (props.card.labels?.length || props.card.dueDate) return false
  if (checklistProgress.value?.total) return false
  return true
})

const assignees = computed(() =>
  props.card.assigneeIds.map(id => ({
    id,
    name: props.memberMap?.[id],
    color: avatarColor(id),
    initials: initials(props.memberMap?.[id], id)
  }))
)

const isLifted = computed(() =>
  dnd?.draggingCardId.value === props.card.id || dnd?.grabbedCardId.value === props.card.id
)

function onPointerDown(e: PointerEvent) {
  dnd?.onCardPointerDown(e, props.card.id, props.card.columnId)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    emit('open', props.card)
    e.preventDefault()
    return
  }
  dnd?.onCardKeyDown(e, props.card.id)
}
</script>

<template>
  <div
    :data-card-id="card.id"
    :data-flip-key="`card-${card.id}`"
    tabindex="0"
    role="button"
    class="group relative cursor-grab select-none overflow-hidden rounded-lg border border-default bg-default p-3 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/40 hover:shadow-md hover:shadow-black/8 focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
    :class="isLifted ? 'border-primary/50 ring-2 ring-primary/25' : ''"
    :aria-label="`Kartu: ${card.title}. Enter untuk membuka, Spasi untuk memindah.`"
    @pointerdown="onPointerDown"
    @keydown="onKeyDown"
  >
    <!-- Cover warna -->
    <div v-if="coverStyle" class="absolute inset-x-0 top-0 h-1" :style="coverStyle" />

    <!-- Prioritas + label -->
    <div v-if="priority.pillClass || card.labels?.length" class="mb-2 flex flex-wrap items-center gap-1.5">
      <span
        v-if="priority.pillClass"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        :class="priority.pillClass"
      >
        <UIcon :name="priority.icon" class="size-2.5" aria-hidden="true" />
        {{ priority.label }}
      </span>
      <span
        v-for="label in card.labels"
        :key="label"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium"
        :class="labelColor(label)"
      >{{ label }}</span>
    </div>

    <!-- Judul -->
    <p class="text-sm font-semibold leading-snug text-highlighted">
      {{ card.title }}
    </p>

    <!-- Deskripsi ringkas -->
    <p v-if="showDescription" class="mt-1 line-clamp-2 text-xs leading-5 text-muted">
      {{ card.description }}
    </p>

    <!-- Progres checklist -->
    <div v-if="checklistProgress" class="mt-2.5 flex items-center gap-2">
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :class="checklistProgress.pct === 100 ? 'bg-green-500' : 'bg-primary'"
          :style="{ width: `${checklistProgress.pct}%` }"
        />
      </div>
      <span class="shrink-0 text-[10px] font-medium tabular-nums text-muted">
        {{ checklistProgress.done }}/{{ checklistProgress.total }}
      </span>
    </div>

    <!-- Meta: due, komentar, lampiran, assignee -->
    <div class="mt-2.5 flex flex-wrap items-center gap-2">
      <span
        v-if="overdue && card.dueDate"
        class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300"
      >
        <span class="relative flex size-1.5" aria-hidden="true">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span class="relative inline-flex size-1.5 rounded-full bg-red-500" />
        </span>
        {{ formatDateShort(card.dueDate) }}
      </span>

      <span
        v-else-if="card.dueDate"
        class="inline-flex items-center gap-1 text-[10px] font-medium"
        :class="dueSoon ? 'text-orange-600 dark:text-orange-400' : 'text-muted'"
      >
        <UIcon name="i-lucide-calendar" class="size-3" aria-hidden="true" />
        {{ formatDateShort(card.dueDate) }}
      </span>

      <span v-if="(card._count?.comments ?? 0) > 0" class="inline-flex items-center gap-1 text-[10px] text-muted">
        <UIcon name="i-lucide-message-circle" class="size-3" aria-hidden="true" />
        {{ card._count?.comments }}
      </span>

      <span v-if="(card._count?.attachments ?? 0) > 0" class="inline-flex items-center gap-1 text-[10px] text-muted">
        <UIcon name="i-lucide-paperclip" class="size-3" aria-hidden="true" />
        {{ card._count?.attachments }}
      </span>

      <!-- Assignee -->
      <div v-if="assignees.length" class="ml-auto flex -space-x-1.5">
        <span
          v-for="a in assignees.slice(0, 3)"
          :key="a.id"
          class="flex size-5 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-white dark:ring-default"
          :class="a.color"
          :title="a.name ?? `User ${a.id}`"
        >{{ a.initials }}</span>
        <span
          v-if="assignees.length > 3"
          class="flex size-5 items-center justify-center rounded-full bg-elevated text-[9px] font-bold text-muted ring-1 ring-white dark:ring-default"
        >+{{ assignees.length - 3 }}</span>
      </div>
    </div>
  </div>
</template>
