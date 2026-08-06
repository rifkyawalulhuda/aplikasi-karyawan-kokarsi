<script setup lang="ts">
import type { SpaceColumn, SpaceCard } from '~/types/space'

const props = defineProps<{
  column: SpaceColumn
  spaceId: number
}>()

const emit = defineEmits<{
  cardClick: [card: SpaceCard]
  columnUpdated: []
  cardAdded: []
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

// Inline add card
const addingCard = ref(false)
const newCardTitle = ref('')
const savingCard = ref(false)

async function addCard() {
  if (!newCardTitle.value.trim()) { addingCard.value = false; return }
  savingCard.value = true
  try {
    await $fetch(`/api/spaces/${props.spaceId}/columns/${props.column.id}/cards`, {
      method: 'POST',
      body: { title: newCardTitle.value.trim() },
      credentials: 'include',
    })
    newCardTitle.value = ''
    addingCard.value = false
    emit('cardAdded')
  } catch (e: any) {
    toast.add({ title: 'Gagal tambah card', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    savingCard.value = false
  }
}

// Edit column name
const editingName = ref(false)
const editName = ref(props.column.name)

async function saveColumnName() {
  if (!editName.value.trim() || editName.value === props.column.name) {
    editingName.value = false
    return
  }
  try {
    await $fetch(`/api/spaces/${props.spaceId}/columns/${props.column.id}`, {
      method: 'PUT',
      body: { name: editName.value.trim() },
      credentials: 'include',
    })
    editingName.value = false
    emit('columnUpdated')
  } catch {
    toast.add({ title: 'Gagal mengubah nama kolom', color: 'error' })
  }
}

// Delete column
function deleteColumn() {
  confirmDeleteToast({
    title: 'Hapus Kolom',
    description: `Kolom "${props.column.name}" akan dihapus. Semua card harus sudah dipindahkan.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${props.spaceId}/columns/${props.column.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      emit('columnUpdated')
    },
  })
}

const COLUMN_COLORS: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', sky: 'bg-sky-500', teal: 'bg-teal-500',
  green: 'bg-green-500', yellow: 'bg-amber-400', orange: 'bg-orange-500',
  red: 'bg-red-500', pink: 'bg-pink-500', purple: 'bg-purple-500', indigo: 'bg-indigo-500',
}
</script>

<template>
  <div class="flex w-72 shrink-0 flex-col rounded-xl border border-default bg-elevated/30">
    <!-- Column Header -->
    <div class="flex items-center gap-2 px-3 pt-3 pb-2">
      <div class="size-2 rounded-full" :class="COLUMN_COLORS[column.color] ?? 'bg-gray-400'" />
      <div class="flex-1 min-w-0">
        <input
          v-if="editingName"
          v-model="editName"
          class="w-full rounded bg-default px-1.5 py-0.5 text-sm font-semibold text-highlighted outline-none ring-1 ring-primary"
          @blur="saveColumnName"
          @keydown.enter="saveColumnName"
          @keydown.escape="editingName = false"
        />
        <button
          v-else
          type="button"
          class="truncate text-sm font-semibold text-highlighted hover:text-primary"
          @dblclick="editingName = true; editName = column.name"
        >{{ column.name }}</button>
      </div>
      <span class="text-xs text-muted">{{ column.cards?.length ?? 0 }}</span>
      <UDropdownMenu
        :items="[[
          { label: 'Tambah Card', icon: 'i-lucide-plus', onSelect: () => { addingCard = true } },
          { label: 'Rename Kolom', icon: 'i-lucide-pencil', onSelect: () => { editingName = true; editName = column.name } },
          { label: 'Hapus Kolom', icon: 'i-lucide-trash-2', color: 'error', onSelect: deleteColumn },
        ]]"
      >
        <UButton icon="i-lucide-more-horizontal" variant="ghost" color="neutral" size="xs" />
      </UDropdownMenu>
    </div>

    <!-- Cards list (drag target via parent) -->
    <div class="flex-1 space-y-2 overflow-y-auto px-3 pb-2" style="max-height: calc(100vh - 280px)">
      <slot />

      <!-- Inline add card form -->
      <div v-if="addingCard" class="rounded-lg border border-primary/40 bg-default p-2.5">
        <UTextarea
          v-model="newCardTitle"
          :rows="2"
          class="w-full text-sm"
          placeholder="Judul card..."
          autofocus
          @keydown.enter.exact.prevent="addCard"
          @keydown.escape="addingCard = false; newCardTitle = ''"
        />
        <div class="mt-2 flex gap-1.5">
          <UButton label="Tambah" size="xs" color="primary" :loading="savingCard" @click="addCard" />
          <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="addingCard = false; newCardTitle = ''" />
        </div>
      </div>
    </div>

    <!-- Add card button -->
    <div class="px-3 pb-3">
      <button
        v-if="!addingCard"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-highlighted"
        @click="addingCard = true"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        Tambah card
      </button>
    </div>
  </div>
</template>
