<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface EmployeeDocument {
  id: number
  employeeId: number
  documentTypeId: number
  documentNumber: string
  expiryDate: string
  notes?: string
  fileUrl?: string
  status: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  employee: { id: number; employeeNo: string; fullName: string }
  documentType: { id: number; name: string; documentType: string; issuer: string }
  createdAt: string
  updatedAt: string
}

interface DocumentTypeItem {
  id: number
  name: string
  documentType: string
  issuer: string
}

interface EmployeeOption {
  label: string
  value: number
}

interface DocumentTypeOption {
  label: string
  value: number
  _raw: DocumentTypeItem
}

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit'
  initialData?: EmployeeDocument | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const replaceFile = ref(false)

// --- Fetch employees ---
const { data: employeesRes } = useFetch<{ data: { id: number; fullName: string; employeeNo: string }[] }>('/api/employees', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

// --- Fetch document types ---
const { data: documentTypesRes } = useFetch<DocumentTypeItem[]>('/api/lookups/document-types', {
  credentials: 'include',
})

const employeeOptions = computed<EmployeeOption[]>(() =>
  (employeesRes.value?.data ?? []).map(e => ({
    label: `${e.fullName} (${e.employeeNo})`,
    value: e.id,
  }))
)

const documentTypeOptions = computed<DocumentTypeOption[]>(() =>
  (documentTypesRes.value ?? []).map(dt => ({
    label: dt.name,
    value: dt.id,
    _raw: dt,
  }))
)

// --- Schema ---
const schema = z.object({
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  documentTypeId: z.number({ error: 'Jenis dokumen wajib dipilih' }),
  documentNumber: z.string().min(1, 'Nomor dokumen wajib diisi'),
  expiryDate: z.string().min(1, 'Masa berlaku wajib diisi'),
  notes: z.string().optional(),
})

type Schema = z.output<typeof schema>

// --- Form state ---
const state = reactive<Partial<Schema>>({
  employeeId: undefined,
  documentTypeId: undefined,
  documentNumber: '',
  expiryDate: '',
  notes: '',
})

// Display-only fields autofilled from selected document type
const jenisLabel = ref('')
const issuerLabel = ref('')

// --- Populate on edit ---
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (props.mode === 'edit' && props.initialData) {
      const d = props.initialData
      state.employeeId = d.employeeId
      state.documentTypeId = d.documentTypeId
      state.documentNumber = d.documentNumber
      state.expiryDate = d.expiryDate ? d.expiryDate.slice(0, 10) : ''
      state.notes = d.notes ?? ''
      jenisLabel.value = d.documentType?.documentType ?? ''
      issuerLabel.value = d.documentType?.issuer ?? ''
    } else {
      state.employeeId = undefined
      state.documentTypeId = undefined
      state.documentNumber = ''
      state.expiryDate = ''
      state.notes = ''
      jenisLabel.value = ''
      issuerLabel.value = ''
    }
    selectedFile.value = null
    replaceFile.value = false
  },
  { immediate: true }
)

// --- Autofill on document type select ---
function onDocumentTypeSelect(val: number | undefined) {
  if (val == null) {
    jenisLabel.value = ''
    issuerLabel.value = ''
    return
  }
  const found = documentTypeOptions.value.find(o => o.value === val)
  if (found) {
    jenisLabel.value = found._raw.documentType
    issuerLabel.value = found._raw.issuer
  }
}

