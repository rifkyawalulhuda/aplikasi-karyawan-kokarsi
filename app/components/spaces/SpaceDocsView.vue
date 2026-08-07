<script setup lang="ts">
import type { SpaceDocument } from '~/types/space'

const props = defineProps<{
  spaceId: number
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

const { data: docs, refresh, pending } = useFetch<SpaceDocument[]>(
  () => `/api/spaces/${props.spaceId}/documents`,
  { credentials: 'include', lazy: false }
)

// ── Create doc ────────────────────────────────────────────────────────────────
const creating = ref(false)
const newTitle = ref('')
const newEmoji = ref('📄')
const saving = ref(false)

const EMOJIS = ['📄', '📝', '📋', '📊', '📌', '💡', '🎯', '📚', '🗒️', '📎', '🛠️', '🌟']

async function createDoc() {
  if (!newTitle.value.trim()) return
  saving.value = true
  try {
    const doc = await $fetch<SpaceDocument>(`/api/spaces/${props.spaceId}/documents`, {
      method: 'POST',
      body: {
        title: newTitle.value.trim(),
        emoji: newEmoji.value,
        content: JSON.stringify({ type: 'doc', content: [] }),
      },
      credentials: 'include',
    })
    newTitle.value = ''
    creating.value = false
    await refresh()
    openDoc(doc)
  } catch (e: any) {
    toast.add({ title: 'Gagal membuat dokumen', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── Delete doc ────────────────────────────────────────────────────────────────
function deleteDoc(doc: SpaceDocument) {
  confirmDeleteToast({
    title: 'Hapus Dokumen',
    description: `Dokumen "${doc.title}" akan dihapus permanen.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${props.spaceId}/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (editorDocId.value === doc.id) closeEditor()
      refresh()
      toast.add({ title: 'Dokumen dihapus', color: 'success' })
    },
  })
}

// ── Inline editor ─────────────────────────────────────────────────────────────
const editorOpen = ref(false)
const editorDocId = ref<number | null>(null)
const editorTitle = ref('')
const editorContent = ref('')
const editorEmoji = ref('📄')
const editorLoading = ref(false)
const autoSaveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function openDoc(doc: SpaceDocument) {
  editorDocId.value = doc.id
  editorTitle.value = doc.title
  editorEmoji.value = doc.emoji ?? '📄'
  editorOpen.value = true
  editorLoading.value = true

  try {
    const full = await $fetch<SpaceDocument>(
      `/api/spaces/${props.spaceId}/documents/${doc.id}`,
      { credentials: 'include' }
    )
    editorContent.value = full.content ?? JSON.stringify({ type: 'doc', content: [] })
  } catch (e: any) {
    toast.add({ title: 'Gagal memuat dokumen', color: 'error' })
    editorOpen.value = false
  } finally {
    editorLoading.value = false
  }
}

function closeEditor() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  editorOpen.value = false
  editorDocId.value = null
  autoSaveStatus.value = 'idle'
  refresh()
}

// Auto-save on changes
watch([editorTitle, editorContent, editorEmoji], () => {
  if (!editorDocId.value || editorLoading.value) return
  autoSaveStatus.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDoc, 1500)
})

async function saveDoc() {
  if (!editorDocId.value) return
  autoSaveStatus.value = 'saving'
  try {
    await $fetch(`/api/spaces/${props.spaceId}/documents/${editorDocId.value}`, {
      method: 'PUT',
      body: {
        title: editorTitle.value.trim() || 'Untitled',
        content: editorContent.value,
        emoji: editorEmoji.value,
      },
      credentials: 'include',
    })
    autoSaveStatus.value = 'saved'
    setTimeout(() => { autoSaveStatus.value = 'idle' }, 2000)
  } catch {
    autoSaveStatus.value = 'idle'
    toast.add({ title: 'Gagal menyimpan', color: 'error' })
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">Dokumen</h2>
        <p class="text-sm text-muted">Catatan dan dokumentasi bersama untuk Space ini</p>
      </div>
      <UButton label="Dokumen Baru" icon="i-lucide-plus" color="primary" size="sm" @click="creating = true" />
    </div>

    <!-- Create form -->
    <div v-if="creating" class="mb-6 rounded-xl border border-primary/40 bg-elevated/30 p-4">
      <p class="mb-3 text-sm font-medium text-highlighted">Dokumen Baru</p>
      <div class="flex items-center gap-3">
        <UPopover :content="{ side: 'bottom' }">
          <button type="button" class="flex size-10 items-center justify-center rounded-lg border border-default bg-elevated/50 text-xl hover:bg-elevated">
            {{ newEmoji }}
          </button>
          <template #content>
            <div class="grid grid-cols-6 gap-1 p-2">
              <button v-for="e in EMOJIS" :key="e" type="button"
                class="flex size-8 items-center justify-center rounded text-lg hover:bg-elevated"
                @click="newEmoji = e">{{ e }}</button>
            </div>
          </template>
        </UPopover>
        <UInput v-model="newTitle" class="flex-1" placeholder="Judul dokumen..." autofocus
          @keydown.enter="createDoc" @keydown.escape="creating = false" />
      </div>
      <div class="mt-3 flex gap-2">
        <UButton label="Buat" size="sm" color="primary" :loading="saving" @click="createDoc" />
        <UButton label="Batal" size="sm" color="neutral" variant="ghost" @click="creating = false; newTitle = ''" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pending && !creating" class="flex h-40 items-center justify-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!pending && !docs?.length && !creating" class="flex h-48 flex-col items-center justify-center gap-3 text-center">
      <div class="rounded-full bg-elevated p-4">
        <UIcon name="i-lucide-file-text" class="size-8 text-muted" />
      </div>
      <div>
        <p class="font-medium text-highlighted">Belum ada dokumen</p>
        <p class="text-sm text-muted">Buat dokumen pertama untuk Space ini</p>
      </div>
      <UButton label="Dokumen Baru" icon="i-lucide-plus" color="primary" size="sm" @click="creating = true" />
    </div>

    <!-- Doc grid -->
    <div v-else-if="docs?.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="doc in docs" :key="doc.id"
        class="group relative overflow-hidden rounded-xl border border-default bg-default p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer"
        @click="openDoc(doc)">
        <div class="mb-2 flex items-center gap-2.5">
          <span class="text-2xl">{{ doc.emoji ?? '📄' }}</span>
          <p class="flex-1 truncate font-semibold text-highlighted group-hover:text-primary">{{ doc.title }}</p>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-user" class="size-3" />
          <span>{{ doc.createdByName }}</span>
          <span>·</span>
          <span>{{ formatDate(doc.updatedAt) }}</span>
        </div>
        <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs"
          class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="deleteDoc(doc)" />
      </div>
    </div>
  </div>

  <!-- Inline Document Editor Modal -->
  <UModal
    v-model:open="editorOpen"
    :ui="{ content: 'max-w-4xl w-full' }"
    :title="editorTitle || 'Untitled'"
    @update:open="(v) => { if (!v) closeEditor() }"
  >
    <template #header>
      <div class="flex flex-1 items-center gap-3 min-w-0 pr-8">
        <!-- Emoji picker -->
        <UPopover :content="{ side: 'bottom', align: 'start' }">
          <button type="button" class="flex size-8 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-elevated transition-colors">
            {{ editorEmoji }}
          </button>
          <template #content>
            <div class="grid grid-cols-6 gap-1 p-2">
              <button v-for="e in EMOJIS" :key="e" type="button"
                class="flex size-8 items-center justify-center rounded text-lg hover:bg-elevated"
                :class="editorEmoji === e ? 'bg-elevated ring-1 ring-primary' : ''"
                @click="editorEmoji = e">{{ e }}</button>
            </div>
          </template>
        </UPopover>

        <!-- Editable title -->
        <input
          v-model="editorTitle"
          class="flex-1 min-w-0 bg-transparent text-base font-semibold text-highlighted outline-none placeholder:text-muted truncate"
          placeholder="Untitled"
          @keydown.enter.prevent
        />

        <!-- Auto-save status -->
        <div class="flex items-center gap-1.5 text-xs text-muted shrink-0">
          <template v-if="autoSaveStatus === 'saving'">
            <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
            <span>Menyimpan...</span>
          </template>
          <template v-else-if="autoSaveStatus === 'saved'">
            <UIcon name="i-lucide-check" class="size-3.5 text-green-500" />
            <span>Tersimpan</span>
          </template>
        </div>
      </div>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="editorLoading" class="flex h-64 items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Editor -->
      <div v-else class="min-h-[60vh]">
        <SpacesTiptapEditor
          v-model="editorContent"
          placeholder="Mulai menulis dokumen..."
          class="min-h-[55vh]"
        />
      </div>
    </template>
  </UModal>
</template>
