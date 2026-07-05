<script setup lang="ts">
import type { EmployeeImportRow, InvalidImportRow } from '~/composables/useImportTemplate'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'imported': []
}>()

const toast = useToast()
const { generateTemplate, parseAndValidate } = useImportTemplate()

const templateLoading = ref(false)
const parsing = ref(false)
const importing = ref(false)
const selectedFile = ref<File | null>(null)
const validRows = ref<EmployeeImportRow[]>([])
const invalidRows = ref<InvalidImportRow[]>([])
const totalRows = ref(0)
const dragOver = ref(false)
const importResult = ref<{ imported: number; errors: Array<{ row: number; message: string }> } | null>(null)

const hasPreview = computed(() => validRows.value.length > 0 || invalidRows.value.length > 0)
const canImport = computed(() => validRows.value.length > 0 && invalidRows.value.length === 0 && !importing.value)
const showResult = computed(() => importResult.value !== null)

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    resetState()
  }
})

function resetState() {
  selectedFile.value = null
  validRows.value = []
  invalidRows.value = []
  totalRows.value = 0
  importResult.value = null
  dragOver.value = false
}

async function handleDownloadTemplate() {
  templateLoading.value = true
  try {
    await generateTemplate()
    toast.add({ title: 'Template berhasil diunduh', color: 'success' })
  } catch (e: any) {
    console.error('Template download error:', e)
    const msg = e?.data?.message ?? e?.message ?? e?.statusMessage ?? 'Terjadi kesalahan'
    toast.add({
      title: 'Gagal mengunduh template',
      description: msg,
      color: 'error',
    })
  } finally {
    templateLoading.value = false
  }
}

function handleFileSelect(file: File | null) {
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
  importResult.value = null
  parseFile()
}

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  handleFileSelect(file)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0] ?? null
  handleFileSelect(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
}

async function parseFile() {
  if (!selectedFile.value) return

  parsing.value = true
  validRows.value = []
  invalidRows.value = []
  totalRows.value = 0

  try {
    const result = await parseAndValidate(selectedFile.value)
    validRows.value = result.validRows
    invalidRows.value = result.invalidRows
    totalRows.value = result.totalRows

    if (result.totalRows === 0) {
      toast.add({ title: 'File tidak berisi data', description: 'Pastikan ada minimal 1 baris data karyawan', color: 'warning' })
    } else if (result.invalidRows.length > 0) {
      toast.add({
        title: 'Ditemukan error validasi',
        description: `${result.invalidRows.length} dari ${result.totalRows} baris memiliki error. Perbaiki sebelum import.`,
        color: 'warning',
      })
    } else {
      toast.add({
        title: 'Semua data valid',
        description: `${result.validRows.length} baris siap diimport`,
        color: 'success',
      })
    }
  } catch (e: any) {
    toast.add({
      title: 'Gagal membaca file',
      description: e?.data?.message ?? e?.message ?? 'Pastikan menggunakan template yang benar',
      color: 'error',
    })
  } finally {
    parsing.value = false
  }
}

