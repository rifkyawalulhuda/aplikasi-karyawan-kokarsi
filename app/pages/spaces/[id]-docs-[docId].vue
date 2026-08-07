<script setup lang="ts">
import type { SpaceDocument } from '~/types/space'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirmActionToast } = useConfirmActionToast()

// Route params: [id]-docs-[docId] -> params.id dan params.docId
const spaceId = computed(() => Number(route.params.id))
const docId = computed(() => Number(route.params.docId))

const { data: doc, pending, error } = useFetch<SpaceDocument>(
  () => `/api/spaces/${spaceId.value}/documents/${docId.value}`,
  {
    credentials: 'include',
    onResponseError({ response }) {
      console.error('[DocPage] fetch error:', response.status, response._data)
    },
  }
)

// Redirect to space if error after load
watch(error, (err) => {
  if (err) {
    console.error('[DocPage] Document fetch failed:', err)
  }
})

const title = ref('')
const content = ref('')
const emoji = ref('📄')

// State baru untuk smart save
type DocStatus = 'idle' | 'dirty' | 'saving' | 'saved'
const docStatus = ref<DocStatus>('idle')
const lastSavedAt = ref<Date | null>(null)
const isHydrating = ref(false)

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Composable untuk word/char count
const { wordCount, charCount } = useDocStats(content)

// Computed untuk status
const hasUnsavedChanges = computed(() => docStatus.value === 'dirty')
const isSaving = computed(() => docStatus.value === 'saving')

// Format timestamp
function formatTime(date: Date | null): string {
  if (!date) return ''
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// Init from loaded doc dengan guard hydrating
watchEffect(() => {
  if (doc.value) {
    isHydrating.value = true
    title.value = doc.value.title
    content.value = doc.value.content ?? JSON.stringify({ type: 'doc', content: [] })
    emoji.value = doc.value.emoji ?? '📄'
    // Set lastSavedAt dari updatedAt dokumen
    if (doc.value.updatedAt) {
      lastSavedAt.value = new Date(doc.value.updatedAt)
    }
    docStatus.value = 'idle'
    // Delay reset hydrating
    nextTick(() => {
      isHydrating.value = false
    })
  }
})

// Debounced auto-save dengan guard hydrating
watch([title, content, emoji], () => {
  if (!doc.value || isHydrating.value) return
  docStatus.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDoc, 1500)
})

async function saveDoc() {
  if (!doc.value) return
  docStatus.value = 'saving'
  try {
    await $fetch(`/api/spaces/${spaceId.value}/documents/${docId.value}`, {
      method: 'PUT',
      body: {
        title: title.value.trim() || 'Untitled',
        content: content.value,
        emoji: emoji.value,
      },
      credentials: 'include',
    })
    lastSavedAt.value = new Date()
    docStatus.value = 'saved'
  } catch (e: any) {
    docStatus.value = 'dirty'
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Error', color: 'error' })
  }
}

// Simpan langsung (untuk tombol & Ctrl+S)
function saveNow() {
  if (!hasUnsavedChanges.value) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  saveDoc()
}

// Keyboard shortcut Ctrl/Cmd+S
function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveNow()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (saveTimer) clearTimeout(saveTimer)
})

// Konfirmasi navigasi keluar saat ada perubahan belum disimpan
onBeforeRouteLeave((_to, _from, next) => {
  if (hasUnsavedChanges.value) {
    confirmActionToast({
      title: 'Perubahan Belum Disimpan',
      description: 'Ada perubahan yang belum disimpan. Buang perubahan?',
      icon: 'i-lucide-alert-triangle',
      color: 'warning',
      confirmLabel: 'Buang Perubahan',
      confirmColor: 'error',
      onConfirm: () => {
        next()
      },
    })
    // Cegah navigasi sampai user konfirmasi
    next(false)
  } else {
    next()
  }
})

// beforeunload untuk refresh/close tab
if (import.meta.client) {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })
}

