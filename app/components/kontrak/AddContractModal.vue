<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate, ContractHistoryResponse, ContractStatus, ContractInputField, ContractInputFieldsResponse } from '~/types'
import type { CalendarDate } from '@internationalized/date'
import { contractPeriodError } from '~/utils/contract-period'
import { formatContractDate, formatCurrency, formatSpan } from '~/utils/contract-timeline'

interface EmployeeOption { label: string, value: number }
interface LookupOption { label: string, value: number }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const formId = useId()
const loading = ref(false)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

const previewContractNo = ref('')
const loadingPreview = ref(false)

async function fetchPreviewContractNo() {
  loadingPreview.value = true
  try {
    const qs = state.startDate ? `?startDate=${state.startDate}` : ''
    const res = await $fetch<{ contractNo: string }>(`/api/contracts/preview-number${qs}`, { credentials: 'include' })
    previewContractNo.value = res.contractNo
  } catch {
    previewContractNo.value = '-'
  } finally {
    loadingPreview.value = false
  }
}

const { data: employeesRes } = await useFetch<{ data: { id: number, fullName: string, employeeNo: string }[] }>('/api/employees', {
  query: { limit: 999 },
  lazy: true
})

const { data: contractTypesRes } = await useFetch<{ id: number, name: string }[]>('/api/lookups/contract-types')
const { data: contractTemplatesRes } = await useFetch<ContractTemplate[]>('/api/contract-templates', {
  query: { activeOnly: true }
})

const employeeOptions = computed<EmployeeOption[]>(() =>
  (employeesRes.value?.data ?? []).map(e => ({
    label: `${e.fullName} (${e.employeeNo})`,
    value: e.id
  }))
)

const contractTypeOptions = computed<LookupOption[]>(() =>
  (contractTypesRes.value ?? []).map(type => ({
    label: type.name,
    value: type.id
  }))
)

const contractTemplateOptions = computed<LookupOption[]>(() =>
  (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id
  }))
)

const templateFields = ref<ContractInputField[]>([])
const loadingTemplateFields = ref(false)
const templateData = ref<Record<string, any>>({})
const dynamicFieldErrors = ref<Record<string, string>>({})
const templateNotPublished = ref(false)

async function fetchTemplateFields(templateId?: number) {
  templateFields.value = []
  templateData.value = {}
  dynamicFieldErrors.value = {}
  templateNotPublished.value = false
  if (!templateId) return

  loadingTemplateFields.value = true
  try {
    const res = await $fetch<ContractInputFieldsResponse>(
      `/api/contract-templates/${templateId}/fields`,
      { credentials: 'include' }
    )
    templateFields.value = res.fields ?? []
    templateNotPublished.value = res.published === false
  } catch {
    templateFields.value = []
    toast.add({
      title: 'Gagal memuat field tambahan template',
      description: 'Coba pilih ulang template atau muat ulang halaman.',
      color: 'warning'
    })
  } finally {
    loadingTemplateFields.value = false
  }
}

