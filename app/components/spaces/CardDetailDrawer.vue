<script setup lang="ts">
import type { CardPriority, SpaceCard, SpaceCardAttachment, SpaceCardChecklist, SpaceCardComment } from '~/types/space'
import type { CalendarDate } from '@internationalized/date'
import { colorHex, errorMessage, labelColor, PRIORITY_CONFIG } from './board-meta'

const props = defineProps<{
  open: boolean
  cardId: number
  spaceId: number
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'updated': []
  'deleted': []
}>()

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const requestFetch = useRequestFetch()
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()
const auth = useAuthStore()

// ── Muat detail ──────────────────────────────────────────────────────────────
const { data: card, refresh, pending } = await useFetch<SpaceCard>(
  () => `/api/spaces/${props.spaceId}/cards/${props.cardId}`,
  { credentials: 'include', lazy: true }
)

const base = () => `/api/spaces/${props.spaceId}/cards/${props.cardId}`

/** PUT dengan optimistic + rollback otomatis bila gagal. */
async function patchCard(
  body: Record<string, unknown>,
  optimistic?: Partial<SpaceCard>,
  failTitle = 'Gagal menyimpan perubahan'
) {
  const prev = card.value ? structuredClone(toRaw(card.value)) : null
  if (card.value && optimistic) Object.assign(card.value, optimistic)
  try {
    await requestFetch(base(), { method: 'PUT', body })
    emit('updated')
  } catch (err) {
    if (prev) card.value = prev
    toast.add({ title: failTitle, description: errorMessage(err), color: 'error' })
  }
}

// ── Judul ────────────────────────────────────────────────────────────────────
const editingTitle = ref(false)
const titleDraft = ref('')

function startEditTitle() {
  titleDraft.value = card.value?.title ?? ''
  editingTitle.value = true
}

async function saveTitle() {
  const title = titleDraft.value.trim()
  editingTitle.value = false
  if (!title || title === card.value?.title) return
  await patchCard({ title }, { title }, 'Gagal mengganti judul')
}

// ── Deskripsi ────────────────────────────────────────────────────────────────
const editingDesc = ref(false)
const descDraft = ref('')

function startEditDesc() {
  descDraft.value = card.value?.description ?? ''
  editingDesc.value = true
}

async function saveDesc() {
  const description = descDraft.value
  editingDesc.value = false
  if (description === (card.value?.description ?? '')) return
  await patchCard({ description }, { description }, 'Gagal menyimpan deskripsi')
}

