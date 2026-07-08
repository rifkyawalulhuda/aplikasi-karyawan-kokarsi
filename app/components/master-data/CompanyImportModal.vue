<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'imported': []
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const templateLoading = ref(false)
const result = ref<{ imported: number; errors: Array<{ row: number; message: string }> } | null>(null)
const isDragging = ref(false)

const showResult = computed(() => result.value !== null)

watch(() => props.open, (val) => {
  if (!val) {
    selectedFile.value = null
    result.value = null
    isDragging.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
})

async function handleDownloadTemplate() {
  templateLoading.value = true
  try {
    const blob = await $fetch<Blob>('/api/lookups/companies/import-template', {
      method: 'GET',
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-import-perusahaan.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.add({ title: 'Template berhasil diunduh', color: 'success' })
  } catch (e: any) {
    console.error('Template download error:', e)
    const msg = e?.data?.message ?? e?.message ?? 'Terjadi kesalahan'
    toast.add({
      title: 'Gagal mengunduh template',
      description: msg,
      color: 'error',
    })
  } finally {
    templateLoading.value = false
  }
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return

  const isValidType = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!isValidType) {
    toast.add({ title: 'Format file tidak didukung', description: 'Gunakan file Excel (.xlsx atau .xls)', color: 'error' })
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 5MB', color: 'error' })
    return
  }

  selectedFile.value = file
  result.value = null
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0] ?? null
  if (!file) return

  const isValidType = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!isValidType) {
    toast.add({ title: 'Format file tidak didukung', description: 'Gunakan file Excel (.xlsx atau .xls)', color: 'error' })
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 5MB', color: 'error' })
    return
  }

  selectedFile.value = file
  result.value = null
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function clearFile() {
  selectedFile.value = null
  result.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function onImport() {
  if (!selectedFile.value) return

  loading.value = true
  result.value = null

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const res = await $fetch<{ imported: number; errors: Array<{ row: number; message: string }> }>(
      '/api/lookups/companies/bulk-import',
      {
        method: 'POST',
        body: formData,
        credentials: 'include',
      },
    )
    result.value = res

    if (res.imported > 0) {
      toast.add({ title: `${res.imported} perusahaan berhasil diimport`, color: 'success' })
      emit('imported')
    }

    if (res.errors.length === 0 && res.imported > 0) {
      emit('update:open', false)
    } else if (res.errors.length > 0) {
      toast.add({
        title: 'Import selesai dengan error',
        description: `${res.imported} berhasil, ${res.errors.length} gagal`,
        color: 'warning',
      })
    }
  } catch (e: any) {
    toast.add({
      title: 'Gagal import data',
      description: e?.data?.message ?? 'Terjadi kesalahan saat import',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Import Data Perusahaan"
    :ui="{ content: 'max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Download Template -->
        <div class="flex items-center justify-between rounded-xl border border-default bg-elevated/30 p-4">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-spreadsheet" class="w-6 h-6 text-success" />
            <div>
              <p class="text-sm font-medium text-highlighted">Template Excel</p>
              <p class="text-xs text-muted">Unduh template untuk format import perusahaan</p>
            </div>
          </div>
          <UButton
            label="Download Template Excel"
            icon="i-lucide-download"
            color="success"
            variant="subtle"
            :loading="templateLoading"
            @click="handleDownloadTemplate"
          />
        </div>

        <!-- Upload Area (when no file selected and no result) -->
        <div
          v-if="!selectedFile && !showResult"
          class="relative rounded-xl border-2 border-dashed transition-colors"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-default'"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <UIcon
              :name="isDragging ? 'i-lucide-file-plus' : 'i-lucide-upload-cloud'"
              class="w-10 h-10 mb-3"
              :class="isDragging ? 'text-primary' : 'text-muted'"
            />
            <p class="text-sm font-medium text-highlighted mb-1">
              Tarik & lepas file Excel di sini
            </p>
            <p class="text-xs text-muted mb-4">atau klik untuk pilih file (format .xlsx, maks 5MB)</p>
            <UButton
              label="Pilih File"
              icon="i-lucide-folder-open"
              color="primary"
              variant="subtle"
              @click="fileInput?.click()"
            />
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls"
              class="hidden"
              @change="onFileInputChange"
            />
          </div>
        </div>

        <!-- Selected File Info -->
        <div v-if="selectedFile && !showResult" class="space-y-4">
          <div class="flex items-center justify-between rounded-xl border border-default bg-elevated/30 p-4">
            <div class="flex items-center gap-3 min-w-0">
              <UIcon name="i-lucide-file-spreadsheet" class="w-8 h-8 text-success shrink-0" />
              <div class="min-w-0">
                <p class="text-sm font-medium text-highlighted truncate">{{ selectedFile.name }}</p>
                <p class="text-xs text-muted">{{ (selectedFile.size / 1024).toFixed(1) }} KB</p>
              </div>
            </div>
            <UButton
              label="Ganti File"
              icon="i-lucide-refresh-ccw"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="clearFile"
            />
          </div>
        </div>

        <!-- Import Result -->
        <div v-if="showResult" class="space-y-4">
          <div
            class="rounded-xl border p-6 text-center"
            :class="result!.errors.length === 0
              ? 'border-success/40 bg-success/10'
              : 'border-warning/40 bg-warning/10'"
          >
            <UIcon
              :name="result!.errors.length === 0 ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
              class="w-12 h-12 mx-auto mb-3"
              :class="result!.errors.length === 0 ? 'text-success' : 'text-warning'"
            />
            <p class="text-lg font-semibold text-highlighted">
              {{ result!.imported }} data berhasil diimport
            </p>
            <p v-if="result!.errors.length > 0" class="text-sm text-muted mt-1">
              {{ result!.errors.length }} baris gagal
            </p>
          </div>

          <div v-if="result!.errors.length > 0" class="rounded-xl border border-error/30 overflow-hidden">
            <div class="bg-error/10 px-4 py-2 border-b border-error/30">
              <p class="text-sm font-semibold text-error">Detail Error</p>
            </div>
            <div class="max-h-[200px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-elevated/50 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-muted">Baris</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Pesan Error</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(err, i) in result!.errors"
                    :key="i"
                    class="border-t border-default"
                  >
                    <td class="px-3 py-2 text-muted">{{ err.row }}</td>
                    <td class="px-3 py-2 text-error text-xs">{{ err.message }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton
          label="Batal"
          color="neutral"
          variant="subtle"
          @click="emit('update:open', false)"
        />
        <UButton
          v-if="selectedFile && !showResult"
          label="Import"
          icon="i-lucide-upload"
          color="primary"
          :loading="loading"
          :disabled="!selectedFile"
          @click="onImport"
        />
      </div>
    </template>
  </UModal>
</template>
