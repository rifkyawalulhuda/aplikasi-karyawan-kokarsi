<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface VendorContract {
  id: number
  category: 'CUSTOMER' | 'VENDOR'
  companyId: number
  documentName: string
  documentNumber: string
  documentType: 'DOKUMEN_KONTRAK' | 'DOKUMEN_PERJANJIAN' | 'SURAT_PENAWARAN' | 'ADDENDUM' | 'AMENDMENT' | 'SURAT'
  createdDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  motherAgreementId?: number | null
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  company: { id: number; name: string }
  motherAgreement?: { id: number; documentName: string; documentNumber: string } | null
  renewals?: { id: number; documentName: string; documentNumber: string; status: string }[]
  createdAt: string
  updatedAt: string
}

interface CompanyOption {
  label: string
  value: number
}

interface MotherAgreementOption {
  label: string
  value: number
}

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit' | 'renew'
  initialData?: VendorContract | null
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
const renewedFromContractId = ref<number | undefined>(undefined)

// --- Fetch companies ---
const { data: companiesRes } = useFetch<{ id: number; name: string }[]>('/api/lookups/companies', {
  credentials: 'include',
})

const companyOptions = computed<CompanyOption[]>(() =>
  (companiesRes.value ?? []).map(c => ({
    label: c.name,
    value: c.id,
  }))
)

// --- Mother agreements ---
const motherAgreementOptions = ref<MotherAgreementOption[]>([])

async function fetchMotherAgreements() {
  if (!state.companyId || !state.category) {
    motherAgreementOptions.value = []
    return
  }
  try {
    const params = new URLSearchParams({
      companyId: String(state.companyId),
      category: String(state.category),
    })
    if (props.initialData?.id) params.set('excludeId', String(props.initialData.id))
    const res = await $fetch<{ id: number; documentName: string; documentNumber: string }[]>(
      `/api/vendor-contracts/mother-agreements?${params}`,
      { credentials: 'include' }
    )
    motherAgreementOptions.value = res.map(r => ({
      label: `${r.documentName} (${r.documentNumber})`,
      value: r.id,
    }))
  }
  catch {
    motherAgreementOptions.value = []
  }
}

// --- Document type options ---
const documentTypeOptions = [
  { label: 'Dokumen Kontrak', value: 'DOKUMEN_KONTRAK' },
  { label: 'Dokumen Perjanjian', value: 'DOKUMEN_PERJANJIAN' },
  { label: 'Surat Penawaran', value: 'SURAT_PENAWARAN' },
  { label: 'Addendum', value: 'ADDENDUM' },
  { label: 'Amendment', value: 'AMENDMENT' },
  { label: 'Surat', value: 'SURAT' },
]

// --- Category options ---
const categoryOptions = [
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Vendor', value: 'VENDOR' },
]

// --- Schema ---
const schema = z.object({
  category: z.enum(['CUSTOMER', 'VENDOR'], { error: 'Kategori wajib dipilih' }),
  companyId: z.number({ error: 'Perusahaan wajib dipilih' }),
  documentName: z.string().min(1, 'Nama dokumen wajib diisi'),
  documentNumber: z.string().min(1, 'Nomor dokumen wajib diisi'),
  documentType: z.enum(['DOKUMEN_KONTRAK', 'DOKUMEN_PERJANJIAN', 'SURAT_PENAWARAN', 'ADDENDUM', 'AMENDMENT', 'SURAT'], { error: 'Jenis dokumen wajib dipilih' }),
  createdDate: z.string().min(1, 'Tanggal dibuat wajib diisi'),
  needsRenewal: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  motherAgreementId: z.number().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.needsRenewal) {
    return !!data.startDate && !!data.endDate
  }
  return true
}, { message: 'Tanggal mulai dan berakhir wajib diisi jika butuh perpanjang', path: ['startDate'] })

type Schema = z.output<typeof schema>

// --- Form state ---
const state = reactive<Partial<Schema>>({
  category: undefined,
  companyId: undefined,
  documentName: '',
  documentNumber: '',
  documentType: undefined,
  createdDate: '',
  needsRenewal: false,
  startDate: '',
  endDate: '',
  motherAgreementId: undefined,
  location: '',
  notes: '',
})

