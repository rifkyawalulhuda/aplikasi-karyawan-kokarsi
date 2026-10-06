<script setup lang="ts">
import type {
  EmployeeImportRow,
  InvalidImportRow,
  BankUpdateRow,
  InvalidBankUpdateRow,
} from '~/composables/useImportTemplate'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'imported': []
}>()

const toast = useToast()
const {
  generateTemplate,
  parseAndValidate,
  generateBankUpdateTemplate,
  parseAndValidateBankUpdate,
} = useImportTemplate()

/**
 * Dua mode:
 *  - `create` : tambah karyawan baru (perilaku lama, wajib semua kolom).
 *  - `bank`   : update massal Data Bank karyawan yang SUDAH ada, dicocokkan per
 *               No. Induk Karyawan. Hanya menyentuh kolom bank + no. rekening.
 */
type EditorMode = 'create' | 'bank'
const mode = ref<EditorMode>('create')
const isBankMode = computed(() => mode.value === 'bank')

const templateLoading = ref(false)
const parsing = ref(false)
const importing = ref(false)
const selectedFile = ref<File | null>(null)

const createValid = ref<EmployeeImportRow[]>([])
const createInvalid = ref<InvalidImportRow[]>([])
const bankValid = ref<BankUpdateRow[]>([])
const bankInvalid = ref<InvalidBankUpdateRow[]>([])
const totalRows = ref(0)
const dragOver = ref(false)

interface ResultState {
  success: boolean
  title: string
  subtitle?: string
  errors: Array<{ row: number; message: string }>
}
const result = ref<ResultState | null>(null)

const validRows = computed<any[]>(() => (isBankMode.value ? bankValid.value : createValid.value))
const invalidRows = computed<any[]>(() => (isBankMode.value ? bankInvalid.value : createInvalid.value))

const hasPreview = computed(() => validRows.value.length > 0 || invalidRows.value.length > 0)
const canImport = computed(() => validRows.value.length > 0 && invalidRows.value.length === 0 && !importing.value)
const showResult = computed(() => result.value !== null)

function switchMode(next: EditorMode) {
  if (mode.value === next) return
  mode.value = next
  resetFile()
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    resetState()
  }
})

function resetState() {
  selectedFile.value = null
  createValid.value = []
  createInvalid.value = []
  bankValid.value = []
  bankInvalid.value = []
  totalRows.value = 0
  result.value = null
  dragOver.value = false
}

