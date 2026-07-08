<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Employee, UserAccount, WarningLetter } from '~/types'

const props = defineProps<{
  open: boolean
  warningLetter: WarningLetter | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const replaceFile = ref(false)

const hasExistingFile = computed(() => !!props.warningLetter?.documentUrl)

const { data: employeesRes } = useFetch<{ data: Employee[] }>('/api/employees', {
  query: { limit: 1000 },
  lazy: true,
  credentials: 'include',
})

const { data: usersRes } = useFetch<UserAccount[]>('/api/users/pengurus', {
  lazy: true,
  credentials: 'include',
})

const employees = computed(() => employeesRes.value?.data ?? [])
const users = computed(() => usersRes.value ?? [])

const employeeItems = computed(() =>
  employees.value.map(e => ({ label: `${e.fullName} (${e.employeeNo})`, value: e.id }))
)

const userItems = computed(() =>
  users.value.map(u => ({ label: u.name, value: u.id }))
)

const selectedEmployee = ref<Employee | null>(null)

const schema = z.object({
  letterNumber: z.string().min(1, 'Nomor surat wajib diisi'),
  employeeId: z.number({ error: 'Karyawan wajib dipilih' }),
  violationType: z.array(z.string().min(1, 'Deskripsi pelanggaran wajib diisi')).min(1, 'Minimal 1 pelanggaran'),
  warningLevel: z.number({ error: 'Level peringatan wajib dipilih' }),
  letterDate: z.string().min(1, 'Tanggal surat wajib diisi'),
  validUntil: z.string().min(1, 'Tanggal berlaku wajib diisi'),
  processedById: z.number({ error: 'Pengurus koperasi wajib dipilih' }),
  processedByName: z.string().min(1, 'Nama pengurus wajib diisi'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  letterNumber: '',
  employeeId: undefined,
  violationType: [''],
  warningLevel: undefined,
  letterDate: '',
  validUntil: '',
  processedById: undefined,
  processedByName: '',
})

// Pre-populate form saat modal dibuka / data berubah
watch(() => props.open, (open) => {
  if (open && props.warningLetter) {
    populateForm(props.warningLetter)
  }
})

watch(() => props.warningLetter, (letter) => {
  if (props.open && letter) {
    populateForm(letter)
  }
})

function populateForm(letter: WarningLetter) {
  state.letterNumber = letter.letterNumber
  state.employeeId = letter.employeeId
  state.violationType = letter.violationType?.length ? [...letter.violationType] : ['']
  state.warningLevel = letter.warningLevel
  state.letterDate = letter.letterDate ? letter.letterDate.split('T')[0] : ''
  state.validUntil = letter.validUntil ? letter.validUntil.split('T')[0] : ''
  state.processedById = letter.processedById ?? undefined
  state.processedByName = letter.processedByName ?? ''

  // Set selectedEmployee untuk info card
  selectedEmployee.value = employees.value.find(e => e.id === letter.employeeId) ?? null

  // Reset file state
  selectedFile.value = null
  replaceFile.value = false
  if (fileInput.value) fileInput.value.value = ''
}

// Auto-calculate Berlaku Sampai = Tanggal Surat + 6 bulan
watch(() => state.letterDate, (date) => {
  if (date) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + 6)
    state.validUntil = d.toISOString().split('T')[0]
  } else {
    state.validUntil = ''
  }
})

function onEmployeeChange(id: number | undefined) {
  selectedEmployee.value = employees.value.find(e => e.id === id) ?? null
}

function addViolation() {
  if (!state.violationType) state.violationType = ['']
  state.violationType.push('')
}

function removeViolation(index: number) {
  if (state.violationType && state.violationType.length > 1) {
    state.violationType.splice(index, 1)
  }
}

function onUserChange(id: number | undefined) {
  const user = users.value.find(u => u.id === id)
  state.processedByName = user?.name ?? ''
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    toast.add({ title: 'Format tidak didukung', description: 'Gunakan file PDF, JPG, PNG, atau WEBP.', color: 'error' })
    target.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.add({ title: 'File terlalu besar', description: 'Maksimal 10 MB.', color: 'error' })
    target.value = ''
    return
  }
  selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  replaceFile.value = false
  if (fileInput.value) fileInput.value.value = ''
}

