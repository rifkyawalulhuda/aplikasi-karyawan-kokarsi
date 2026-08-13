<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate } from '~/types'

interface LookupItem { id: number; name: string }

const toast = useToast()
const auth = useAuthStore()

const { data: templatesRes, refresh } = await useFetch<ContractTemplate[]>('/api/contract-templates')
const { data: contractTypesRes } = await useFetch<LookupItem[]>('/api/lookups/contract-types')
const { data: jobRolesRes } = await useFetch<LookupItem[]>('/api/lookups/job-roles')

const templates = computed(() => templatesRes.value ?? [])
const contractTypeOptions = computed(() => (contractTypesRes.value ?? []).map(item => ({ label: item.name, value: item.id })))
const jobRoleOptions = computed(() => (jobRolesRes.value ?? []).map(item => ({ label: item.name, value: item.id })))

// --- Template Key Options (sesuai CONTRACT_DOCUMENT_DEFINITIONS di backend) ---
const TEMPLATE_KEY_OPTIONS: Record<string, { label: string; value: string }[]> = {
  PKWT: [
    { label: 'PKWT_DRIVER — Driver', value: 'PKWT_DRIVER' },
    { label: 'PKWT_KASIR — Kasir', value: 'PKWT_KASIR' },
    { label: 'PKWT_STAFF — Staff', value: 'PKWT_STAFF' },
    { label: 'PKWT_WAREHOUSE — Karyawan Gudang', value: 'PKWT_WAREHOUSE' },
  ],
  MITRA: [
    { label: 'MITRA_DRIVER — Driver', value: 'MITRA_DRIVER' },
    { label: 'MITRA_KOMART — Kasir Kopmart', value: 'MITRA_KOMART' },
    { label: 'MITRA_STAFF — Staff', value: 'MITRA_STAFF' },
    { label: 'MITRA_WAREHOUSE — Karyawan Gudang', value: 'MITRA_WAREHOUSE' },
  ],
}

const templateKeyOptions = computed(() =>
  TEMPLATE_KEY_OPTIONS[state.family ?? 'PKWT'] ?? []
)

const formOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const schema = z.object({
  code: z.string().min(3, 'Min. 3 karakter'),
  name: z.string().min(3, 'Min. 3 karakter'),
  family: z.enum(['MITRA', 'PKWT']),
  templateKey: z.enum([
    'PKWT_DRIVER', 'PKWT_KASIR', 'PKWT_STAFF', 'PKWT_WAREHOUSE',
    'MITRA_DRIVER', 'MITRA_KOMART', 'MITRA_STAFF', 'MITRA_WAREHOUSE',
  ], { message: 'Pilih template key yang valid' }),
  contractTypeId: z.number().optional(),
  jobRoleId: z.number().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  code: '',
  name: '',
  family: 'PKWT',
  templateKey: undefined,
  contractTypeId: undefined,
  jobRoleId: undefined,
  description: '',
  notes: '',
  isActive: true,
})

function resetForm() {
  editingId.value = null
  state.code = ''
  state.name = ''
  state.family = 'PKWT'
  state.templateKey = undefined
  state.contractTypeId = undefined
  state.jobRoleId = undefined
  state.description = ''
  state.notes = ''
  state.isActive = true
}

// Reset templateKey jika tidak cocok dengan family yang baru dipilih
watch(() => state.family, (newFamily) => {
  const validKeys = (TEMPLATE_KEY_OPTIONS[newFamily ?? 'PKWT'] ?? []).map(o => o.value)
  if (state.templateKey && !validKeys.includes(state.templateKey)) {
    state.templateKey = undefined
  }
})

function openCreate() {
  resetForm()
  formOpen.value = true
}