async function handleDownloadTemplate() {
  templateLoading.value = true
  try {
    if (isBankMode.value) {
      await generateBankUpdateTemplate()
    } else {
      await generateTemplate()
    }
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
  result.value = null
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
  createValid.value = []
  createInvalid.value = []
  bankValid.value = []
  bankInvalid.value = []
  totalRows.value = 0

  const verb = isBankMode.value ? 'update' : 'import'

  try {
    if (isBankMode.value) {
      const res = await parseAndValidateBankUpdate(selectedFile.value)
      bankValid.value = res.validRows
      bankInvalid.value = res.invalidRows
      totalRows.value = res.totalRows
    } else {
      const res = await parseAndValidate(selectedFile.value)
      createValid.value = res.validRows
      createInvalid.value = res.invalidRows
      totalRows.value = res.totalRows
    }

    if (totalRows.value === 0) {
      toast.add({ title: 'File tidak berisi data', description: 'Pastikan ada minimal 1 baris data karyawan', color: 'warning' })
    } else if (invalidRows.value.length > 0) {
      toast.add({
        title: 'Ditemukan error validasi',
        description: `${invalidRows.value.length} dari ${totalRows.value} baris memiliki error. Perbaiki sebelum ${verb}.`,
        color: 'warning',
      })
    } else {
      toast.add({
        title: 'Semua data valid',
        description: `${validRows.value.length} baris siap di${verb}`,
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
  result.value = null

  try {
    if (isBankMode.value) {
      const res = await $fetch<{ updated: number; skipped: number }>(
        '/api/employees/bulk-update-bank',
        {
          method: 'POST',
          body: {
            employees: bankValid.value.map(row => ({
              employeeNo: row.employeeNo,
              bank: row.bank,
              bankAccountNumber: row.bankAccountNumber,
              rowNumber: row.rowNumber,
            })),
          },
        },
      )

      result.value = {
        success: true,
        title: `${res.updated} karyawan berhasil diperbarui`,
        subtitle: res.skipped > 0 ? `${res.skipped} baris dilewati (tidak ada bank/rekening untuk diisi)` : undefined,
        errors: [],
      }
      toast.add({
        title: 'Update berhasil',
        description: `${res.updated} data bank diperbarui`,
        color: 'success',
      })
      emit('imported')
      emit('update:open', false)
      return
    }

    const res = await $fetch<{ imported: number; errors: Array<{ row: number; message: string }> }>(
      '/api/employees/bulk-import',
      {
        method: 'POST',
        body: {
          employees: createValid.value.map(({ rowNumber, ...emp }) => emp),
        },
      },
    )

    result.value = {
      success: res.errors.length === 0,
      title: `${res.imported} karyawan berhasil diimport`,
      subtitle: res.errors.length > 0 ? `${res.errors.length} baris gagal` : undefined,
      errors: res.errors,
    }

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
    // Nuxt membungkus error server: pesan/errors asli bisa berada di `e.data`
    // atau `e.data.data` tergantung pembungkus proxy. Tangani keduanya.
    const payload = e?.data?.data ?? e?.data ?? {}
    const backendErrors: Array<{ row: number; message: string }> = payload?.errors ?? []
    const message: string = payload?.message ?? 'Terjadi kesalahan saat memproses data'

    result.value = {
      success: false,
      title: isBankMode.value ? 'Update dibatalkan' : 'Import dibatalkan',
      subtitle: message,
      errors: backendErrors,
    }

    toast.add({
      title: isBankMode.value ? 'Gagal update data bank' : 'Gagal import data',
      description: backendErrors.length > 0
        ? `${message} (${backendErrors.length} baris bermasalah)`
        : message,
      color: 'error',
    })
  } finally {
    importing.value = false
  }
}

function resetFile() {
  selectedFile.value = null
  createValid.value = []
  createInvalid.value = []
  bankValid.value = []
  bankInvalid.value = []
  totalRows.value = 0
  result.value = null
}
</script>

<template>
  <UModal
    :open="open"
    title="Import / Update Data Karyawan"
    :ui="{ content: 'max-w-4xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <!-- Pilih mode -->
        <div class="grid grid-cols-2 gap-1 rounded-xl border border-default p-1">
          <UButton
            label="Tambah Karyawan Baru"
            icon="i-lucide-user-plus"
            block
            :color="mode === 'create' ? 'primary' : 'neutral'"
            :variant="mode === 'create' ? 'solid' : 'ghost'"
            @click="switchMode('create')"
          />
          <UButton
            label="Update Data Bank"
            icon="i-lucide-landmark"
            block
            :color="mode === 'bank' ? 'primary' : 'neutral'"
            :variant="mode === 'bank' ? 'solid' : 'ghost'"
            @click="switchMode('bank')"
          />
        </div>

        <p v-if="isBankMode" class="text-xs text-muted">
          Perbarui <b>Bank</b> & <b>No. Rekening</b> karyawan yang sudah ada, dicocokkan lewat
          <b>No. Induk Karyawan</b>. Kolom karyawan lain tidak diubah. File <b>Export Excel</b> data karyawan
          bisa langsung dipakai — cukup isi kolom Bank/Cabang & No. Rekening.
        </p>

        <!-- Download Template -->
        <div class="flex items-center justify-between rounded-xl border border-default bg-elevated/30 p-4">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-file-spreadsheet" class="w-6 h-6 text-success" />
            <div>
              <p class="text-sm font-medium text-highlighted">
                {{ isBankMode ? 'Template Update Data Bank' : 'Template Excel' }}
              </p>
              <p class="text-xs text-muted">
                {{ isBankMode
                  ? 'Kolom: No. Induk Karyawan, Bank, No. Rekening'
                  : 'Unduh template dengan dropdown validasi dari data master' }}
              </p>
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
                    <th v-if="!isBankMode" class="px-3 py-2 text-left font-medium text-muted">Nama</th>
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
                    <td v-if="!isBankMode" class="px-3 py-2">{{ row.data.fullName || '-' }}</td>
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
                    <th v-if="!isBankMode" class="px-3 py-2 text-left font-medium text-muted">Nama</th>
                    <template v-if="isBankMode">
                      <th class="px-3 py-2 text-left font-medium text-muted">Bank</th>
                      <th class="px-3 py-2 text-left font-medium text-muted">No. Rekening</th>
                    </template>
                    <template v-else>
                      <th class="px-3 py-2 text-left font-medium text-muted">Email</th>
                      <th class="px-3 py-2 text-left font-medium text-muted">Gender</th>
                      <th class="px-3 py-2 text-left font-medium text-muted">Jabatan</th>
                    </template>
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
                    <td v-if="!isBankMode" class="px-3 py-2">{{ row.fullName || '-' }}</td>
                    <template v-if="isBankMode">
                      <td class="px-3 py-2 text-xs">{{ row.bank || '-' }}</td>
                      <td class="px-3 py-2 text-xs">{{ row.bankAccountNumber || '-' }}</td>
                    </template>
                    <template v-else>
                      <td class="px-3 py-2 text-xs">{{ row.email }}</td>
                      <td class="px-3 py-2 text-xs">{{ row.gender === 'MALE' ? 'Laki-laki' : 'Perempuan' }}</td>
                      <td class="px-3 py-2 text-xs">{{ row.jobRoleId }}</td>
                    </template>
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
              <p class="font-semibold text-warning">
                Semua baris harus valid sebelum {{ isBankMode ? 'update' : 'import' }}
              </p>
              <p class="mt-1 text-muted">
                Perbaiki {{ invalidRows.length }} baris bermasalah di file Excel Anda, lalu unggah ulang.
                {{ isBankMode ? 'Update' : 'Import' }} hanya bisa dilakukan jika semua baris valid
                ({{ validRows.length }}/{{ totalRows }}).
              </p>
            </div>
          </div>
        </div>

        <!-- Hasil -->
        <div v-if="showResult" class="space-y-4">
          <div
            class="rounded-xl border p-6 text-center"
            :class="result!.success
              ? 'border-success/40 bg-success/10'
              : 'border-error/40 bg-error/10'"
          >
            <UIcon
              :name="result!.success ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
              class="w-12 h-12 mx-auto mb-3"
              :class="result!.success ? 'text-success' : 'text-error'"
            />
            <p class="text-lg font-semibold text-highlighted">
              {{ result!.title }}
            </p>
            <p v-if="result!.subtitle" class="text-sm text-muted mt-1">
              {{ result!.subtitle }}
            </p>
          </div>

          <div v-if="result!.errors.length > 0" class="rounded-xl border border-error/30 overflow-hidden">
            <div class="bg-error/10 px-4 py-2 border-b border-error/30">
              <p class="text-sm font-semibold text-error">
                Detail Error ({{ result!.errors.length }})
              </p>
            </div>
            <div class="max-h-[240px] overflow-y-auto">
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

          <div class="flex justify-end">
            <UButton
              label="Tutup"
              color="neutral"
              variant="subtle"
              @click="emit('update:open', false)"
            />
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
          :label="isBankMode ? `Update ${validRows.length} Karyawan` : `Import ${validRows.length} Karyawan`"
          :icon="isBankMode ? 'i-lucide-landmark' : 'i-lucide-upload'"
          color="primary"
          :loading="importing"
          :disabled="!canImport"
          @click="handleImport"
        />
      </div>
    </template>
  </UModal>
</template>