// ── Prioritas ────────────────────────────────────────────────────────────────
const priorityOptions = (Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(k => ({
  label: k === 'NONE' ? 'Tidak Ada' : PRIORITY_CONFIG[k].label,
  value: k,
  icon: PRIORITY_CONFIG[k].icon
}))

const currentPriority = computed(() => PRIORITY_CONFIG[card.value?.priority ?? 'NONE'])

function setPriority(value: CardPriority) {
  if (value === card.value?.priority) return
  patchCard({ priority: value }, { priority: value }, 'Gagal mengubah prioritas')
}

// ── Tanggal jatuh tempo ──────────────────────────────────────────────────────
const dueCal = shallowRef<CalendarDate | null>(null)
watch(() => card.value?.dueDate, (val) => {
  dueCal.value = toCalDate(val ?? null)
}, { immediate: true })

watch(dueCal, (val) => {
  const next = fromCalDate(val) || null
  const current = card.value?.dueDate?.slice(0, 10) ?? ''
  if ((next ?? '') === current) return
  patchCard({ dueDate: next }, { dueDate: next }, 'Gagal mengubah tanggal')
})

// ── Assignee ─────────────────────────────────────────────────────────────────
const memberOptions = computed(() =>
  Object.entries(props.memberMap ?? {}).map(([id, name]) => ({ label: name, value: Number(id) }))
)

function setAssignees(ids: number[]) {
  patchCard({ assigneeIds: ids }, { assigneeIds: ids }, 'Gagal mengubah assignee')
}

// ── Label ────────────────────────────────────────────────────────────────────
const labelDraft = ref('')

function addLabel() {
  const label = labelDraft.value.trim()
  if (!label) return
  const labels = [...(card.value?.labels ?? [])]
  if (labels.includes(label)) {
    labelDraft.value = ''
    return
  }
  labels.push(label)
  labelDraft.value = ''
  patchCard({ labels }, { labels }, 'Gagal menambah label')
}

function removeLabel(label: string) {
  const labels = (card.value?.labels ?? []).filter(l => l !== label)
  patchCard({ labels }, { labels }, 'Gagal menghapus label')
}

// ── Warna cover ──────────────────────────────────────────────────────────────
const COVER_COLORS = ['blue', 'sky', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo']

function setCover(color: string | null) {
  const coverColor = card.value?.coverColor === color ? null : color
  patchCard({ coverColor }, { coverColor }, 'Gagal mengubah warna')
}

// ── Checklist (optimistic) ───────────────────────────────────────────────────
const newCheckItem = ref('')

const checklistProgress = computed(() => {
  const items = card.value?.checklists ?? []
  if (!items.length) return null
  const done = items.filter(c => c.checked).length
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
})

async function addCheckItem() {
  const title = newCheckItem.value.trim()
  if (!title || !card.value) return
  const temp: SpaceCardChecklist = {
    id: -Date.now(), cardId: props.cardId, title, checked: false,
    position: (card.value.checklists?.length ?? 0), createdAt: new Date().toISOString()
  }
  card.value.checklists = [...(card.value.checklists ?? []), temp]
  newCheckItem.value = ''
  try {
    await requestFetch(`${base()}/checklists`, { method: 'POST', body: { title } })
    await refresh()
    emit('updated')
  } catch (err) {
    card.value.checklists = card.value.checklists.filter(c => c.id !== temp.id)
    newCheckItem.value = title
    toast.add({ title: 'Gagal menambah item', description: errorMessage(err), color: 'error' })
  }
}

async function toggleCheckItem(item: SpaceCardChecklist) {
  const prev = item.checked
  item.checked = !prev
  try {
    await requestFetch(`${base()}/checklists/${item.id}`, { method: 'PATCH', body: { checked: item.checked } })
    emit('updated')
  } catch (err) {
    item.checked = prev
    toast.add({ title: 'Gagal memperbarui item', description: errorMessage(err), color: 'error' })
  }
}

async function deleteCheckItem(item: SpaceCardChecklist) {
  if (!card.value) return
  const prev = card.value.checklists ?? []
  card.value.checklists = prev.filter(c => c.id !== item.id)
  try {
    await requestFetch(`${base()}/checklists/${item.id}`, { method: 'DELETE' })
    emit('updated')
  } catch (err) {
    card.value.checklists = prev
    toast.add({ title: 'Gagal menghapus item', description: errorMessage(err), color: 'error' })
  }
}

// ── Lampiran ─────────────────────────────────────────────────────────────────
const attLinkName = ref('')
const attLinkUrl = ref('')
const attLinkOpen = ref(false)
const uploadingAtt = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function uploadAttFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingAtt.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    // fetch native: $fetch men-serialisasi FormData sebagai JSON (multipart rusak)
    const res = await fetch(`${base()}/attachments`, { method: 'POST', body: fd, credentials: 'include' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.message ?? `Upload gagal (${res.status})`)
    }
    await refresh()
    emit('updated')
  } catch (err) {
    toast.add({ title: 'Gagal upload', description: errorMessage(err), color: 'error' })
  } finally {
    uploadingAtt.value = false
    input.value = ''
  }
}

