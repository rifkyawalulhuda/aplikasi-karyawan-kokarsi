<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: File | null
  uploading?: boolean
  uploadedName?: string
  accept?: string
  maxSizeMb?: number
  hint?: string
}>(), {
  uploading: false,
  uploadedName: '',
  accept: 'application/pdf',
  maxSizeMb: 10,
  hint: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: File | null]
}>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const error = ref('')

function pickFile() {
  input.value?.click()
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function acceptFile(file: File) {
  error.value = ''
  if (props.accept === 'application/pdf' && file.type !== 'application/pdf') {
    error.value = 'Hanya file PDF yang diizinkan.'
    return
  }
  if (file.size > props.maxSizeMb * 1024 * 1024) {
    error.value = `Ukuran file maksimal ${props.maxSizeMb} MB.`
    return
  }
  emit('update:modelValue', file)
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) acceptFile(file)
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) acceptFile(file)
}

function clearFile() {
  error.value = ''
  emit('update:modelValue', null)
  if (input.value) input.value.value = ''
}

watch(() => props.modelValue, (file) => {
  if (file) error.value = ''
})
</script>

<template>
  <div>
    <div
      v-if="modelValue"
      class="flex items-center gap-3 rounded-xl border border-default bg-elevated/30 p-3"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
        <UIcon name="i-lucide-file-check" class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-highlighted">
          {{ modelValue.name }}
        </p>
        <p class="mt-0.5 text-xs text-muted">
          {{ formatSize(modelValue.size) }} · Siap diunggah
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Hapus file"
        @click="clearFile"
      />
    </div>

    <div
      v-else-if="uploadedName && !uploading"
      class="flex items-center gap-3 rounded-xl border border-default bg-elevated/30 p-3"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
        <UIcon name="i-lucide-file-check" class="size-5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-highlighted">
          {{ uploadedName }}
        </p>
        <p class="mt-0.5 text-xs text-muted">
          Dokumen tersimpan. Pilih file baru untuk menggantinya.
        </p>
      </div>
      <UButton
        label="Ganti"
        color="neutral"
        variant="outline"
        size="sm"
        @click="pickFile"
      />
    </div>

    <div
      v-else
      role="button"
      tabindex="0"
      class="flex items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors"
      :class="dragging
        ? 'border-primary bg-primary/5'
        : 'border-default bg-elevated/20 hover:border-primary/40 hover:bg-elevated/40'"
      :aria-label="uploading ? 'Sedang mengunggah dokumen' : 'Pilih file dokumen PDF'"
      @click="pickFile"
      @keydown.enter.prevent="pickFile"
      @keydown.space.prevent="pickFile"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon
          :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'"
          class="size-5"
          :class="uploading ? 'animate-spin' : ''"
          aria-hidden="true"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium text-highlighted">
          {{ uploading ? 'Mengunggah dokumen...' : 'Pilih file PDF' }}
        </span>
        <span class="mt-0.5 block text-xs text-muted">
          {{ hint || `PDF, maksimal ${maxSizeMb} MB. Bisa juga tarik file ke sini.` }}
        </span>
      </span>
      <span class="hidden shrink-0 rounded-md border border-default px-3 py-1.5 text-xs font-medium text-toned sm:inline-flex">
        Pilih
      </span>
    </div>

    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="accept"
      @change="onInput"
    >

    <p v-if="error" class="mt-2 flex items-center gap-1.5 text-xs text-error">
      <UIcon name="i-lucide-circle-alert" class="size-3.5" aria-hidden="true" />
      {{ error }}
    </p>
  </div>
</template>
