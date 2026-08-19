<script setup lang="ts">
import type { Space, SpaceCard, SpaceColumn, SpaceEvent } from '~/types/space'

const props = defineProps<{ space: Space }>()
const emit = defineEmits<{
  refresh: []
  cardClick: [card: SpaceCard]
}>()

const toast = useToast()
const spaceId = computed(() => props.space.id)

// Fetch user map untuk resolve assignee names di card
const { data: usersRes } = useFetch<{ id: number; name: string }[]>('/api/users/pengurus', {
  credentials: 'include',
  lazy: true,
})
const memberMap = computed<Record<number, string>>(() =>
  Object.fromEntries((usersRes.value ?? []).map(u => [u.id, u.name]))
)

// SSE real-time
const { events } = useSpaceSSE(spaceId)

// Local reactive copy of columns + cards
const columns = ref<SpaceColumn[]>([])

watch(() => props.space, (s) => {
  columns.value = s.columns ? JSON.parse(JSON.stringify(s.columns)) : []
}, { immediate: true, deep: true })

// Handle SSE events
watch(events, (evts) => {
  const latest = evts[evts.length - 1]
  if (!latest) return
  handleSpaceEvent(latest)
}, { deep: true })

function handleSpaceEvent(event: SpaceEvent) {
  switch (event.type) {
    case 'CARD_CREATED': {
      const col = columns.value.find(c => c.id === event.payload.columnId)
      if (col) { if (!col.cards) col.cards = []; col.cards.push(event.payload) }
      break
    }
    case 'CARD_UPDATED': {
      for (const col of columns.value) {
        const idx = col.cards?.findIndex(c => c.id === event.payload.id) ?? -1
        if (idx !== -1 && col.cards) col.cards[idx] = { ...col.cards[idx], ...event.payload }
      }
      break
    }
    case 'CARD_DELETED': {
      for (const col of columns.value) {
        if (col.cards) col.cards = col.cards.filter(c => c.id !== event.payload.cardId)
      }
      break
    }
    case 'CARD_MOVED': {
      const { cardId, fromColumnId, toColumnId, position } = event.payload
      const fromCol = columns.value.find(c => c.id === fromColumnId)
      const toCol = columns.value.find(c => c.id === toColumnId)
      if (fromCol && toCol) {
        const cardIdx = fromCol.cards?.findIndex(c => c.id === cardId) ?? -1
        if (cardIdx !== -1 && fromCol.cards) {
          const [card] = fromCol.cards.splice(cardIdx, 1)
          if (!toCol.cards) toCol.cards = []
          toCol.cards.splice(position, 0, { ...card, columnId: toColumnId })
        }
      }
      break
    }
    case 'COLUMN_CREATED': columns.value.push({ ...event.payload, cards: [] }); break
    case 'COLUMN_UPDATED': {
      const idx = columns.value.findIndex(c => c.id === event.payload.id)
      if (idx !== -1) columns.value[idx] = { ...columns.value[idx], ...event.payload }
      break
    }
    case 'COLUMN_DELETED': columns.value = columns.value.filter(c => c.id !== event.payload.columnId); break
    default: break
  }
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────
// Store drag state in module-level vars (not reactive) to avoid Vue overhead during drag
let dragCardId = -1
let dragFromColId = -1
let dragFromIdx = -1

// Reactive only for visual feedback
const dragOverColId = ref<number | null>(null)

const COLUMN_COLORS: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500', indigo: 'bg-indigo-500',
  slate: 'bg-slate-500',
}

