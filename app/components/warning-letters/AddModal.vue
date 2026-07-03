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

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/warning-letters', {
      method: 'POST',
      body: {
        ...event.data,
        violationType: event.data.violationType.filter(v => v.trim()),
      },
      credentials: 'include',
    })
    toast.add({ title: 'Surat peringatan berhasil dibuat', color: 'success' })
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
  state.letterNumber = ''
  state.employeeId = undefined
  state.violationType = ['']
  state.warningLevel = undefined
  state.letterDate = ''
  state.validUntil = ''
  state.processedById = undefined
  state.processedByName = ''
  selectedEmployee.value = null
}
</script>

<template>
  <UModal :open="props.open" title="Tambah Surat Peringatan" @update:open="emit('update:open', $event)">
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

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="emit('update:open', false)" />
          <UButton type="submit" label="Simpan" color="primary" :loading="loading" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
