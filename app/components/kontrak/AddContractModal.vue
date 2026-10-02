<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate, ContractHistoryResponse, ContractStatus, ContractInputField, ContractInputFieldsResponse } from '~/types'
import { CalendarDate } from '@internationalized/date'

interface EmployeeOption { label: string; value: number }
interface LookupOption { label: string; value: number }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const { toCalDate, fromCalDate, formatDisplay, getLocalTimeZone } = useDatePicker()

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

const { data: employeesRes } = await useFetch<{ data: { id: number; fullName: string; employeeNo: string }[] }>('/api/employees', {
  query: { limit: 999 },
  lazy: true
})

const { data: contractTypesRes } = await useFetch<{ id: number; name: string }[]>('/api/lookups/contract-types')
const { data: contractTemplatesRes } = await useFetch<ContractTemplate[]>('/api/contract-templates', {
  query: { activeOnly: true },
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
    value: type.id,
  })),
)

const contractTemplateOptions = computed<LookupOption[]>(() =>
  (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id,
  })),
)

// ── Field dinamis template (CONTRACT_INPUT) ──────────────────────────────
// Sumbernya `GET /api/contract-templates/:id/fields`, yaitu `fieldDefinitions`
// versi PUBLISHED — sumber yang sama dengan yang divalidasi server saat kontrak
// dibuat. Karena itu field di sini tidak perlu (dan tidak boleh) memakai prefix
// `custom.`; resolver backend yang menambahkannya saat mencocokkan placeholder.
const templateFields = ref<ContractInputField[]>([])
const loadingTemplateFields = ref(false)
const templateData = ref<Record<string, any>>({})
const dynamicFieldErrors = ref<Record<string, string>>({})
// Template yang belum pernah menerbitkan versi tetap bisa dibuka form-nya, tapi
// kontraknya TIDAK akan punya snapshot: `TemplateSnapshotService` mengembalikan
// null untuk versi non-PUBLISHED, sehingga PDF dirender dari definisi bawaan dan
// field dinamis yang diisi petugas tidak ikut tercetak — tanpa pesan error apa pun
// (diverifikasi: kontrak tetap 201 dengan templateVersionId/snapshot null).
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
      { credentials: 'include' },
    )
    templateFields.value = res.fields ?? []
    templateNotPublished.value = res.published === false
  } catch {
    // Gagal muat: form tetap bisa dipakai, tapi petugas diberi tahu agar tidak
    // mengira template ini memang tanpa field tambahan.
    templateFields.value = []
    toast.add({
      title: 'Gagal memuat field tambahan template',
      description: 'Coba pilih ulang template atau muat ulang halaman.',
      color: 'warning',
    })
  } finally {
    loadingTemplateFields.value = false
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
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractTypeId: z.number({ error: 'Tipe kontrak wajib diisi' }),
  templateId: z.number({ error: 'Template kontrak wajib dipilih' }),
  signedDate: z.string().min(1, 'Tanggal tanda tangan wajib diisi'),
  baseCompensation: z.coerce.number({ error: 'Nominal wajib diisi' }).min(1, 'Nominal wajib diisi'),
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
})

// Template berganti → field dinamis & nilainya ikut berganti.
watch(() => state.templateId, (templateId) => { fetchTemplateFields(templateId) })

// Contract status awareness
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
      $fetch<{ employmentStatus: string }>(`/api/employees/${employeeId}`),
    ])
    employeeEmploymentStatus.value = empRes.employmentStatus
    const latest = historyRes.contracts[0]
    if (latest) {
      employeeContractStatus.value = latest.status
      employeeLatestContract.value = latest
    }
  } catch {
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
  // Template belum terbit: kontraknya akan tersimpan tanpa snapshot dan field
  // dinamis tidak tercetak. Tombol dimatikan, alasannya tampil sebagai banner
  // di dekat pemilih template.
  if (templateNotPublished.value) return false
  return true
})

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const statusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral',
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
    fetchPreviewContractNo()
  }
})

watch(() => state.startDate, (val) => {
  if (val) fetchPreviewContractNo()
})