const EMOJIS = ['📄', '📝', '📋', '📊', '📌', '💡', '🎯', '📚', '🗒️', '📎', '🛠️', '🌟']
</script>

<template>
  <UDashboardPanel id="space-doc-editor">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <NuxtLink :to="`/spaces/${spaceId}`" class="text-muted hover:text-highlighted text-sm">
              <UIcon name="i-lucide-arrow-left" class="size-4" />
            </NuxtLink>
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-3">
            <!-- Status indicator -->
            <div class="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
              <template v-if="docStatus === 'saving'">
                <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </template>
              <template v-else-if="docStatus === 'dirty'">
                <UIcon name="i-lucide-circle-dot" class="size-3.5 text-amber-500" />
                <span class="text-amber-600 dark:text-amber-400">Belum disimpan</span>
              </template>
              <template v-else-if="docStatus === 'saved' || lastSavedAt">
                <UIcon name="i-lucide-check" class="size-3.5 text-green-500" />
                <span>Tersimpan</span>
                <span v-if="lastSavedAt" class="text-muted">• {{ formatTime(lastSavedAt) }}</span>
              </template>
            </div>

            <!-- Save button -->
            <UButton
              label="Simpan"
              icon="i-lucide-save"
              color="primary"
              size="xs"
              :disabled="!hasUnsavedChanges"
              :loading="isSaving"
              @click="saveNow"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading state -->
      <div v-if="pending" class="flex h-full items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex h-full flex-col items-center justify-center gap-3 text-center">
        <UIcon name="i-lucide-alert-circle" class="size-10 text-error" />
        <p class="font-medium text-highlighted">Dokumen tidak ditemukan</p>
        <UButton label="Kembali" color="neutral" variant="outline" @click="router.push(`/spaces/${spaceId}`)" />
      </div>

      <!-- Editor (full-width for desktop) -->
      <div v-else-if="doc" class="px-8 py-8 lg:px-12">
        <!-- Emoji + Title -->
        <div class="mb-6 flex items-start gap-4">
          <UPopover :content="{ side: 'bottom', align: 'start' }">
            <button type="button" class="mt-1 flex size-12 items-center justify-center rounded-xl text-3xl hover:bg-elevated transition-colors">
              {{ emoji }}
            </button>
            <template #content>
              <div class="grid grid-cols-6 gap-1.5 p-2">
                <button
                  v-for="e in EMOJIS"
                  :key="e"
                  type="button"
                  class="flex size-9 items-center justify-center rounded text-xl hover:bg-elevated"
                  :class="emoji === e ? 'bg-elevated ring-1 ring-primary' : ''"
                  @click="emoji = e"
                >{{ e }}</button>
              </div>
            </template>
          </UPopover>

          <div class="flex-1">
            <input
              v-model="title"
              class="w-full bg-transparent text-2xl font-bold text-highlighted outline-none placeholder:text-muted"
              placeholder="Untitled"
              @keydown.enter.prevent
            />
          </div>
        </div>

        <!-- Rich text editor -->
        <SpacesTiptapEditor
          v-model="content"
          :space-id="spaceId"
          placeholder="Mulai menulis dokumen..."
          class="min-h-[60vh]"
        />

        <!-- Footer meta: word/char count + timestamp -->
        <div class="mt-6 flex items-center justify-between border-t border-default pt-4 text-xs text-muted">
          <div class="flex items-center gap-3">
            <span class="tabular-nums">{{ wordCount.toLocaleString('id-ID') }}</span>
            <span>kata</span>
            <span class="text-muted">·</span>
            <span class="tabular-nums">{{ charCount.toLocaleString('id-ID') }}</span>
            <span>karakter</span>
          </div>
          <div v-if="lastSavedAt" class="flex items-center gap-1.5">
            <UIcon name="i-lucide-clock" class="size-3" />
            <span>Terakhir disimpan {{ formatTime(lastSavedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
