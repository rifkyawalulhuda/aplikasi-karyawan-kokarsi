<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  editable?: boolean
  memberMap?: Record<number, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Parse content — handle both JSON string and plain text
function parseContent(value: string) {
  if (!value) return ''
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: props.placeholder ?? 'Mulai menulis...',
    }),
    Typography,
  ],
  content: parseContent(props.modelValue),
  editable: props.editable ?? true,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', JSON.stringify(editor.getJSON()))
  },
})

// Sync external value changes - improved handling for race condition
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = JSON.stringify(editor.value.getJSON())
  if (current !== val) {
    // Use setTimeout untuk hindari race condition saat sync cepat
    setTimeout(() => {
      editor.value.commands.setContent(parseContent(val), false)
    }, 10)
  }
})

// Sync editable prop
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val ?? true)
})

onBeforeUnmount(() => editor.value?.destroy())

// Toolbar actions
const tools = [
  { icon: 'i-lucide-bold', action: () => editor.value?.chain().focus().toggleBold().run(), isActive: () => editor.value?.isActive('bold') },
  { icon: 'i-lucide-italic', action: () => editor.value?.chain().focus().toggleItalic().run(), isActive: () => editor.value?.isActive('italic') },
  { icon: 'i-lucide-strikethrough', action: () => editor.value?.chain().focus().toggleStrike().run(), isActive: () => editor.value?.isActive('strike') },
  { separator: true },
  { icon: 'i-lucide-heading-2', action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(), isActive: () => editor.value?.isActive('heading', { level: 2 }) },
  { icon: 'i-lucide-heading-3', action: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(), isActive: () => editor.value?.isActive('heading', { level: 3 }) },
  { separator: true },
  { icon: 'i-lucide-list', action: () => editor.value?.chain().focus().toggleBulletList().run(), isActive: () => editor.value?.isActive('bulletList') },
  { icon: 'i-lucide-list-ordered', action: () => editor.value?.chain().focus().toggleOrderedList().run(), isActive: () => editor.value?.isActive('orderedList') },
  { separator: true },
  { icon: 'i-lucide-quote', action: () => editor.value?.chain().focus().toggleBlockquote().run(), isActive: () => editor.value?.isActive('blockquote') },
  { icon: 'i-lucide-code', action: () => editor.value?.chain().focus().toggleCode().run(), isActive: () => editor.value?.isActive('code') },
  { icon: 'i-lucide-code-2', action: () => editor.value?.chain().focus().toggleCodeBlock().run(), isActive: () => editor.value?.isActive('codeBlock') },
  { separator: true },
  { icon: 'i-lucide-undo', action: () => editor.value?.chain().focus().undo().run(), isActive: () => false },
  { icon: 'i-lucide-redo', action: () => editor.value?.chain().focus().redo().run(), isActive: () => false },
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
          @click="tool.action?.()"
        >
          <UIcon :name="tool.icon!" class="size-3.5" />
        </button>
      </template>
    </div>

    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      class="tiptap-content min-h-[200px] flex-1 px-4 py-3"
    />
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
</style>
