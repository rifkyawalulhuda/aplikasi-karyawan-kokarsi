<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Contract, ContractTemplate, ContractInputField, ContractInputFieldsResponse } from '~/types'
import type { CalendarDate } from '@internationalized/date'
import { contractPeriodError } from '~/utils/contract-period'
import { formatContractDate, formatCurrency, formatSpan } from '~/utils/contract-timeline'

interface LookupOption { label: string, value: number }

const props = defineProps<{ open: boolean, contract: Contract | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const formId = useId()
const loading = ref(false)
const uploadingDoc = ref(false)
const selectedFile = ref<File | null>(null)
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

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

watch(selectedFile, async (file) => {
  if (!file || !props.contract) return

  uploadingDoc.value = true
  try {
    const formData = new FormData()
    formData.append('document', file)
    const res = await $fetch<{ documentUrl?: string }>(`/api/contracts/${props.contract.id}/document`, {
      method: 'POST',
      body: formData
    })
    state.documentUrl = res?.documentUrl ?? ''
    toast.add({ title: 'Dokumen berhasil diunggah', color: 'success' })
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Terjadi kesalahan'
    toast.add({ title: 'Gagal mengunggah dokumen', description: message, color: 'error' })
  } finally {
    uploadingDoc.value = false
    selectedFile.value = null
  }
})

const { data: contractTypesRes } = await useFetch<{ id: number, name: string }[]>('/api/lookups/contract-types')
const { data: contractTemplatesRes } = await useFetch<ContractTemplate[]>('/api/contract-templates', {
  query: { activeOnly: true }
})

const contractTypeOptions = computed<LookupOption[]>(() =>
  (contractTypesRes.value ?? []).map(type => ({
    label: type.name,
    value: type.id
  }))
)

const contractTemplateOptions = computed<LookupOption[]>(() => {
  const options = (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id
  }))

  const current = props.contract?.template
  if (current && !options.some(option => option.value === current.id)) {
    options.push({
      label: `${current.name} (${current.family}) — Nonaktif`,
      value: current.id
    })
  }

  return options
})

const templateFields = ref<ContractInputField[]>([])
const loadingTemplateFields = ref(false)
const templateData = ref<Record<string, any>>({})
const dynamicFieldErrors = ref<Record<string, string>>({})
const templateNotPublished = ref(false)
const suppressTemplateWatch = ref(false)

async function fetchTemplateFields(templateId?: number) {
  templateFields.value = []
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

function prefillTemplateData(c: Contract | null) {
  const source = (c as any)?.templateData
  const result: Record<string, any> = {}
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, any>)) {
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
  keterangan: z.string().max(2000, 'Keterangan maksimal 2000 karakter').optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema> & { contractNo?: string, documentUrl?: string }>({
  contractNo: '',
  startDate: '',
  endDate: '',
  contractTypeId: undefined,
  templateId: undefined,
  signedDate: '',
  baseCompensation: undefined,
  keterangan: '',
  documentUrl: ''
})

interface EditDraftData {
  startDate: string
  endDate: string
  contractTypeId?: number
  templateId?: number
  signedDate: string
  baseCompensation?: number
  keterangan: string
  templateData: Record<string, any>
}

function snapshot(): EditDraftData {
  return {
    startDate: state.startDate ?? '',
    endDate: state.endDate ?? '',
    contractTypeId: state.contractTypeId,
    templateId: state.templateId,
    signedDate: state.signedDate ?? '',
    baseCompensation: state.baseCompensation,
    keterangan: state.keterangan ?? '',
    templateData: { ...templateData.value }
  }
}

const draft = useContractDraft<EditDraftData>(() => props.contract ? `edit:${props.contract.id}` : 'edit:none')
const draftReady = ref(false)
const baseline = ref('')
const pendingDraft = ref<{ savedAt: number, data: EditDraftData } | null>(null)
let draftTimer: ReturnType<typeof setTimeout> | null = null

const isDirty = computed(() => baseline.value !== '' && JSON.stringify(snapshot()) !== baseline.value)

function scheduleDraftSave() {
  if (!props.open || !draftReady.value || !isDirty.value) return
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => {
    draft.save(snapshot())
  }, 600)
}

watch(state, scheduleDraftSave, { deep: true })
watch(templateData, scheduleDraftSave, { deep: true })

const pendingDraftAge = computed(() => pendingDraft.value ? formatDraftAge(pendingDraft.value.savedAt) : '')

async function restoreDraft() {
  const saved = pendingDraft.value
  if (!saved) return

  suppressTemplateWatch.value = true
  state.startDate = saved.data.startDate
  state.endDate = saved.data.endDate
  state.contractTypeId = saved.data.contractTypeId
  state.templateId = saved.data.templateId
  state.signedDate = saved.data.signedDate
  state.baseCompensation = saved.data.baseCompensation
  state.keterangan = saved.data.keterangan
  startDateCal.value = toCalDate(state.startDate)
  endDateCal.value = toCalDate(state.endDate)
  signedDateCal.value = toCalDate(state.signedDate)
  if (state.templateId) await fetchTemplateFields(state.templateId)
  templateData.value = { ...(saved.data.templateData ?? {}) }
  dynamicFieldErrors.value = {}
  await nextTick()
  suppressTemplateWatch.value = false
  pendingDraft.value = null
  toast.add({ title: 'Draft perubahan dipulihkan', color: 'success' })
}

function discardPendingDraft() {
  draft.clear()
  pendingDraft.value = null
}

