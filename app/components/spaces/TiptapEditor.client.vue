<script setup lang="ts">
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Image from '@tiptap/extension-image'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  editable?: boolean
  memberMap?: Record<number, string>
  spaceId?: number // Untuk upload gambar
}>(), {
  editable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const toast = useToast()

// Parse content — handle both JSON string and plain text
function parseContent(value: string) {
  if (!value) return ''
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// Referensi untuk node DOM editor (manual mount — lebih reliable untuk Nuxt/modal)
const editorEl = ref<HTMLElement | null>(null)
const editor = shallowRef<Editor | null>(null)

// Image modal state
const imageModalOpen = ref(false)
const imageTab = ref<'upload' | 'url'>('upload')
const imageUrl = ref('')
const imageAlt = ref('')
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff']

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `Ukuran file terlalu besar. Maksimal 5MB, file Anda ${(file.size / 1024 / 1024).toFixed(2)}MB`
  }
  if (!file.type.startsWith('image/')) {
    return 'File harus berupa gambar'
  }
  return null
}

async function uploadImage(file: File): Promise<string | null> {
  if (!props.spaceId) {
    toast.add({ title: 'Error', description: 'Space ID tidak tersedia', color: 'error' })
    return null
  }

  const error = validateFile(file)
  if (error) {
    toast.add({ title: 'Upload Gagal', description: error, color: 'error' })
    return null
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('image', file)

    const res = await $fetch<{ url: string }>(`/api/spaces/${props.spaceId}/documents/upload-image`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    return res.url
  } catch (e: any) {
    toast.add({ 
      title: 'Upload Gagal', 
      description: e?.data?.message ?? e?.message ?? 'Gagal mengupload gambar', 
      color: 'error' 
    })
    return null
  } finally {
    uploading.value = false
  }
}

function insertImage(url: string, alt?: string) {
  if (!editor.value || !url) return
  editor.value.chain().focus().setImage({ src: url, alt: alt || '' }).run()
}

// Handle file input change
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const url = await uploadImage(file)
  if (url) {
    insertImage(url, imageAlt.value)
    closeImageModal()
  }
  
  // Reset input
  input.value = ''
}

// Handle URL submit
function handleUrlSubmit() {
  if (!imageUrl.value.trim()) {
    toast.add({ title: 'Error', description: 'URL tidak boleh kosong', color: 'error' })
    return
  }
  insertImage(imageUrl.value.trim(), imageAlt.value)
  closeImageModal()
}

// Open image modal
function openImageModal() {
  imageModalOpen.value = true
  imageTab.value = 'upload'
  imageUrl.value = ''
  imageAlt.value = ''
}

// Close image modal
function closeImageModal() {
  imageModalOpen.value = false
  imageUrl.value = ''
  imageAlt.value = ''
}

// Handle drop event
async function handleDrop(event: DragEvent) {
  if (!props.editable) return
  
  const files = event.dataTransfer?.files
  if (!files?.length) return

  const file = files[0]
  if (!file.type.startsWith('image/')) return

  event.preventDefault()
  event.stopPropagation()

  const url = await uploadImage(file)
  if (url) {
    insertImage(url)
  }
}

// Handle paste event (for clipboard images)
async function handlePaste(view: any, event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return false

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        const url = await uploadImage(file)
        if (url) {
          insertImage(url)
        }
      }
      return true
    }
  }
  return false
}

onMounted(() => {
  if (!editorEl.value) return
  editor.value = new Editor({
    element: editorEl.value,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: props.placeholder ?? 'Mulai menulis...',
      }),
      Typography,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
    ],
    content: parseContent(props.modelValue),
    editable: props.editable ?? true,
    onCreate: () => {
      const ed = editor.value
      if (ed && props.modelValue) {
        ed.commands.setContent(parseContent(props.modelValue), false)
      }
    },
    onUpdate: ({ editor }) => {
      emit('update:modelValue', JSON.stringify(editor.getJSON()))
    },
    editorProps: {
      handlePaste: (view, event) => handlePaste(view, event),
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false
        const hasFiles = event.dataTransfer?.files?.length
        if (hasFiles) {
          handleDrop(event)
          return true
        }
        return false
      },
    },
  })
})

