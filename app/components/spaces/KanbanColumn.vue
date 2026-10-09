<script setup lang="ts">
import type { SpaceCard, SpaceColumn } from '~/types/space'
import { BOARD_DND_KEY } from '~/composables/useBoardDnd'
import { colorClass, colorHex } from './board-meta'

const props = defineProps<{
  column: SpaceColumn
  /** Warna tersedia untuk diubah lewat menu kolom. */
  colors: string[]
}>()

const emit = defineEmits<{
  addCard: [title: string]
  rename: [name: string]
  colorChange: [color: string]
  delete: []
}>()

const dnd = inject(BOARD_DND_KEY)

// ── Tambah kartu inline ──────────────────────────────────────────────────────
const addingCard = ref(false)
const newCardTitle = ref('')
const savingCard = ref(false)

async function submitCard() {
  const title = newCardTitle.value.trim()
  if (!title) {
    addingCard.value = false
    return
  }
  savingCard.value = true
  try {
    emit('addCard', title)
    newCardTitle.value = ''
    addingCard.value = false
  } finally {
    savingCard.value = false
  }
}

// ── Rename inline ────────────────────────────────────────────────────────────
const editingName = ref(false)
const editName = ref('')

function startRename() {
  editName.value = props.column.name
  editingName.value = true
}

async function saveName() {
  const name = editName.value.trim()
  editingName.value = false
  if (!name || name === props.column.name) return
  emit('rename', name)
}

// ── Ubah warna ───────────────────────────────────────────────────────────────
const colorOpen = ref(false)

// ── Ringkasan kolom ──────────────────────────────────────────────────────────
const cards = computed<SpaceCard[]>(() => props.column.cards ?? [])
const dueSoonCount = computed(() =>
  cards.value.filter(c => c.dueDate && !isOverdueDate(c.dueDate)
    && (new Date(c.dueDate).getTime() - Date.now()) <= 2 * 86_400_000).length
)
const overdueCount = computed(() =>
  cards.value.filter(c => c.dueDate && new Date(c.dueDate).getTime() < Date.now()).length
)

function isOverdueDate(date: string) {
  return new Date(date).getTime() < Date.now()
}

function onHeaderPointerDown(e: PointerEvent) {
  dnd?.onColumnPointerDown(e, props.column.id)
}

function onHeaderKeyDown(e: KeyboardEvent) {
  dnd?.onColumnKeyDown(e, props.column.id)
}

const isLifted = computed(() =>
  dnd?.draggingColumnId.value === props.column.id || dnd?.grabbedColumnId.value === props.column.id
)
</script>