async function onSubmit(event: FormSubmitEvent<Schema>) {
  // Template tanpa versi terbit menghasilkan kontrak tanpa snapshot, sehingga
  // field dinamis di bawah ini tidak akan ikut tercetak ke PDF. Server tidak
  // menolaknya, jadi submit harus dicegat di sini.
  if (templateNotPublished.value) {
    toast.add({
      title: 'Template belum memiliki versi terbit',
      description: 'Terbitkan versi template terlebih dahulu di Pengaturan › Template Kontrak.',
      color: 'warning',
    })
    return
  }

  // Field dinamis divalidasi di sini dulu supaya pesan errornya tampil di dalam
  // form, bukan sebagai toast dari penolakan server.
  dynamicFieldErrors.value = collectDynamicFieldErrors()
  if (Object.keys(dynamicFieldErrors.value).length > 0) {
    toast.add({ title: 'Lengkapi data tambahan template', color: 'warning' })
    return
  }

  loading.value = true
  try {
    await $fetch('/api/contracts', {
      method: 'POST',
      body: {
        ...event.data,
        templateData: dynamicFieldValues(),
      },
    })
    toast.add({ title: 'Kontrak berhasil ditambahkan', color: 'success' })
    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan kontrak', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  state.employeeId = undefined
  state.startDate = ''
  state.endDate = ''
  state.contractTypeId = undefined
  state.templateId = undefined
  state.signedDate = ''
  state.baseCompensation = undefined
  employeeContractStatus.value = null
  employeeLatestContract.value = null
  employeeEmploymentStatus.value = null
  startDateCal.value = null
  endDateCal.value = null
  signedDateCal.value = null
  templateData.value = {}
  dynamicFieldErrors.value = {}
}

// ── DatePicker CalendarDate refs ─────────────────────────────────────────────
const startDateCal  = shallowRef<CalendarDate | null>(null)
const endDateCal    = shallowRef<CalendarDate | null>(null)
const signedDateCal = shallowRef<CalendarDate | null>(null)

watch(startDateCal,  val => { state.startDate  = fromCalDate(val) })
watch(endDateCal,    val => { state.endDate    = fromCalDate(val) })
watch(signedDateCal, val => { state.signedDate = fromCalDate(val) })
</script>

<template>
  <UModal :open="open" title="Tambah Kontrak" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
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

        <!-- Contract Status Alert -->
        <div v-if="checkingContract" class="flex items-center gap-2 text-sm text-muted py-2">
          <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
          Memeriksa status kontrak karyawan...
        </div>

        <div v-else-if="isOffboarded" class="rounded-xl border border-error/40 bg-error/10 p-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-user-x" class="w-5 h-5 text-error shrink-0 mt-0.5" />
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
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
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
                  <UBadge variant="subtle" :color="statusColorMap[employeeLatestContract.status] as any" size="sm" class="ml-1">
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
            <UIcon name="i-lucide-info" class="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div class="text-sm">
              <p class="font-semibold text-info">Kontrak terakhir sudah Expired</p>
              <p class="mt-1 text-muted">
                Kontrak terakhir <span class="font-medium text-highlighted">{{ employeeLatestContract.contractNo }}</span>
                berakhir pada {{ new Date(employeeLatestContract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}.
                Histori kontrak akan otomatis tersambung.
              </p>
            </div>
          </div>
        </div>

        <UFormField label="No. Kontrak (otomatis)">
          <UInput
            :model-value="loadingPreview ? 'Memuat...' : previewContractNo"
            readonly
            class="w-full opacity-70 font-mono"
            placeholder="Memuat nomor..."
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

        <div v-if="loadingTemplateFields" class="flex items-center gap-2 text-sm text-muted py-2">
          <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
          Memuat field tambahan template...
        </div>
        <KontrakContractDynamicFields
          v-else
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
              Kontrak tidak dapat disimpan karena field tambahan template tidak akan ikut
              tercetak ke dokumen. Terbitkan versi template terlebih dahulu di
              <NuxtLink
                to="/settings/contract-templates"
                class="underline"
              >
                Pengaturan › Template Kontrak
              </NuxtLink>.
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

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton
            type="submit"
            label="Simpan"
            color="primary"
            :loading="loading"
            :disabled="!canSubmitForm"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
