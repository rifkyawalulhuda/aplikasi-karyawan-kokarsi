<script setup lang="ts">
import type { Space, SpaceCard } from '~/types/space'

const props = defineProps<{
  space: Space
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{
  cardClick: [card: SpaceCard]
}>()

// ── Sort & Filter State ──────────────────────────────────────────────────────
type SortKey = 'title' | 'priority' | 'dueDate' | 'createdAt' | 'updatedAt'
type SortDir = 'asc' | 'desc'
type GroupMode = 'grouped' | 'flat'

const groupMode = ref<GroupMode>('grouped')
const sortKey = ref<SortKey>('createdAt')
const sortDir = ref<SortDir>('desc')
const filterPriority = ref<string[]>([])
const filterAssignee = ref<number[]>([])
const filterColumn = ref<number[]>([])
const filterOverdueOnly = ref(false)
const expandedCols = ref<Set<number>>(new Set())

// Initialize all columns as expanded
watch(() => props.space.columns, (cols) => {
  if (cols) cols.forEach(c => expandedCols.value.add(c.id))
}, { immediate: true })

// ── All cards flat ────────────────────────────────────────────────────────────
const allCards = computed<(SpaceCard & { columnName: string, columnColor: string })[]>(() => {
  const result: (SpaceCard & { columnName: string, columnColor: string })[] = []
  for (const col of props.space.columns ?? []) {
    for (const card of col.cards ?? []) {
      result.push({ ...card, columnName: col.name, columnColor: col.color })
    }
  }
  return result
})

// ── Filtered cards ────────────────────────────────────────────────────────────
const filteredCards = computed(() => {
  let cards = allCards.value

  if (filterPriority.value.length) {
    cards = cards.filter(c => filterPriority.value.includes(c.priority))
  }
  if (filterAssignee.value.length) {
    cards = cards.filter(c => c.assigneeIds.some(id => filterAssignee.value.includes(id)))
  }
  if (filterColumn.value.length) {
    cards = cards.filter(c => filterColumn.value.includes(c.columnId))
  }
  if (filterOverdueOnly.value) {
    cards = cards.filter(c => c.dueDate && new Date(c.dueDate) < new Date())
  }

  // Sort
  const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 }
  cards = [...cards].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (sortKey.value === 'title') {
      va = a.title
      vb = b.title
    } else if (sortKey.value === 'priority') {
      va = PRIORITY_ORDER[a.priority] ?? 9
      vb = PRIORITY_ORDER[b.priority] ?? 9
    } else if (sortKey.value === 'dueDate') {
      va = a.dueDate ?? '9999'
      vb = b.dueDate ?? '9999'
    } else if (sortKey.value === 'createdAt') {
      va = a.createdAt
      vb = b.createdAt
    } else {
      va = a.updatedAt
      vb = b.updatedAt
    }

    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })

  return cards
})