onBeforeUnmount(() => {
  editor.value?.destroy()
  editor.value = null
})

// Sync content dari parent saat berubah
watch(() => props.modelValue, (val) => {
  const ed = editor.value
  if (!ed) return
  const current = JSON.stringify(ed.getJSON())
  if (current !== val) {
    ed.commands.setContent(parseContent(val), false)
  }
})

// Sync editable prop
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val ?? true)
})

// Toolbar actions
const tools = [
  { icon: 'i-lucide-bold', action: () => editor.value?.chain().focus().toggleBold().run(), isActive: () => editor.value?.isActive('bold'), title: 'Bold' },
  { icon: 'i-lucide-italic', action: () => editor.value?.chain().focus().toggleItalic().run(), isActive: () => editor.value?.isActive('italic'), title: 'Italic' },
  { icon: 'i-lucide-strikethrough', action: () => editor.value?.chain().focus().toggleStrike().run(), isActive: () => editor.value?.isActive('strike'), title: 'Strikethrough' },
  { separator: true },
  { icon: 'i-lucide-heading-2', action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.value?.isActive('heading', { level: 2 }), title: 'Heading 2' },
  { icon: 'i-lucide-heading-3', action: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.value?.isActive('heading', { level: 3 }), title: 'Heading 3' },
  { separator: true },
  { icon: 'i-lucide-list', action: () => editor.value?.chain().focus().toggleBulletList().run(), isActive: () => editor.value?.isActive('bulletList'), title: 'Bullet List' },
  { icon: 'i-lucide-list-ordered', action: () => editor.value?.chain().focus().toggleOrderedList().run(), isActive: () => editor.value?.isActive('orderedList'), title: 'Numbered List' },
  { separator: true },
  { icon: 'i-lucide-quote', action: () => editor.value?.chain().focus().toggleBlockquote().run(), isActive: () => editor.value?.isActive('blockquote'), title: 'Quote' },
  { icon: 'i-lucide-code', action: () => editor.value?.chain().focus().toggleCode().run(), isActive: () => editor.value?.isActive('code'), title: 'Inline Code' },
  { icon: 'i-lucide-code-2', action: () => editor.value?.chain().focus().toggleCodeBlock().run(), isActive: () => editor.value?.isActive('codeBlock'), title: 'Code Block' },
  { separator: true },
  { icon: 'i-lucide-image', action: openImageModal, isActive: () => false, title: 'Insert Image' },
  { separator: true },
  { icon: 'i-lucide-undo', action: () => editor.value?.chain().focus().undo().run(), isActive: () => false, title: 'Undo' },
  { icon: 'i-lucide-redo', action: () => editor.value?.chain().focus().redo().run(), isActive: () => false, title: 'Redo' },
]
</script>

