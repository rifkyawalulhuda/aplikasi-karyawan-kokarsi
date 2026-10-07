<script setup lang="ts">
import type { Space, SpaceAnnouncement } from '~/types/space'
import { errorMessage } from './board-meta'

const props = defineProps<{
  space: Space
  spaceId: number
}>()

const emit = defineEmits<{ updated: [] }>()

const toast = useToast()

// Load announcements
const { data: announcements, refresh } = useFetch<SpaceAnnouncement[]>(
  () => `/api/spaces/${props.spaceId}/announcements`,
  { credentials: 'include', lazy: true }
)

// Realtime: pembaruan pengumuman dari user lain → muat ulang daftar
const sse = useSpaceSseContext()
watch(() => sse?.events.value ?? [], (list) => {
  const latest = list[list.length - 1]
  if (!latest) return
  if (latest.type === 'ANNOUNCEMENT_CREATED' || latest.type === 'ANNOUNCEMENT_UPDATED' || latest.type === 'ANNOUNCEMENT_DELETED') {
    refresh()
  }
}, { deep: true })

const collapsed = ref(false)
const adding = ref(false)
const newContent = ref('')
const saving = ref(false)

async function addAnnouncement() {
  if (!newContent.value.trim()) return
  saving.value = true
  try {
    await $fetch(`/api/spaces/${props.spaceId}/announcements`, {
      method: 'POST',
      body: { content: newContent.value.trim(), isPinned: true },
      credentials: 'include'
    })
    newContent.value = ''
    adding.value = false
    refresh()
    emit('updated')
  } catch (err: unknown) {
    toast.add({ title: 'Gagal menambahkan pengumuman', description: errorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

function onUpdated() {
  refresh()
  emit('updated')
}

function onDeleted() {
  refresh()
  emit('updated')
}

const hasAnnouncements = computed(() => (announcements.value?.length ?? 0) > 0)
</script>

<template>
  <div v-if="hasAnnouncements || adding" class="border-b border-default">
    <!-- Header -->
    <div class="flex items-center gap-2 px-4 py-2">
      <UIcon name="i-lucide-megaphone" class="size-3.5 text-primary shrink-0" />
      <span class="text-xs font-semibold text-muted uppercase tracking-wide flex-1">
        Pengumuman
        <span v-if="announcements?.length" class="ml-1 font-normal normal-case">
          ({{ announcements.length }})
        </span>
      </span>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-plus"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="Tambah pengumuman"
          @click="adding = !adding"
        />
        <UButton
          :icon="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="collapsed ? 'Tampilkan' : 'Sembunyikan'"
          @click="collapsed = !collapsed"
        />
      </div>
    </div>

    <!-- Announcement list -->
    <div v-if="!collapsed" class="px-4 pb-3 space-y-2">
      <!-- Add form -->
      <div v-if="adding" class="rounded-lg border border-primary/40 bg-default p-3">
        <UTextarea
          v-model="newContent"
          :rows="2"
          class="w-full text-sm"
          placeholder="Tulis pengumuman..."
          autofocus
          @keydown.escape="adding = false; newContent = ''"
        />
        <div class="mt-2 flex gap-1.5">
          <UButton
            label="Posting"
            size="xs"
            color="primary"
            :loading="saving"
            @click="addAnnouncement"
          />
          <UButton
            label="Batal"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="adding = false; newContent = ''"
          />
        </div>
      </div>

      <!-- Announcements -->
      <div v-for="ann in announcements ?? []" :key="ann.id" class="group relative">
        <SpacesSpaceAnnouncement
          :announcement="ann"
          :space-id="spaceId"
          @updated="onUpdated"
          @deleted="onDeleted"
        />
      </div>
    </div>
  </div>

  <!-- Show add button even if no announcements yet -->
  <div v-else class="border-b border-default px-4 py-1.5 flex items-center gap-2">
    <button
      type="button"
      class="flex items-center gap-1.5 text-xs text-muted hover:text-highlighted transition-colors"
      @click="adding = true"
    >
      <UIcon name="i-lucide-megaphone" class="size-3.5" />
      Tambah Pengumuman
    </button>
  </div>
</template>
