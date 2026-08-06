<script setup lang="ts">
import type { SpaceDocument } from '~/types/space'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const spaceId = computed(() => Number(route.params.id))
const docId = computed(() => Number(route.params.docId))

const { data: doc, refresh } = await useFetch<SpaceDocument>(
  () => `/api/spaces/${spaceId.value}/documents/${docId.value}`,
  { credentials: 'include' }
)

const title = ref('')
const content = ref('')
const emoji = ref('📄')
const editingTitle = ref(false)
const autoSaveStatus = ref<'saved' | 'saving' | 'idle'>('idle')

// Init from loaded doc
watchEffect(() => {
  if (doc.value) {
    title.value = doc.value.title
    content.value = doc.value.content ?? JSON.stringify({ type: 'doc', content: [] })
    emoji.value = doc.value.emoji ?? '📄'
  }
})

// Debounced auto-save
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch([title, content, emoji], () => {
  autoSaveStatus.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveDoc, 1500)
})

async function saveDoc() {
  if (!doc.value) return
  autoSaveStatus.value = 'saving'
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
    autoSaveStatus.value = 'saved'
    setTimeout(() => { autoSaveStatus.value = 'idle' }, 2000)
  } catch (e: any) {
    autoSaveStatus.value = 'idle'
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Error', color: 'error' })
  }
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
            <NuxtLink :to="`/spaces/${spaceId}/docs`" class="text-muted hover:text-highlighted text-sm">
              <UIcon name="i-lucide-arrow-left" class="size-4" />
            </NuxtLink>
          </div>
        </template>
        <template #right>
          <div class="flex items-center gap-2 text-xs text-muted">
            <template v-if="autoSaveStatus === 'saving'">
              <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
              Menyimpan...
            </template>
            <template v-else-if="autoSaveStatus === 'saved'">
              <UIcon name="i-lucide-check" class="size-3.5 text-green-500" />
              Tersimpan
            </template>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto max-w-3xl px-6 py-8">
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
          v-if="doc"
          v-model="content"
          placeholder="Mulai menulis dokumen..."
          class="min-h-[60vh]"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
