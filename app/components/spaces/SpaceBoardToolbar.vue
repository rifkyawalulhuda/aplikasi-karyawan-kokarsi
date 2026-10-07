<script setup lang="ts">
import type { Space } from '~/types/space'
import { PRIORITY_CONFIG } from './board-meta'

const props = defineProps<{
  space: Space
  /** Peta id → nama untuk opsi assignee. */
  memberNames?: Record<number, string>
  /** Jumlah kartu yang lolos filter (untuk hitungan di kanan). */
  visibleCount?: number
}>()

const state = useSpaceViewState()

// ── Opsi ─────────────────────────────────────────────────────────────────────
const priorityOptions = (Object.keys(PRIORITY_CONFIG) as Array<keyof typeof PRIORITY_CONFIG>)
  .filter(k => k !== 'NONE')
  .map(k => ({ label: PRIORITY_CONFIG[k].label as string, value: k as string }))

const columnOptions = computed(() =>
  (props.space.columns ?? []).map(c => ({ label: c.name, value: c.id }))
)

const labelOptions = computed(() => {
  const set = new Set<string>()
  for (const col of props.space.columns ?? []) {
    for (const card of col.cards ?? []) {
      for (const label of card.labels ?? []) set.add(label)
    }
  }
  return [...set].sort().map(l => ({ label: l, value: l }))
})

const memberOptions = computed(() =>
  props.space.memberIds.map(id => ({
    label: props.memberNames?.[id] ?? `User ${id}`,
    value: id
  }))
)

// ── Pencarian (debounce agar URL tidak ditulis tiap ketikan) ─────────────────
const searchInput = ref(state.q.value)
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(() => state.q.value, (v) => {
  if (v !== searchInput.value) searchInput.value = v
})

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => state.setQ(searchInput.value), 250)
}

watch(searchInput, onSearch)

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

const dueOptions = [
  { label: 'Semua tanggal', value: 'all' },
  { label: 'Terlambat', value: 'overdue' },
  { label: 'Jatuh tempo ≤2 hari', value: 'soon' }
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-default bg-elevated/20 px-4 py-2.5">
    <!-- Pencarian -->
    <UInput
      v-model="searchInput"
      icon="i-lucide-search"
      size="sm"
      placeholder="Cari kartu…"
      class="w-48 sm:w-56"
      aria-label="Cari kartu"
    />

    <!-- Assignee -->
    <USelectMenu
      :model-value="state.assigneeIds.value"
      :items="memberOptions"
      multiple
      value-key="value"
      size="sm"
      placeholder="Assignee"
      class="w-36"
      aria-label="Filter assignee"
      @update:model-value="(v: number[]) => state.setAssignee(v)"
    />

    <!-- Prioritas -->
    <USelectMenu
      :model-value="state.priorities.value"
      :items="priorityOptions"
      multiple
      value-key="value"
      size="sm"
      placeholder="Prioritas"
      class="w-36"
      aria-label="Filter prioritas"
      @update:model-value="(v: string[]) => state.setPriorities(v)"
    />

    <!-- Label -->
    <USelectMenu
      v-if="labelOptions.length"
      :model-value="state.labels.value"
      :items="labelOptions"
      multiple
      value-key="value"
      size="sm"
      placeholder="Label"
      class="w-32"
      aria-label="Filter label"
      @update:model-value="(v: string[]) => state.setLabels(v)"
    />

    <!-- Due -->
    <USelect
      :model-value="state.due.value"
      :items="dueOptions"
      size="sm"
      class="w-44"
      aria-label="Filter tanggal jatuh tempo"
      @update:model-value="(v: any) => state.setDue(v)"
    />

    <!-- Kolom -->
    <USelectMenu
      v-if="columnOptions.length > 1"
      :model-value="state.columnIds.value"
      :items="columnOptions"
      multiple
      value-key="value"
      size="sm"
      placeholder="Kolom"
      class="w-36"
      aria-label="Filter kolom"
      @update:model-value="(v: number[]) => state.setColumn(v)"
    />

    <!-- Reset -->
    <UButton
      v-if="state.hasFilters.value"
      label="Reset"
      size="sm"
      color="neutral"
      variant="ghost"
      icon="i-lucide-x"
      @click="state.clearFilters()"
    />

    <span class="ml-auto shrink-0 text-xs tabular-nums text-muted">
      {{ visibleCount ?? 0 }} kartu
    </span>
  </div>
</template>
