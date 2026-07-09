<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Employee, UserAccount } from '~/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

const previewLetterNumber = ref('')
const loadingLetterPreview = ref(false)

async function fetchPreviewLetterNumber() {
  loadingLetterPreview.value = true
  try {
    const qs = state.letterDate ? `?letterDate=${state.letterDate}` : ''
    const res = await $fetch<{ letterNumber: string }>(`/api/warning-letters/preview-number${qs}`, { credentials: 'include' })
    previewLetterNumber.value = res.letterNumber
  } catch {
    previewLetterNumber.value = '-'
  } finally {
    loadingLetterPreview.value = false
  }
}

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

interface EscalationStatus {
  employeeId: number
  highestActiveLevel: number
  allowedLevels: number[]
  defaultLevel: number | null
  blocked: boolean
  message: string
  activeLetters: Array<{ id: number; letterNumber: string; warningLevel: number; letterDate: string; validUntil: string }>
}

const escalation = ref<EscalationStatus | null>(null)
const escalationLoading = ref(false)

const warningLevelItems = computed(() => {
  const allowed = escalation.value?.allowedLevels ?? [1, 2, 3]
  return [
    { label: 'SP 1', value: 1, disabled: !allowed.includes(1) },
    { label: 'SP 2', value: 2, disabled: !allowed.includes(2) },
    { label: 'SP 3', value: 3, disabled: !allowed.includes(3) },
  ]
})

const isBlocked = computed(() => escalation.value?.blocked ?? false)

async function loadEscalation(employeeId: number) {
  escalationLoading.value = true
  escalation.value = null
  try {
    const status = await $fetch<EscalationStatus>(`/api/warning-letters/escalation/${employeeId}`, {
      credentials: 'include',
    })
    escalation.value = status
    // Apply default level from escalation rule
    if (status.blocked) {
      state.warningLevel = undefined
    } else if (status.defaultLevel != null) {
      state.warningLevel = status.defaultLevel
    } else if (state.warningLevel != null && !status.allowedLevels.includes(state.warningLevel)) {
      state.warningLevel = undefined
    }
  } catch {
    escalation.value = null
  } finally {
    escalationLoading.value = false
  }
}

const schema = z.object({
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
  employeeId: undefined,
  violationType: [''],
  warningLevel: undefined,
  letterDate: '',
  validUntil: '',
  processedById: undefined,
  processedByName: '',
})

const auth = useAuthStore()

// Auto-fill pengurus dari user yang login saat modal dibuka
watch(() => props.open, (open) => {
  if (open && auth.admin) {
    // Find matching user from pengurus list
    const matchedUser = users.value.find(u => u.name === auth.admin?.fullName || u.id === auth.admin?.id)
    if (matchedUser) {
      state.processedById = matchedUser.id
      state.processedByName = matchedUser.name
    } else {
      // Use admin data directly even if not in pengurus list
      state.processedByName = auth.admin?.fullName ?? ''
    }
    fetchPreviewLetterNumber()
  }
})

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

watch(() => state.letterDate, (val) => {
  if (val) fetchPreviewLetterNumber()
})

function onEmployeeChange(id: number | undefined) {
  selectedEmployee.value = employees.value.find(e => e.id === id) ?? null
  if (id != null) {
    loadEscalation(id)
  } else {
    escalation.value = null
  }
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
  loading.value = true
  try {
    const filtered = event.data.violationType.filter(v => v.trim())
    const created = await $fetch<{ id: number }>('/api/warning-letters', {
      method: 'POST',
      body: {
        ...event.data,
        violationType: filtered,
      },
      credentials: 'include',
    })

    if (selectedFile.value) {
      try {
        await uploadFile(created.id)
      } catch {
        toast.add({ title: 'SP berhasil ditambahkan', description: 'Namun gagal mengupload file.', color: 'warning' })
        emit('saved')
        emit('update:open', false)
        resetForm()
        return
      }
    }

    toast.add({ title: 'Surat peringatan berhasil ditambahkan', color: 'success' })
    emit('saved')
    emit('update:open', false)
    resetForm()
  } catch (e: any) {
    toast.add({ title: 'Gagal membuat surat peringatan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  state.employeeId = undefined
  state.violationType = ['']
  state.warningLevel = undefined
  state.letterDate = ''
  state.validUntil = ''
  state.processedById = undefined
  state.processedByName = ''
  selectedEmployee.value = null
  escalation.value = null
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <UModal :open="props.open" title="Tambah Surat Peringatan" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nomor Surat (otomatis)">
          <UInput
            :model-value="loadingLetterPreview ? 'Memuat...' : previewLetterNumber"
            readonly
            class="w-full opacity-70 font-mono"
            placeholder="Memuat nomor..."
          />
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

        <!-- Info eskalasi / blokir SP -->
        <UAlert
          v-if="selectedEmployee && isBlocked"
          color="error"
          variant="subtle"
          icon="i-lucide-ban"
          title="Pembuatan SP diblokir"
          :description="escalation?.message"
        />
        <UAlert
          v-else-if="selectedEmployee && escalation && escalation.highestActiveLevel > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Karyawan masih memiliki SP${escalation.highestActiveLevel} aktif`"
          :description="`Sesuai rule eskalasi, level peringatan yang tersedia: ${escalation.allowedLevels.map(l => 'SP' + l).join(', ')}.`"
        />

        <UFormField label="Level Peringatan" name="warningLevel" required>
          <USelect
            v-model="state.warningLevel"
            :items="warningLevelItems"
            placeholder="Pilih level..."
            class="w-full"
            :disabled="isBlocked || escalationLoading"
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
              <UButton
                v-if="selectedFile"
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                class="ml-auto shrink-0"
                @click.stop="clearFile()"
              />
            </div>
          </div>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" :disabled="isBlocked" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