// --- Populate on open ---
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    if (props.mode === 'edit') {
      const d = props.initialData!
      state.category = d.category
      state.companyId = d.companyId
      state.documentName = d.documentName
      state.documentNumber = d.documentNumber
      state.documentType = d.documentType
      state.createdDate = d.createdDate ? d.createdDate.slice(0, 10) : ''
      state.needsRenewal = d.needsRenewal
      state.startDate = d.startDate ? d.startDate.slice(0, 10) : ''
      state.endDate = d.endDate ? d.endDate.slice(0, 10) : ''
      state.motherAgreementId = d.motherAgreementId ?? undefined
      state.location = d.location ?? ''
      state.notes = d.notes ?? ''
    }
    else if (props.mode === 'renew') {
      const d = props.initialData!
      state.category = d.category
      state.companyId = d.companyId
      state.documentName = d.documentName
      state.documentNumber = '' // new doc number required
      state.documentType = d.documentType
      state.createdDate = new Date().toISOString().slice(0, 10)
      state.needsRenewal = true
      state.startDate = ''
      state.endDate = ''
      state.location = d.location ?? ''
      state.notes = ''
      renewedFromContractId.value = d.id
    }
    else {
      // add mode
      state.category = undefined
      state.companyId = undefined
      state.documentName = ''
      state.documentNumber = ''
      state.documentType = undefined
      state.createdDate = ''
      state.needsRenewal = false
      state.startDate = ''
      state.endDate = ''
      state.motherAgreementId = undefined
      state.location = ''
      state.notes = ''
      renewedFromContractId.value = undefined
    }
    selectedFile.value = null
    replaceFile.value = false
    if (fileInput.value) fileInput.value.value = ''
    // Fetch mother agreements after state is set
    fetchMotherAgreements()
  },
  { immediate: true }
)

