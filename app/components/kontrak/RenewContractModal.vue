<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Contract, ContractTemplate } from '~/types'

interface LookupOption { label: string; value: number }

const props = defineProps<{ open: boolean; parentContract: Contract | null }>()
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

const contractTemplateOptions = computed<LookupOption[]>(() =>
  (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id,
  })),
)

const minStartDate = computed(() => {
  if (!props.parentContract?.endDate) return ''
  return props.parentContract.endDate.split('T')[0]
})

const schema = z.object({
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractTypeId: z.number({ error: 'Tipe kontrak wajib diisi' }),
  templateId: z.number({ error: 'Template kontrak wajib dipilih' }),
  signedDate: z.string().min(1, 'Tanggal tanda tangan wajib diisi'),
  positionLabel: z.string().optional(),
  workLocationLabel: z.string().optional(),
  baseCompensation: z.coerce.number({ error: 'Nominal wajib diisi' }).min(1, 'Nominal wajib diisi'),
}).refine(
  (data) => {
    const parentEnd = props.parentContract?.endDate
    if (!parentEnd) return true
    return data.startDate >= parentEnd.split('T')[0]!
  },
  {
    message: 'Tanggal mulai tidak boleh lebih kecil dari tanggal selesai kontrak sebelumnya',
    path: ['startDate'],
  }
)

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  startDate: '',
  endDate: '',
  contractTypeId: undefined,
  templateId: undefined,
  signedDate: '',
  positionLabel: '',
  workLocationLabel: '',
  baseCompensation: undefined,
})

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
  if (!props.parentContract) return

  loading.value = true
  try {
    await $fetch(`/api/contracts/${props.parentContract.id}/renew`, {
      method: 'POST',
      body: event.data,
    })
    toast.add({ title: 'Kontrak berhasil diperpanjang', color: 'success' })
    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (e: any) {
    toast.add({
      title: 'Gagal memperpanjang kontrak',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  state.startDate = ''
  state.endDate = ''
  state.contractTypeId = undefined
  state.templateId = undefined
  state.signedDate = ''
  state.positionLabel = ''
  state.workLocationLabel = ''
  state.baseCompensation = undefined
}

const statusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}
</script>

<template>
  <UModal :open="open" title="Perpanjang Kontrak" :ui="{ content: 'max-w-2xl' }" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="parentContract" class="mb-5 rounded-xl border border-default bg-elevated/40 p-4">
        <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">Kontrak Sebelumnya</p>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span class="text-muted">No. Kontrak:</span>
            <span class="ml-1 font-medium text-highlighted">{{ parentContract.contractNo }}</span>
          </div>
          <div>
            <span class="text-muted">Status:</span>
            <UBadge variant="subtle" color="warning" size="sm" class="ml-1">
              {{ statusLabelMap[parentContract.status] ?? parentContract.status }}
            </UBadge>
          </div>
          <div>
            <span class="text-muted">Periode:</span>
            <span class="ml-1 text-highlighted">
              {{ new Date(parentContract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              -
              {{ new Date(parentContract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
            </span>
          </div>
          <div v-if="parentContract.contractType">
            <span class="text-muted">Tipe:</span>
            <span class="ml-1 text-highlighted">{{ parentContract.contractType.name }}</span>
          </div>
        </div>
      </div>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="No. Kontrak Baru (otomatis)">
          <UInput
            :model-value="loadingPreview ? 'Memuat...' : previewContractNo"
            readonly
            class="w-full opacity-70 font-mono"
            placeholder="Memuat nomor..."
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Mulai" name="startDate" required :hint="minStartDate ? `Min: ${minStartDate}` : ''">
            <UInput v-model="state.startDate" type="date" :min="minStartDate" class="w-full" />
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
          <UButton type="submit" label="Perpanjang" icon="i-lucide-refresh-cw" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
