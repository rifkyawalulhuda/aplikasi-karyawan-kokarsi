<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface EmployeeOption { label: string; value: number }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)

// Fetch daftar karyawan untuk dropdown
const { data: employeesRes } = await useFetch<{ data: { id: number; fullName: string; employeeNo: string }[] }>('/api/employees', {
  query: { limit: 999 },
  lazy: true
})

const employeeOptions = computed<EmployeeOption[]>(() =>
  (employeesRes.value?.data ?? []).map(e => ({
    label: `${e.fullName} (${e.employeeNo})`,
    value: e.id
  }))
)

const contractTypeOptions = [
  { label: 'PKWT', value: 'PKWT' },
  { label: 'PKWTT', value: 'PKWTT' },
  { label: 'Magang', value: 'Magang' },
]

const statusOptions = [
  { label: 'Aktif', value: 'AKTIF' },
  { label: 'Akan Habis', value: 'AKAN_HABIS' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Dibatalkan', value: 'DIBATALKAN' },
]

const schema = z.object({
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  contractNo: z.string().min(1, 'No. kontrak wajib diisi'),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
  endDate: z.string().min(1, 'Tanggal selesai wajib diisi'),
  contractType: z.string().min(1, 'Tipe kontrak wajib diisi'),
  status: z.string().min(1, 'Status wajib diisi'),
  documentUrl: z.string().optional(),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  employeeId: undefined,
  contractNo: '',
  startDate: '',
  endDate: '',
  contractType: 'PKWT',
  status: 'AKTIF',
  documentUrl: '',
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
  state.contractNo = ''
  state.startDate = ''
  state.endDate = ''
  state.contractType = 'PKWT'
  state.status = 'AKTIF'
  state.documentUrl = ''
}
</script>

<template>
  <UModal :open="open" title="Tambah Kontrak" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Karyawan" name="employeeId" required>
          <USelect
            v-model="state.employeeId"
            :items="employeeOptions"
            placeholder="Pilih karyawan..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="No. Kontrak" name="contractNo" required>
          <UInput v-model="state.contractNo" placeholder="PKWT/2026/001" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Mulai" name="startDate" required>
            <UInput v-model="state.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal Selesai" name="endDate" required>
            <UInput v-model="state.endDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tipe Kontrak" name="contractType" required>
            <USelect v-model="state.contractType" :items="contractTypeOptions" class="w-full" />
          </UFormField>
          <UFormField label="Status" name="status" required>
            <USelect v-model="state.status" :items="statusOptions" class="w-full" />
          </UFormField>
        </div>

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