function dynamicFieldValues(): Record<string, any> {
  const values: Record<string, any> = {}
  for (const field of templateFields.value) {
    const value = templateData.value[field.key]
    if (value === undefined || value === null || String(value).trim() === '') continue
    values[field.key] = value
  }
  return values
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

watch(templateData, (values) => {
  const remaining: Record<string, string> = {}
  for (const [key, message] of Object.entries(dynamicFieldErrors.value)) {
    const value = values?.[key]
    if (value === undefined || value === null || String(value).trim() === '') remaining[key] = message
  }
  dynamicFieldErrors.value = remaining
}, { deep: true })

const schema = z.object({
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractTypeId: z.number({ error: 'Tipe kontrak wajib diisi' }),
  templateId: z.number({ error: 'Template kontrak wajib dipilih' }),
  signedDate: z.string().min(1, 'Tanggal tanda tangan wajib diisi'),
  baseCompensation: z.coerce.number({ error: 'Nominal wajib diisi' }).min(1, 'Nominal wajib diisi'),
  keterangan: z.string().max(2000, 'Keterangan maksimal 2000 karakter').optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  employeeId: undefined,
  startDate: '',
  endDate: '',
  contractTypeId: undefined,
  templateId: undefined,
  signedDate: '',
  baseCompensation: undefined,
  keterangan: ''
})

const selectedFile = ref<File | null>(null)
const uploadingDoc = ref(false)

interface AddDraftData {
  state: Partial<Schema>
  templateData: Record<string, any>
}

const draft = useContractDraft<AddDraftData>('add')
const draftReady = ref(false)
const restoredDraftAt = ref<number | null>(null)
const suppressTemplateWatch = ref(false)
let draftTimer: ReturnType<typeof setTimeout> | null = null

const isDirty = computed(() =>
  !!state.employeeId
  || !!state.startDate
  || !!state.endDate
  || !!state.contractTypeId
  || !!state.templateId
  || !!state.signedDate
  || !!state.baseCompensation
  || !!state.keterangan?.trim()
)

function scheduleDraftSave() {
  if (!props.open || !draftReady.value || !isDirty.value) return
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draft.save({ state: { ...state }, templateData: { ...templateData.value } })
  }, 600)
}

watch(state, scheduleDraftSave, { deep: true })
watch(templateData, scheduleDraftSave, { deep: true })

async function applyDraft(data: AddDraftData) {
  suppressTemplateWatch.value = true
  Object.assign(state, data.state ?? {})
  startDateCal.value = toCalDate(state.startDate)
  endDateCal.value = toCalDate(state.endDate)
  signedDateCal.value = toCalDate(state.signedDate)
  if (state.templateId) await fetchTemplateFields(state.templateId)
  templateData.value = { ...(data.templateData ?? {}) }
  dynamicFieldErrors.value = {}
  await nextTick()
  suppressTemplateWatch.value = false
}

function discardDraft() {
  draft.clear()
  restoredDraftAt.value = null
  resetForm()
  fetchPreviewContractNo()
}

const restoredDraftAge = computed(() => restoredDraftAt.value ? formatDraftAge(restoredDraftAt.value) : '')

watch(() => state.templateId, (templateId) => {
  if (suppressTemplateWatch.value) return
  fetchTemplateFields(templateId)
})

const employeeContractStatus = ref<ContractStatus | null>(null)
const employeeLatestContract = ref<ContractHistoryResponse['contracts'][0] | null>(null)
const employeeEmploymentStatus = ref<string | null>(null)
const checkingContract = ref(false)

watch(() => state.employeeId, async (employeeId) => {
  employeeContractStatus.value = null
  employeeLatestContract.value = null
  employeeEmploymentStatus.value = null

  if (!employeeId) return

  checkingContract.value = true
  try {
    const [historyRes, empRes] = await Promise.all([
      $fetch<ContractHistoryResponse>(`/api/contracts/history/${employeeId}`),
      $fetch<{ employmentStatus: string }>(`/api/employees/${employeeId}`)
    ])
    employeeEmploymentStatus.value = empRes.employmentStatus
    const latest = historyRes.contracts[0]
    if (latest) {
      employeeContractStatus.value = latest.status
      employeeLatestContract.value = latest
    }
  } catch {
    // Pemeriksaan status bersifat informasi; kegagalannya tidak memblokir form.
  } finally {
    checkingContract.value = false
  }
})

const isOffboarded = computed(() => {
  const s = employeeEmploymentStatus.value
  return s === 'RESIGN' || s === 'PHK'
})

const isBlocked = computed(() => {
  if (isOffboarded.value) return true
  const s = employeeContractStatus.value
  return s === 'AKTIF' || s === 'AKAN_HABIS'
})

