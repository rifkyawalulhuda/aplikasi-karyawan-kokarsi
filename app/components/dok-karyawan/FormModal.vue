<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

interface DocumentType {
  id: number
  name: string
}

interface EmployeeDocument {
  id: number
  documentTypeId: number
  documentNumber: string
  expiryDate: string | null
  notes: string | null
  fileUrl: string | null
}

const props = defineProps<{
  open: boolean
  employeeId: number | null
  doc?: EmployeeDocument | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref<string | null>(null)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const expiryDateCal = shallowRef<CalendarDate | null>(null)
watch(expiryDateCal, val => { state.expiryDate = fromCalDate(val) })

// --- Fetch document types ---
const { data: documentTypesRes } = useFetch<DocumentType[]>('/api/lookups/document-types', {
  query: { category: 'PERSONAL' },
  credentials: 'include',
})

// --- Fetch existing documents untuk karyawan ini (untuk rule no-duplicate) ---
const { data: existingDocsRes, refresh: refreshExisting } = useFetch<{ data: EmployeeDocument[] } | EmployeeDocument[]>(
  '/api/employee-documents',
  {
    query: computed(() => ({ employeeId: props.employeeId, limit: 100 })),
    immediate: false,
    server: false,
  },
)

// Trigger fetch saat modal dibuka dan employeeId tersedia
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.employeeId) refreshExisting()
  },
)

// Set documentTypeId yang sudah dipakai karyawan ini
// Di mode Edit: exclude tipe yang sedang diedit (boleh tetap dipilih)
const existingDocTypeIds = computed<Set<number>>(() => {
  const raw = existingDocsRes.value
  const docs: EmployeeDocument[] = Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])
  return new Set(
    docs
      .filter(d => !isEditMode.value || d.documentTypeId !== props.doc?.documentTypeId)
      .map(d => d.documentTypeId),
  )
})

const documentTypeOptions = computed(() =>
  (documentTypesRes.value ?? []).map(dt => {
    const alreadyExists = existingDocTypeIds.value.has(dt.id)
    return {
      label: alreadyExists ? `${dt.name} ✓` : dt.name,
      value: dt.id,
      disabled: alreadyExists,
    }
  })
)

// --- Schema ---
const schema = z.object({
  documentTypeId: z.number({ error: 'Tipe dokumen wajib dipilih' }),
  documentNumber: z.string().min(1, 'Nomor dokumen wajib diisi'),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

// --- Form state ---
const state = reactive<Partial<Schema>>({
  documentTypeId: undefined,
  documentNumber: '',
  expiryDate: '',
  notes: '',
})

// --- Computed ---
const isEditMode = computed(() => !!props.doc)
const title = computed(() => isEditMode.value ? 'Edit Dokumen' : 'Tambah Dokumen')
const hasExistingFile = computed(() => !!props.doc?.fileUrl)

// --- Populate on open ---
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (props.doc) {
      state.documentTypeId = props.doc.documentTypeId
      state.documentNumber = props.doc.documentNumber
      state.expiryDate = props.doc.expiryDate ? props.doc.expiryDate.slice(0, 10) : ''
      expiryDateCal.value = toCalDate(props.doc.expiryDate ?? null)
      state.notes = props.doc.notes ?? ''
    }
    else {
      state.documentTypeId = undefined
      state.documentNumber = ''
      state.expiryDate = ''
      expiryDateCal.value = null
      state.notes = ''
    }
    selectedFile.value = null
    fileError.value = null
    if (fileInput.value) fileInput.value.value = ''
  },
  { immediate: true }
)

// --- File handling ---
function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  fileError.value = null
  if (!file) {
    selectedFile.value = null
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    fileError.value = 'Ukuran file maksimal 10MB'
    target.value = ''
    selectedFile.value = null
    return
  }
  selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  fileError.value = null
  if (fileInput.value) fileInput.value.value = ''
}