async function handleImport() {
  if (!canImport.value) return

  importing.value = true
  importResult.value = null

  try {
    const res = await $fetch<{ imported: number; errors: Array<{ row: number; message: string }> }>(
      '/api/employees/bulk-import',
      {
        method: 'POST',
        body: {
          employees: validRows.value.map(({ rowNumber, ...emp }) => emp),
        },
      },
    )

    importResult.value = res

    if (res.errors.length === 0) {
      toast.add({
        title: 'Import berhasil',
        description: `${res.imported} karyawan berhasil diimport`,
        color: 'success',
      })
      emit('imported')
      emit('update:open', false)
    } else {
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
    importing.value = false
  }
}

function resetFile() {
  selectedFile.value = null
  validRows.value = []
  invalidRows.value = []
  totalRows.value = 0
  importResult.value = null
}
</script>

<template>
  <UModal
    :open="open"
    title="Import Data Karyawan"
    :ui="{ content: 'max-w-4xl' }"
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
              <p class="text-xs text-muted">Unduh template dengan dropdown validasi dari data master</p>
            </div>
          </div>
          <UButton
            label="Download Template"
            icon="i-lucide-download"
            color="success"
            variant="subtle"
            :loading="templateLoading"
            @click="handleDownloadTemplate"
          />
        </div>

        <!-- Upload Area -->
        <div
          v-if="!hasPreview && !showResult"
          class="relative rounded-xl border-2 border-dashed transition-colors"
          :class="dragOver ? 'border-primary bg-primary/5' : 'border-default'"
          @drop="onDrop"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
        >
          <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <UIcon
              :name="dragOver ? 'i-lucide-file-plus' : 'i-lucide-upload-cloud'"
              class="w-10 h-10 mb-3"
              :class="dragOver ? 'text-primary' : 'text-muted'"
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
              :loading="parsing"
              @click="($refs.fileInput as HTMLInputElement).click()"
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

        <!-- Parsing Loader -->
        <div v-if="parsing" class="flex items-center justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 text-primary animate-spin mr-2" />
          <span class="text-sm text-muted">Memproses file...</span>
        </div>

        <!-- Preview Table -->
        <div v-if="hasPreview && !parsing && !showResult" class="space-y-4">
          <!-- Summary -->
          <div class="flex flex-wrap items-center gap-3">
            <UBadge variant="subtle" color="neutral" size="lg">
              Total: {{ totalRows }} baris
            </UBadge>
            <UBadge variant="subtle" color="success" size="lg">
              Valid: {{ validRows.length }}
            </UBadge>
            <UBadge v-if="invalidRows.length > 0" variant="subtle" color="error" size="lg">
              Error: {{ invalidRows.length }}
            </UBadge>
            <UButton
              label="Ganti File"
              icon="i-lucide-refresh-ccw"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="resetFile"
            />
          </div>

          <!-- Error rows -->
          <div v-if="invalidRows.length > 0" class="rounded-xl border border-error/30 overflow-hidden">
            <div class="bg-error/10 px-4 py-2 border-b border-error/30">
              <p class="text-sm font-semibold text-error flex items-center gap-2">
                <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />
                Baris dengan Error ({{ invalidRows.length }})
              </p>
            </div>
            <div class="max-h-[300px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-elevated/50 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-muted">Baris</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">No. Induk</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Nama</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Error</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in invalidRows"
                    :key="row.rowNumber"
                    class="border-t border-default"
                  >
                    <td class="px-3 py-2 text-muted">{{ row.rowNumber }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ row.data.employeeNo || '-' }}</td>
                    <td class="px-3 py-2">{{ row.data.fullName || '-' }}</td>
                    <td class="px-3 py-2">
                      <ul class="space-y-0.5">
                        <li v-for="(err, i) in row.errors" :key="i" class="text-xs text-error">
                          • {{ err }}
                        </li>
                      </ul>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Valid rows preview -->
          <div v-if="validRows.length > 0" class="rounded-xl border border-default overflow-hidden">
            <div class="bg-success/10 px-4 py-2 border-b border-default">
              <p class="text-sm font-semibold text-success flex items-center gap-2">
                <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
                Data Valid ({{ validRows.length }})
              </p>
            </div>
            <div class="max-h-[300px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-elevated/50 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-muted">Baris</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">No. Induk</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Nama</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Email</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Gender</th>
                    <th class="px-3 py-2 text-left font-medium text-muted">Jabatan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in validRows.slice(0, 50)"
                    :key="row.rowNumber"
                    class="border-t border-default"
                  >
                    <td class="px-3 py-2 text-muted">{{ row.rowNumber }}</td>
                    <td class="px-3 py-2 font-mono text-xs">{{ row.employeeNo }}</td>
                    <td class="px-3 py-2">{{ row.fullName }}</td>
                    <td class="px-3 py-2 text-xs">{{ row.email }}</td>
                    <td class="px-3 py-2 text-xs">{{ row.gender === 'MALE' ? 'Laki-laki' : 'Perempuan' }}</td>
                    <td class="px-3 py-2 text-xs">{{ row.jobRoleId }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="validRows.length > 50" class="px-3 py-2 text-xs text-muted text-center border-t border-default">
                Dan {{ validRows.length - 50 }} baris lainnya...
              </p>
            </div>
          </div>

          <!-- Warning if errors exist -->
          <div v-if="invalidRows.length > 0" class="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div class="text-sm">
              <p class="font-semibold text-warning">Semua baris harus valid sebelum import</p>
              <p class="mt-1 text-muted">
                Perbaiki {{ invalidRows.length }} baris bermasalah di file Excel Anda, lalu unggah ulang.
                Import hanya bisa dilakukan jika semua baris valid ({{ validRows.length }}/{{ totalRows }}).
              </p>
            </div>
          </div>
        </div>

        <!-- Import Result -->
        <div v-if="showResult" class="space-y-4">
          <div
            class="rounded-xl border p-6 text-center"
            :class="importResult!.errors.length === 0
              ? 'border-success/40 bg-success/10'
              : 'border-warning/40 bg-warning/10'"
          >
            <UIcon
              :name="importResult!.errors.length === 0 ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
              class="w-12 h-12 mx-auto mb-3"
              :class="importResult!.errors.length === 0 ? 'text-success' : 'text-warning'"
            />
            <p class="text-lg font-semibold text-highlighted">
              {{ importResult!.imported }} karyawan berhasil diimport
            </p>
            <p v-if="importResult!.errors.length > 0" class="text-sm text-muted mt-1">
              {{ importResult!.errors.length }} baris gagal
            </p>
          </div>

          <div v-if="importResult!.errors.length > 0" class="rounded-xl border border-error/30 overflow-hidden">
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
                    v-for="(err, i) in importResult!.errors"
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
          label="Tutup"
          color="neutral"
          variant="subtle"
          @click="emit('update:open', false)"
        />
        <UButton
          v-if="hasPreview && !showResult"
          :label="`Import ${validRows.length} Karyawan`"
          icon="i-lucide-upload"
          color="primary"
          :loading="importing"
          :disabled="!canImport"
          @click="handleImport"
        />
      </div>
    </template>
  </UModal>
</template>
