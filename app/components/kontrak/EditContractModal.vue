<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Contract } from '~/types'

const props = defineProps<{ open: boolean; contract: Contract | null }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)

const contractTypeOptions = [
  { label: 'PKWT', value: 'PKWT' },
  { label: 'PKWTT', value: 'PKWTT' },
  { label: 'Magang', value: 'Magang' },
]

const schema = z.object({
  contractNo: z.string().min(1, 'No. kontrak wajib diisi'),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractType: z.string().min(1, 'Tipe kontrak wajib diisi'),
  documentUrl: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  contractNo: '',
  startDate: '',
  endDate: '',
  contractType: 'PKWT',
  documentUrl: '',
})

function fillState(c: Contract | null) {
  if (!c) return
  state.contractNo = c.contractNo
  state.startDate = c.startDate ? c.startDate.slice(0, 10) : ''
  state.endDate = c.endDate ? c.endDate.slice(0, 10) : ''
  state.contractType = c.contractType
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

        <UFormField label="Tipe Kontrak" name="contractType" required>
          <USelect v-model="state.contractType" :items="contractTypeOptions" class="w-full" />
        </UFormField>

        <UFormField label="URL Dokumen" name="documentUrl">
          <UInput v-model="state.documentUrl" placeholder="https://..." class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
