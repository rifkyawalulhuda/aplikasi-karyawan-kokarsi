<script setup lang="ts">
import type { SpaceCard, SpaceCardChecklist, SpaceCardComment, SpaceCardAttachment, CardPriority } from '~/types/space'

const props = defineProps<{
  open: boolean
  card: SpaceCard
  spaceId: number
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  updated: []
  deleted: []
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const requestFetch = useRequestFetch()

// Load full card detail
const { data: cardDetail, refresh } = await useFetch<SpaceCard>(
  () => `/api/spaces/${props.spaceId}/cards/${props.card.id}`,
  { credentials: 'include' }
)

// Edit title
const editingTitle = ref(false)
const editTitle = ref(props.card.title)
async function saveTitle() {
  if (!editTitle.value.trim() || editTitle.value === cardDetail.value?.title) {
    editingTitle.value = false; return
  }
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}`, {
    method: 'PUT', body: { title: editTitle.value.trim() }
  })
  editingTitle.value = false
  refresh()
  emit('updated')
}

// Description
const editingDesc = ref(false)
const editDesc = ref('')
function startEditDesc() {
  editDesc.value = cardDetail.value?.description ?? ''
  editingDesc.value = true
}
async function saveDesc() {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}`, {
    method: 'PUT', body: { description: editDesc.value }
  })
  editingDesc.value = false
  refresh()
  emit('updated')
}

// Priority
const PRIORITY_OPTIONS: { value: CardPriority; label: string; color: string; icon: string }[] = [
  { value: 'NONE', label: 'Tidak Ada', color: 'text-muted', icon: 'i-lucide-minus' },
  { value: 'LOW', label: 'Rendah', color: 'text-blue-500', icon: 'i-lucide-arrow-down' },
  { value: 'MEDIUM', label: 'Sedang', color: 'text-yellow-500', icon: 'i-lucide-minus' },
  { value: 'HIGH', label: 'Tinggi', color: 'text-orange-500', icon: 'i-lucide-arrow-up' },
  { value: 'URGENT', label: 'Mendesak', color: 'text-red-500', icon: 'i-lucide-alert-circle' },
]
async function setPriority(p: CardPriority) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}`, {
    method: 'PUT', body: { priority: p }
  })
  refresh(); emit('updated')
}

// Due date
async function setDueDate(val: string) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}`, {
    method: 'PUT', body: { dueDate: val || null }
  })
  refresh(); emit('updated')
}

// Checklist
const newCheckItem = ref('')
async function addCheckItem() {
  if (!newCheckItem.value.trim()) return
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/checklists`, {
    method: 'POST', body: { title: newCheckItem.value.trim() }
  })
  newCheckItem.value = ''
  refresh()
}
async function toggleCheckItem(item: SpaceCardChecklist) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/checklists/${item.id}`, {
    method: 'PATCH', body: { checked: !item.checked }
  })
  refresh()
}
async function deleteCheckItem(itemId: number) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/checklists/${itemId}`, { method: 'DELETE' })
  refresh()
}

const checklistProgress = computed(() => {
  const items = cardDetail.value?.checklists ?? []
  if (!items.length) return null
  const done = items.filter(c => c.checked).length
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
})

// Attachments
const attLinkName = ref('')
const attLinkUrl = ref('')
const attLinkOpen = ref(false)
const uploadingAtt = ref(false)

async function uploadAttFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingAtt.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    await $fetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/attachments`, {
      method: 'POST', body: fd, credentials: 'include',
    })
    refresh()
  } catch (err: any) {
    toast.add({ title: 'Gagal upload', description: err?.data?.message ?? 'Error', color: 'error' })
  } finally {
    uploadingAtt.value = false
    input.value = ''
  }
}

async function addAttLink() {
  if (!attLinkUrl.value.trim()) return
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/attachments`, {
    method: 'POST', body: { name: attLinkName.value || attLinkUrl.value, url: attLinkUrl.value },
  })
  attLinkName.value = ''; attLinkUrl.value = ''; attLinkOpen.value = false
  refresh()
}

async function deleteAtt(attId: number) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/attachments/${attId}`, { method: 'DELETE' })
  refresh()
}

// Comments
const newComment = ref('')
const savingComment = ref(false)

