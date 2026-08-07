<script setup lang="ts">
import type { SpaceDocument } from '~/types/space'

const props = defineProps<{
  spaceId: number
}>()

const router = useRouter()
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { confirmActionToast } = useConfirmActionToast()

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

// State baru untuk smart save
type DocStatus = 'idle' | 'dirty' | 'saving' | 'saved'
const docStatus = ref<DocStatus>('idle')
const lastSavedAt = ref<Date | null>(null)
const isHydrating = ref(false)
const isNavigatingToFullPage = ref(false)

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Composable untuk word/char count
const { wordCount, charCount } = useDocStats(editorContent)

// Computed untuk status
const hasUnsavedChanges = computed(() => docStatus.value === 'dirty')
const isSaving = computed(() => docStatus.value === 'saving')

// Format timestamp
function formatTime(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

async function openDoc(doc: SpaceDocument) {
  editorDocId.value = doc.id
  editorTitle.value = doc.title
  editorEmoji.value = doc.emoji ?? '📄'
  editorOpen.value = true
  editorLoading.value = true
  isHydrating.value = true
  docStatus.value = 'idle'
  lastSavedAt.value = null

  try {
    const full = await $fetch<SpaceDocument>(
      `/api/spaces/${props.spaceId}/documents/${doc.id}`,
      { credentials: 'include' }
    )
    editorContent.value = full.content ?? JSON.stringify({ type: 'doc', content: [] })
    // Set lastSavedAt dari updatedAt dokumen
    if (full.updatedAt) {
      lastSavedAt.value = new Date(full.updatedAt)
    }
  } catch (e: any) {
    toast.add({ title: 'Gagal memuat dokumen', color: 'error' })
    editorOpen.value = false
  } finally {
    editorLoading.value = false
    // Delay reset hydrating agar watch tidak trigger
    nextTick(() => {
      isHydrating.value = false
    })
  }
}

function closeEditor() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  editorOpen.value = false
  editorDocId.value = null
  editorContent.value = ''
  editorTitle.value = ''
  editorEmoji.value = '📄'
  docStatus.value = 'idle'
  lastSavedAt.value = null
  refresh()
}

// Konfirmasi tutup saat ada perubahan belum disimpan
function handleCloseEditor() {
  // Skip jika sedang navigasi ke full-page
  if (isNavigatingToFullPage.value) {
    isNavigatingToFullPage.value = false
    return
  }
  
  if (hasUnsavedChanges.value) {
    confirmActionToast({
      title: 'Perubahan Belum Disimpan',
      description: 'Ada perubahan yang belum disimpan. Buang perubahan?',
      icon: 'i-lucide-alert-triangle',
      color: 'warning',
      confirmLabel: 'Buang Perubahan',
      confirmColor: 'error',
      onConfirm: () => {
        closeEditor()
      },
    })
  } else {
    closeEditor()
  }
}

// Auto-save on changes dengan guard hydrating
watch([editorTitle, editorContent, editorEmoji], () => {
  if (!editorDocId.value || editorLoading.value || isHydrating.value) return
  docStatus.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDoc, 1500)
})

async function saveDoc() {
  if (!editorDocId.value) return
  docStatus.value = 'saving'
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
    lastSavedAt.value = new Date()
    docStatus.value = 'saved'
  } catch {
    docStatus.value = 'dirty'
    toast.add({ title: 'Gagal menyimpan', color: 'error' })
  }
}

// Simpan langsung (untuk tombol & Ctrl+S)
function saveNow() {
  if (!hasUnsavedChanges.value) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  saveDoc()
}

// Buka di halaman penuh (auto-save dulu jika ada perubahan)
async function openFullPage() {
  const docId = editorDocId.value
  const spaceId = props.spaceId
  if (!docId) return
  
  // Auto-save jika ada perubahan belum disimpan
  if (hasUnsavedChanges.value) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    await saveDoc()
  }
  
  // Set flag agar handleCloseEditor tidak memproses
  isNavigatingToFullPage.value = true
  editorOpen.value = false
  
  // Route flat: /spaces/[id]-docs-[docId]
  await navigateTo(`/spaces/${spaceId}-docs-${docId}`)
}

// Keyboard shortcut Ctrl/Cmd+S
function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveNow()
  }
}

// Pasang/lepas listener keyboard saat modal open/close
watch(editorOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKeyDown)
  } else {
    window.removeEventListener('keydown', handleKeyDown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (saveTimer) clearTimeout(saveTimer)
})

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

  <!-- Inline Document Editor Modal (Notion-style) -->
  <UModal
    v-model:open="editorOpen"
    :ui="{ content: 'max-w-5xl w-full' }"
    :title="editorTitle || 'Untitled'"
    @update:open="(v) => { if (!v) handleCloseEditor() }"
  >
    <template #header>
      <div class="flex flex-1 items-center gap-3 min-w-0 pr-8">
        <!-- Emoji picker -->
        <UPopover :content="{ side: 'bottom', align: 'start' }">
          <button type="button" class="flex size-10 shrink-0 items-center justify-center rounded-lg text-2xl hover:bg-elevated transition-colors">
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

        <!-- Editable title (larger, Notion-style) -->
        <input
          v-model="editorTitle"
          class="flex-1 min-w-0 bg-transparent text-lg font-semibold text-highlighted outline-none placeholder:text-muted truncate"
          placeholder="Untitled"
          @keydown.enter.prevent
        />

        <!-- Expand to full page -->
        <UButton
          icon="i-lucide-maximize-2"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          title="Buka halaman penuh"
          aria-label="Buka halaman penuh"
          @click.stop="openFullPage"
        />
      </div>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="editorLoading" class="flex h-64 items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Editor (centered, Notion-style) -->
      <div v-else class="mx-auto max-w-3xl px-4 py-2">
        <SpacesTiptapEditor
          :key="editorDocId ?? 'new'"
          v-model="editorContent"
          :space-id="spaceId"
          placeholder="Mulai menulis dokumen..."
          class="min-h-[55vh]"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <!-- Left: Status + Stats -->
        <div class="flex items-center gap-3 text-xs text-muted" aria-live="polite">
          <!-- Status indicator -->
          <div class="flex items-center gap-1.5">
            <template v-if="docStatus === 'saving'">
              <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
              <span>Menyimpan...</span>
            </template>
            <template v-else-if="docStatus === 'dirty'">
              <UIcon name="i-lucide-circle-dot" class="size-3.5 text-amber-500" />
              <span class="text-amber-600 dark:text-amber-400">Perubahan belum disimpan</span>
            </template>
            <template v-else-if="docStatus === 'saved' || lastSavedAt">
              <UIcon name="i-lucide-check" class="size-3.5 text-green-500" />
              <span>Tersimpan</span>
              <span v-if="lastSavedAt" class="text-muted">• {{ formatTime(lastSavedAt) }}</span>
            </template>
          </div>

          <!-- Word/char count -->
          <div class="flex items-center gap-1.5 border-l border-default pl-3">
            <span class="tabular-nums">{{ wordCount.toLocaleString('id-ID') }}</span>
            <span>kata</span>
            <span class="text-muted">·</span>
            <span class="tabular-nums">{{ charCount.toLocaleString('id-ID') }}</span>
            <span>karakter</span>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleCloseEditor"
          />
          <UButton
            label="Simpan"
            color="primary"
            size="sm"
            :disabled="!hasUnsavedChanges"
            :loading="isSaving"
            @click="saveNow"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
