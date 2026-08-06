<script setup lang="ts">
import type { SpaceAnnouncement } from '~/types/space'

const props = defineProps<{
  announcement: SpaceAnnouncement
  spaceId: number
  currentUserId?: number
}>()

const emit = defineEmits<{
  updated: [ann: SpaceAnnouncement]
  deleted: [annId: number]
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const requestFetch = useRequestFetch()

const editing = ref(false)
const editContent = ref('')
const saving = ref(false)

function startEdit() {
  editContent.value = props.announcement.content
  editing.value = true
}

async function saveEdit() {
  if (!editContent.value.trim()) return
  saving.value = true
  try {
    const updated = await requestFetch<SpaceAnnouncement>(
      `/api/spaces/${props.spaceId}/announcements/${props.announcement.id}`,
      { method: 'PUT', body: { content: editContent.value.trim() } }
    )
    editing.value = false
    emit('updated', updated as SpaceAnnouncement)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui pengumuman', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function togglePin() {
  try {
    const updated = await requestFetch<SpaceAnnouncement>(
      `/api/spaces/${props.spaceId}/announcements/${props.announcement.id}`,
      { method: 'PUT', body: { isPinned: !props.announcement.isPinned } }
    )
    emit('updated', updated as SpaceAnnouncement)
  } catch (e: any) {
    toast.add({ title: 'Gagal mengubah pin', color: 'error' })
  }
}

function deleteAnn() {
  confirmDeleteToast({
    title: 'Hapus Pengumuman',
    description: 'Pengumuman ini akan dihapus permanen.',
    onConfirm: async () => {
      await requestFetch(`/api/spaces/${props.spaceId}/announcements/${props.announcement.id}`, {
        method: 'DELETE',
      })
      emit('deleted', props.announcement.id)
    },
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="relative rounded-lg border border-default bg-elevated/30 p-3.5">
    <!-- Pin indicator -->
    <div
      v-if="announcement.isPinned"
      class="absolute -top-px left-4 h-0.5 w-8 rounded-b bg-primary"
    />

    <!-- Content or edit form -->
    <div v-if="!editing">
      <p class="text-sm text-highlighted whitespace-pre-wrap leading-relaxed">{{ announcement.content }}</p>
      <div class="mt-2 flex items-center gap-2 text-xs text-muted">
        <span class="font-medium">{{ announcement.createdByName }}</span>
        <span>·</span>
        <span>{{ formatTime(announcement.updatedAt) }}</span>
        <UBadge
          v-if="announcement.isPinned"
          label="Disematkan"
          color="primary"
          variant="subtle"
          size="sm"
          class="ml-1"
        />
      </div>
    </div>

    <!-- Edit form -->
    <div v-else>
      <UTextarea
        v-model="editContent"
        :rows="3"
        class="w-full text-sm"
        autofocus
        @keydown.escape="editing = false"
      />
      <div class="mt-2 flex gap-1.5">
        <UButton label="Simpan" size="xs" color="primary" :loading="saving" @click="saveEdit" />
        <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="editing = false" />
      </div>
    </div>

    <!-- Actions -->
    <div v-if="!editing" class="absolute right-2 top-2">
      <UDropdownMenu
        :items="[[
          { label: announcement.isPinned ? 'Lepas Sematan' : 'Sematkan', icon: 'i-lucide-pin', onSelect: togglePin },
          { label: 'Edit', icon: 'i-lucide-pencil', onSelect: startEdit },
          { label: 'Hapus', icon: 'i-lucide-trash-2', color: 'error', onSelect: deleteAnn },
        ]]"
      >
        <UButton icon="i-lucide-more-horizontal" variant="ghost" color="neutral" size="xs" />
      </UDropdownMenu>
    </div>
  </div>
</template>

<style scoped>
</style>