async function submitComment() {
  if (!newComment.value.trim()) return
  savingComment.value = true
  try {
    await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/comments`, {
      method: 'POST', body: { content: newComment.value.trim() }
    })
    newComment.value = ''
    refresh()
  } finally {
    savingComment.value = false
  }
}

async function deleteComment(cmtId: number) {
  await requestFetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}/comments/${cmtId}`, { method: 'DELETE' })
  refresh()
}

// Delete card
function deleteCard() {
  confirmDeleteToast({
    title: 'Hapus Card',
    description: `Card "${cardDetail.value?.title}" akan dihapus permanen.`,
    onConfirm: async () => {
      await $fetch(`/api/spaces/${props.spaceId}/cards/${props.card.id}`, {
        method: 'DELETE', credentials: 'include'
      })
      emit('deleted')
    },
  })
}

const currentPriority = computed(() =>
  PRIORITY_OPTIONS.find(p => p.value === cardDetail.value?.priority) ?? PRIORITY_OPTIONS[0]
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-start gap-3 pr-8">
        <!-- Edit title inline -->
        <div class="flex-1">
          <input
            v-if="editingTitle"
            v-model="editTitle"
            class="w-full rounded bg-elevated px-2 py-1 text-base font-semibold text-highlighted outline-none ring-1 ring-primary"
            @blur="saveTitle"
            @keydown.enter="saveTitle"
            @keydown.escape="editingTitle = false"
          />
          <h2
            v-else
            class="cursor-pointer text-base font-semibold text-highlighted hover:text-primary"
            @click="editingTitle = true; editTitle = cardDetail?.title ?? ''"
          >{{ cardDetail?.title ?? card.title }}</h2>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="cardDetail" class="space-y-5">
        <!-- Meta row: Priority + Due date -->
        <div class="flex flex-wrap gap-3">
          <!-- Priority picker -->
          <UDropdownMenu
            :items="[PRIORITY_OPTIONS.map(p => ({
              label: p.label,
              icon: p.icon,
              onSelect: () => setPriority(p.value),
            }))]"
          >
            <UButton variant="outline" color="neutral" size="sm" :icon="currentPriority.icon">
              <span :class="currentPriority.color">{{ currentPriority.label }}</span>
            </UButton>
          </UDropdownMenu>

          <!-- Due date -->
          <UInput
            :model-value="cardDetail.dueDate?.slice(0, 10) ?? ''"
            type="date"
            size="sm"
            class="w-40"
            @change="(e: any) => setDueDate(e.target.value)"
          />
        </div>

        <!-- Description -->
        <div>
          <div class="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted">
            <UIcon name="i-lucide-align-left" class="size-3.5" />
            Deskripsi
          </div>
          <div v-if="!editingDesc">
            <p
              v-if="cardDetail.description"
              class="cursor-pointer rounded p-2 text-sm text-highlighted hover:bg-elevated/50"
              @click="startEditDesc"
            >{{ cardDetail.description }}</p>
            <button
              v-else
              type="button"
              class="w-full rounded border border-dashed border-default p-2 text-left text-sm text-muted hover:border-primary/40 hover:text-highlighted"
              @click="startEditDesc"
            >Tambah deskripsi...</button>
          </div>
          <div v-else>
            <UTextarea v-model="editDesc" :rows="4" class="w-full" autofocus />
            <div class="mt-1.5 flex gap-1.5">
              <UButton label="Simpan" size="xs" color="primary" @click="saveDesc" />
              <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="editingDesc = false" />
            </div>
          </div>
        </div>

        <!-- Checklist -->
        <div>
          <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
            <UIcon name="i-lucide-check-square" class="size-3.5" />
            Checklist
            <span v-if="checklistProgress" class="ml-auto font-mono">{{ checklistProgress.done }}/{{ checklistProgress.total }}</span>
          </div>
          <!-- Progress bar -->
          <div v-if="checklistProgress" class="mb-2 h-1.5 w-full rounded-full bg-elevated">
            <div class="h-1.5 rounded-full bg-primary transition-all" :style="`width:${checklistProgress.pct}%`" :class="checklistProgress.pct === 100 ? 'bg-green-500' : ''" />
          </div>
          <!-- Items -->
          <div class="space-y-1">
            <div
              v-for="item in cardDetail.checklists"
              :key="item.id"
              class="flex items-center gap-2 rounded px-2 py-1 hover:bg-elevated/50"
            >
              <input
                type="checkbox"
                :checked="item.checked"
                class="rounded"
                @change="toggleCheckItem(item)"
              />
              <span class="flex-1 text-sm" :class="item.checked ? 'text-muted line-through' : 'text-highlighted'">{{ item.title }}</span>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" @click="deleteCheckItem(item.id)" />
            </div>
          </div>
          <!-- Add item -->
          <div class="mt-2 flex gap-2">
            <UInput v-model="newCheckItem" size="sm" class="flex-1" placeholder="Tambah item..." @keydown.enter="addCheckItem" />
            <UButton label="Tambah" size="sm" color="neutral" variant="outline" @click="addCheckItem" />
          </div>
        </div>

        <!-- Attachments -->
        <div>
          <div class="mb-2 flex items-center justify-between text-xs font-medium text-muted">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-paperclip" class="size-3.5" />
              Lampiran
            </div>
            <div class="flex gap-1.5">
              <label class="cursor-pointer">
                <input type="file" class="hidden" @change="uploadAttFile" />
                <UButton tag="span" label="Upload" size="xs" color="neutral" variant="outline" :loading="uploadingAtt" />
              </label>
              <UButton label="Tambah Link" size="xs" color="neutral" variant="outline" @click="attLinkOpen = !attLinkOpen" />
            </div>
          </div>
          <!-- Add link form -->
          <div v-if="attLinkOpen" class="mb-2 space-y-1.5 rounded-lg border border-default p-2.5">
            <UInput v-model="attLinkName" size="sm" placeholder="Nama tampilan (opsional)" />
            <UInput v-model="attLinkUrl" size="sm" placeholder="URL (https://...)" @keydown.enter="addAttLink" />
            <div class="flex gap-1.5">
              <UButton label="Simpan" size="xs" color="primary" @click="addAttLink" />
              <UButton label="Batal" size="xs" color="neutral" variant="ghost" @click="attLinkOpen = false" />
            </div>
          </div>
          <!-- Attachment list -->
          <div class="space-y-1">
            <div
              v-for="att in cardDetail.attachments"
              :key="att.id"
              class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-elevated/50"
            >
              <UIcon :name="att.type === 'LINK' ? 'i-lucide-link' : 'i-lucide-file'" class="size-4 text-muted shrink-0" />
              <a
                v-if="att.type === 'LINK'"
                :href="att.url"
                target="_blank"
                class="flex-1 truncate text-sm text-primary hover:underline"
              >{{ att.name }}</a>
              <span v-else class="flex-1 truncate text-sm text-highlighted">{{ att.name }}</span>
              <span v-if="att.size" class="text-xs text-muted">{{ (att.size / 1024).toFixed(0) }}KB</span>
              <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="deleteAtt(att.id)" />
            </div>
          </div>
        </div>

        <!-- Comments -->
        <div>
          <div class="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
            <UIcon name="i-lucide-message-circle" class="size-3.5" />
            Komentar
          </div>
          <div class="space-y-3">
            <div
              v-for="cmt in cardDetail.comments"
              :key="cmt.id"
              class="flex gap-3"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {{ cmt.authorName.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1">
                <div class="flex items-baseline gap-2">
                  <span class="text-sm font-medium text-highlighted">{{ cmt.authorName }}</span>
                  <span class="text-xs text-muted">{{ new Date(cmt.createdAt).toLocaleDateString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }}</span>
                </div>
                <p class="mt-0.5 text-sm text-muted">{{ cmt.content }}</p>
              </div>
              <UButton icon="i-lucide-trash-2" variant="ghost" color="error" size="xs" @click="deleteComment(cmt.id)" />
            </div>
          </div>
          <!-- Add comment -->
          <div class="mt-3 flex gap-2">
            <UTextarea v-model="newComment" :rows="2" class="flex-1 text-sm" placeholder="Tulis komentar..." />
            <UButton label="Kirim" color="primary" size="sm" :loading="savingComment" class="self-end" @click="submitComment" />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <UButton label="Hapus Card" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="deleteCard" />
        <UButton label="Tutup" color="neutral" variant="outline" @click="emit('update:open', false)" />
      </div>
    </template>
  </UModal>
</template>
