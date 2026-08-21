<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { CalendarDate } from '@internationalized/date'

interface LegalKoperasi {
  id: number
  category: 'IZIN' | 'SERTIFIKAT' | 'KEBIJAKAN' | 'DOKUMEN_INTERNAL' | 'DOKUMEN_B3' | 'LAIN_LAIN'
  documentName: string
  documentNumber: string
  publisher: string
  documentDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  renewedFrom?: { id: number; documentName: string; documentNumber: string; fileUrl?: string | null; documentDate: string } | null
  renewedTo?: { id: number; documentName: string; documentNumber: string; status: string; documentDate: string } | null
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  open: boolean
  mode: 'add' | 'edit' | 'renew'
  initialData?: LegalKoperasi | null
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
const renewedFromId = ref<number | undefined>(undefined)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const documentDateCal = shallowRef<CalendarDate | null>(null)
const startDateCal    = shallowRef<CalendarDate | null>(null)
const endDateCal      = shallowRef<CalendarDate | null>(null)

// Tanggal minimum untuk datepicker startDate saat mode renew — mengikuti endDate dokumen lama
const minStartDateCal = computed(() => {
  if (props.mode !== 'renew' || !props.initialData?.endDate) return null
  return toCalDate(props.initialData.endDate.split('T')[0])
})

watch(documentDateCal, val => { state.documentDate = fromCalDate(val) })
watch(startDateCal,    val => { state.startDate    = fromCalDate(val) })
watch(endDateCal,      val => { state.endDate      = fromCalDate(val) })

// --- Category options ---
const categoryOptions = [
  { label: 'Izin', value: 'IZIN' },
  { label: 'Sertifikat', value: 'SERTIFIKAT' },
  { label: 'Kebijakan', value: 'KEBIJAKAN' },
  { label: 'Dokumen Internal', value: 'DOKUMEN_INTERNAL' },
  { label: 'Dokumen B3', value: 'DOKUMEN_B3' },
  { label: 'Lain-lain', value: 'LAIN_LAIN' },
]

const categoryLabelMap: Record<string, string> = {
  IZIN: 'Izin',
  SERTIFIKAT: 'Sertifikat',
  KEBIJAKAN: 'Kebijakan',
  DOKUMEN_INTERNAL: 'Dokumen Internal',
  DOKUMEN_B3: 'Dokumen B3',
  LAIN_LAIN: 'Lain-lain',
}

// --- Schema ---
const schema = z.object({
  category: z.enum(['IZIN', 'SERTIFIKAT', 'KEBIJAKAN', 'DOKUMEN_INTERNAL', 'DOKUMEN_B3', 'LAIN_LAIN'], { error: 'Kategori wajib dipilih' }),
  documentName: z.string().min(1, 'Nama dokumen wajib diisi'),
  documentNumber: z.string().min(1, 'Nomor dokumen wajib diisi'),
  publisher: z.string().min(1, 'Penerbit wajib diisi'),
  documentDate: z.string().min(1, 'Tanggal wajib diisi'),
  needsRenewal: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.needsRenewal) return !!data.startDate && !!data.endDate
  return true
}, { message: 'Tanggal mulai dan berakhir wajib diisi', path: ['startDate'] })

type Schema = z.output<typeof schema>

