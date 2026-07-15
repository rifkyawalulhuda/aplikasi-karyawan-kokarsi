<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate, ContractHistoryResponse, ContractStatus } from '~/types'

interface EmployeeOption { label: string; value: number }
interface LookupOption { label: string; value: number }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)

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

const schema = z.object({
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractTypeId: z.number({ error: 'Tipe kontrak wajib diisi' }),
  templateId: z.number({ error: 'Template kontrak wajib dipilih' }),
  signedDate: z.string().min(1, 'Tanggal tanda tangan wajib diisi'),
  positionLabel: z.string().optional(),
  workLocationLabel: z.string().optional(),
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
  positionLabel: '',
  workLocationLabel: '',
  baseCompensation: undefined,
})

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
  loading.value = true
  try {
    await $fetch('/api/contracts', {
      method: 'POST',
      body: event.data,
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
  state.positionLabel = ''
  state.workLocationLabel = ''
  state.baseCompensation = undefined
  employeeContractStatus.value = null
  employeeLatestContract.value = null
  employeeEmploymentStatus.value = null
}
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
            <UInput v-model="state.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal Selesai" name="endDate" required>
            <UInput v-model="state.endDate" type="date" class="w-full" />
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

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Tanda Tangan" name="signedDate" required>
            <UInput v-model="state.signedDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Nominal Kompensasi" name="baseCompensation" required>
            <UInput v-model="state.baseCompensation" type="number" min="0" placeholder="5941759" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Label Posisi di Dokumen" name="positionLabel">
            <UInput v-model="state.positionLabel" placeholder="Staff Admin" class="w-full" />
          </UFormField>
          <UFormField label="Label Lokasi Kerja di Dokumen" name="workLocationLabel">
            <UInput v-model="state.workLocationLabel" placeholder="Head Office Jakarta" class="w-full" />
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
