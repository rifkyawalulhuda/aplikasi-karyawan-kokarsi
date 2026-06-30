<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Employee } from '~/types'

interface LookupItem { id: number; name: string }
interface LookupsResponse {
  workLocations: LookupItem[]
  taxStatus: LookupItem[]
  jobRoles: LookupItem[]
  jobLevels: LookupItem[]
  educationLevels: string[]
  employmentStatuses: string[]
  genders: { value: string; label: string }[]
}

const props = defineProps<{ employee: Employee | null }>()
const emit = defineEmits<{ updated: []; 'update:modelValue': [val: boolean] }>()

const open = defineModel<boolean>({ default: false })
const loading = ref(false)
const toast = useToast()

const { data: lookups } = await useFetch<LookupsResponse>('/api/lookups')

const schema = z.object({
  employeeNo: z.string().min(3, 'Min. 3 karakter'),
  fullName: z.string().min(3, 'Min. 3 karakter'),
  employmentStatus: z.enum(['MITRA', 'KONTRAK']),
  gender: z.enum(['MALE', 'FEMALE']),
  birthDate: z.string().min(1, 'Wajib diisi'),
  joinDate: z.string().min(1, 'Wajib diisi'),
  email: z.string().email('Email tidak valid'),
  phoneNumber: z.string().min(8, 'Min. 8 karakter'),
  educationLevel: z.enum(['SMA', 'D3', 'S1', 'S2']),
  workLocationId: z.number({ error: 'Wajib dipilih' }),
  jobRoleId: z.number({ error: 'Wajib dipilih' }),
  jobLevelId: z.number({ error: 'Wajib dipilih' }),
  taxStatusId: z.number({ error: 'Wajib dipilih' })
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  employeeNo: '',
  fullName: '',
  employmentStatus: 'KONTRAK',
  gender: 'MALE',
  birthDate: '',
  joinDate: '',
  email: '',
  phoneNumber: '',
  educationLevel: 'SMA',
  workLocationId: undefined,
  jobRoleId: undefined,
  jobLevelId: undefined,
  taxStatusId: undefined
})

// Isi state saat employee atau lookups berubah (tunggu keduanya ready)
function fillState(emp: typeof props.employee) {
  if (!emp) return
  state.employeeNo = emp.employeeNo
  state.fullName = emp.fullName
  state.employmentStatus = emp.employmentStatus as 'MITRA' | 'KONTRAK'
  state.gender = emp.gender as 'MALE' | 'FEMALE'
  state.birthDate = emp.birthDate ? emp.birthDate.slice(0, 10) : ''
  state.joinDate = emp.joinDate ? emp.joinDate.slice(0, 10) : ''
  state.email = emp.email ?? ''
  state.phoneNumber = emp.phoneNumber ?? ''
  state.educationLevel = emp.educationLevel as 'SMA' | 'D3' | 'S1' | 'S2'
  state.workLocationId = emp.workLocationId
  state.jobRoleId = emp.jobRoleId
  state.jobLevelId = emp.jobLevelId
  state.taxStatusId = emp.taxStatusId
}

// Watch employee prop
watch(() => props.employee, (emp) => fillState(emp), { immediate: true })

// Watch lookups — re-fill setelah lookups loaded agar USelect resolve label dengan benar
watch(() => lookups.value, (val) => {
  if (val) fillState(props.employee)
})

const workLocationItems = computed(() =>
  (lookups.value?.workLocations ?? []).map(l => ({ label: l.name, value: l.id }))
)
const jobRoleItems = computed(() =>
  (lookups.value?.jobRoles ?? []).map(l => ({ label: l.name, value: l.id }))
)
const jobLevelItems = computed(() =>
  (lookups.value?.jobLevels ?? []).map(l => ({ label: l.name, value: l.id }))
)
const taxStatusItems = computed(() =>
  (lookups.value?.taxStatus ?? []).map(l => ({ label: l.name, value: l.id }))
)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.employee) return
  loading.value = true
  try {
    await $fetch(`/api/employees/${props.employee.id}`, {
      method: 'PUT',
      body: event.data,
    })
    toast.add({
      title: 'Data karyawan diperbarui',
      description: `${event.data.fullName} berhasil diperbarui.`,
      color: 'success',
    })
    open.value = false
    emit('updated')
  } catch (e: any) {
    toast.add({
      title: 'Gagal memperbarui karyawan',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit Data Karyawan"
    description="Perbarui data karyawan Koperasi PT. Sankyu"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <!-- Baris 1: NIK + Nama -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="No. Induk Karyawan" name="employeeNo" required>
            <UInput v-model="state.employeeNo" placeholder="SKY-001" class="w-full" />
          </UFormField>
          <UFormField label="Nama Lengkap" name="fullName" required>
            <UInput v-model="state.fullName" placeholder="Nama lengkap karyawan" class="w-full" />
          </UFormField>
        </div>

        <!-- Baris 2: Status + Gender -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Status Kepegawaian" name="employmentStatus" required>
            <USelect
              v-model="state.employmentStatus"
              :items="[{ label: 'MITRA', value: 'MITRA' }, { label: 'KONTRAK', value: 'KONTRAK' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jenis Kelamin" name="gender" required>
            <USelect
              v-model="state.gender"
              :items="[{ label: 'Laki-laki', value: 'MALE' }, { label: 'Perempuan', value: 'FEMALE' }]"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Baris 3: Tgl Lahir + Tgl Bergabung -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Tanggal Lahir" name="birthDate" required>
            <UInput v-model="state.birthDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal Bergabung" name="joinDate" required>
            <UInput v-model="state.joinDate" type="date" class="w-full" />
          </UFormField>
        </div>

        <!-- Baris 4: Email + No HP -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Email" name="email" required>
            <UInput v-model="state.email" type="email" placeholder="nama@sankyu.co.id" class="w-full" />
          </UFormField>
          <UFormField label="Nomor Telepon" name="phoneNumber" required>
            <UInput v-model="state.phoneNumber" placeholder="08xxxxxxxxxx" class="w-full" />
          </UFormField>
        </div>

        <!-- Baris 5: Lokasi + Jabatan -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Lokasi Kerja" name="workLocationId" required>
            <USelect
              v-model="state.workLocationId"
              :items="workLocationItems"
              placeholder="Pilih lokasi"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jabatan" name="jobRoleId" required>
            <USelect
              v-model="state.jobRoleId"
              :items="jobRoleItems"
              placeholder="Pilih jabatan"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Baris 6: Level + Status Pajak -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Level Jabatan" name="jobLevelId" required>
            <USelect
              v-model="state.jobLevelId"
              :items="jobLevelItems"
              placeholder="Pilih level"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status Pajak" name="taxStatusId" required>
            <USelect
              v-model="state.taxStatusId"
              :items="taxStatusItems"
              placeholder="Pilih status pajak"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Pendidikan -->
        <UFormField label="Pendidikan Terakhir" name="educationLevel" required>
          <USelect
            v-model="state.educationLevel"
            :items="[
              { label: 'SMA/SMK', value: 'SMA' },
              { label: 'D3', value: 'D3' },
              { label: 'S1', value: 'S1' },
              { label: 'S2', value: 'S2' }
            ]"
            class="w-full"
          />
        </UFormField>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="open = false" />
          <UButton label="Simpan Perubahan" color="primary" variant="solid" type="submit" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
