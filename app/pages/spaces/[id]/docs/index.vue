<script setup lang="ts">
import type { SpaceDocument } from '~/types/space'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

const spaceId = computed(() => Number(route.params.id))

const { data: docs, refresh, pending } = await useFetch<SpaceDocument[]>(
  () => `/api/spaces/${spaceId.value}/documents`,
  { credentials: 'include' }
)

const creating = ref(false)
const newTitle = ref('')
const newEmoji = ref('📄')
const saving = ref(false)

const EMOJIS = ['📄', '📝', '📋', '📊', '📌', '💡', '🎯', '📚', '🗒️', '📎', '🛠️', '🌟']

async function createDoc() {
  if (!newTitle.value.trim()) return
  saving.value = true
  try {
    const doc = await $fetch<SpaceDocument>(`/api/spaces/${spaceId.value}/documents`, {
      method: 'POST',
      body: {
        title: newTitle.value.trim(),
        emoji: newEmoji.value,
        content: JSON.stringify({ type: 'doc', content: [] }),
      },
      credentials: 'include',
    })
    router.push(`/spaces/${spaceId.value}/docs/${doc.id}`)
  } catch (e: any) {
    toast.add({ title: 'Gagal membuat dokumen', description: e?.data?.message ?? 'Error', color: 'error' })
  } finally {
    saving.value = false
  }
}

function deleteDoc(doc: SpaceDocument) {
  confirmDeleteToast({
    title: 'Hapus Dokumen',
    description: `Dokumen "${doc.title}" akan dihapus permanen.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${spaceId.value}/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      refresh()
      toast.add({ title: 'Dokumen dihapus', color: 'success' })
    },
  })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <UDashboardPanel id="space-docs">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <NuxtLink :to="`/spaces/${spaceId}`" class="text-muted hover:text-highlighted text-sm">
              <UIcon name="i-lucide-arrow-left" class="size-4" />
            </NuxtLink>
            <span class="text-sm font-semibold text-highlighted">Dokumen Space</span>
          </div>
        </template>
        <template #right>
          <UButton label="Dokumen Baru" icon="i-lucide-plus" color="primary" size="sm" @click="creating = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
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
                  <button
                    v-for="e in EMOJIS"
                    :key="e"
                    type="button"
                    class="flex size-8 items-center justify-center rounded text-lg hover:bg-elevated"
                    @click="newEmoji = e"
                  >{{ e }}</button>
                </div>
              </template>
            </UPopover>
            <UInput v-model="newTitle" class="flex-1" placeholder="Judul dokumen..." autofocus @keydown.enter="createDoc" @keydown.escape="creating = false" />
          </div>
          <div class="mt-3 flex gap-2">
            <UButton label="Buat" size="sm" color="primary" :loading="saving" @click="createDoc" />
            <UButton label="Batal" size="sm" color="neutral" variant="ghost" @click="creating = false; newTitle = ''" />
          </div>
        </div>

        <!-- Loading -->
        <div v-if="pending" class="flex h-40 items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <!-- Empty state -->
        <div v-else-if="!docs?.length && !creating" class="flex h-48 flex-col items-center justify-center gap-3 text-center">
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
        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="doc in docs"
            :key="doc.id"
            class="group relative overflow-hidden rounded-xl border border-default bg-default p-4 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <NuxtLink :to="`/spaces/${spaceId}/docs/${doc.id}`" class="block">
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
            </NuxtLink>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="deleteDoc(doc)"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