function fillState(c: Contract | null) {
  if (!c) return
  state.contractNo = c.contractNo
  state.startDate = c.startDate ? c.startDate.slice(0, 10) : ''
  state.endDate = c.endDate ? c.endDate.slice(0, 10) : ''
  state.contractTypeId = c.contractTypeId ?? undefined
  state.templateId = c.templateId ?? undefined
  state.signedDate = c.signedDate ? c.signedDate.slice(0, 10) : c.startDate ? c.startDate.slice(0, 10) : ''
  state.baseCompensation = c.baseCompensation ?? undefined
  state.keterangan = c.keterangan ?? ''
  state.documentUrl = c.documentUrl ?? ''
  startDateCal.value = toCalDate(state.startDate)
  endDateCal.value = toCalDate(state.endDate)
  signedDateCal.value = toCalDate(state.signedDate)
  prefillTemplateData(c)
}

const fetchLoading = ref(false)
const fullContract = ref<Contract | null>(null)

async function hydrate(c: Contract | null) {
  if (!c) return
  draftReady.value = false
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

  await fetchTemplateFields(state.templateId)

  baseline.value = JSON.stringify(snapshot())
  pendingDraft.value = null
  submitErrors.value = []
  const saved = draft.read()
  if (saved && JSON.stringify(saved.data) !== baseline.value) pendingDraft.value = saved

  await nextTick()
  draftReady.value = true
}

watch(() => [props.contract, props.open] as const, ([contract, open]) => {
  if (!open) {
    draftReady.value = false
    return
  }
  if (contract) hydrate(contract)
}, { immediate: true })

watch(() => state.templateId, async (templateId, previous) => {
  if (suppressTemplateWatch.value) return
  if (!previous || templateId === previous) return
  await fetchTemplateFields(templateId)
  prefillTemplateData(null)
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const contract = props.contract
  if (!contract) return

  dynamicFieldErrors.value = collectDynamicFieldErrors()
  if (Object.keys(dynamicFieldErrors.value).length > 0) {
    toast.add({ title: 'Lengkapi data tambahan template', color: 'warning' })
    return
  }

  loading.value = true
  try {
    const employeeId = fullContract.value?.employeeId ?? contract.employeeId
    const { startDate, endDate, contractTypeId, templateId, signedDate, baseCompensation, keterangan } = event.data
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
        keterangan,
        templateData: dynamicFieldValues()
      }
    })
    draft.clear()
    pendingDraft.value = null
    baseline.value = JSON.stringify(snapshot())
    toast.add({ title: 'Kontrak berhasil diperbarui', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (e) {
    const error = e as { data?: { message?: string }, message?: string }
    toast.add({ title: 'Gagal memperbarui', description: error?.data?.message ?? error?.message ?? 'Terjadi kesalahan', color: 'error' })
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

const statusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  SUDAH_DIPERPANJANG: 'Sudah Diperpanjang'
}

const statusColorMap: Record<string, string> = {
  DRAFT: 'neutral',
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral',
  SUDAH_DIPERPANJANG: 'info'
}

const employeeLabel = computed(() => {
  const employee = fullContract.value?.employee ?? props.contract?.employee
  if (!employee) return ''
  return employee.employeeNo ? `${employee.fullName} (${employee.employeeNo})` : employee.fullName
})

const contractStatus = computed(() => fullContract.value?.status ?? props.contract?.status ?? null)

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

const uploadedName = computed(() =>
  state.documentUrl ? state.documentUrl.split('/').pop() ?? '' : ''
)

const requiredChecks = computed(() => {
  const checks = [
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
          <UIcon name="i-lucide-pencil" class="size-5" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-highlighted">
            Edit Kontrak
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            Perbarui data kontrak. Perubahan akan tercatat di riwayat karyawan.
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
          :contract-no="state.contractNo"
          :loading="fetchLoading"
          :employee="employeeLabel"
          :period="periodLabel"
          :duration="durationLabel"
          :compensation="compensationLabel"
          :status-label="contractStatus ? (statusLabelMap[contractStatus] ?? contractStatus) : undefined"
          :status-color="contractStatus ? (statusColorMap[contractStatus] ?? 'neutral') : undefined"
        />

        <div
          v-if="pendingDraft"
          class="dossier-rise flex flex-col gap-3 rounded-xl border border-info/30 bg-info/10 p-3 sm:flex-row sm:items-start"
        >
          <UIcon name="i-lucide-history" class="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-medium text-highlighted">
              Ada perubahan yang belum tersimpan
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Draft dari {{ pendingDraftAge }} berbeda dengan data kontrak saat ini.
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <UButton
              label="Buang"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="discardPendingDraft"
            />
            <UButton
              label="Pulihkan"
              color="info"
              variant="subtle"
              size="sm"
              @click="restoreDraft"
            />
          </div>
        </div>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 40ms"
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
          style="animation-delay: 80ms"
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
          style="animation-delay: 120ms"
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
                Kontrak ini tidak punya snapshot dokumen, sehingga nilai field tambahan di atas
                tidak akan ikut tercetak ke PDF. Perubahan tanggal dan kompensasi tetap tersimpan.
              </p>
            </div>
          </div>
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 160ms"
          icon="i-lucide-paperclip"
          title="Dokumen Pendukung"
          description="Ganti hasil pindai kontrak yang sudah ditandatangani bila perlu."
        >
          <KontrakContractFileDropzone
            v-model="selectedFile"
            :uploading="uploadingDoc"
            :uploaded-name="uploadedName"
          />
        </KontrakContractFormSection>

        <KontrakContractFormSection
          class="dossier-rise"
          style="animation-delay: 200ms"
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
            label="Simpan Perubahan"
            icon="i-lucide-check"
            color="primary"
            :loading="loading"
            :disabled="!!endDateError"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