<template>
  <div class="tiptap-editor flex flex-col rounded-lg border border-default bg-default">
    <!-- Toolbar -->
    <div v-if="editable !== false" class="flex flex-wrap items-center gap-0.5 border-b border-default px-2 py-1.5">
      <template v-for="(tool, i) in tools" :key="i">
        <div v-if="tool.separator" class="mx-1 h-4 w-px bg-default" />
        <button
          v-else
          type="button"
          class="flex size-7 items-center justify-center rounded text-sm transition-colors"
          :class="tool.isActive?.() ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated hover:text-highlighted'"
          :title="tool.title"
          @click="tool.action?.()"
        >
          <UIcon :name="tool.icon!" class="size-3.5" />
        </button>
      </template>
    </div>

    <!-- Editor content (manual mount) -->
    <div
      ref="editorEl"
      class="tiptap-content min-h-[200px] flex-1 px-4 py-3"
      @dragover.prevent
      @dragenter.prevent
    />

    <!-- Image Insert Modal -->
    <UModal v-model:open="imageModalOpen" :ui="{ content: 'max-w-md' }">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-image" class="size-5" />
          <span class="font-semibold">Tambah Gambar</span>
        </div>
      </template>

      <template #body>
        <!-- Tabs -->
        <div class="mb-4 flex rounded-lg border border-default overflow-hidden">
          <button
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
            :class="imageTab === 'upload' ? 'bg-primary text-inverted' : 'text-muted hover:bg-elevated'"
            @click="imageTab = 'upload'"
          >
            Upload File
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium transition-colors"
            :class="imageTab === 'url' ? 'bg-primary text-inverted' : 'text-muted hover:bg-elevated'"
            @click="imageTab = 'url'"
          >
            URL Gambar
          </button>
        </div>

        <!-- Upload Tab -->
        <div v-if="imageTab === 'upload'" class="space-y-4">
          <div
            class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-default p-8 transition-colors hover:border-primary/50 hover:bg-elevated/30 cursor-pointer"
            @click="fileInputRef?.click()"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <div class="rounded-full bg-elevated p-3">
              <UIcon name="i-lucide-upload" class="size-6 text-muted" />
            </div>
            <div class="text-center">
              <p class="font-medium text-highlighted">Klik atau drag gambar ke sini</p>
              <p class="text-xs text-muted mt-1">Maksimal 5MB • JPG, PNG, GIF, WebP, SVG</p>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>

          <!-- Alt text -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-highlighted">Alt Text (opsional)</label>
            <UInput v-model="imageAlt" placeholder="Deskripsi gambar..." />
          </div>

          <!-- Loading -->
          <div v-if="uploading" class="flex items-center justify-center gap-2 py-2">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-primary" />
            <span class="text-sm text-muted">Mengupload...</span>
          </div>
        </div>

        <!-- URL Tab -->
        <div v-else class="space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-highlighted">URL Gambar</label>
            <UInput v-model="imageUrl" placeholder="https://example.com/image.jpg" />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-highlighted">Alt Text (opsional)</label>
            <UInput v-model="imageAlt" placeholder="Deskripsi gambar..." />
          </div>

          <!-- Preview -->
          <div v-if="imageUrl" class="rounded-lg border border-default p-2">
            <p class="mb-2 text-xs text-muted">Preview:</p>
            <img
              :src="imageUrl"
              :alt="imageAlt || 'Preview'"
              class="max-h-40 w-full rounded object-contain"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Batal" color="neutral" variant="ghost" @click="closeImageModal" />
          <UButton
            v-if="imageTab === 'url'"
            label="Tambahkan"
            color="primary"
            :disabled="!imageUrl.trim()"
            @click="handleUrlSubmit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
.tiptap-content .ProseMirror {
  outline: none;
  min-height: 180px;
  font-size: 0.875rem;
  line-height: 1.6;
}

.tiptap-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted, #9ca3af);
  pointer-events: none;
  float: left;
  height: 0;
}

.tiptap-content .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.tiptap-content .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75rem 0 0.4rem; }
.tiptap-content .ProseMirror ul, .tiptap-content .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.tiptap-content .ProseMirror li { margin: 0.2rem 0; }
.tiptap-content .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }
.tiptap-content .ProseMirror code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-size: 0.8rem; }
.tiptap-content .ProseMirror pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
.tiptap-content .ProseMirror pre code { background: transparent; color: inherit; }
.tiptap-content .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }

/* Image styles */
.tiptap-content .ProseMirror img.tiptap-image {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.tiptap-content .ProseMirror img.tiptap-image:hover {
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
}

.tiptap-content .ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid var(--color-primary, #3b82f6);
  outline-offset: 2px;
}

/* Dark mode adjustments */
.dark .tiptap-content .ProseMirror blockquote { border-left-color: #4b5563; color: #9ca3af; }
.dark .tiptap-content .ProseMirror code { background: #374151; }
.dark .tiptap-content .ProseMirror hr { border-top-color: #374151; }
</style>
