<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Contract, ContractTemplate } from '~/types'

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

const contractTemplateOptions = computed<LookupOption[]>(() =>
  (contractTemplatesRes.value ?? []).map(template => ({
    label: `${template.name} (${template.family})`,
    value: template.id,
  })),
)

const schema = z.object({
  contractNo: z.string().min(1, 'No. kontrak wajib diisi'),
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

const state = reactive<Partial<Schema> & { documentUrl?: string }>({
  contractNo: '',
  startDate: '',
  endDate: '',
  contractTypeId: undefined,
  templateId: undefined,
  signedDate: '',
  positionLabel: '',
  workLocationLabel: '',
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
  state.positionLabel = c.positionLabel ?? ''
  state.workLocationLabel = c.workLocationLabel ?? ''
  state.baseCompensation = c.baseCompensation ?? undefined
  state.documentUrl = c.documentUrl ?? ''
}

watch(() => props.contract, fillState, { immediate: true })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.contract) return
  loading.value = true
  try {
    await $fetch(`/api/contracts/${props.contract.id}`, {
      method: 'PUT',
      body: { ...event.data, employeeId: props.contract.employeeId },
    })
    toast.add({ title: 'Kontrak berhasil diperbarui', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
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
        <UFormField label="No. Kontrak" name="contractNo" required>
          <UInput v-model="state.contractNo" class="w-full" />
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
