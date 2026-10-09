<script setup lang="ts">
import type { Space, SpaceCard, SpaceColumn, SpaceEvent } from '~/types/space'
import { useSpaceSseContext } from '~/composables/useSpaceSSE'
import { applyCardFilters, useSpaceViewState } from '~/composables/useSpaceViewState'
import { useFlip } from '~/composables/useFlip'
import { errorMessage } from './board-meta'
import { BOARD_DND_KEY, useBoardDnd } from '~/composables/useBoardDnd'

const props = defineProps<{
  space: Space
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{
  refresh: []
  cardClick: [card: SpaceCard]
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const spaceId = computed(() => props.space.id)

provide('space-member-map', props.memberMap ?? {})

// ── State kolom lokal (sumber render) ────────────────────────────────────────
const columns = ref<SpaceColumn[]>([])

watch(() => props.space.columns, (cols) => {
  // Salin dangkal per kolom/kartu — tanpa JSON round-trip yang mahal.
  columns.value = (cols ?? []).map(col => ({ ...col, cards: [...(col.cards ?? [])] }))
}, { immediate: true })

// ── Filter (URL) ─────────────────────────────────────────────────────────────
const viewState = useSpaceViewState()

const cardMatches = (card: SpaceCard) => applyCardFilters([card], viewState).length === 1

const totalVisible = computed(() =>
  columns.value.reduce((sum, col) => sum + (col.cards ?? []).filter(c => cardMatches(c)).length, 0)
)

/** Kartu tampil bila lolos filter, ATAU sedang di-drag (agar tidak menghilang). */
function isCardVisible(card: SpaceCard): boolean {
  if (dnd.draggingCardId.value === card.id || dnd.grabbedCardId.value === card.id) return true
  return cardMatches(card)
}

// ── FLIP ─────────────────────────────────────────────────────────────────────
const boardRef = ref<HTMLElement | null>(null)
const flip = useFlip()

function boardFlipKeys(): HTMLElement[] {
  if (!boardRef.value) return []
  return [...boardRef.value.querySelectorAll<HTMLElement>('[data-flip-key]')]
}

/** Mutasi layout + animasikan perpindahan (kecuali kartu yang di-drag). */
function withFlip(mutate: () => void, excludeCardId: number | null = null) {
  const before = flip.first(boardFlipKeys())
  mutate()
  nextTick(() => {
    const els = boardFlipKeys().filter(el =>
      el.dataset.flipKey !== `card-${excludeCardId}` && el.dataset.flipKey !== `col-${excludeCardId}`
    )
    flip.play(before, els)
  })
}

// ── Layout logika untuk engine ───────────────────────────────────────────────
function getLayout() {
  return columns.value.map(col => ({ id: col.id, cardIds: (col.cards ?? []).map(c => c.id) }))
}

function moveCardLocal(intent: { cardId: number, fromColumnId: number, toColumnId: number, position: number }) {
  const fromCol = columns.value.find(c => c.id === intent.fromColumnId)
  const toCol = columns.value.find(c => c.id === intent.toColumnId)
  if (!fromCol || !toCol) return
  const fromIdx = fromCol.cards?.findIndex(c => c.id === intent.cardId) ?? -1
  if (fromIdx === -1 || !fromCol.cards) return
  const [card] = fromCol.cards.splice(fromIdx, 1)
  if (!card) return
  if (!toCol.cards) toCol.cards = []
  const pos = Math.max(0, Math.min(intent.position, toCol.cards.length))
  toCol.cards.splice(pos, 0, { ...card, columnId: intent.toColumnId, position: pos })
}

function moveColumnLocal(columnId: number, toIndex: number) {
  const fromIdx = columns.value.findIndex(c => c.id === columnId)
  if (fromIdx === -1) return
  const [col] = columns.value.splice(fromIdx, 1)
  if (!col) return
  const pos = Math.max(0, Math.min(toIndex, columns.value.length))
  columns.value.splice(pos, 0, col)
}

// ── Engine ───────────────────────────────────────────────────────────────────
const announceMsg = ref('')

const dnd = useBoardDnd({
  boardRef,
  getLayout,
  moveCard: (intent) => {
    withFlip(() => moveCardLocal(intent), intent.cardId)
  },
  commitCard: (cardId) => {
    const col = columns.value.find(c => c.cards?.some(c2 => c2.id === cardId))
    if (!col) return
    const position = col.cards!.findIndex(c => c.id === cardId)
    $fetch(`/api/spaces/${spaceId.value}/cards/${cardId}/move`, {
      method: 'POST',
      body: { toColumnId: col.id, position },
      credentials: 'include'
    }).catch((err: unknown) => {
      toast.add({ title: 'Gagal memindahkan kartu', description: errorMessage(err), color: 'error' })
      emit('refresh')
    })
  },
  moveColumn: (columnId, toIndex) => {
    withFlip(() => moveColumnLocal(columnId, toIndex))
  },
  commitColumn: () => {
    const columnIds = columns.value.map(c => c.id)
    $fetch(`/api/spaces/${spaceId.value}/columns/reorder`, {
      method: 'POST',
      body: { columnIds },
      credentials: 'include'
    }).catch((err: unknown) => {
      toast.add({ title: 'Gagal mengurutkan kolom', description: errorMessage(err), color: 'error' })
      emit('refresh')
    })
  },
  onCardClick: (cardId) => {
    const card = columns.value.flatMap(c => c.cards ?? []).find(c => c.id === cardId)
    if (card) emit('cardClick', card)
  },
  announce: (message) => {
    announceMsg.value = message
  }
})

provide(BOARD_DND_KEY, dnd)

// ── SSE ──────────────────────────────────────────────────────────────────────
const sse = useSpaceSseContext()

watch(() => sse?.events.value ?? [], (list) => {
  const latest = list[list.length - 1]
  if (latest) handleSpaceEvent(latest)
}, { deep: true })

function handleSpaceEvent(event: SpaceEvent) {
  switch (event.type) {
    case 'CARD_CREATED': {
      const col = columns.value.find(c => c.id === event.payload.columnId)
      if (col && !col.cards?.some(c => c.id === event.payload.id)) {
        col.cards = [...(col.cards ?? []), event.payload]
      }
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
        if (col.cards?.some(c => c.id === event.payload.cardId)) {
          col.cards = col.cards.filter(c => c.id !== event.payload.cardId)
        }
      }
      break
    }
    case 'CARD_MOVED': {
      const { cardId, fromColumnId, toColumnId, position } = event.payload
      const fromCol = columns.value.find(c => c.id === fromColumnId)
      const toCol = columns.value.find(c => c.id === toColumnId)
      if (!fromCol || !toCol || fromCol.cards?.every(c => c.id !== cardId)) break
      if (fromCol.cards && toCol) {
        const cardIdx = fromCol.cards.findIndex(c => c.id === cardId)
        if (cardIdx !== -1) {
          const [card] = fromCol.cards.splice(cardIdx, 1)
          if (!card) break
          if (!toCol.cards) toCol.cards = []
          toCol.cards.splice(Math.min(position, toCol.cards.length), 0, { ...card, columnId: toColumnId })
        }
      }
      break
    }
    case 'COLUMN_CREATED':
      if (!columns.value.some(c => c.id === event.payload.id)) {
        columns.value.push({ ...event.payload, cards: [] })
      }
      break
    case 'COLUMN_UPDATED': {
      const idx = columns.value.findIndex(c => c.id === event.payload.id)
      if (idx !== -1) columns.value[idx] = { ...columns.value[idx], ...event.payload, cards: columns.value[idx]!.cards }
      break
    }
    case 'COLUMN_DELETED':
      columns.value = columns.value.filter(c => c.id !== event.payload.columnId)
      break
    case 'COLUMNS_REORDERED': {
      const order: number[] = event.payload.columnIds ?? []
      columns.value = order
        .map(id => columns.value.find(c => c.id === id))
        .filter((c): c is SpaceColumn => !!c)
      break
    }
    default: break
  }
}

// ── CRUD kolom ───────────────────────────────────────────────────────────────
const COLUMN_COLORS = ['gray', 'blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo', 'slate']

const addingColumn = ref(false)
const newColName = ref('')
const savingCol = ref(false)

async function addColumn() {
  const name = newColName.value.trim()
  if (!name) {
    addingColumn.value = false
    return
  }
  savingCol.value = true
  try {
    await $fetch(`/api/spaces/${spaceId.value}/columns`, {
      method: 'POST', body: { name }, credentials: 'include'
    })
    newColName.value = ''
    addingColumn.value = false
    emit('refresh')
  } catch (err: unknown) {
    toast.add({ title: 'Gagal menambah kolom', description: errorMessage(err), color: 'error' })
  } finally {
    savingCol.value = false
  }
}

async function renameColumn(colId: number, name: string) {
  try {
    await $fetch(`/api/spaces/${spaceId.value}/columns/${colId}`, {
      method: 'PUT', body: { name }, credentials: 'include'
    })
  } catch (err: unknown) {
    toast.add({ title: 'Gagal mengganti nama kolom', description: errorMessage(err), color: 'error' })
  }
}

async function changeColumnColor(colId: number, color: string) {
  try {
    await $fetch(`/api/spaces/${spaceId.value}/columns/${colId}`, {
      method: 'PUT', body: { color }, credentials: 'include'
    })
  } catch (err: unknown) {
    toast.add({ title: 'Gagal mengubah warna kolom', description: errorMessage(err), color: 'error' })
  }
}

function deleteColumn(col: SpaceColumn) {
  confirmDeleteToast({
    title: 'Hapus Kolom',
    description: `Kolom "${col.name}" akan dihapus. Pastikan semua kartu sudah dipindahkan.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${spaceId.value}/columns/${col.id}`, {
        method: 'DELETE', credentials: 'include'
      })
      columns.value = columns.value.filter(c => c.id !== col.id)
    }
  })
}

