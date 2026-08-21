<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate } from '~/types'

interface LookupItem { id: number; name: string }

const toast = useToast()
const auth = useAuthStore()
const { confirmDeleteToast } = useConfirmDeleteToast()

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

async function removeTemplate(id: number, name: string) {
  confirmDeleteToast({
    title: 'Hapus Template Kontrak?',
    description: `Template "${name}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Template',
    onConfirm: async () => {
      try {
        await $fetch(`/api/contract-templates/${id}`, { method: 'DELETE' })
        toast.add({ title: 'Template kontrak dihapus', color: 'success' })
        await refresh()
      } catch (e: any) {
        toast.add({ title: 'Gagal menghapus template', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
      }
    },
  })
}

// --- Content editor modal state ---
const contentModalOpen = ref(false)
const contentModalTemplate = ref<{ id: number; name: string; templateKey: string; family: 'PKWT' | 'MITRA' } | null>(null)

function openContentEditor(template: ContractTemplate) {
  contentModalTemplate.value = {
    id: template.id,
    name: template.name,
    templateKey: template.templateKey,
    family: template.family,
  }
  contentModalOpen.value = true
}

// --- Grouping & family config ---
const templatesByFamily = computed(() => ({
  PKWT: templates.value.filter(t => t.family === 'PKWT'),
  MITRA: templates.value.filter(t => t.family === 'MITRA'),
}))

const familyConfig = {
  PKWT: {
    label: 'PKWT',
    fullName: 'Kesepakatan Kerja Waktu Tertentu',
    icon: 'i-lucide-file-check',
    ringClass: 'bg-primary/10 text-primary',
    borderClass: 'border-l-primary',
  },
  MITRA: {
    label: 'MITRA',
    fullName: 'Perjanjian Kemitraan',
    icon: 'i-lucide-handshake',
    ringClass: 'bg-warning/10 text-warning',
    borderClass: 'border-l-warning',
  },
} as const
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
      <div class="space-y-8 p-4 sm:p-6">

        <!-- Info bar -->
        <div class="flex items-start gap-3 rounded-xl border border-info/20 bg-info/5 px-4 py-3">
          <UIcon name="i-lucide-info" class="size-4 text-info mt-0.5 shrink-0" />
          <p class="text-sm text-muted">
            Template kontrak menentukan <strong class="text-highlighted">format dan konten dokumen PDF</strong> yang digenerate saat membuat kontrak karyawan.
            Setiap template terikat pada satu <strong class="text-highlighted">Template Key</strong> yang menentukan struktur pasal dan role karyawan.
          </p>
        </div>

        <!-- Empty state -->
        <div v-if="templates.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
          <div class="flex size-16 items-center justify-center rounded-full bg-elevated mb-4">
            <UIcon name="i-lucide-file-x" class="size-7 text-muted" />
          </div>
          <p class="text-base font-medium text-highlighted">Belum ada template kontrak</p>
          <p class="text-sm text-muted mt-1 mb-5">Tambahkan template pertama untuk mulai meng-generate dokumen PDF kontrak karyawan.</p>
          <UButton
            v-if="auth.canManageMasterData"
            label="Tambah Template Pertama"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate"
          />
        </div>

        <!-- Family sections -->
        <template v-else>
          <div
            v-for="familyKey in (['PKWT', 'MITRA'] as const)"
            :key="familyKey"
            class="space-y-4"
          >
            <!-- Section header -->
            <div class="flex items-center gap-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                :class="familyConfig[familyKey].ringClass"
              >
                <UIcon :name="familyConfig[familyKey].icon" class="size-5" />
              </div>
              <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <h2 class="font-semibold text-highlighted">{{ familyConfig[familyKey].label }}</h2>
                <span class="text-sm text-muted hidden sm:inline">— {{ familyConfig[familyKey].fullName }}</span>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ templatesByFamily[familyKey].length }} template
                </UBadge>
              </div>
              <div class="h-px flex-1 bg-border hidden sm:block" />
            </div>

            <!-- Empty family state -->
            <div
              v-if="templatesByFamily[familyKey].length === 0"
              class="rounded-xl border border-dashed border-default bg-elevated/30 px-6 py-8 text-center"
            >
              <UIcon name="i-lucide-file-plus" class="size-8 text-muted mx-auto mb-2" />
              <p class="text-sm text-muted">Belum ada template {{ familyConfig[familyKey].label }}</p>
            </div>

            <!-- Cards grid -->
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="template in templatesByFamily[familyKey]"
                :key="template.id"
                class="rounded-xl border border-default bg-default overflow-hidden flex flex-col transition-shadow hover:shadow-md border-l-4"
                :class="template.isActive ? familyConfig[familyKey].borderClass : 'border-l-muted'"
              >
                <!-- Card header -->
                <div class="px-5 pt-5 pb-3">
                  <div class="flex items-start justify-between gap-3 mb-1">
                    <div class="min-w-0">
                      <p class="font-semibold text-highlighted truncate">{{ template.name }}</p>
                      <p class="font-mono text-xs text-muted mt-0.5">{{ template.code }}</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <UBadge
                        v-if="template.contentOverrides && Object.keys(template.contentOverrides).length > 0"
                        color="primary"
                        variant="subtle"
                        size="xs"
                        icon="i-lucide-pencil"
                        label="Dikustomisasi"
                      />
                      <UBadge
                        :color="template.isActive ? 'success' : 'neutral'"
                        variant="subtle"
                        size="xs"
                      >
                        {{ template.isActive ? 'Aktif' : 'Nonaktif' }}
                      </UBadge>
                    </div>
                  </div>
                </div>

                <!-- Metadata grid -->
                <div class="px-5 pb-4 grid grid-cols-2 gap-x-4 gap-y-3 flex-1">
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed mb-0.5">Template Key</p>
                    <p class="text-xs font-mono text-highlighted">{{ template.templateKey }}</p>
                  </div>
                  <div>
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed mb-0.5">Tipe Kontrak</p>
                    <p class="text-xs text-highlighted">{{ template.contractType?.name ?? '—' }}</p>
                  </div>
                  <div v-if="template.jobRole?.name" class="col-span-2">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-dimmed mb-0.5">Jabatan</p>
                    <p class="text-xs text-highlighted">{{ template.jobRole.name }}</p>
                  </div>
                  <div v-if="template.description" class="col-span-2">
                    <p class="text-xs text-muted italic line-clamp-2">{{ template.description }}</p>
                  </div>
                </div>

                <!-- Actions footer -->
                <div class="border-t border-default bg-elevated/30 px-4 py-3">
                  <!-- Primary action -->
                  <UButton
                    label="Edit Konten"
                    icon="i-lucide-file-edit"
                    color="primary"
                    variant="subtle"
                    class="w-full mb-2"
                    @click="openContentEditor(template)"
                  />
                  <!-- Secondary actions -->
                  <div v-if="auth.canManageMasterData" class="flex items-center gap-2">
                    <UButton
                      label="Edit"
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      class="flex-1"
                      @click="openEdit(template)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      aria-label="Hapus template"
                      @click="removeTemplate(template.id, template.name)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

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

  <KontrakTemplateContentModal
    v-model:open="contentModalOpen"
    :template="contentModalTemplate"
    @saved="refresh()"
  />
</template>