// --- Watch company/category for mother agreements ---
watch([() => state.companyId, () => state.category], () => {
  if (props.mode !== 'renew') {
    state.motherAgreementId = undefined
  }
  fetchMotherAgreements()
})

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
async function uploadFile(contractId: number) {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  await $fetch(`/api/vendor-contracts/${contractId}/file`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
}

// --- Submit ---
async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    let contractId: number

    // Strip empty strings to undefined so backend @IsOptional validators pass
    const payload = {
      ...event.data,
      startDate: event.data.startDate || undefined,
      endDate: event.data.endDate || undefined,
      location: event.data.location || undefined,
      notes: event.data.notes || undefined,
    }

    if (props.mode === 'add') {
      const res = await $fetch<VendorContract>('/api/vendor-contracts', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      contractId = res.id
    }
    else if (props.mode === 'renew') {
      const res = await $fetch<VendorContract>(`/api/vendor-contracts/${renewedFromContractId.value}/renew`, {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      contractId = res.id
    }
    else {
      await $fetch(`/api/vendor-contracts/${props.initialData!.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include',
      })
      contractId = props.initialData!.id
    }

    // Upload file if selected
    if (selectedFile.value) {
      try {
        await uploadFile(contractId)
      }
      catch {
        toast.add({ title: 'Kontrak tersimpan', description: 'Namun gagal mengupload file.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    const modeLabel = props.mode === 'add' ? 'ditambahkan' : props.mode === 'renew' ? 'diperpanjang' : 'diperbarui'
    toast.add({
      title: 'Berhasil',
      description: `Kontrak berhasil ${modeLabel}.`,
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  }
  catch {
    const modeLabel = props.mode === 'add' ? 'menambahkan' : props.mode === 'renew' ? 'memperpanjang' : 'memperbarui'
    toast.add({
      title: 'Gagal',
      description: `Gagal ${modeLabel} kontrak.`,
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

const title = computed(() => {
  if (props.mode === 'add') return 'Tambah Kontrak'
  if (props.mode === 'renew') return 'Perpanjang Kontrak'
  return 'Edit Kontrak'
})

const isRenewMode = computed(() => props.mode === 'renew')
const isReadonlyMode = computed(() => props.mode === 'renew')
const hasExistingFile = computed(() => !!props.initialData?.fileUrl)
const showMotherAgreement = computed(() => !!state.companyId && !!state.category)
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{ container: 'items-start sm:items-center', panel: 'w-full max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">

        <!-- Kategori -->
        <UFormField label="Kategori" name="category" required>
          <template v-if="isReadonlyMode">
            <div class="flex items-center gap-2 py-1.5">
              <UBadge
                :label="state.category === 'CUSTOMER' ? 'Customer' : 'Vendor'"
                :color="state.category === 'CUSTOMER' ? 'blue' : 'green'"
                variant="subtle"
              />
              <span class="text-xs text-muted">(tidak dapat diubah saat perpanjang)</span>
            </div>
          </template>
          <template v-else>
            <URadioGroup
              v-model="state.category"
              :items="categoryOptions"
              orientation="horizontal"
              class="mt-1"
            />
          </template>
        </UFormField>

        <!-- Nama Perusahaan -->
        <UFormField label="Nama Perusahaan" name="companyId" required>
          <USelectMenu
            v-model="state.companyId"
            :items="companyOptions"
            value-key="value"
            placeholder="Pilih perusahaan..."
            class="w-full"
            :class="isReadonlyMode ? 'opacity-60' : ''"
            :search-input="{ placeholder: 'Cari perusahaan...' }"
            :disabled="isReadonlyMode"
          />
        </UFormField>

        <!-- Nama Dokumen -->
        <UFormField label="Nama Dokumen" name="documentName" required>
          <UInput
            v-model="state.documentName"
            placeholder="Contoh: Kontrak Pengadaan Barang 2024"
            class="w-full"
          />
        </UFormField>

        <!-- Nomor Dokumen -->
        <UFormField label="Nomor Dokumen" name="documentNumber" required>
          <UInput
            v-model="state.documentNumber"
            :placeholder="isRenewMode ? 'Masukkan nomor dokumen baru...' : 'Contoh: KTR-2024-001'"
            class="w-full"
          />
          <template v-if="isRenewMode" #hint>
            <span class="text-xs text-muted">Isi dengan nomor dokumen kontrak baru</span>
          </template>
        </UFormField>

        <!-- Jenis Dokumen -->
        <UFormField label="Jenis Dokumen" name="documentType" required>
          <USelect
            v-model="state.documentType"
            :items="documentTypeOptions"
            placeholder="Pilih jenis dokumen..."
            class="w-full"
          />
        </UFormField>

        <!-- Tanggal Dibuat -->
        <UFormField label="Tanggal Dibuat" name="createdDate" required>
          <UInput
            v-model="state.createdDate"
            type="date"
            class="w-full"
          />
        </UFormField>

        <!-- Butuh Perpanjang -->
        <UFormField name="needsRenewal">
          <UCheckbox
            v-model="state.needsRenewal"
            label="Butuh Perpanjang"
            :disabled="isRenewMode"
          />
        </UFormField>

        <!-- Tanggal Mulai & Berakhir (jika needsRenewal) -->
        <template v-if="state.needsRenewal">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Tanggal Mulai" name="startDate" required>
              <UInput
                v-model="state.startDate"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tanggal Berakhir" name="endDate" required>
              <UInput
                v-model="state.endDate"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
        </template>

        <!-- Mother Agreement -->
        <UFormField
          v-if="showMotherAgreement"
          label="Mother Agreement"
          name="motherAgreementId"
        >
          <USelect
            v-model="state.motherAgreementId"
            :items="motherAgreementOptions"
            placeholder="Pilih kontrak induk (opsional)..."
            class="w-full"
            searchable
            searchable-placeholder="Cari kontrak induk..."
          />
          <template #hint>
            <span class="text-xs text-muted">Kontrak induk yang menjadi dasar kontrak ini</span>
          </template>
        </UFormField>

        <!-- Lokasi -->
        <UFormField label="Lokasi" name="location">
          <UInput
            v-model="state.location"
            placeholder="Lokasi dokumen (opsional)"
            class="w-full"
          />
        </UFormField>

        <!-- Keterangan -->
        <UFormField label="Keterangan" name="notes">
          <UTextarea
            v-model="state.notes"
            placeholder="Keterangan tambahan (opsional)"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- File Dokumen -->
        <UFormField :label="isRenewMode ? 'File Dokumen (Upload kontrak baru)' : 'File Dokumen'">
          <div class="space-y-2">
            <!-- Hint for renew mode -->
            <p v-if="isRenewMode" class="text-xs text-muted">
              Upload file kontrak baru (opsional). File lama dari kontrak sebelumnya tidak akan dipindahkan.
            </p>

            <!-- Existing file info (edit mode) -->
            <div
              v-if="hasExistingFile && !replaceFile && !isRenewMode"
              class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm"
            >
              <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-muted">File sudah ada</span>
              <a
                :href="initialData!.fileUrl!"
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
            <div v-if="!hasExistingFile || replaceFile || isRenewMode">
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
            :label="mode === 'renew' ? 'Perpanjang' : 'Simpan'"
            color="primary"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
