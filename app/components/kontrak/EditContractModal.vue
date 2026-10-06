<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Contract, ContractTemplate, ContractInputField, ContractInputFieldsResponse } from '~/types'
import { CalendarDate } from '@internationalized/date'

interface LookupOption { label: string; value: number }

const props = defineProps<{ open: boolean; contract: Contract | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const uploadingDoc = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const startDateCal  = shallowRef<CalendarDate | null>(null)
const endDateCal    = shallowRef<CalendarDate | null>(null)
const signedDateCal = shallowRef<CalendarDate | null>(null)

watch(startDateCal,  val => { state.startDate  = fromCalDate(val) })
watch(endDateCal,    val => { state.endDate    = fromCalDate(val) })
watch(signedDateCal, val => { state.signedDate = fromCalDate(val) })

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.contract) return

  if (file.type !== 'application/pdf') {
    toast.add({ title: 'Hanya file PDF yang diizinkan', color: 'error' })
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.add({ title: 'Ukuran file maksimal 10MB', color: 'error' })
    return
  }

  uploadingDoc.value = true
  try {
    const formData = new FormData()
    formData.append('document', file)
    const res = await $fetch<{ documentUrl?: string }>(`/api/contracts/${props.contract.id}/document`, {
      method: 'POST',
      body: formData,
    })
    state.documentUrl = res?.documentUrl ?? ''
    toast.add({ title: 'Dokumen berhasil diupload', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Gagal upload dokumen', description: err?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadingDoc.value = false
  }
}

const { data: contractTypesRes } = await useFetch<{ id: number; name: string }[]>('/api/lookups/contract-types')
const { data: contractTemplatesRes } = await useFetch<ContractTemplate[]>('/api/contract-templates', {
  query: { activeOnly: true },
})

const contractTypeOptions = computed<LookupOption[]>(() =>
  (contractTypesRes.value ?? []).map(type => ({
    label: type.name,
    value: type.id,
  })),
)

const contractTemplateOptions = computed<LookupOption[]>(() => {
  const options = (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id,
  }))

  // Template yang sedang dipakai kontrak ini bisa saja dinonaktifkan setelah
  // kontrak dibuat. Daftar hanya memuat template aktif, jadi tanpa disisipkan
  // di sini pilihan tampak kosong walau `templateId` kontrak tetap tersimpan.
  const current = props.contract?.template
  if (current && !options.some(option => option.value === current.id)) {
    options.push({
      label: `${current.name} (${current.family}) — Nonaktif`,
      value: current.id,
    })
  }

  return options
})

// ── Field dinamis template (CONTRACT_INPUT) ──────────────────────────────
// Sama seperti modal tambah kontrak: field dibaca dari `fieldDefinitions` versi
// PUBLISHED template agar yang ditampilkan = yang divalidasi server. Nilainya
// di-prefill dari `contract.templateData` (hasil normalisasi backend).
const templateFields = ref<ContractInputField[]>([])
const templateData = ref<Record<string, any>>({})
const dynamicFieldErrors = ref<Record<string, string>>({})
// Template tanpa versi terbit = kontrak ini kontrak legacy (tanpa snapshot).
// Editnya tetap diizinkan, tapi nilainya tidak akan pernah masuk ke PDF, jadi
// pengguna diberi tahu lewat banner — bukan diblokir, karena tanggal/kompensasi
// kontrak legacy tetap sah untuk diperbaiki.
const templateNotPublished = ref(false)

async function fetchTemplateFields(templateId?: number) {
  templateFields.value = []
  templateNotPublished.value = false
  if (!templateId) return
  try {
    const res = await $fetch<ContractInputFieldsResponse>(
      `/api/contract-templates/${templateId}/fields`,
      { credentials: 'include' },
    )
    templateFields.value = res.fields ?? []
    templateNotPublished.value = res.published === false
  } catch {
    // Kontrak lama bisa memakai template tanpa versi terbit; jangan blokir edit
    // hanya karena field tambahan tidak bisa dimuat.
    templateFields.value = []
  }
}

/** Nilai yang dikirim: hanya field yang dikenal template ini. */
function dynamicFieldValues(): Record<string, any> {
  const values: Record<string, any> = {}
  for (const field of templateFields.value) {
    const value = templateData.value[field.key]
    if (value === undefined || value === null || String(value).trim() === '') continue
    values[field.key] = value
  }
  return values
}