// --- Upload file ---
async function uploadFile(docId: number) {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  await $fetch(`/api/employee-documents/${docId}/file`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
}

// --- Submit ---
async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (selectedFile.value && selectedFile.value.size > 10 * 1024 * 1024) {
    fileError.value = 'Ukuran file maksimal 10MB'
    return
  }

  loading.value = true
  try {
    const payload = {
      employeeId: props.employeeId,
      documentTypeId: event.data.documentTypeId,
      documentNumber: event.data.documentNumber,
      expiryDate: event.data.expiryDate || undefined,
      notes: event.data.notes || undefined,
    }

    let docId: number

    if (isEditMode.value) {
      await $fetch(`/api/employee-documents/${props.doc!.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include',
      })
      docId = props.doc!.id
    }
    else {
      const res = await $fetch<EmployeeDocument>('/api/employee-documents', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      docId = res.id
    }

    // Upload file if selected
    if (selectedFile.value) {
      try {
        await uploadFile(docId)
      }
      catch {
        toast.add({
          title: 'Dokumen tersimpan',
          description: 'Namun gagal mengupload file.',
          color: 'warning',
        })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    toast.add({
      title: 'Berhasil',
      description: `Dokumen berhasil ${isEditMode.value ? 'diperbarui' : 'ditambahkan'}.`,
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  }
  catch {
    toast.add({
      title: 'Gagal',
      description: `Gagal ${isEditMode.value ? 'memperbarui' : 'menambahkan'} dokumen.`,
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ wrapper: 'items-start sm:items-center', content: 'w-full max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">

        <!-- Tipe Dokumen -->
        <UFormField label="Tipe Dokumen" name="documentTypeId" required>
          <USelectMenu
            v-model="state.documentTypeId"
            :items="documentTypeOptions"
            value-key="value"
            placeholder="Pilih tipe dokumen..."
            class="w-full"
            :search-input="{ placeholder: 'Cari tipe dokumen...' }"
          />
        </UFormField>

        <!-- Nomor Dokumen -->
        <UFormField label="Nomor Dokumen" name="documentNumber" required>
          <UInput
            v-model="state.documentNumber"
            placeholder="Contoh: 3174xxxxxxxxxxxx"
            class="w-full"
          />
        </UFormField>

        <!-- Masa Berlaku -->
        <UFormField label="Masa Berlaku (opsional)" name="expiryDate">
          <div class="flex items-center gap-2">
            <UPopover class="flex-1">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!expiryDateCal && 'text-muted'"
              >
                {{ expiryDateCal ? formatDisplay(expiryDateCal) : 'Pilih tanggal (opsional)' }}
              </UButton>
              <template #content>
                <CalendarPicker v-model="expiryDateCal" class="p-2" />
              </template>
            </UPopover>
            <UButton
              v-if="expiryDateCal"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="expiryDateCal = null"
            />
          </div>
          <template #hint>
            <span class="text-xs text-muted">Kosongkan untuk dokumen tanpa masa berlaku (KTP, NPWP, dll)</span>
          </template>
        </UFormField>

        <!-- Catatan -->
        <UFormField label="Catatan" name="notes">
          <UTextarea
            v-model="state.notes"
            placeholder="Catatan tambahan (opsional)..."
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <!-- File Dokumen -->
        <UFormField label="File Dokumen">
          <div class="space-y-2">
            <!-- Existing file link (edit mode) -->
            <div v-if="hasExistingFile && !selectedFile" class="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm">
              <UIcon name="i-lucide-paperclip" class="shrink-0 text-muted" />
              <a
                :href="doc!.fileUrl!"
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-0 flex-1 truncate text-primary hover:underline"
              >
                File tersimpan
              </a>
              <span class="shrink-0 text-xs text-muted">Unggah file baru untuk mengganti</span>
            </div>

            <!-- File input -->
            <div v-if="!selectedFile">
              <input
                ref="fileInput"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                class="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-default hover:file:bg-accented"
                @change="onFileChange"
              />
            </div>

            <!-- Selected file preview -->
            <div v-if="selectedFile" class="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm">
              <UIcon name="i-lucide-file" class="shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate">{{ selectedFile.name }}</span>
              <span class="shrink-0 text-xs text-muted">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</span>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                class="ml-auto shrink-0"
                @click.stop="clearFile()"
              />
            </div>

            <!-- File error -->
            <p v-if="fileError" class="text-xs text-error">{{ fileError }}</p>

            <!-- Replace note -->
            <p v-if="hasExistingFile && selectedFile" class="text-xs text-muted">
              File baru akan menggantikan file lama setelah disimpan.
            </p>
          </div>
        </UFormField>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            label="Simpan"
            color="primary"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