async function addAttLink() {
  const url = attLinkUrl.value.trim()
  if (!url) return
  try {
    await requestFetch(`${base()}/attachments`, {
      method: 'POST',
      body: { name: attLinkName.value.trim() || url, url }
    })
    attLinkName.value = ''
    attLinkUrl.value = ''
    attLinkOpen.value = false
    await refresh()
    emit('updated')
  } catch (err) {
    toast.add({ title: 'Gagal menambah lampiran', description: errorMessage(err), color: 'error' })
  }
}

function getFileUrl(att: SpaceCardAttachment): string {
  if (att.type === 'LINK') return att.url
  return att.url.startsWith('/') ? att.url : `/${att.url}`
}

function getFileIcon(att: SpaceCardAttachment): string {
  if (att.type === 'LINK') return 'i-lucide-link'
  const ext = att.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'i-lucide-image'
  if (['pdf'].includes(ext)) return 'i-lucide-file-text'
  if (['doc', 'docx'].includes(ext)) return 'i-lucide-file-type'
  if (['xls', 'xlsx'].includes(ext)) return 'i-lucide-table'
  if (['zip', 'rar', '7z'].includes(ext)) return 'i-lucide-archive'
  return 'i-lucide-file'
}

function deleteAtt(att: SpaceCardAttachment) {
  confirmDeleteToast({
    title: 'Hapus Lampiran',
    description: `Lampiran "${att.name}" akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      await requestFetch(`${base()}/attachments/${att.id}`, { method: 'DELETE' })
      await refresh()
      emit('updated')
    }
  })
}

// ── Komentar (optimistic) ────────────────────────────────────────────────────
const newComment = ref('')
const editingCommentId = ref<number | null>(null)
const editCommentText = ref('')

const currentUserId = computed(() => auth.admin?.id ?? null)
const currentUserName = computed(() => auth.admin?.fullName ?? 'Saya')

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

async function submitComment() {
  const content = newComment.value.trim()
  if (!content || !card.value) return
  const temp: SpaceCardComment = {
    id: -Date.now(), cardId: props.cardId, content,
    authorId: currentUserId.value ?? 0, authorType: 'ADMIN',
    authorName: currentUserName.value,
    authorPhotoUrl: auth.admin?.photoUrl ?? null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }
  card.value.comments = [...(card.value.comments ?? []), temp]
  newComment.value = ''
  try {
    await requestFetch(`${base()}/comments`, { method: 'POST', body: { content } })
    await refresh()
    emit('updated')
  } catch (err) {
    card.value.comments = card.value.comments.filter(c => c.id !== temp.id)
    newComment.value = content
    toast.add({ title: 'Gagal mengirim komentar', description: errorMessage(err), color: 'error' })
  }
}

function startEditComment(cmt: SpaceCardComment) {
  editingCommentId.value = cmt.id
  editCommentText.value = cmt.content
}

function cancelEditComment() {
  editingCommentId.value = null
  editCommentText.value = ''
}

async function saveEditComment(cmt: SpaceCardComment) {
  const content = editCommentText.value.trim()
  if (!content) return
  const prevContent = cmt.content
  const prevEdited = cmt.isEdited
  cmt.content = content
  cmt.isEdited = true
  editingCommentId.value = null
  editCommentText.value = ''
  try {
    await requestFetch(`${base()}/comments/${cmt.id}`, { method: 'PUT', body: { content } })
    emit('updated')
  } catch (err) {
    cmt.content = prevContent
    cmt.isEdited = prevEdited
    toast.add({ title: 'Gagal menyimpan komentar', description: errorMessage(err), color: 'error' })
  }
}

function deleteComment(cmt: SpaceCardComment) {
  confirmDeleteToast({
    title: 'Hapus Komentar',
    description: 'Komentar ini akan dihapus. Bekasnya tetap tampil sebagai log.',
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      if (card.value) {
        card.value.comments = (card.value.comments ?? []).map(c =>
          c.id === cmt.id ? { ...c, isDeleted: true, deletedAt: new Date().toISOString(), content: '' } : c
        )
      }
      try {
        await requestFetch(`${base()}/comments/${cmt.id}`, { method: 'DELETE' })
        emit('updated')
      } catch (err) {
        await refresh()
        toast.add({ title: 'Gagal menghapus komentar', description: errorMessage(err), color: 'error' })
      }
    }
  })
}

// ── Hapus kartu ──────────────────────────────────────────────────────────────
function deleteCard() {
  confirmDeleteToast({
    title: 'Hapus Kartu',
    description: `Kartu "${card.value?.title}" akan dihapus permanen.`,
    onConfirm: async () => {
      await $fetch(base(), { method: 'DELETE', credentials: 'include' })
      emit('deleted')
    }
  })
}

const comments = computed(() => card.value?.comments ?? [])
const attachments = computed(() => card.value?.attachments ?? [])
const checklists = computed(() => card.value?.checklists ?? [])
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'w-full sm:max-w-xl' }"
    :title="card?.title ?? 'Detail Kartu'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="pending && !card" class="space-y-4">
        <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-lg bg-accented" />
      </div>

      <div v-else-if="card" class="space-y-6">
        <!-- Judul -->
        <div>
          <input
            v-if="editingTitle"
            v-model="titleDraft"
            class="w-full rounded-lg border border-default bg-default px-2.5 py-1.5 text-lg font-semibold text-highlighted outline-none ring-1 ring-primary"
            autofocus
            @blur="saveTitle"
            @keydown.enter="saveTitle"
            @keydown.escape="editingTitle = false"
          >
          <button
            v-else
            type="button"
            class="w-full rounded-lg px-2.5 py-1.5 text-left text-lg font-semibold text-highlighted transition-colors hover:bg-elevated/60"
            @click="startEditTitle"
          >
            {{ card.title }}
          </button>
        </div>

        <!-- Meta: prioritas + due + cover -->
        <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :items="[priorityOptions.map(p => ({ label: p.label, icon: p.icon, onSelect: () => setPriority(p.value as CardPriority) }))]">
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              :icon="currentPriority.icon"
              :label="currentPriority.label"
            />
          </UDropdownMenu>

          <UPopover>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-calendar"
              :class="!dueCal && 'text-muted'"
            >
              {{ dueCal ? formatDisplay(dueCal) : 'Tanggal jatuh tempo' }}
            </UButton>
            <template #content>
              <CalendarPicker v-model="dueCal" class="p-2" />
            </template>
          </UPopover>
          <UButton
            v-if="dueCal"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Hapus tanggal"
            @click="dueCal = null"
          />

          <!-- Cover -->
          <UPopover>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-palette"
              aria-label="Warna kartu"
            />
            <template #content>
              <div class="p-2">
                <p class="mb-1.5 px-1 text-[11px] font-medium text-muted">
                  Warna kartu
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="c in COVER_COLORS"
                    :key="c"
                    type="button"
                    class="size-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                    :class="card.coverColor === c ? 'ring-2 ring-highlighted ring-offset-1 ring-offset-default' : ''"
                    :style="{ backgroundColor: colorHex(c) }"
                    :aria-label="`Warna ${c}`"
                    @click="setCover(c)"
                  />
                </div>
              </div>
            </template>
          </UPopover>
        </div>

        <!-- Assignee + label -->
        <div class="space-y-3">
          <USelectMenu
            :model-value="card.assigneeIds"
            :items="memberOptions"
            multiple
            value-key="value"
            placeholder="Belum ada assignee"
            class="w-full"
            icon="i-lucide-users"
            @update:model-value="(v: number[]) => setAssignees(v)"
          />

          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="label in card.labels"
              :key="label"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="labelColor(label)"
            >
              {{ label }}
              <button type="button" :aria-label="`Hapus label ${label}`" @click="removeLabel(label)">
                <UIcon name="i-lucide-x" class="size-3" />
              </button>
            </span>
            <UInput
              v-model="labelDraft"
              size="xs"
              placeholder="+ Label"
              class="w-28"
              @keydown.enter="addLabel"
            />
          </div>
        </div>

        <USeparator />

        <!-- Deskripsi -->
        <section>
          <h3 class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-align-left" class="size-3.5" />
            Deskripsi
          </h3>
          <div v-if="!editingDesc">
            <p
              v-if="card.description"
              class="cursor-pointer whitespace-pre-wrap rounded-lg p-2 text-sm text-highlighted transition-colors hover:bg-elevated/50"
              @click="startEditDesc"
            >
              {{ card.description }}
            </p>
            <button
              v-else
              type="button"
              class="w-full rounded-lg border border-dashed border-default p-2.5 text-left text-sm text-muted transition-colors hover:border-primary/40 hover:text-highlighted"
              @click="startEditDesc"
            >
              Tambah deskripsi…
            </button>
          </div>
          <div v-else>
            <UTextarea
              v-model="descDraft"
              :rows="4"
              class="w-full"
              autofocus
            />
            <div class="mt-1.5 flex gap-1.5">
              <UButton
                label="Simpan"
                size="xs"
                color="primary"
                @click="saveDesc"
              />
              <UButton
                label="Batal"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="editingDesc = false"
              />
            </div>
          </div>
        </section>

        <USeparator />

        <!-- Checklist -->
        <section>
          <h3 class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-check-square" class="size-3.5" />
            Checklist
            <span v-if="checklistProgress" class="ml-auto font-mono tabular-nums">
              {{ checklistProgress.done }}/{{ checklistProgress.total }}
            </span>
          </h3>
          <div v-if="checklistProgress" class="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              :class="checklistProgress.pct === 100 ? 'bg-green-500' : 'bg-primary'"
              :style="{ width: `${checklistProgress.pct}%` }"
            />
          </div>
          <div class="space-y-0.5">
            <div
              v-for="item in checklists"
              :key="item.id"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/50"
            >
              <input
                type="checkbox"
                :checked="item.checked"
                class="size-4 rounded"
                :aria-label="item.title"
                @change="toggleCheckItem(item)"
              >
              <span class="flex-1 text-sm" :class="item.checked ? 'text-muted line-through' : 'text-highlighted'">
                {{ item.title }}
              </span>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="xs"
                :aria-label="`Hapus ${item.title}`"
                @click="deleteCheckItem(item)"
              />
            </div>
          </div>
          <div class="mt-2 flex gap-2">
            <UInput
              v-model="newCheckItem"
              size="sm"
              class="flex-1"
              placeholder="Tambah item…"
              @keydown.enter="addCheckItem"
            />
            <UButton
              label="Tambah"
              size="sm"
              color="neutral"
              variant="outline"
              @click="addCheckItem"
            />
          </div>
        </section>

        <USeparator />

        <!-- Lampiran -->
        <section>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <UIcon name="i-lucide-paperclip" class="size-3.5" />
              Lampiran
            </h3>
            <div class="flex gap-1.5">
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                @change="uploadAttFile"
              >
              <UButton
                label="Upload"
                size="xs"
                color="neutral"
                variant="outline"
                :loading="uploadingAtt"
                @click="fileInputRef?.click()"
              />
              <UButton
                label="Link"
                size="xs"
                color="neutral"
                variant="outline"
                @click="attLinkOpen = !attLinkOpen"
              />
            </div>
          </div>

          <div v-if="attLinkOpen" class="mb-2 space-y-1.5 rounded-lg border border-default p-2.5">
            <UInput v-model="attLinkName" size="sm" placeholder="Nama tampilan (opsional)" />
            <UInput
              v-model="attLinkUrl"
              size="sm"
              placeholder="URL (https://…)"
              @keydown.enter="addAttLink"
            />
            <div class="flex gap-1.5">
              <UButton
                label="Simpan"
                size="xs"
                color="primary"
                @click="addAttLink"
              />
              <UButton
                label="Batal"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="attLinkOpen = false"
              />
            </div>
          </div>

          <p v-if="!attachments.length" class="text-xs text-muted">
            Belum ada lampiran.
          </p>
          <div class="space-y-0.5">
            <div
              v-for="att in attachments"
              :key="att.id"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-elevated/50"
            >
              <UIcon :name="getFileIcon(att)" class="size-4 shrink-0 text-muted" />
              <a
                :href="att.type === 'LINK' ? att.url : getFileUrl(att)"
                :download="att.type === 'FILE' ? att.name : undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 truncate text-sm text-primary hover:underline"
              >{{ att.name }}</a>
              <span v-if="att.size" class="shrink-0 text-xs text-muted">
                {{ att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(0)}KB` : `${(att.size / 1024 / 1024).toFixed(1)}MB` }}
              </span>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                :aria-label="`Hapus ${att.name}`"
                @click="deleteAtt(att)"
              />
            </div>
          </div>
        </section>

        <USeparator />

        <!-- Komentar -->
        <section>
          <h3 class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-message-circle" class="size-3.5" />
            Komentar
            <span v-if="comments.length" class="font-normal normal-case">({{ comments.length }})</span>
          </h3>

          <div class="space-y-3">
            <div v-for="cmt in comments" :key="cmt.id" class="flex gap-3">
              <div
                class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
                :class="cmt.isDeleted ? 'bg-muted/30 text-muted' : 'bg-primary/10 text-primary'"
              >
                <img
                  v-if="!cmt.isDeleted && cmt.authorPhotoUrl"
                  :src="cmt.authorPhotoUrl"
                  :alt="cmt.authorName"
                  class="size-full object-cover"
                >
                <span v-else>{{ cmt.authorName.charAt(0).toUpperCase() }}</span>
              </div>

              <div v-if="cmt.isDeleted" class="flex-1 rounded-lg bg-elevated/30 px-3 py-2">
                <p class="text-xs italic text-muted">
                  Komentar dihapus pada {{ formatDateTime(cmt.deletedAt) }}
                </p>
              </div>

              <div v-else-if="editingCommentId === cmt.id" class="flex-1 space-y-2">
                <UTextarea v-model="editCommentText" :rows="2" class="w-full text-sm" />
                <div class="flex gap-2">
                  <UButton
                    label="Simpan"
                    color="primary"
                    size="xs"
                    @click="saveEditComment(cmt)"
                  />
                  <UButton
                    label="Batal"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="cancelEditComment"
                  />
                </div>
              </div>

              <div v-else class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2">
                  <span class="text-sm font-medium text-highlighted">{{ cmt.authorName }}</span>
                  <span class="text-xs text-muted">{{ formatDateTime(cmt.createdAt) }}</span>
                  <UBadge
                    v-if="cmt.isEdited"
                    label="Diedit"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  />
                </div>
                <p class="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                  {{ cmt.content }}
                </p>
              </div>

              <div
                v-if="!cmt.isDeleted && editingCommentId !== cmt.id && cmt.authorId === currentUserId"
                class="flex shrink-0 gap-1"
              >
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  aria-label="Edit komentar"
                  @click="startEditComment(cmt)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  aria-label="Hapus komentar"
                  @click="deleteComment(cmt)"
                />
              </div>
            </div>
          </div>

          <div class="mt-3 flex gap-2">
            <UTextarea
              v-model="newComment"
              :rows="2"
              class="flex-1 text-sm"
              placeholder="Tulis komentar…"
              @keydown.ctrl.enter="submitComment"
            />
            <UButton
              label="Kirim"
              color="primary"
              size="sm"
              class="self-end"
              @click="submitComment"
            />
          </div>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between">
        <UButton
          label="Hapus Kartu"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          @click="deleteCard"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </USlideover>
</template>
