<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

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

const emit = defineEmits<{ added: [] }>()

const open = ref(false)
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
  if (photoPreview.value) {
    URL.revokeObjectURL(photoPreview.value)
  }
  photoFile.value = file
  photoPreview.value = URL.createObjectURL(file)
}

async function uploadPhoto(employeeId: number) {
  if (!photoFile.value) return
  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('photo', photoFile.value)
    await $fetch(`/api/employees/${employeeId}/photo`, {
      method: 'POST',
      body: formData,
    })
    toast.add({ title: 'Foto berhasil diupload', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal upload foto', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    uploadLoading.value = false
    resetPhotoState()
  }
}

// Reset photo state saat modal ditutup
watch(() => open.value, (val) => {
  if (!val) {
    resetPhotoState()
  }
})

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

const workLocationItems = computed(() =>
  (lookups.value?.workLocations ?? []).map((l: { id: number; name: string }) => ({ label: l.name, value: l.id }))
)
const jobRoleItems = computed(() =>
  (lookups.value?.jobRoles ?? []).map((l: { id: number; name: string }) => ({ label: l.name, value: l.id }))
)
const jobLevelItems = computed(() =>
  (lookups.value?.jobLevels ?? []).map((l: { id: number; name: string }) => ({ label: l.name, value: l.id }))
)
const taxStatusItems = computed(() =>
  (lookups.value?.taxStatus ?? []).map((l: { id: number; name: string }) => ({ label: l.name, value: l.id }))
)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const created = await $fetch<{ id: number }>('/api/employees', {
      method: 'POST',
      body: event.data,
    })
    // Upload foto jika ada file yang dipilih
    if (photoFile.value) {
      await uploadPhoto(created.id)
    }
    toast.add({
      title: 'Karyawan ditambahkan',
      description: `${event.data.fullName} (${event.data.employeeNo}) berhasil ditambahkan.`,
      color: 'success',
    })
    open.value = false
    emit('added')
  } catch (e: any) {
    toast.add({
      title: 'Gagal menambahkan karyawan',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

function onClose() {
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Tambah Karyawan Baru"
    description="Isi data karyawan baru untuk Koperasi PT. Sankyu"
    :ui="{ content: 'max-w-2xl' }"
  >
    <UButton label="Tambah Karyawan" icon="i-lucide-user-plus" />

    <template #body>
      <!-- Section Upload Foto -->
      <div class="flex items-center gap-4 mb-4 pb-4 border-b border-default">
        <div class="w-16 h-16 rounded-full overflow-hidden bg-elevated flex items-center justify-center shrink-0">
          <img
            v-if="photoPreview"
            :src="photoPreview"
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
          <UButton label="Batal" color="neutral" variant="subtle" @click="onClose" />
          <UButton label="Simpan Karyawan" color="primary" variant="solid" type="submit" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