async function uploadFile(spId: number) {
  if (!selectedFile.value) return
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  await $fetch(`/api/warning-letters/${spId}/file`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.warningLetter?.id) return
  loading.value = true
  try {
    await $fetch(`/api/warning-letters/${props.warningLetter.id}`, {
      method: 'PUT',
      body: {
        ...event.data,
        violationType: event.data.violationType.filter(v => v.trim()),
      },
      credentials: 'include',
    })
    if (selectedFile.value) {
      try {
        await uploadFile(props.warningLetter.id)
      } catch {
        toast.add({ title: 'SP berhasil diperbarui', description: 'Namun gagal mengupload file.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        return
      }
    }
    toast.add({ title: 'Surat peringatan berhasil diperbarui', color: 'success' })
    emit('saved')
    emit('update:open', false)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui surat peringatan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="props.open" title="Edit Surat Peringatan" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nomor Surat" name="letterNumber" required>
          <UInput v-model="state.letterNumber" placeholder="Contoh: 195 /KUKP-SII/VIII/2025" class="w-full" />
        </UFormField>

        <UFormField label="Karyawan" name="employeeId" required>
          <USelect
            v-model="state.employeeId"
            :items="employeeItems"
            placeholder="Pilih karyawan..."
            class="w-full"
            @update:model-value="onEmployeeChange"
          />
        </UFormField>

        <div v-if="selectedEmployee" class="grid grid-cols-2 gap-4 rounded-xl border border-default bg-elevated/40 p-4">
          <div>
            <span class="text-xs text-muted">NIK</span>
            <p class="font-medium text-highlighted">{{ selectedEmployee.employeeNo }}</p>
          </div>
          <div>
            <span class="text-xs text-muted">Jabatan</span>
            <p class="font-medium text-highlighted">{{ selectedEmployee.jobRole?.name ?? '-' }}</p>
          </div>
        </div>

        <UFormField label="Jenis Pelanggaran" name="violationType" required>
          <div class="space-y-2">
            <div v-for="(_, index) in state.violationType ?? []" :key="index" class="flex gap-2">
              <UTextarea
                v-model="(state.violationType ?? [])[index]"
                placeholder="Jelaskan pelanggaran secara detail"
                class="flex-1"
                :rows="4"
              />
              <UButton
                v-if="(state.violationType ?? []).length > 1"
                icon="i-lucide-x"
                variant="ghost"
                color="error"
                @click="removeViolation(index)"
              />
            </div>
            <UButton
              label="Tambah Pelanggaran"
              icon="i-lucide-plus"
              variant="soft"
              color="primary"
              size="sm"
              @click="addViolation"
            />
          </div>
        </UFormField>

        <UFormField label="Level Peringatan" name="warningLevel" required>
          <USelect
            v-model="state.warningLevel"
            :items="[
              { label: 'SP 1', value: 1 },
              { label: 'SP 2', value: 2 },
              { label: 'SP 3', value: 3 },
            ]"
            placeholder="Pilih level..."
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tanggal Surat" name="letterDate" required>
            <UInput v-model="state.letterDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Berlaku Sampai (6 bulan)" name="validUntil">
            <UInput
              :model-value="state.validUntil"
              type="date"
              readonly
              class="w-full opacity-60"
            />
          </UFormField>
        </div>

        <UFormField label="Pengurus Koperasi" name="processedById" required>
          <USelect
            v-model="state.processedById"
            :items="userItems"
            placeholder="Pilih pengurus..."
            class="w-full"
            @update:model-value="onUserChange"
          />
        </UFormField>

        <!-- File Dokumen SP -->
        <UFormField label="File Dokumen (opsional)">
          <div class="space-y-2">
            <!-- File existing -->
            <div v-if="hasExistingFile && !replaceFile" class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2 text-sm">
              <UIcon name="i-lucide-paperclip" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-muted">File sudah ada</span>
              <a :href="props.warningLetter!.documentUrl!" target="_blank" class="shrink-0 text-primary hover:underline">Unduh</a>
              <UButton label="Ganti" size="xs" color="neutral" variant="subtle" @click="replaceFile = true" />
            </div>
            <!-- File input -->
            <div v-if="!hasExistingFile || replaceFile">
              <input
                ref="fileInput"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                class="hidden"
                @change="onFileChange"
              />
              <div
                class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-default px-3 py-3 text-sm text-muted transition hover:border-primary hover:text-primary"
                @click="fileInput?.click()"
              >
                <UIcon name="i-lucide-upload" class="size-4 shrink-0" />
                <span v-if="!selectedFile">Klik untuk pilih file (PDF, JPG, PNG, WEBP · maks. 10 MB)</span>
                <span v-else class="truncate text-highlighted">{{ selectedFile.name }}</span>
                <UButton v-if="selectedFile" icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="ml-auto shrink-0" @click.stop="clearFile()" />
              </div>
              <p v-if="replaceFile" class="mt-1 text-xs text-muted">File baru akan menggantikan file lama setelah disimpan.</p>
            </div>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan Perubahan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