/** Nilai templateData dari server → bentuk yang diterima input form. */
function prefillTemplateData(c: Contract | null) {
  const source = (c as any)?.templateData
  const result: Record<string, any> = {}
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, any>)) {
      // Date dari JSON sudah jadi ISO string; potong ke YYYY-MM-DD agar cocok
      // dengan `<input type="date">` dan CalendarPicker.
      result[key] = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
        ? value.slice(0, 10)
        : value
    }
  }
  templateData.value = result
  dynamicFieldErrors.value = {}
}

function collectDynamicFieldErrors(): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of templateFields.value) {
    if (!field.required) continue
    const value = templateData.value[field.key]
    if (value === undefined || value === null || String(value).trim() === '') {
      errors[field.key] = `${field.label} wajib diisi`
    }
  }
  return errors
}

// Error sebuah field hilang begitu field itu diisi.
watch(templateData, (values) => {
  const remaining: Record<string, string> = {}
  for (const [key, message] of Object.entries(dynamicFieldErrors.value)) {
    const value = values?.[key]
    if (value === undefined || value === null || String(value).trim() === '') remaining[key] = message
  }
  dynamicFieldErrors.value = remaining
}, { deep: true })

const schema = z.object({
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractTypeId: z.number({ error: 'Tipe kontrak wajib diisi' }),
  templateId: z.number({ error: 'Template kontrak wajib dipilih' }),
  signedDate: z.string().min(1, 'Tanggal tanda tangan wajib diisi'),
  baseCompensation: z.coerce.number({ error: 'Nominal wajib diisi' }).min(1, 'Nominal wajib diisi'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema> & { contractNo?: string; documentUrl?: string }>({
  contractNo: '',
  startDate: '',
  endDate: '',
  contractTypeId: undefined,
  templateId: undefined,
  signedDate: '',
  baseCompensation: undefined,
  documentUrl: '',
})

function fillState(c: Contract | null) {
  if (!c) return
  state.contractNo = c.contractNo
  state.startDate = c.startDate ? c.startDate.slice(0, 10) : ''
  state.endDate = c.endDate ? c.endDate.slice(0, 10) : ''
  state.contractTypeId = c.contractTypeId ?? undefined
  state.templateId = c.templateId ?? undefined
  state.signedDate = c.signedDate ? c.signedDate.slice(0, 10) : c.startDate ? c.startDate.slice(0, 10) : ''
  state.baseCompensation = c.baseCompensation ?? undefined
  state.documentUrl = c.documentUrl ?? ''
  // Sync CalendarDate refs
  startDateCal.value  = toCalDate(state.startDate)
  endDateCal.value    = toCalDate(state.endDate)
  signedDateCal.value = toCalDate(state.signedDate)
  prefillTemplateData(c)
}

const fetchLoading = ref(false)
const fullContract = ref<Contract | null>(null)

watch(() => props.contract, async (c) => {
  if (!c) return
  fullContract.value = null
  if (c.contractNo) {
    fillState(c)
    fullContract.value = c
  } else if (c.id) {
    fetchLoading.value = true
    try {
      const full = await $fetch<Contract>(`/api/contracts/${c.id}`)
      fillState(full)
      fullContract.value = full
    } catch {
      toast.add({ title: 'Gagal memuat data kontrak', color: 'error' })
    } finally {
      fetchLoading.value = false
    }
  }
  // Field tambahan bergantung pada template kontrak ini (bukan pilihan di form
  // saat pertama dibuka), jadi ambil setelah templateId terisi.
  await fetchTemplateFields(state.templateId)
}, { immediate: true })

// Pengguna mengganti template → field dan nilai template lama tidak relevan lagi.
watch(() => state.templateId, async (templateId, previous) => {
  if (!previous || templateId === previous) return
  await fetchTemplateFields(templateId)
  prefillTemplateData(null)
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const contract = props.contract
  if (!contract) return

  // Validasi field dinamis dulu agar errornya tampil di dalam form.
  dynamicFieldErrors.value = collectDynamicFieldErrors()
  if (Object.keys(dynamicFieldErrors.value).length > 0) {
    toast.add({ title: 'Lengkapi data tambahan template', color: 'warning' })
    return
  }

  loading.value = true
  try {
    const employeeId = fullContract.value?.employeeId ?? contract.employeeId
    const { startDate, endDate, contractTypeId, templateId, signedDate, baseCompensation } = event.data
    await $fetch(`/api/contracts/${contract.id}`, {
      method: 'PUT',
      body: {
        employeeId,
        startDate,
        endDate,
        contractTypeId,
        templateId,
        signedDate,
        baseCompensation,
        templateData: dynamicFieldValues(),
      },
    })
    toast.add({ title: 'Kontrak berhasil diperbarui', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? e?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open" title="Edit Kontrak" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="contract" class="text-sm text-muted mb-4">
        Karyawan: <span class="text-highlighted font-medium">{{ contract.employee?.fullName }}</span>
        ({{ contract.employee?.employeeNo }})
      </div>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="No. Kontrak">
          <UInput
            :model-value="state.contractNo"
            readonly
            class="w-full opacity-60 font-mono"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Mulai" name="startDate" required>
            <UPopover :content="{ side: 'bottom', align: 'start' }">
              <UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start font-normal" :class="!startDateCal ? 'text-muted' : ''">
                {{ startDateCal ? formatDisplay(startDateCal) : 'Pilih tanggal mulai' }}
              </UButton>
              <template #content><CalendarPicker v-model="startDateCal" /></template>
            </UPopover>
          </UFormField>
          <UFormField label="Tanggal Selesai" name="endDate" required>
            <UPopover :content="{ side: 'bottom', align: 'start' }">
              <UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start font-normal" :class="!endDateCal ? 'text-muted' : ''">
                {{ endDateCal ? formatDisplay(endDateCal) : 'Pilih tanggal selesai' }}
              </UButton>
              <template #content><CalendarPicker v-model="endDateCal" /></template>
            </UPopover>
          </UFormField>
        </div>

        <UFormField label="Tipe Kontrak" name="contractTypeId" required>
          <USelect
            v-model="state.contractTypeId"
            :items="contractTypeOptions"
            placeholder="Pilih tipe kontrak..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Template Dokumen" name="templateId" required>
          <USelect
            v-model="state.templateId"
            :items="contractTemplateOptions"
            placeholder="Pilih template kontrak..."
            class="w-full"
          />
        </UFormField>

        <KontrakContractDynamicFields
          v-model="templateData"
          :fields="templateFields"
          :errors="dynamicFieldErrors"
        />

        <div
          v-if="templateNotPublished"
          class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="mt-0.5 w-4 h-4 shrink-0 text-warning"
          />
          <div>
            <p class="font-medium">
              Template ini belum memiliki versi terbit.
            </p>
            <p class="text-muted">
              Kontrak ini tidak punya snapshot dokumen, sehingga nilai field tambahan di atas
              tidak akan ikut tercetak ke PDF. Perubahan tanggal dan kompensasi tetap tersimpan.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Tanda Tangan" name="signedDate" required>
            <UPopover :content="{ side: 'bottom', align: 'start' }">
              <UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start font-normal" :class="!signedDateCal ? 'text-muted' : ''">
                {{ signedDateCal ? formatDisplay(signedDateCal) : 'Pilih tanggal tanda tangan' }}
              </UButton>
              <template #content><CalendarPicker v-model="signedDateCal" /></template>
            </UPopover>
          </UFormField>
          <UFormField label="Nominal Kompensasi" name="baseCompensation" required>
            <UInput v-model="state.baseCompensation" type="number" min="0" placeholder="5941759" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Upload Dokumen Kontrak (PDF Scan)" name="documentFile">
          <div class="space-y-2">
            <input
              ref="fileInput"
              type="file"
              accept="application/pdf"
              class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
              @change="onFileSelected"
            >
            <div v-if="uploadingDoc" class="flex items-center gap-2 text-xs text-muted">
              <UIcon name="i-lucide-loader-circle" class="w-3.5 h-3.5 animate-spin" />
              Mengupload...
            </div>
            <div v-else-if="state.documentUrl" class="flex items-center gap-2 text-xs text-success">
              <UIcon name="i-lucide-check-circle" class="w-3.5 h-3.5" />
              <span class="truncate">{{ state.documentUrl.split('/').pop() }}</span>
            </div>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