// ── Tambah kartu (dipanggil KanbanColumn) ────────────────────────────────────
async function addCard(colId: number, title: string) {
  try {
    await $fetch(`/api/spaces/${spaceId.value}/columns/${colId}/cards`, {
      method: 'POST', body: { title }, credentials: 'include'
    })
  } catch (err: unknown) {
    toast.add({ title: 'Gagal menambah kartu', description: errorMessage(err), color: 'error' })
  }
}

const hasColumns = computed(() => columns.value.length > 0)
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar filter (Hanya board) -->
    <SpacesSpaceBoardToolbar :space="space" :member-names="memberMap" :visible-count="totalVisible" />

    <!-- Empty: belum ada kolom -->
    <div v-if="!hasColumns" class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div class="rounded-full bg-elevated p-4">
        <UIcon name="i-lucide-columns-2" class="size-10 text-dimmed" />
      </div>
      <div>
        <p class="font-semibold text-highlighted">
          Board masih kosong
        </p>
        <p class="mt-1 text-sm text-muted">
          Buat kolom pertama untuk mulai mengatur kartu
        </p>
      </div>
      <UButton
        label="Tambah Kolom"
        icon="i-lucide-plus"
        color="primary"
        size="sm"
        @click="addingColumn = true"
      />
    </div>

    <!-- Empty hasil filter -->
    <div v-else-if="totalVisible === 0" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <UIcon name="i-lucide-search-x" class="size-10 text-dimmed" />
      <div>
        <p class="font-medium text-highlighted">
          Tidak ada kartu yang cocok
        </p>
        <p class="mt-1 text-sm text-muted">
          Coba ubah atau reset filter
        </p>
      </div>
      <UButton
        label="Reset Filter"
        color="neutral"
        variant="outline"
        size="sm"
        @click="viewState.clearFilters()"
      />
    </div>

    <!-- Board -->
    <div v-else ref="boardRef" class="flex flex-1 gap-4 overflow-x-auto p-4 pb-6">
      <SpacesKanbanColumn
        v-for="col in columns"
        :key="col.id"
        :column="col"
        :colors="COLUMN_COLORS"
        @add-card="(title: string) => addCard(col.id, title)"
        @rename="(name: string) => renameColumn(col.id, name)"
        @color-change="(color: string) => changeColumnColor(col.id, color)"
        @delete="deleteColumn(col)"
      >
        <template v-for="card in col.cards ?? []" :key="card.id">
          <SpacesKanbanCard
            v-if="isCardVisible(card)"
            :card="card"
            :member-map="memberMap"
            @open="emit('cardClick', $event)"
          />
        </template>
      </SpacesKanbanColumn>

      <!-- Tambah kolom -->
      <div class="w-72 shrink-0">
        <div v-if="addingColumn" class="rounded-xl border border-primary/40 bg-elevated/40 p-3" data-no-drag>
          <UInput
            v-model="newColName"
            class="w-full"
            placeholder="Nama kolom…"
            autofocus
            @keydown.enter="addColumn"
            @keydown.escape="addingColumn = false; newColName = ''"
          />
          <div class="mt-2 flex gap-1.5">
            <UButton
              label="Tambah"
              size="xs"
              color="primary"
              :loading="savingCol"
              @click="addColumn"
            />
            <UButton
              label="Batal"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="addingColumn = false; newColName = ''"
            />
          </div>
        </div>
        <button
          v-else
          type="button"
          class="flex w-full items-center gap-2 rounded-xl border border-dashed border-default px-4 py-3 text-sm text-muted transition-colors hover:border-primary/40 hover:bg-elevated/40 hover:text-highlighted"
          @click="addingColumn = true"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
          Tambah Kolom
        </button>
      </div>
    </div>

    <!-- Live region untuk mode keyboard -->
    <p class="sr-only" role="status" aria-live="polite">
      {{ announceMsg }}
    </p>
  </div>
</template>