const canSubmitForm = computed(() => {
  if (checkingContract.value) return false
  if (isBlocked.value) return false
  if (templateNotPublished.value) return false
  if (contractPeriodError(state.startDate, state.endDate)) return false
  return true
})

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
}

const statusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral'
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) {
    draftReady.value = false
    return
  }
  resetForm()
  const saved = draft.read()
  if (saved) {
    await applyDraft(saved.data)
    restoredDraftAt.value = saved.savedAt
  } else {
    restoredDraftAt.value = null
  }
  draftReady.value = true
  fetchPreviewContractNo()
})

watch(() => state.startDate, (val) => {
  if (val) fetchPreviewContractNo()
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (templateNotPublished.value) {
    toast.add({
      title: 'Template belum memiliki versi terbit',
      description: 'Terbitkan versi template terlebih dahulu di Pengaturan › Template Kontrak.',
      color: 'warning'
    })
    return
  }

  dynamicFieldErrors.value = collectDynamicFieldErrors()
  if (Object.keys(dynamicFieldErrors.value).length > 0) {
    toast.add({ title: 'Lengkapi data tambahan template', color: 'warning' })
    return
  }

  loading.value = true
  try {
    const created = await $fetch<{ id: number }>('/api/contracts', {
      method: 'POST',
      body: {
        ...event.data,
        templateData: dynamicFieldValues()
      }
    })

    let uploadFailed = false
    if (selectedFile.value && created?.id) {
      uploadingDoc.value = true
      try {
        const formData = new FormData()
        formData.append('document', selectedFile.value)
        await $fetch(`/api/contracts/${created.id}/document`, {
          method: 'POST',
          body: formData
        })
      } catch {
        uploadFailed = true
      } finally {
        uploadingDoc.value = false
      }
    }

    draft.clear()
    restoredDraftAt.value = null
    toast.add({
      title: 'Kontrak berhasil ditambahkan',
      description: uploadFailed ? 'Namun dokumen gagal diunggah. Unggah ulang lewat Edit Kontrak.' : undefined,
      color: uploadFailed ? 'warning' : 'success'
    })
    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (e) {
    const message = (e as { data?: { message?: string } })?.data?.message ?? 'Terjadi kesalahan'
    toast.add({ title: 'Gagal menambahkan kontrak', description: message, color: 'error' })
  } finally {
    loading.value = false
  }
}

const submitErrors = ref<{ name?: string, message: string }[]>([])

function onFormError(event: { errors?: { id?: string, name?: string, message: string }[] }) {
  submitErrors.value = (event.errors ?? []).map(error => ({ name: error.name, message: error.message }))
  const first = event.errors?.[0]
  nextTick(() => {
    const byId = first?.id ? document.getElementById(first.id) : null
    const byField = first?.name
      ? document.querySelector<HTMLElement>(`[data-contract-form] [data-field="${first.name}"]`)
      : null
    const byInvalid = document.querySelector<HTMLElement>('[data-contract-form] [aria-invalid="true"]')
    const target = byId ?? byField ?? byInvalid
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function resetForm() {
  state.employeeId = undefined
  state.startDate = ''
  state.endDate = ''
  state.contractTypeId = undefined
  state.templateId = undefined
  state.signedDate = ''
  state.baseCompensation = undefined
  state.keterangan = ''
  employeeContractStatus.value = null
  employeeLatestContract.value = null
  employeeEmploymentStatus.value = null
  startDateCal.value = null
  endDateCal.value = null
  signedDateCal.value = null
  templateData.value = {}
  dynamicFieldErrors.value = {}
  selectedFile.value = null
  uploadingDoc.value = false
  submitErrors.value = []
}

const startDateCal = shallowRef<CalendarDate | null>(null)
const endDateCal = shallowRef<CalendarDate | null>(null)
const signedDateCal = shallowRef<CalendarDate | null>(null)

watch(startDateCal, (val) => {
  state.startDate = fromCalDate(val)
})
watch(endDateCal, (val) => {
  state.endDate = fromCalDate(val)
})
watch(signedDateCal, (val) => {
  state.signedDate = fromCalDate(val)
})

const endDateError = computed(() => contractPeriodError(state.startDate, state.endDate))

const endMinDateCal = computed(() =>
  startDateCal.value ? startDateCal.value.add({ days: 1 }) : null
)

const selectedEmployeeLabel = computed(() =>
  employeeOptions.value.find(option => option.value === state.employeeId)?.label ?? ''
)

const periodLabel = computed(() => {
  if (!state.startDate || !state.endDate) return ''
  return `${formatContractDate(state.startDate)} – ${formatContractDate(state.endDate)}`
})

const durationLabel = computed(() => {
  if (!state.startDate || !state.endDate || endDateError.value) return ''
  const start = new Date(state.startDate)
  const end = new Date(state.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  return formatSpan(start, end)
})

const compensationLabel = computed(() =>
  state.baseCompensation ? formatCurrency(state.baseCompensation) : ''
)

const currencyDisplay = computed(() =>
  state.baseCompensation ? new Intl.NumberFormat('id-ID').format(state.baseCompensation) : ''
)

function onCurrencyInput(value: string | number) {
  const digits = String(value ?? '').replace(/\D/g, '')
  state.baseCompensation = digits ? Number(digits) : undefined
}

const requiredChecks = computed(() => {
  const checks = [
    !!state.employeeId,
    !!state.startDate,
    !!state.endDate,
    !!state.contractTypeId,
    !!state.templateId,
    !!state.signedDate,
    !!state.baseCompensation && state.baseCompensation > 0
  ]
  for (const field of templateFields.value) {
    if (!field.required) continue
    const value = templateData.value[field.key]
    checks.push(!(value === undefined || value === null || String(value).trim() === ''))
  }
  return checks
})

const totalRequired = computed(() => requiredChecks.value.length)
const filledRequired = computed(() => requiredChecks.value.filter(Boolean).length)
const progressPct = computed(() =>
  totalRequired.value ? Math.round((filledRequired.value / totalRequired.value) * 100) : 0
)
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-3xl', header: 'relative' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex w-full items-start gap-3 pr-8">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon name="i-lucide-file-signature" class="size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-highlighted">
            Tambah Kontrak
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            Lengkapi data kontrak karyawan. Nomor kontrak dibuat otomatis.
          </p>
        </div>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        square
        class="absolute end-2 top-2 size-9"
        aria-label="Tutup form"
        @click="emit('update:open', false)"
      />
    </template>

    <template #body>
      <UForm
        :id="formId"
        :schema="schema"
        :state="state"
        class="space-y-4"
        data-contract-form
        @submit="onSubmit"
        @error="onFormError"
      >
        <KontrakContractFormHero
          class="dossier-rise"
          :contract-no="previewContractNo"
          :loading="loadingPreview"
          :employee="selectedEmployeeLabel"
          :period="periodLabel"
          :duration="durationLabel"
          :compensation="compensationLabel"
        />

        <div
          v-if="restoredDraftAt"
          class="dossier-rise flex items-start gap-3 rounded-xl border border-info/30 bg-info/10 p-3"
        >
          <UIcon name="i-lucide-history" class="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-medium text-highlighted">
              Draft dipulihkan
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Isian terakhir dari {{ restoredDraftAge }}. File dokumen tidak ikut tersimpan.
            </p>
          </div>
          <UButton
            label="Hapus draft"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="discardDraft"
          />
        </div>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 40ms"
          icon="i-lucide-user-round"
          title="Karyawan"
          description="Pilih karyawan yang akan dibuatkan kontrak baru."
        >
          <UFormField label="Karyawan" name="employeeId" required>
            <USelectMenu
              v-model="state.employeeId"
              :items="employeeOptions"
              value-key="value"
              placeholder="Pilih karyawan..."
              class="w-full"
              :search-input="{ placeholder: 'Cari nama atau no. karyawan...' }"
            />
          </UFormField>

          <div v-if="checkingContract" class="flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            Memeriksa status kontrak karyawan...
          </div>

          <div v-else-if="isOffboarded" class="rounded-xl border border-error/40 bg-error/10 p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-user-x" class="mt-0.5 size-5 shrink-0 text-error" aria-hidden="true" />
              <div class="text-sm">
                <p class="font-semibold text-error">
                  Karyawan sudah tidak aktif ({{ employeeEmploymentStatus === 'PHK' ? 'PHK' : 'RESIGN' }})
                </p>
                <p class="mt-1 text-muted">
                  Karyawan ini sudah keluar dari perusahaan. Pembuatan kontrak baru tidak diizinkan.
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="isBlocked && employeeLatestContract" class="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div class="text-sm">
                <p class="font-semibold text-warning">
                  Karyawan masih memiliki kontrak {{ statusLabelMap[employeeLatestContract.status] ?? employeeLatestContract.status }}
                </p>
                <div class="mt-2 space-y-1 text-muted">
                  <p><span class="font-medium text-highlighted">No. Kontrak:</span> {{ employeeLatestContract.contractNo }}</p>
                  <p>
                    <span class="font-medium text-highlighted">Periode:</span>
                    {{ new Date(employeeLatestContract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                    -
                    {{ new Date(employeeLatestContract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                  </p>
                  <p>
                    <span class="font-medium text-highlighted">Status:</span>
                    <UBadge
                      variant="subtle"
                      :color="statusColorMap[employeeLatestContract.status] as any"
                      size="sm"
                      class="ml-1"
                    >
                      {{ statusLabelMap[employeeLatestContract.status] }}
                    </UBadge>
                  </p>
                </div>
                <p class="mt-2 text-xs text-muted">
                  Tidak dapat menambahkan kontrak baru. Gunakan menu Perpanjang dari halaman Manajemen Kontrak jika karyawan akan diperpanjang.
                </p>
              </div>
            </div>
          </div>

          <div v-else-if="employeeLatestContract && employeeContractStatus === 'EXPIRED'" class="rounded-xl border border-info/30 bg-info/10 p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-info" class="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
              <div class="text-sm">
                <p class="font-semibold text-info">
                  Kontrak terakhir sudah Expired
                </p>
                <p class="mt-1 text-muted">
                  Kontrak terakhir <span class="font-medium text-highlighted">{{ employeeLatestContract.contractNo }}</span>
                  berakhir pada {{ new Date(employeeLatestContract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}.
                  Histori kontrak akan otomatis tersambung.
                </p>
              </div>
            </div>
          </div>
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 80ms"
          icon="i-lucide-calendar-range"
          title="Periode Kontrak"
          description="Tanggal mulai dan selesai menentukan durasi kontrak."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Tanggal Mulai" name="startDate" required>
              <KontrakContractDateField v-model="startDateCal" field="startDate" placeholder="Pilih tanggal mulai" />
            </UFormField>
            <UFormField
              label="Tanggal Selesai"
              name="endDate"
              required
              :error="endDateError ?? undefined"
              :hint="endMinDateCal ? `Minimal ${formatDisplay(endMinDateCal)}` : undefined"
            >
              <KontrakContractDateField
                v-model="endDateCal"
                field="endDate"
                placeholder="Pilih tanggal selesai"
                :min-date="endMinDateCal"
              />
            </UFormField>
          </div>

          <div
            v-if="durationLabel"
            class="flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2 text-xs text-muted"
          >
            <UIcon name="i-lucide-hourglass" class="size-3.5" aria-hidden="true" />
            Durasi kontrak
            <span class="font-medium text-highlighted">{{ durationLabel }}</span>
          </div>
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 120ms"
          icon="i-lucide-clipboard-check"
          title="Administrasi"
          description="Tipe kontrak dan tanggal penandatanganan."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Tipe Kontrak" name="contractTypeId" required>
              <USelect
                v-model="state.contractTypeId"
                :items="contractTypeOptions"
                placeholder="Pilih tipe kontrak..."
                class="w-full"
              />
            </UFormField>
            <UFormField label="Tanggal Tanda Tangan" name="signedDate" required>
              <KontrakContractDateField v-model="signedDateCal" field="signedDate" placeholder="Pilih tanggal tanda tangan" />
            </UFormField>
          </div>
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 160ms"
          icon="i-lucide-file-text"
          title="Template Dokumen"
          description="Template menentukan isi dan field tambahan yang ikut tercetak."
        >
          <UFormField label="Template Kontrak" name="templateId" required>
            <USelect
              v-model="state.templateId"
              :items="contractTemplateOptions"
              placeholder="Pilih template kontrak..."
              class="w-full"
            />
          </UFormField>

          <div v-if="loadingTemplateFields" class="flex items-center gap-2 rounded-lg bg-elevated/50 px-3 py-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            Memuat field tambahan template...
          </div>
          <KontrakContractDynamicFields
            v-else
            v-model="templateData"
            :fields="templateFields"
            :errors="dynamicFieldErrors"
            embedded
          />

          <div
            v-if="templateNotPublished"
            class="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p class="font-medium">
                Template ini belum memiliki versi terbit.
              </p>
              <p class="text-muted">
                Kontrak tidak dapat disimpan karena field tambahan template tidak akan ikut
                tercetak ke dokumen. Terbitkan versi template terlebih dahulu di
                <NuxtLink to="/settings/contract-templates" class="underline">
                  Pengaturan › Template Kontrak
                </NuxtLink>.
              </p>
            </div>
          </div>
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 200ms"
          icon="i-lucide-paperclip"
          title="Dokumen Pendukung"
          description="Unggah hasil pindai kontrak yang sudah ditandatangani (opsional)."
        >
          <KontrakContractFileDropzone v-model="selectedFile" :uploading="uploadingDoc" />
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 240ms"
          icon="i-lucide-wallet"
          title="Kompensasi & Catatan"
          description="Nominal kompensasi dan keterangan tambahan untuk kontrak ini."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              label="Nominal Kompensasi"
              name="baseCompensation"
              required
              hint="Otomatis diformat dalam Rupiah."
            >
              <UInput
                :model-value="currencyDisplay"
                inputmode="numeric"
                placeholder="5.941.759"
                class="w-full"
                @update:model-value="onCurrencyInput"
              >
                <template #leading>
                  <span class="text-sm font-medium text-muted">Rp</span>
                </template>
              </UInput>
            </UFormField>

            <UFormField
              label="Keterangan"
              name="keterangan"
              class="sm:col-span-2"
              :hint="`${state.keterangan?.length ?? 0}/2000`"
            >
              <UTextarea
                v-model="state.keterangan"
                :rows="3"
                class="w-full"
                placeholder="Keterangan tambahan (opsional)"
              />
            </UFormField>
          </div>
        </KontrakContractFormSection>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="h-1.5 w-24 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="progressPct === 100 ? 'bg-success' : 'bg-primary'"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
          <span v-if="submitErrors.length" class="flex items-center gap-1.5 text-xs font-medium text-error" role="alert">
            <UIcon name="i-lucide-circle-alert" class="size-3.5" aria-hidden="true" />
            {{ submitErrors.length }} isian belum lengkap
          </span>
          <span v-else class="text-xs text-muted">
            <span class="font-medium text-highlighted">{{ filledRequired }}</span>
            dari {{ totalRequired }} wajib terisi
          </span>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            :form="formId"
            label="Simpan Kontrak"
            icon="i-lucide-check"
            color="primary"
            :loading="loading"
            :disabled="!canSubmitForm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