function openEdit(template: ContractTemplate) {
  editingId.value = template.id
  state.code = template.code
  state.name = template.name
  state.family = template.family
  state.templateKey = template.templateKey as Schema['templateKey']
  state.contractTypeId = template.contractTypeId ?? undefined
  state.jobRoleId = template.jobRoleId ?? undefined
  state.description = template.description ?? ''
  state.notes = template.notes ?? ''
  state.isActive = template.isActive
  formOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/contract-templates/${editingId.value}`, { method: 'PUT', body: event.data })
      toast.add({ title: 'Template kontrak diperbarui', color: 'success' })
    } else {
      await $fetch('/api/contract-templates', { method: 'POST', body: event.data })
      toast.add({ title: 'Template kontrak ditambahkan', color: 'success' })
    }
    formOpen.value = false
    resetForm()
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menyimpan template', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function removeTemplate(id: number) {
  try {
    await $fetch(`/api/contract-templates/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Template kontrak dihapus', color: 'success' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus template', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="settings-contract-templates">
    <template #header>
      <UDashboardNavbar title="Template Kontrak">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="auth.canManageMasterData" label="Tambah Template" icon="i-lucide-plus" color="primary" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-lucide-file-text"
          title="Master Template Kontrak"
          description="Template ini dipakai di halaman kontrak untuk menentukan struktur dokumen legal yang akan digenerate otomatis."
        />

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="template in templates" :key="template.id">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-highlighted">{{ template.name }}</p>
                  <p class="text-xs text-muted">{{ template.code }}</p>
                </div>
                <UBadge :color="template.isActive ? 'success' : 'neutral'" variant="subtle">
                  {{ template.isActive ? 'Aktif' : 'Nonaktif' }}
                </UBadge>
              </div>

              <div class="space-y-1 text-sm text-muted">
                <p>Keluarga: <span class="text-highlighted">{{ template.family }}</span></p>
                <p>Tipe Kontrak: <span class="text-highlighted">{{ template.contractType?.name ?? '-' }}</span></p>
                <p>Jabatan: <span class="text-highlighted">{{ template.jobRole?.name ?? '-' }}</span></p>
                <p>Template Key: <span class="font-mono text-highlighted">{{ template.templateKey }}</span></p>
              </div>

              <p v-if="template.description" class="text-sm text-muted leading-6">{{ template.description }}</p>

              <div v-if="auth.canManageMasterData" class="flex gap-2 pt-2">
                <UButton label="Edit" size="sm" color="neutral" variant="subtle" icon="i-lucide-pencil" @click="openEdit(template)" />
                <UButton label="Hapus" size="sm" color="error" variant="ghost" icon="i-lucide-trash" @click="removeTemplate(template.id)" />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="formOpen" :title="editingId ? 'Edit Template Kontrak' : 'Tambah Template Kontrak'" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Kode" name="code" required>
            <UInput v-model="state.code" class="w-full" />
          </UFormField>
          <UFormField label="Nama Template" name="name" required>
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Keluarga" name="family" required>
            <USelect v-model="state.family" :items="[{ label: 'PKWT', value: 'PKWT' }, { label: 'MITRA', value: 'MITRA' }]" class="w-full" />
          </UFormField>
          <UFormField label="Template Key" name="templateKey" required hint="Menentukan konten dokumen PDF yang digenerate">
            <USelect
              v-model="state.templateKey"
              :items="templateKeyOptions"
              placeholder="Pilih template key..."
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Tipe Kontrak" name="contractTypeId">
            <USelect v-model="state.contractTypeId" :items="contractTypeOptions" placeholder="Opsional" class="w-full" />
          </UFormField>
          <UFormField label="Jabatan" name="jobRoleId">
            <USelect v-model="state.jobRoleId" :items="jobRoleOptions" placeholder="Opsional" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Deskripsi" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <UFormField label="Catatan" name="notes">
          <UTextarea v-model="state.notes" :rows="2" class="w-full" />
        </UFormField>

        <UCheckbox v-model="state.isActive" label="Template aktif" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Batal" color="neutral" variant="subtle" @click="formOpen = false" />
          <UButton type="submit" label="Simpan" color="primary" :loading="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