// --- Form state ---
const state = reactive<Partial<Schema>>({
  category: undefined,
  documentName: '',
  documentNumber: '',
  publisher: '',
  documentDate: '',
  needsRenewal: false,
  startDate: '',
  endDate: '',
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
      state.documentName = d.documentName
      state.documentNumber = d.documentNumber
      state.publisher = d.publisher
      state.documentDate = d.documentDate ? d.documentDate.slice(0, 10) : ''
      state.needsRenewal = d.needsRenewal
      state.startDate = d.startDate ? d.startDate.slice(0, 10) : ''
      state.endDate = d.endDate ? d.endDate.slice(0, 10) : ''
      documentDateCal.value = toCalDate(d.documentDate ?? null)
      startDateCal.value    = toCalDate(d.startDate ?? null)
      endDateCal.value      = toCalDate(d.endDate ?? null)
      state.location = d.location ?? ''
      state.notes = d.notes ?? ''
      renewedFromId.value = undefined
    }
    else if (props.mode === 'renew') {
      const d = props.initialData!
      state.category = d.category
      state.documentName = d.documentName
      state.documentNumber = ''
      state.publisher = d.publisher
      state.documentDate = new Date().toISOString().slice(0, 10)
      state.needsRenewal = d.needsRenewal
      state.startDate = ''
      state.endDate = ''
      documentDateCal.value = toCalDate(new Date().toISOString().slice(0, 10))
      startDateCal.value    = null
      endDateCal.value      = null
      state.location = d.location ?? ''
      state.notes = ''
      renewedFromId.value = d.id
    }
    else {
      // add mode
      state.category = undefined
      state.documentName = ''
      state.documentNumber = ''
      state.publisher = ''
      state.documentDate = ''
      state.needsRenewal = false
      state.startDate = ''
      state.endDate = ''
      documentDateCal.value = null
      startDateCal.value    = null
      endDateCal.value      = null
      state.location = ''
      state.notes = ''
      renewedFromId.value = undefined
    }
    selectedFile.value = null
    replaceFile.value = false
    if (fileInput.value) fileInput.value.value = ''
  },
  { immediate: true }
)

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
  await $fetch(`/api/legal-koperasi/${docId}/file`, {
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

    // Validasi mode renew: tanggal mulai tidak boleh sebelum tanggal berakhir dokumen lama
    if (props.mode === 'renew' && props.initialData?.endDate && state.startDate) {
      const parentEnd = props.initialData.endDate.split('T')[0]!
      if (state.startDate < parentEnd) {
        loading.value = false
        toast.add({
          title: 'Tanggal mulai tidak valid',
          description: 'Tanggal mulai dokumen baru tidak boleh lebih kecil dari tanggal berakhir dokumen sebelumnya.',
          color: 'error',
        })
        return
      }
    }

    // Strip empty strings to undefined so backend @IsOptional validators pass
    const payload = {
      ...event.data,
      startDate: event.data.startDate || undefined,
      endDate: event.data.endDate || undefined,
      location: event.data.location || undefined,
      notes: event.data.notes || undefined,
    }

    if (props.mode === 'add') {
      const res = await $fetch<LegalKoperasi>('/api/legal-koperasi', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      docId = res.id
    }
    else if (props.mode === 'renew') {
      const res = await $fetch<LegalKoperasi>(`/api/legal-koperasi/${renewedFromId.value}/renew`, {
        method: 'POST',
        body: payload,
        credentials: 'include',
      })
      docId = res.id
    }
    else {
      await $fetch(`/api/legal-koperasi/${props.initialData!.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include',
      })
      docId = props.initialData!.id
    }

    // Upload file if selected
    if (selectedFile.value) {
      try {
        await uploadFile(docId)
      }
      catch {
        toast.add({ title: 'Dokumen tersimpan', description: 'Namun gagal mengupload file.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        return
      }
    }

    const modeLabel = props.mode === 'add' ? 'ditambahkan' : props.mode === 'renew' ? 'diperpanjang' : 'diperbarui'
    toast.add({
      title: 'Berhasil',
      description: `Dokumen berhasil ${modeLabel}.`,
      color: 'success',
    })
    emit('saved')
    emit('update:open', false)
  }
  catch {
    const modeLabel = props.mode === 'add' ? 'menambahkan' : props.mode === 'renew' ? 'memperpanjang' : 'memperbarui'
    toast.add({
      title: 'Gagal',
      description: `Gagal ${modeLabel} dokumen.`,
      color: 'error',
    })
  }
  finally {
    loading.value = false
  }
}

const title = computed(() => {
  if (props.mode === 'add') return 'Tambah Dokumen Legal Koperasi'
  if (props.mode === 'renew') return 'Perpanjang Dokumen Legal Koperasi'
  return 'Edit Dokumen Legal Koperasi'
})

const isRenewMode = computed(() => props.mode === 'renew')
const hasExistingFile = computed(() => !!props.initialData?.fileUrl)
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

        <!-- Kategori -->
        <UFormField label="Kategori" name="category" required>
          <template v-if="isRenewMode">
            <div class="flex items-center gap-2 py-1.5">
              <UBadge
                :label="categoryLabelMap[state.category ?? ''] ?? state.category"
                color="primary"
                variant="subtle"
              />
              <span class="text-xs text-muted">(tidak dapat diubah saat perpanjang)</span>
            </div>
          </template>
          <template v-else>
            <USelect
              v-model="state.category"
              :items="categoryOptions"
              placeholder="Pilih kategori..."
              class="w-full"
            />
          </template>
        </UFormField>

        <!-- Nama Dokumen -->
        <UFormField label="Nama Dokumen" name="documentName" required>
          <template v-if="isRenewMode">
            <div class="w-full px-3 py-2 rounded-md border border-default bg-elevated text-sm text-muted cursor-not-allowed">
              {{ state.documentName }}
            </div>
          </template>
          <UInput
            v-else
            v-model="state.documentName"
            placeholder="Contoh: Izin Usaha Simpan Pinjam 2024"
            class="w-full"
          />
        </UFormField>

        <!-- Nomor Dokumen -->
        <UFormField label="Nomor Dokumen" name="documentNumber" required>
          <UInput
            v-model="state.documentNumber"
            :placeholder="isRenewMode ? 'Masukkan nomor dokumen baru...' : 'Contoh: DOC-2024-001'"
            class="w-full"
          />
          <template v-if="isRenewMode" #hint>
            <span class="text-xs text-muted">Isi dengan nomor dokumen baru hasil perpanjangan</span>
          </template>
        </UFormField>

        <!-- Penerbit -->
        <UFormField label="Penerbit" name="publisher" required>
          <UInput
            v-model="state.publisher"
            placeholder="Contoh: Kementerian Koperasi dan UKM"
            class="w-full"
          />
        </UFormField>

        <!-- Tanggal -->
        <UFormField label="Tanggal" name="documentDate" required>
          <UPopover>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
              class="w-full justify-start font-normal"
              :class="!documentDateCal && 'text-muted'"
            >
              {{ documentDateCal ? formatDisplay(documentDateCal) : 'Pilih tanggal' }}
            </UButton>
            <template #content>
              <CalendarPicker v-model="documentDateCal" class="p-2" />
            </template>
          </UPopover>
        </UFormField>

        <!-- Butuh Perpanjang -->
        <UFormField name="needsRenewal">
          <UCheckbox
            v-model="state.needsRenewal"
            label="Butuh Perpanjang"
          />
        </UFormField>

        <!-- Tanggal Mulai & Berakhir (jika needsRenewal) -->
        <template v-if="state.needsRenewal">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Tanggal Mulai" name="startDate" required>
              <div class="flex items-center gap-2">
                <UPopover class="flex-1">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-calendar"
                    class="w-full justify-start font-normal"
                    :class="!startDateCal && 'text-muted'"
                  >
                    {{ startDateCal ? formatDisplay(startDateCal) : 'Pilih tanggal mulai' }}
                  </UButton>
                  <template #content>
                    <CalendarPicker v-model="startDateCal" :min-date="minStartDateCal" class="p-2" />
                  </template>
                </UPopover>
                <UButton
                  v-if="startDateCal"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="startDateCal = null"
                />
              </div>
            </UFormField>
            <UFormField label="Tanggal Berakhir" name="endDate" required>
              <div class="flex items-center gap-2">
                <UPopover class="flex-1">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-calendar"
                    class="w-full justify-start font-normal"
                    :class="!endDateCal && 'text-muted'"
                  >
                    {{ endDateCal ? formatDisplay(endDateCal) : 'Pilih tanggal berakhir' }}
                  </UButton>
                  <template #content>
                    <CalendarPicker v-model="endDateCal" class="p-2" />
                  </template>
                </UPopover>
                <UButton
                  v-if="endDateCal"
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="endDateCal = null"
                />
              </div>
            </UFormField>
          </div>
        </template>

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
        <UFormField :label="isRenewMode ? 'File Dokumen (Upload dokumen baru)' : 'File Dokumen'">
          <div class="space-y-2">
            <!-- Hint for renew mode -->
            <p v-if="isRenewMode" class="text-xs text-muted">
              Upload file dokumen baru (opsional). File lama dari dokumen sebelumnya tidak akan dipindahkan.
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
