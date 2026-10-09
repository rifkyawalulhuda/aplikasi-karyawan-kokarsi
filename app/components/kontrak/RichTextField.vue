<script setup lang="ts">
/**
 * Field teks dengan toolbar pemformatan inline (B / I / U) — pembungkus
 * `UTextarea` dengan API identik, plus grup perataan opsional.
 *
 * Prinsip:
 * - Tetap `string` + markup inline (`**tebal**`, `*miring*`, `__garis bawah__`).
 *   Tidak ada model data baru; yang tersimpan tetap teks biasa.
 * - Penggantian teks memakai `setRangeText` + `setSelectionRange` pada elemen
 *   `<textarea>` asli sehingga undo bawaan browser tetap bekerja.
 * - Backend tetap otoritatif; toolbar ini hanya mempermudah menulis markup
 *   yang sudah didefinisikan `app/utils/inline-marks.ts`.
 */
import {
  activeMarksForRange,
  hasInlineMarks,
  parseInlineMarks,
  toggleMark,
  type InlineMark
} from '~/utils/inline-marks'

type AlignValue = 'left' | 'center' | 'right' | 'justify'

interface Props {
  disabled?: boolean
  rows?: number
  autoresize?: boolean
  placeholder?: string
  /** Tampilkan grup perataan (hanya untuk blok `paragraph` / `article`). */
  showAlign?: boolean
  defaultAlign?: 'justify' | 'left'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 3,
  autoresize: true,
  placeholder: '',
  showAlign: false,
  defaultAlign: 'justify'
})

/** `align` sengaja tidak punya default: tidak ada = perilaku default renderer. */
const align = defineModel<AlignValue | undefined>('align')
const model = defineModel<string>({ default: '' })

const field = useTemplateRef<{ textareaRef?: HTMLTextAreaElement | null } | null>('field')

const MARK_BUTTONS: Array<{ mark: InlineMark, icon: string, label: string, shortcut: string }> = [
  { mark: 'bold', icon: 'i-lucide-bold', label: 'Tebal', shortcut: 'Ctrl+B' },
  { mark: 'italic', icon: 'i-lucide-italic', label: 'Miring', shortcut: 'Ctrl+I' },
  { mark: 'underline', icon: 'i-lucide-underline', label: 'Garis bawah', shortcut: 'Ctrl+U' }
]

const selStart = ref(0)
const selEnd = ref(0)

function syncSelection() {
  const el = field.value?.textareaRef
  if (!el) return
  selStart.value = el.selectionStart ?? 0
  selEnd.value = el.selectionEnd ?? 0
}

/** Mark aktif untuk seleksi/kursor saat ini — menyalakan status tombol toolbar. */
const activeMarks = computed(() => activeMarksForRange(model.value, selStart.value, selEnd.value))

/** Pratinjau inline perkiran; acuan final tetap modal Pratinjau PDF. */
const previewRuns = computed(() => parseInlineMarks(model.value))
const showPreview = computed(() => hasInlineMarks(model.value))
const previewAlign = computed(() => align.value ?? props.defaultAlign)

function applyMark(mark: InlineMark) {
  const el = field.value?.textareaRef
  if (!el || props.disabled) return

  const result = toggleMark(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, mark)
  if (result.text !== el.value) {
    // Turunkan ke satu operasi penggantian rentang (undo tetap satu langkah).
    const oldText = el.value
    let prefix = 0
    while (prefix < oldText.length && prefix < result.text.length && oldText[prefix] === result.text[prefix]) prefix++
    let suffix = 0
    while (
      suffix < oldText.length - prefix
      && suffix < result.text.length - prefix
      && oldText[oldText.length - 1 - suffix] === result.text[result.text.length - 1 - suffix]
    ) suffix++
    el.setRangeText(result.text.slice(prefix, result.text.length - suffix), prefix, oldText.length - suffix, 'end')
  }
  el.setSelectionRange(result.selectionStart, result.selectionEnd)
  syncSelection()
  model.value = el.value
}

/** Pintasan Ctrl/Cmd+B / I / U. */
function onKeydown(event: KeyboardEvent) {
  if (props.disabled || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
  const marks: Record<string, InlineMark> = { b: 'bold', i: 'italic', u: 'underline' }
  const mark = marks[event.key.toLowerCase()]
  if (!mark) return
  event.preventDefault()
  applyMark(mark)
}
</script>

<template>
  <div class="w-full">
    <div v-if="!disabled" class="mb-1 flex flex-wrap items-center gap-0.5">
      <UTooltip
        v-for="button in MARK_BUTTONS"
        :key="button.mark"
        :text="`${button.label} (${button.shortcut})`"
      >
        <UButton
          :icon="button.icon"
          size="xs"
          :variant="activeMarks.has(button.mark) ? 'soft' : 'ghost'"
          :color="activeMarks.has(button.mark) ? 'primary' : 'neutral'"
          :aria-label="button.label"
          :aria-pressed="activeMarks.has(button.mark)"
          type="button"
          @click="applyMark(button.mark)"
        />
      </UTooltip>
      <KontrakAlignButtonGroup
        v-if="showAlign"
        class="ml-1 border-l border-default pl-1"
        :align="align"
        :default-align="defaultAlign"
        :disabled="disabled"
        @update:align="align = $event"
      />
    </div>

    <UTextarea
      ref="field"
      v-model="model"
      :disabled="disabled"
      :rows="rows"
      :autoresize="autoresize"
      :placeholder="placeholder"
      class="w-full"
      @keydown="onKeydown"
      @keyup="syncSelection"
      @click="syncSelection"
      @select="syncSelection"
      @focus="syncSelection"
    />

    <div
      v-if="showPreview"
      class="mt-1 rounded-md border border-default bg-elevated/40 px-3 py-2 text-sm whitespace-pre-wrap"
      :style="{ textAlign: previewAlign }"
    >
      <span
        v-for="(run, i) in previewRuns"
        :key="i"
        :style="{
          fontWeight: run.bold ? 600 : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: run.underline ? 'underline' : undefined
        }"
      >{{ run.text }}</span>
      <span class="ml-2 text-xs text-muted italic">Pratinjau perkiran — acuan final: Pratinjau PDF</span>
    </div>
  </div>
</template>