function onDragStart(e: DragEvent, colId: number, cardIdx: number, cardId: number) {
  dragCardId = cardId
  dragFromColId = colId
  dragFromIdx = cardIdx
  // MUST call setData for HTML5 DnD drop event to fire
  e.dataTransfer!.setData('application/x-card-id', String(cardId))
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragEnd() {
  dragCardId = -1
  dragFromColId = -1
  dragFromIdx = -1
  dragOverColId.value = null
}

function onColumnDragOver(e: DragEvent, colId: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverColId.value = colId
}

function onColumnDragLeave(e: DragEvent, colId: number) {
  // Only clear if the mouse is actually leaving the column element
  const related = e.relatedTarget as HTMLElement | null
  if (!related?.closest(`[data-col-id="${colId}"]`)) {
    if (dragOverColId.value === colId) dragOverColId.value = null
  }
}

async function onColumnDrop(e: DragEvent, toColId: number) {
  e.preventDefault()
  dragOverColId.value = null

  if (dragCardId === -1) return

  const cardId = dragCardId
  const fromColId = dragFromColId
  const fromIdx = dragFromIdx

  // Calculate drop position based on mouse Y within the column cards
  const col = columns.value.find(c => c.id === toColId)
  const toIdx = col?.cards?.length ?? 0

  // No-op: same position
  if (fromColId === toColId && fromIdx === toIdx) { onDragEnd(); return }

  // Optimistic local update
  const fromCol = columns.value.find(c => c.id === fromColId)
  const toCol = columns.value.find(c => c.id === toColId)
  if (fromCol && toCol) {
    const cardIdx = fromCol.cards?.findIndex(c => c.id === cardId) ?? -1
    if (cardIdx !== -1 && fromCol.cards) {
      const [card] = fromCol.cards.splice(cardIdx, 1)
      if (!toCol.cards) toCol.cards = []
      const adjustedIdx = fromColId === toColId && toIdx > cardIdx ? toIdx - 1 : toIdx
      toCol.cards.splice(adjustedIdx, 0, { ...card, columnId: toColId })
    }
  }

  onDragEnd()

  try {
    await $fetch(`/api/spaces/${props.space.id}/cards/${cardId}/move`, {
      method: 'POST',
      body: { toColumnId: toColId, position: toIdx },
      credentials: 'include',
    })
  } catch (err: any) {
    toast.add({ title: 'Gagal memindahkan card', description: err?.data?.message ?? 'Error', color: 'error' })
    emit('refresh')
  }
}

// ── Add column ───────────────────────────────────────────────────────────────
const addingColumn = ref(false)
const newColName = ref('')
const savingCol = ref(false)

async function addColumn() {
  if (!newColName.value.trim()) { addingColumn.value = false; return }
  savingCol.value = true
  try {
    await $fetch(`/api/spaces/${props.space.id}/columns`, {
      method: 'POST',
      body: { name: newColName.value.trim() },
      credentials: 'include',
    })
    newColName.value = ''
    addingColumn.value = false
  } catch (e: any) {
    toast.add({ title: 'Gagal tambah kolom', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    savingCol.value = false
  }
}

// ── Column management ────────────────────────────────────────────────────────
const { confirmDeleteToast } = useConfirmDeleteToast()

async function renameColumn(colId: number, newName: string) {
  await $fetch(`/api/spaces/${props.space.id}/columns/${colId}`, {
    method: 'PUT', body: { name: newName }, credentials: 'include',
  })
  emit('refresh')
}

function deleteColumn(col: SpaceColumn) {
  confirmDeleteToast({
    title: 'Hapus Kolom',
    description: `Kolom "${col.name}" akan dihapus. Pastikan semua card sudah dipindahkan.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${props.space.id}/columns/${col.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      emit('refresh')
    },
  })
}

// ── Add card inline ──────────────────────────────────────────────────────────
const addingCardColId = ref<number | null>(null)
const newCardTitle = ref('')
const savingCard = ref(false)

function startAddCard(colId: number) {
  addingCardColId.value = colId
  newCardTitle.value = ''
}

async function saveCard() {
  if (!newCardTitle.value.trim() || !addingCardColId.value) {
    addingCardColId.value = null; return
  }
  savingCard.value = true
  try {
    await $fetch(`/api/spaces/${props.space.id}/columns/${addingCardColId.value}/cards`, {
      method: 'POST', body: { title: newCardTitle.value.trim() }, credentials: 'include',
    })
    newCardTitle.value = ''
    addingCardColId.value = null
    emit('refresh')
  } catch (e: any) {
    toast.add({ title: 'Gagal tambah card', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    savingCard.value = false
  }
}

// Editing column name inline
const editingColId = ref<number | null>(null)
const editColName = ref('')

function startRenameCol(col: SpaceColumn) {
  editingColId.value = col.id
  editColName.value = col.name
}

async function saveColName() {
  if (!editColName.value.trim() || editingColId.value === null) { editingColId.value = null; return }
  await renameColumn(editingColId.value, editColName.value.trim())
  editingColId.value = null
}

// ── Click vs drag detection ───────────────────────────────────────────────────
// Chrome suppresses click events on draggable="true" elements.
// We use mousedown/mouseup + movement threshold to detect intentional clicks.
const CLICK_THRESHOLD = 5 // pixels
let mouseDownX = 0
let mouseDownY = 0

function onCardMouseDown(e: MouseEvent) {
  mouseDownX = e.clientX
  mouseDownY = e.clientY
}

function onCardMouseUp(e: MouseEvent, card: SpaceCard) {
  const dx = Math.abs(e.clientX - mouseDownX)
  const dy = Math.abs(e.clientY - mouseDownY)
  if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
    emit('cardClick', card)
  }
}
</script>

<template>
  <div class="flex h-full gap-4 overflow-x-auto p-4 pb-6">
    <!-- Each column is self-contained with its own drag target -->
    <div
      v-for="col in columns"
      :key="col.id"
      :data-col-id="col.id"
      class="flex w-72 shrink-0 flex-col rounded-xl border transition-colors duration-150"
      :class="dragOverColId === col.id
        ? 'border-primary bg-primary/5'
        : 'border-default bg-elevated/30'"
      @dragover="onColumnDragOver($event, col.id)"
      @dragleave="onColumnDragLeave($event, col.id)"
      @drop="onColumnDrop($event, col.id)"
    >
      <!-- Column Header -->
      <div class="flex items-center gap-2 px-3 pt-3 pb-2">
        <div class="size-2 shrink-0 rounded-full" :class="COLUMN_COLORS[col.color] ?? 'bg-gray-400'" />

        <!-- Editable column name -->
        <div class="flex-1 min-w-0">
          <input
            v-if="editingColId === col.id"
            v-model="editColName"
            class="w-full rounded bg-default px-1.5 py-0.5 text-sm font-semibold text-highlighted outline-none ring-1 ring-primary"
            autofocus
            @blur="saveColName"
            @keydown.enter="saveColName"
            @keydown.escape="editingColId = null"
          />
          <button
            v-else
            type="button"
            class="truncate text-sm font-semibold text-highlighted hover:text-primary"
            @dblclick="startRenameCol(col)"
          >{{ col.name }}</button>
        </div>

        <span class="text-xs text-muted shrink-0">{{ col.cards?.length ?? 0 }}</span>

        <UDropdownMenu
          :items="[[
            { label: 'Tambah Card', icon: 'i-lucide-plus', onSelect: () => startAddCard(col.id) },
            { label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => startRenameCol(col) },
            { label: 'Hapus Kolom', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteColumn(col) },
          ]]"
        >
          <UButton icon="i-lucide-more-horizontal" variant="ghost" color="neutral" size="xs" />
        </UDropdownMenu>
      </div>

      <!-- Cards list — this is the actual drop target area -->
      <div class="flex-1 space-y-2 overflow-y-auto px-3 pb-2" style="max-height: calc(100vh - 280px)">
        <!-- Empty column hint -->
        <div
          v-if="!col.cards?.length && dragOverColId === col.id"
          class="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-primary/40 text-xs text-primary/60"
        >
          Lepaskan di sini
        </div>

        <!-- Draggable cards -->
        <div
          v-for="(card, idx) in (col.cards ?? [])"
          :key="card.id"
          draggable="true"
          class="cursor-grab active:cursor-grabbing select-none"
          :class="dragCardId === card.id ? 'opacity-40 ring-2 ring-primary/30 rounded-lg' : ''"
          @dragstart="onDragStart($event, col.id, idx, card.id)"
          @dragend="onDragEnd"
          @mousedown="onCardMouseDown"
          @mouseup="onCardMouseUp($event, card)"
        >
          <SpacesKanbanCard
            :card="card"
            :space-id="space.id"
            :member-map="memberMap"
          />
        </div>

        <!-- Inline add card form -->
        <div v-if="addingCardColId === col.id" class="rounded-lg border border-primary/40 bg-default p-2.5">
          <UTextarea
            v-model="newCardTitle"
            :rows="2"
            class="w-full text-sm"
            placeholder="Judul card..."
            autofocus
            @keydown.enter.exact.prevent="saveCard"
            @keydown.escape="addingCardColId = null; newCardTitle = ''"
          />
          <div class="mt-2 flex gap-1.5">
            <UButton label="Tambah" size="xs" color="primary" :loading="savingCard" @click="saveCard" />
            <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="addingCardColId = null; newCardTitle = ''" />
          </div>
        </div>
      </div>

      <!-- Add card button -->
      <div class="px-3 pb-3">
        <button
          v-if="addingCardColId !== col.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-highlighted"
          @click="startAddCard(col.id)"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
          Tambah card
        </button>
      </div>
    </div>

    <!-- Add column -->
    <div class="w-72 shrink-0">
      <div v-if="addingColumn" class="rounded-xl border border-primary/40 bg-elevated/30 p-3">
        <UInput
          v-model="newColName"
          class="w-full"
          placeholder="Nama kolom..."
          autofocus
          @keydown.enter="addColumn"
          @keydown.escape="addingColumn = false; newColName = ''"
        />
        <div class="mt-2 flex gap-1.5">
          <UButton label="Tambah" size="xs" color="primary" :loading="savingCol" @click="addColumn" />
          <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="addingColumn = false; newColName = ''" />
        </div>
      </div>
      <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 rounded-xl border border-dashed border-default px-4 py-3 text-sm text-muted transition-colors hover:border-primary/40 hover:bg-elevated/30 hover:text-highlighted"
        @click="addingColumn = true"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        Tambah Kolom
      </button>
    </div>
  </div>
</template>
