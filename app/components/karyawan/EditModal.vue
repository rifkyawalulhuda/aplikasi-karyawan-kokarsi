<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Employee } from '~/types'

interface LookupItem { id: number; name: string }
interface LookupsResponse {
  workLocations: LookupItem[]
  taxStatus: LookupItem[]
  departments: LookupItem[]
  jobRoles: LookupItem[]
  jobLevels: LookupItem[]
  educationLevels: string[]
  genders: { value: string; label: string }[]
}

const props = defineProps<{ employee: Employee | null }>()
const emit = defineEmits<{ updated: []; 'update:modelValue': [val: boolean] }>()

const open = defineModel<boolean>({ default: false })
const loading = ref(false)
const uploadLoading = ref(false)
const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(null)
const toast = useToast()

function resetPhotoState() {
  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value)
  }
  photoPreview.value = null
  photoFile.value = null
}

function onPhotoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // Revoke blob URL lama sebelum buat yang baru
  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value)
  }
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}

async function uploadPhoto() {
  if (!props.employee || !photoFile.value) return
  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('photo', photoFile.value)
    await $fetch(`/api/employees/${props.employee.id}/photo`, {
      method: 'POST',
      body: formData,
    })
    toast.add({ title: 'Foto berhasil diupload', color: 'success' })
    // Reset preview agar fallback ke URL server yang baru
    resetPhotoState()
    emit('updated')
  } catch (e: any) {
    toast.add({ title: 'Gagal upload foto', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadLoading.value = false
  }
}

const { data: lookups } = await useFetch<LookupsResponse>('/api/lookups')

const schema = z.object({
  employeeNo: z.string().min(3, 'Min. 3 karakter'),
  fullName: z.string().min(3, 'Min. 3 karakter'),
  nik: z.string().min(8, 'Min. 8 karakter').optional().or(z.literal('')),
  birthPlace: z.string().min(2, 'Min. 2 karakter').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE']),
  birthDate: z.string().min(1, 'Wajib diisi'),
  joinDate: z.string().min(1, 'Wajib diisi'),
  email: z.string().email('Email tidak valid'),
  phoneNumber: z.string().min(8, 'Min. 8 karakter'),
  address: z.string().min(5, 'Min. 5 karakter').optional().or(z.literal('')),
  educationLevel: z.enum(['SMA', 'D3', 'S1', 'S2']),
  workLocationId: z.number({ error: 'Wajib dipilih' }),
  jobRoleId: z.number({ error: 'Wajib dipilih' }),
  jobLevelId: z.number({ error: 'Wajib dipilih' }),
  taxStatusId: z.number({ error: 'Wajib dipilih' }),
  departmentId: z.number({ error: 'Wajib dipilih' })
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  employeeNo: '',
  fullName: '',
  nik: '',
  birthPlace: '',
  gender: 'MALE',
  birthDate: '',
  joinDate: '',
  email: '',
  phoneNumber: '',
  address: '',
  educationLevel: 'SMA',
  workLocationId: undefined,
  jobRoleId: undefined,
  jobLevelId: undefined,
  taxStatusId: undefined,
  departmentId: undefined
})

// Isi state saat employee atau lookups berubah (tunggu keduanya ready)
function fillState(emp: typeof props.employee) {
  if (!emp) return
  state.employeeNo = emp.employeeNo
  state.fullName = emp.fullName
  state.nik = emp.nik ?? ''
  state.birthPlace = emp.birthPlace ?? ''
  state.gender = emp.gender as 'MALE' | 'FEMALE'
  state.birthDate = emp.birthDate ? emp.birthDate.slice(0, 10) : ''
  state.joinDate = emp.joinDate ? emp.joinDate.slice(0, 10) : ''
  state.email = emp.email ?? ''
  state.phoneNumber = emp.phoneNumber ?? ''
  state.address = emp.address ?? ''
  state.educationLevel = emp.educationLevel as 'SMA' | 'D3' | 'S1' | 'S2'
  state.workLocationId = emp.workLocationId
  state.jobRoleId = emp.jobRoleId
  state.jobLevelId = emp.jobLevelId
  state.taxStatusId = emp.taxStatusId
  state.departmentId = emp.departmentId ?? undefined
}

// Watch employee prop — reset photo state saat ganti employee
watch(() => props.employee, (emp) => {
  resetPhotoState()
  fillState(emp)
}, { immediate: true })

// Reset photo state saat modal ditutup
watch(() => open.value, (val) => {
  if (!val) {
    resetPhotoState()
  }
})

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
const departmentItems = computed(() =>
  (lookups.value?.departments ?? []).map(l => ({ label: l.name, value: l.id }))
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
      <!-- Section Upload Foto -->
      <div class="flex items-center gap-4 mb-4 pb-4 border-b border-default">
        <div class="w-16 h-16 rounded-full overflow-hidden bg-elevated flex items-center justify-center shrink-0">
          <img
            v-if="photoPreview || props.employee?.fotoKaryawan"
            :src="photoPreview || `http://localhost:3001${props.employee?.fotoKaryawan}`"
            class="w-full h-full object-cover"
            alt="Foto karyawan"
          />
          <UIcon v-else name="i-lucide-user" class="w-8 h-8 text-muted" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-highlighted mb-1">Foto Karyawan</p>
          <p class="text-xs text-muted mb-2">JPG, PNG, WebP. Maks 2MB.</p>
          <div class="flex items-center gap-2">
            <label class="cursor-pointer">
              <input type="file" accept="image/jpg,image/jpeg,image/png,image/webp" class="hidden" @change="onPhotoChange" />
              <UButton as="span" label="Pilih Foto" color="neutral" variant="subtle" size="sm" icon="i-lucide-upload" />
            </label>
            <UButton
              v-if="photoFile"
              label="Upload"
              color="primary"
              size="sm"
              :loading="uploadLoading"
              @click="uploadPhoto()"
            />
          </div>
          <p v-if="photoFile" class="text-xs text-muted mt-1">{{ photoFile.name }}</p>
        </div>
      </div>

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

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="NIK" name="nik">
            <UInput v-model="state.nik" placeholder="3275xxxxxxxxxxxx" class="w-full" />
          </UFormField>
          <UFormField label="Tempat Lahir" name="birthPlace">
            <UInput v-model="state.birthPlace" placeholder="Bekasi" class="w-full" />
          </UFormField>
        </div>

        <!-- Baris 2: Gender -->
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted">
            Status kepegawaian dihitung otomatis dari kontrak terbaru atau proses offboarding.
          </div>
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

        <UFormField label="Alamat Lengkap" name="address">
          <UTextarea v-model="state.address" :rows="3" placeholder="Alamat lengkap sesuai identitas" class="w-full" />
        </UFormField>

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

        <!-- Baris 6: Departement + Level -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Departement" name="departmentId" required>
            <USelect
              v-model="state.departmentId"
              :items="departmentItems"
              placeholder="Pilih departement"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Level Jabatan" name="jobLevelId" required>
            <USelect
              v-model="state.jobLevelId"
              :items="jobLevelItems"
              placeholder="Pilih level"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Baris 7: Status Pajak -->
        <div class="grid grid-cols-2 gap-4">
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