// --- File handling ---
function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan file PDF, JPG, PNG, atau WEBP.', color: 'error' })
    target.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal ukuran file adalah 10 MB.', color: 'error' })
    target.value = ''
    return
  }
  selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  replaceFile.value = false
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
  loading.value = true
  try {
    let docId: number

    if (props.mode === 'add') {
      const res = await $fetch<EmployeeDocument>('/api/employee-documents', {
        method: 'POST',
        body: event.data,
        credentials: 'include',
      })
      docId = res.id
    } else {
      await $fetch(`/api/employee-documents/${props.initialData!.id}`, {
        method: 'PUT',
        body: event.data,
        credentials: 'include',
      })
      docId = props.initialData!.id
    }

    // Upload file if selected
    if (selectedFile.value) {
      try {
        await uploadFile(docId)
      } catch {
        toast.add({ title: 'Dokumen tersimpan', description: 'Namun gagal mengupload file.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    toast.add({
      title: 'Berhasil',
      description: props.mode === 'add' ? 'Dokumen berhasil ditambahkan.' : 'Dokumen berhasil diperbarui.',
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  } catch {
    toast.add({
      title: 'Gagal',
      description: props.mode === 'add' ? 'Gagal menambahkan dokumen.' : 'Gagal memperbarui dokumen.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

const title = computed(() => props.mode === 'add' ? 'Tambah Dokumen' : 'Edit Dokumen')
const hasExistingFile = computed(() => !!props.initialData?.fileUrl)
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ container: 'items-start sm:items-center', panel: 'w-full max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <!-- Karyawan -->
        <UFormField label="Karyawan" name="employeeId" required>
          <USelect
            v-model="state.employeeId"
            :items="employeeOptions"
            placeholder="Pilih karyawan..."
            class="w-full"
            searchable
            searchable-placeholder="Cari karyawan..."
          />
        </UFormField>

        <!-- Jenis Dokumen -->
        <UFormField label="Nama Dokumen" name="documentTypeId" required>
          <USelect
            v-model="state.documentTypeId"
            :items="documentTypeOptions"
            placeholder="Pilih dokumen..."
            class="w-full"
            searchable
            searchable-placeholder="Cari dokumen..."
            @update:model-value="onDocumentTypeSelect"
          />
        </UFormField>

        <!-- Autofill: Jenis & Penerbit -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Jenis">
            <UInput
              :model-value="jenisLabel"
              readonly
              placeholder="Otomatis terisi"
              class="w-full opacity-60"
            />
          </UFormField>
          <UFormField label="Penerbit">
            <UInput
              :model-value="issuerLabel"
              readonly
              placeholder="Otomatis terisi"
              class="w-full opacity-60"
            />
          </UFormField>
        </div>

        <!-- Nomor Dokumen -->
        <UFormField label="Nomor Dokumen" name="documentNumber" required>
          <UInput
            v-model="state.documentNumber"
            placeholder="Contoh: CERT-2024-001"
            class="w-full"
          />
        </UFormField>

        <!-- Masa Berlaku -->
        <UFormField label="Masa Berlaku" name="expiryDate" required>
          <UInput
            v-model="state.expiryDate"
            type="date"
            class="w-full"
          />
        </UFormField>

        <!-- Catatan -->
        <UFormField label="Catatan" name="notes">
          <UTextarea
            v-model="state.notes"
            placeholder="Catatan tambahan (opsional)"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- File Upload -->
        <UFormField label="File Dokumen">
          <div class="space-y-2">
            <!-- Existing file info (edit mode) -->
            <div v-if="hasExistingFile && !replaceFile" class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm">
              <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-muted">File sudah ada</span>
              <a
                :href="initialData!.fileUrl"
                target="_blank"
                class="shrink-0 text-primary hover:underline"
              >
                Unduh
              </a>
              <UButton
                label="Ganti"
                size="xs"
                color="neutral"
                variant="subtle"
                @click="replaceFile = true"
              />
            </div>

            <!-- File input -->
            <div v-if="!hasExistingFile || replaceFile">
              <input
                ref="fileInput"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                class="hidden"
                @change="onFileChange"
              />
              <div
                class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-default px-3 py-3 text-sm text-muted transition hover:border-primary hover:text-primary"
                @click="fileInput?.click()"
              >
                <UIcon name="i-lucide-upload" class="size-4 shrink-0" />
                <span v-if="!selectedFile">Klik untuk pilih file (PDF, JPG, PNG, WEBP · maks. 10 MB)</span>
                <span v-else class="truncate text-highlighted">{{ selectedFile.name }}</span>
                <UButton
                  v-if="selectedFile"
                  icon="i-lucide-x"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="ml-auto shrink-0"
                  @click.stop="clearFile()"
                />
              </div>
              <p v-if="replaceFile" class="mt-1 text-xs text-muted">
                File baru akan menggantikan file lama setelah disimpan.
              </p>
            </div>
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