// ── Grouped cards ──────────────────────────────────────────────────────────────
const groupedCards = computed(() => {
  const cols = props.space.columns ?? []
  return cols.map(col => ({
    col,
    cards: filteredCards.value.filter(c => c.columnId === col.id)
  }))
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const COLUMN_COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500', indigo: 'bg-indigo-500',
  slate: 'bg-slate-500'
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function toggleColExpand(colId: number) {
  if (expandedCols.value.has(colId)) expandedCols.value.delete(colId)
  else expandedCols.value.add(colId)
}

const sortOptions = [
  { label: 'Judul', value: 'title' },
  { label: 'Prioritas', value: 'priority' },
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Dibuat', value: 'createdAt' },
  { label: 'Diperbarui', value: 'updatedAt' }
]

const priorityOptions = [
  { label: 'Urgent', value: 'URGENT' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
  { label: 'None', value: 'NONE' }
]

const columnOptions = computed(() =>
  (props.space.columns ?? []).map(c => ({ label: c.name, value: c.id }))
)

const memberOptions = computed(() =>
  Object.entries(props.memberMap ?? {}).map(([id, name]) => ({ label: name, value: Number(id) }))
)

const hasFilters = computed(() =>
  filterPriority.value.length > 0 || filterAssignee.value.length > 0
  || filterColumn.value.length > 0 || filterOverdueOnly.value
)

function clearFilters() {
  filterPriority.value = []
  filterAssignee.value = []
  filterColumn.value = []
  filterOverdueOnly.value = false
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-2.5">
      <!-- Grouping toggle -->
      <div class="flex rounded-lg border border-default overflow-hidden text-xs">
        <button
          type="button"
          class="px-3 py-1.5 font-medium transition-colors"
          :class="groupMode === 'grouped' ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted'"
          @click="groupMode = 'grouped'"
        >
          <UIcon name="i-lucide-layers" class="size-3.5 mr-1" />
          Grouped
        </button>
        <button
          type="button"
          class="px-3 py-1.5 font-medium transition-colors"
          :class="groupMode === 'flat' ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted'"
          @click="groupMode = 'flat'"
        >
          <UIcon name="i-lucide-list" class="size-3.5 mr-1" />
          Flat
        </button>
      </div>

      <!-- Sort -->
      <USelect
        :model-value="sortKey"
        :items="sortOptions"
        size="sm"
        class="w-36"
        @update:model-value="(v: any) => { sortKey = v; }"
      />
      <UButton
        :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-a-z' : 'i-lucide-arrow-down-z-a'"
        size="sm"
        color="neutral"
        variant="outline"
        @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
      />

      <div class="h-4 w-px bg-default" />

      <!-- Filter: Priority -->
      <USelect
        v-model="filterPriority"
        :items="priorityOptions"
        size="sm"
        placeholder="Prioritas"
        class="w-32"
        multiple
      />

      <!-- Filter: Column -->
      <USelect
        v-model="filterColumn"
        :items="columnOptions"
        size="sm"
        placeholder="Kolom"
        class="w-36"
        multiple
      />

      <!-- Filter: Assignee -->
      <USelect
        v-if="memberOptions.length"
        v-model="filterAssignee"
        :items="memberOptions"
        size="sm"
        placeholder="Assignee"
        class="w-36"
        multiple
      />

      <!-- Overdue toggle -->
      <label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-highlighted">
        <input v-model="filterOverdueOnly" type="checkbox" class="rounded">
        Overdue
      </label>

      <!-- Clear filters -->
      <UButton
        v-if="hasFilters"
        label="Reset"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="clearFilters"
      />

      <span class="ml-auto text-xs text-muted">{{ filteredCards.length }} card</span>
    </div>

    <!-- Table header (desktop) -->
    <div class="hidden border-b border-default bg-elevated/30 px-4 py-2 text-xs font-medium text-muted md:grid md:grid-cols-[1fr_130px_100px_120px_120px_70px] md:gap-2">
      <button class="flex items-center gap-1 text-left" @click="toggleSort('title')">
        Judul
        <UIcon v-if="sortKey === 'title'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
      </button>
      <span>Status</span>
      <button class="flex items-center gap-1 text-left" @click="toggleSort('priority')">
        Prioritas
        <UIcon v-if="sortKey === 'priority'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
      </button>
      <button class="flex items-center gap-1 text-left" @click="toggleSort('dueDate')">
        Due Date
        <UIcon v-if="sortKey === 'dueDate'" :name="sortDir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="size-3" />
      </button>
      <span>Assignee</span>
      <span>Info</span>
    </div>

    <!-- Table body (scrollable) -->
    <div class="flex-1 overflow-y-auto">
      <!-- GROUPED MODE -->
      <template v-if="groupMode === 'grouped'">
        <div v-for="{ col, cards } in groupedCards" :key="col.id">
          <!-- Group header -->
          <button
            type="button"
            class="flex w-full items-center gap-2 border-b border-default bg-elevated/20 px-4 py-2 text-left text-xs font-semibold text-highlighted hover:bg-elevated/40"
            @click="toggleColExpand(col.id)"
          >
            <UIcon :name="expandedCols.has(col.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-3.5 text-muted" />
            <div class="size-2 rounded-full shrink-0" :class="COLUMN_COLOR_MAP[col.color] ?? 'bg-gray-400'" />
            {{ col.name }}
            <span class="font-normal text-muted ml-1">{{ cards.length }}</span>
          </button>

          <!-- Group rows -->
          <template v-if="expandedCols.has(col.id)">
            <SpacesListCardRow
              v-for="card in cards"
              :key="card.id"
              :card="card"
              :member-map="memberMap"
              :column-name="col.name"
              :column-color="col.color"
              @click="emit('cardClick', card)"
            />
            <div v-if="!cards.length" class="px-4 py-3 text-xs text-muted">
              Tidak ada card di kolom ini
            </div>
          </template>
        </div>
      </template>

      <!-- FLAT MODE -->
      <template v-else>
        <SpacesListCardRow
          v-for="card in filteredCards"
          :key="card.id"
          :card="card"
          :member-map="memberMap"
          :column-name="card.columnName"
          :column-color="card.columnColor"
          @click="emit('cardClick', card)"
        />
        <div v-if="!filteredCards.length" class="py-16 text-center text-sm text-muted">
          Tidak ada card yang sesuai filter
        </div>
      </template>
    </div>
  </div>
</template>