<template>
  <div
    :data-col-id="column.id"
    :data-flip-key="`col-${column.id}`"
    class="flex w-72 shrink-0 flex-col rounded-xl border transition-[border-color,background-color,box-shadow] duration-150"
    :class="[
      isLifted ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/25' : 'border-default bg-elevated/40'
    ]"
  >
    <!-- Header: grip + titik warna + nama + jumlah + menu -->
    <div
      class="flex cursor-grab items-center gap-2 px-3 pt-3 pb-2 active:cursor-grabbing"
      :aria-label="`Kolom ${column.name} — tahan untuk memindah urutan`"
      @pointerdown="onHeaderPointerDown"
      @keydown="onHeaderKeyDown"
    >
      <UIcon
        name="i-lucide-grip-vertical"
        class="size-3.5 shrink-0 text-dimmed"
        aria-hidden="true"
      />

      <!-- Titik warna + popover ubah warna -->
      <UPopover v-model:open="colorOpen" :content="{ side: 'bottom', align: 'start' }">
        <button
          type="button"
          class="flex size-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="colorClass(column.color)"
          :style="{ backgroundColor: colorHex(column.color) }"
          :aria-label="`Ubah warna kolom ${column.name}`"
          data-no-drag
          @click.stop
        >
          <UIcon v-if="colorOpen" name="i-lucide-check" class="size-2 text-white drop-shadow" />
        </button>
        <template #content>
          <div class="p-2">
            <p class="mb-1.5 px-1 text-[11px] font-medium text-muted">
              Warna kolom
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="c in colors"
                :key="c"
                type="button"
                class="size-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                :class="[colorClass(c), column.color === c ? 'ring-2 ring-highlighted ring-offset-1 ring-offset-default' : '']"
                :style="{ backgroundColor: colorHex(c) }"
                :aria-label="`Warna ${c}`"
                @click="emit('colorChange', c); colorOpen = false"
              />
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Nama kolom (rename inline) -->
      <div class="min-w-0 flex-1">
        <input
          v-if="editingName"
          v-model="editName"
          class="w-full rounded bg-default px-1.5 py-0.5 text-sm font-semibold text-highlighted outline-none ring-1 ring-primary"
          autofocus
          data-no-drag
          @blur="saveName"
          @keydown.enter="saveName"
          @keydown.escape="editingName = false"
        >
        <button
          v-else
          type="button"
          class="w-full truncate text-left text-sm font-semibold text-highlighted"
          title="Klik dua kali untuk mengganti nama"
          data-no-drag
          @dblclick.stop="startRename"
        >
          {{ column.name }}
        </button>
      </div>

      <!-- Ringkasan: jumlah + due soon/overdue -->
      <span class="shrink-0 text-xs tabular-nums text-muted">{{ cards.length }}</span>
      <span
        v-if="overdueCount > 0"
        class="flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300"
        :title="`${overdueCount} kartu terlambat`"
      >{{ overdueCount }}</span>
      <span
        v-else-if="dueSoonCount > 0"
        class="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        :title="`${dueSoonCount} kartu jatuh tempo ≤2 hari`"
      >{{ dueSoonCount }}</span>

      <UDropdownMenu
        :items="[[
          { label: 'Tambah Card', icon: 'i-lucide-plus', onSelect: () => { addingCard = true } },
          { label: 'Ganti Nama', icon: 'i-lucide-pencil', onSelect: startRename },
          { label: 'Hapus Kolom', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete') }
        ]]"
      >
        <UButton
          icon="i-lucide-more-horizontal"
          variant="ghost"
          color="neutral"
          size="xs"
          aria-label="Menu kolom"
          data-no-drag
          @click.stop
        />
      </UDropdownMenu>
    </div>

    <!-- Daftar kartu: target drop -->
    <div
      data-col-list
      class="board-col-list flex-1 space-y-2 overflow-y-auto px-3 pb-2"
      style="max-height: calc(100dvh - 300px)"
    >
      <!-- Penanda kolom kosong saat drag -->
      <div
        v-if="!cards.length"
        class="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-default text-xs text-dimmed"
      >
        Belum ada kartu
      </div>

      <slot />

      <!-- Form tambah kartu -->
      <div v-if="addingCard" class="rounded-lg border border-primary/40 bg-default p-2.5" data-no-drag>
        <UTextarea
          v-model="newCardTitle"
          :rows="2"
          class="w-full text-sm"
          placeholder="Judul kartu… (Enter untuk simpan)"
          autofocus
          @keydown.enter.exact.prevent="submitCard"
          @keydown.escape="addingCard = false; newCardTitle = ''"
        />
        <div class="mt-2 flex gap-1.5">
          <UButton
            label="Tambah"
            size="xs"
            color="primary"
            :loading="savingCard"
            @click="submitCard"
          />
          <UButton
            label="Batal"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="addingCard = false; newCardTitle = ''"
          />
        </div>
      </div>
    </div>

    <!-- Tambah kartu -->
    <div class="px-3 pb-3">
      <button
        v-if="!addingCard"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-highlighted"
        data-no-drag
        @click="addingCard = true"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        Tambah kartu
      </button>
    </div>
  </div>
</template>
