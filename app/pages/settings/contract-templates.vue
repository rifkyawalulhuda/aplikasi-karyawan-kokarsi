<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ContractTemplate } from '~/types'

interface LookupItem { id: number, name: string }

const toast = useToast()
const auth = useAuthStore()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { confirmActionToast } = useConfirmActionToast()

const { data: templatesRes, refresh } = await useFetch<ContractTemplate[]>('/api/contract-templates')
const { data: contractTypesRes } = await useFetch<LookupItem[]>('/api/lookups/contract-types')
const { data: jobRolesRes } = await useFetch<LookupItem[]>('/api/lookups/job-roles')

const templates = computed(() => templatesRes.value ?? [])
const contractTypeOptions = computed(() => (contractTypesRes.value ?? []).map(item => ({ label: item.name, value: item.id })))
const jobRoleOptions = computed(() => (jobRolesRes.value ?? []).map(item => ({ label: item.name, value: item.id })))

// --- Template Key Options (sesuai CONTRACT_DOCUMENT_DEFINITIONS di backend) ---
const TEMPLATE_KEY_OPTIONS: Record<string, { label: string, value: string }[]> = {
  PKWT: [
    { label: 'PKWT_DRIVER — Driver', value: 'PKWT_DRIVER' },
    { label: 'PKWT_KASIR — Kasir', value: 'PKWT_KASIR' },
    { label: 'PKWT_STAFF — Staff', value: 'PKWT_STAFF' },
    { label: 'PKWT_WAREHOUSE — Karyawan Gudang', value: 'PKWT_WAREHOUSE' }
  ],
  MITRA: [
    { label: 'MITRA_DRIVER — Driver', value: 'MITRA_DRIVER' },
    { label: 'MITRA_DRIVER_TRUCK_B3 — Driver Truk B3', value: 'MITRA_DRIVER_TRUCK_B3' },
    { label: 'MITRA_KOMART — Kasir Kopmart', value: 'MITRA_KOMART' },
    { label: 'MITRA_STAFF — Staff', value: 'MITRA_STAFF' },
    { label: 'MITRA_WAREHOUSE — Karyawan Gudang', value: 'MITRA_WAREHOUSE' }
  ]
}

const formOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const schema = z.object({
  code: z.string().min(3, 'Min. 3 karakter'),
  name: z.string().min(3, 'Min. 3 karakter'),
  family: z.enum(['MITRA', 'PKWT']),
  templateKey: z.enum([
    'PKWT_DRIVER', 'PKWT_KASIR', 'PKWT_STAFF', 'PKWT_WAREHOUSE',
    'MITRA_DRIVER', 'MITRA_DRIVER_TRUCK_B3', 'MITRA_KOMART', 'MITRA_STAFF', 'MITRA_WAREHOUSE'
  ], { message: 'Pilih template key yang valid' }),
  contractTypeId: z.number().optional(),
  jobRoleId: z.number().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true)
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
  isActive: true
})

const templateKeyOptions = computed(() =>
  TEMPLATE_KEY_OPTIONS[state.family ?? 'PKWT'] ?? []
)

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

/**
 * Buka form tambah dengan nilai awal dari template yang sudah ada.
 * Kode HARUS diganti admin karena `code` unik di database (P2002) — jadi
 * dikosongkan, bukan diisi otomatis, agar admin sadar perlu kode baru.
 */
function openDuplicate(template: ContractTemplate) {
  resetForm()
  editingId.value = null
  state.code = ''
  state.name = `${template.name} (Salinan)`
  state.family = template.family
  state.templateKey = template.templateKey as Schema['templateKey']
  state.contractTypeId = template.contractTypeId ?? undefined
  state.jobRoleId = template.jobRoleId ?? undefined
  state.description = template.description ?? ''
  state.notes = template.notes ?? ''
  state.isActive = true
  formOpen.value = true
}

async function setTemplateActive(template: ContractTemplate, nextActive: boolean) {
  try {
    await $fetch(`/api/contract-templates/${template.id}`, {
      method: 'PUT',
      body: {
        code: template.code,
        name: template.name,
        family: template.family,
        templateKey: template.templateKey,
        contractTypeId: template.contractTypeId ?? undefined,
        jobRoleId: template.jobRoleId ?? undefined,
        description: template.description ?? undefined,
        notes: template.notes ?? undefined,
        isActive: nextActive
      }
    })
    toast.add({
      title: nextActive ? 'Template diaktifkan' : 'Template dinonaktifkan',
      description: nextActive
        ? 'Template kembali muncul sebagai pilihan saat membuat kontrak baru.'
        : 'Template tidak lagi muncul sebagai pilihan saat membuat kontrak baru. Kontrak lama tidak terpengaruh.',
      color: 'success'
    })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Gagal mengubah status template', description: apiErrorMessage(e), color: 'error' })
  }
}

/**
 * Mengaktifkan langsung; menonaktifkan lewat konfirmasi yang menyebut berapa
 * kontrak memakai template ini. Kontrak lama tetap aman (dokumennya beku lewat
 * snapshot), tetapi template hilang dari pilihan saat membuat kontrak baru —
 * jadi admin diberi tahu dampaknya sebelum lanjut.
 */
function toggleActive(template: ContractTemplate) {
  if (!template.isActive) {
    void setTemplateActive(template, true)
    return
  }

  const used = usageCount(template)
  confirmActionToast({
    title: 'Nonaktifkan template ini?',
    description: used > 0
      ? `Template "${template.name}" sedang dipakai oleh ${used} kontrak. Kontrak yang sudah ada tidak terpengaruh, tetapi template ini tidak akan muncul saat membuat atau memperpanjang kontrak baru.`
      : `Template "${template.name}" tidak akan muncul sebagai pilihan saat membuat kontrak baru.`,
    icon: 'i-lucide-power',
    color: 'warning',
    confirmLabel: 'Nonaktifkan',
    confirmColor: 'warning',
    onConfirm: () => setTemplateActive(template, false)
  })
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
  } catch (e) {
    toast.add({ title: 'Gagal menyimpan template', description: apiErrorMessage(e), color: 'error' })
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
      } catch (e) {
        toast.add({ title: 'Gagal menghapus template', description: apiErrorMessage(e), color: 'error' })
      }
    }
  })
}

// --- Content editor modal state ---
const contentModalOpen = ref(false)
const contentModalTemplate = ref<{ id: number, name: string, templateKey: string, family: 'PKWT' | 'MITRA' } | null>(null)

function openContentEditor(template: ContractTemplate) {
  contentModalTemplate.value = {
    id: template.id,
    name: template.name,
    templateKey: template.templateKey,
    family: template.family
  }
  contentModalOpen.value = true
}

// --- Usage/deletion safety (dipakai tombol Hapus & delete guard) ---
function usageCount(template: ContractTemplate) {
  return template._count?.contracts ?? 0
}

function publishedVersion(template: ContractTemplate) {
  return template.versions?.[0] ?? null
}

function draftCount(template: ContractTemplate) {
  return template._count?.versions ?? 0
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// --- Search & filters (client-side; daftar template kecil & sudah di-fetch) ---
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive' | 'draft' | 'unpublished'>('all')
const familyFilter = ref<'all' | 'PKWT' | 'MITRA'>('all')
const sortBy = ref<'family' | 'name' | 'usage' | 'published'>('family')

// Info bar bisa dilipat karena isinya penjelasan statis yang tidak perlu
// memakan ruang tiap kali halaman dibuka.
const showInfo = useLocalStorage('contract-templates-info-open', true)

function matchesFilters(template: ContractTemplate) {
  const q = search.value.trim().toLowerCase()
  if (q) {
    const haystack = [template.name, template.code, template.templateKey, template.jobRole?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(q)) return false
  }

  if (familyFilter.value !== 'all' && template.family !== familyFilter.value) return false

  switch (statusFilter.value) {
    case 'active':
      return template.isActive
    case 'inactive':
      return !template.isActive
    case 'draft':
      return draftCount(template) > 0
    case 'unpublished':
      return !publishedVersion(template)
    default:
      return true
  }
}

const filteredByFamily = computed(() => {
  const result = {
    PKWT: templates.value.filter(t => t.family === 'PKWT' && matchesFilters(t)),
    MITRA: templates.value.filter(t => t.family === 'MITRA' && matchesFilters(t))
  }

  const byUsage = (a: ContractTemplate, b: ContractTemplate) =>
    usageCount(b) - usageCount(a)
  const byName = (a: ContractTemplate, b: ContractTemplate) =>
    a.name.localeCompare(b.name, 'id')
  const byPublished = (a: ContractTemplate, b: ContractTemplate) =>
    (publishedVersion(b)?.publishedAt ?? '').localeCompare(publishedVersion(a)?.publishedAt ?? '')

  for (const key of ['PKWT', 'MITRA'] as const) {
    if (sortBy.value === 'name') result[key].sort(byName)
    else if (sortBy.value === 'usage') result[key].sort(byUsage || byName)
    else if (sortBy.value === 'published') result[key].sort(byPublished || byName)
  }

  return result
})

const totalCount = computed(() => templates.value.length)
const resultCount = computed(() => filteredByFamily.value.PKWT.length + filteredByFamily.value.MITRA.length)
const hasFilter = computed(() =>
  search.value.trim().length > 0 || statusFilter.value !== 'all' || familyFilter.value !== 'all'
)

// Untuk pesan "tidak ada yang cocok" di dalam satu keluarga: filter keluarga
// TIDAK dihitung, karena memilih keluarga bukan penyebab satu keluarga kosong —
// kalau keluarga itu memang belum punya template, pesannya harus "Belum ada".
const hasNarrowingFilter = computed(() =>
  search.value.trim().length > 0 || statusFilter.value !== 'all'
)

function resetFilters() {
  search.value = ''
  statusFilter.value = 'all'
  familyFilter.value = 'all'
}

function clearSearch() {
  search.value = ''
}

const statusFilterOptions = [
  { label: 'Semua status', value: 'all' },
  { label: 'Aktif', value: 'active' },
  { label: 'Nonaktif', value: 'inactive' },
  { label: 'Punya draft', value: 'draft' },
  { label: 'Belum diterbitkan', value: 'unpublished' }
]

const familyFilterOptions = [
  { label: 'Semua keluarga', value: 'all' },
  { label: 'PKWT', value: 'PKWT' },
  { label: 'MITRA', value: 'MITRA' }
]

const sortOptions = [
  { label: 'Urutkan: Keluarga', value: 'family' },
  { label: 'Urutkan: Nama (A–Z)', value: 'name' },
  { label: 'Urutkan: Paling banyak dipakai', value: 'usage' },
  { label: 'Urutkan: Terbaru diterbitkan', value: 'published' }
]

// --- Grouping & family config ---
const familyConfig = {
  PKWT: {
    label: 'PKWT',
    fullName: 'Kesepakatan Kerja Waktu Tertentu',
    icon: 'i-lucide-file-check',
    ringClass: 'bg-primary/10 text-primary',
    borderClass: 'border-l-primary'
  },
  MITRA: {
    label: 'MITRA',
    fullName: 'Perjanjian Kemitraan',
    icon: 'i-lucide-handshake',
    ringClass: 'bg-warning/10 text-warning',
    borderClass: 'border-l-warning'
  }
} as const

const familyKeys = ['PKWT', 'MITRA'] as const

// Saat filter keluarga aktif, hanya section keluarga itu yang dirender —
// section lain tidak perlu tampil kosong dan membingungkan.
const visibleFamilyKeys = computed(() =>
  familyFilter.value === 'all'
    ? [...familyKeys]
    : familyKeys.filter(key => key === familyFilter.value)
)

// --- Row actions ---
// Hapus dinonaktifkan (bukan disembunyikan) saat template masih dipakai, agar
// admin paham alasannya. Backend juga menolak (`remove()` → BadRequest), jadi
// ini hanya lapisan UX, bukan satu-satunya penjaga.
function moreActions(template: ContractTemplate) {
  const used = usageCount(template)
  const actions: { label: string, icon: string, onSelect?: () => void, disabled?: boolean }[][] = [
    [
      { label: 'Edit detail template', icon: 'i-lucide-pencil', onSelect: () => openEdit(template) },
      { label: 'Duplikat template', icon: 'i-lucide-copy', onSelect: () => openDuplicate(template) }
    ],
    [
      {
        label: template.isActive ? 'Nonaktifkan template' : 'Aktifkan template',
        icon: template.isActive ? 'i-lucide-power' : 'i-lucide-circle-check',
        onSelect: () => toggleActive(template),
        disabled: !auth.canManageMasterData
      }
    ],
    [
      {
        label: used > 0
          ? `Dipakai ${used} kontrak — tidak dapat dihapus`
          : 'Hapus template',
        icon: 'i-lucide-trash-2',
        disabled: used > 0 || !auth.canManageMasterData,
        onSelect: () => removeTemplate(template.id, template.name)
      }
    ]
  ]
  return actions
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
          <UButton
            v-if="auth.canManageMasterData"
            label="Tambah Template"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <!-- Info bar (dapat dilipat; preferensi tersimpan di localStorage) -->
        <div class="overflow-hidden rounded-xl border border-info/20 bg-info/5">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left"
            :aria-expanded="showInfo"
            aria-controls="contract-templates-info"
            @click="showInfo = !showInfo"
          >
            <UIcon name="i-lucide-info" class="size-4 shrink-0 text-info" />
            <span class="flex-1 text-sm font-medium text-highlighted">Tentang template kontrak</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 text-muted transition-transform duration-200"
              :class="showInfo ? 'rotate-180' : ''"
            />
          </button>
          <div v-show="showInfo" id="contract-templates-info" class="px-4 pb-3 pl-11">
            <p class="text-sm text-muted">
              Template kontrak menentukan <strong class="text-highlighted">format dan konten dokumen PDF</strong> yang digenerate saat membuat kontrak karyawan.
              Setiap template terikat pada satu <strong class="text-highlighted">Template Key</strong> yang menentukan struktur pasal dan role karyawan.
            </p>
          </div>
        </div>

        <!-- Empty state: belum ada template sama sekali -->
        <div v-if="templates.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
          <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-elevated">
            <UIcon name="i-lucide-file-x" class="size-7 text-muted" />
          </div>
          <p class="text-base font-medium text-highlighted">
            Belum ada template kontrak
          </p>
          <p class="mt-1 mb-5 max-w-md text-sm text-muted">
            Template bawaan aplikasi dibuat otomatis saat halaman ini dimuat. Jika tetap kosong, tambahkan template pertama secara manual.
          </p>
          <UButton
            v-if="auth.canManageMasterData"
            label="Tambah Template Pertama"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate"
          />
        </div>

        <template v-else>
          <!-- Toolbar: pencarian + status + urutan -->
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Cari nama, kode, template key, atau jabatan…"
              class="w-full lg:max-w-sm"
              :ui="{ trailing: 'pe-1' }"
            >
              <template v-if="search" #trailing>
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Bersihkan pencarian"
                  @click="clearSearch"
                />
              </template>
            </UInput>

            <div class="flex flex-wrap items-center gap-3 lg:ml-auto">
              <USelectMenu
                v-model="statusFilter"
                :items="statusFilterOptions"
                value-key="value"
                icon="i-lucide-filter"
                class="w-full sm:w-44"
              />
              <USelectMenu
                v-model="familyFilter"
                :items="familyFilterOptions"
                value-key="value"
                icon="i-lucide-folder-tree"
                class="w-full sm:w-44"
              />
              <USelectMenu
                v-model="sortBy"
                :items="sortOptions"
                value-key="value"
                class="w-full sm:w-52"
              />
            </div>
          </div>

          <!-- Ringkasan hasil filter -->
          <div v-if="hasFilter" class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              Menampilkan <span class="font-medium text-highlighted">{{ resultCount }}</span>
              dari {{ totalCount }} template
            </span>
            <UButton
              label="Reset filter"
              icon="i-lucide-undo-2"
              color="neutral"
              variant="link"
              size="xs"
              :padded="false"
              @click="resetFilters"
            />
          </div>

          <!-- Family sections -->
          <div v-for="familyKey in visibleFamilyKeys" :key="familyKey" class="space-y-4">
            <!-- Section header -->
            <div class="flex items-center gap-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                :class="familyConfig[familyKey].ringClass"
              >
                <UIcon :name="familyConfig[familyKey].icon" class="size-5" />
              </div>
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <h2 class="font-semibold text-highlighted">
                  {{ familyConfig[familyKey].label }}
                </h2>
                <span class="hidden text-sm text-muted sm:inline">— {{ familyConfig[familyKey].fullName }}</span>
                <UBadge color="neutral" variant="subtle" size="xs">
                  {{ filteredByFamily[familyKey].length }} template
                </UBadge>
              </div>
              <div class="hidden h-px flex-1 bg-border sm:block" />
            </div>

            <!-- Empty family state -->
            <div
              v-if="filteredByFamily[familyKey].length === 0"
              class="rounded-xl border border-dashed border-default bg-elevated/30 px-6 py-10 text-center"
            >
              <template v-if="hasNarrowingFilter">
                <UIcon name="i-lucide-search-x" class="mx-auto mb-2 size-8 text-muted" />
                <p class="text-sm font-medium text-highlighted">
                  Tidak ada template {{ familyConfig[familyKey].label }} yang cocok
                </p>
                <p class="mt-1 text-sm text-muted">
                  Coba ubah kata kunci atau reset filter.
                </p>
                <UButton
                  label="Reset filter"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="mt-4"
                  @click="resetFilters"
                />
              </template>
              <template v-else>
                <UIcon name="i-lucide-file-plus" class="mx-auto mb-2 size-8 text-muted" />
                <p class="text-sm font-medium text-highlighted">
                  Belum ada template {{ familyConfig[familyKey].label }}
                </p>
                <p class="mt-1 text-sm text-muted">
                  Template bawaan keluarga {{ familyConfig[familyKey].label }} dibuat otomatis saat halaman dimuat.
                </p>
                <UButton
                  v-if="auth.canManageMasterData"
                  :label="`Tambah Template ${familyConfig[familyKey].label}`"
                  icon="i-lucide-plus"
                  color="primary"
                  variant="subtle"
                  size="sm"
                  class="mt-4"
                  @click="openCreate"
                />
              </template>
            </div>

            <!-- Cards grid -->
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="template in filteredByFamily[familyKey]"
                :key="template.id"
                class="flex flex-col overflow-hidden rounded-xl border border-l-4 border-default bg-default transition-shadow hover:shadow-md"
                :class="[
                  template.isActive ? familyConfig[familyKey].borderClass : 'border-l-accented',
                  template.isActive ? '' : 'opacity-75'
                ]"
              >
                <!-- Card header -->
                <div class="px-5 pt-5 pb-3">
                  <div class="mb-1 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-semibold text-highlighted">
                        {{ template.name }}
                      </p>
                      <p class="mt-0.5 truncate font-mono text-xs text-muted">
                        {{ template.code }}
                      </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-1">
                      <UBadge
                        v-if="publishedVersion(template)"
                        color="info"
                        variant="subtle"
                        size="xs"
                      >
                        v{{ publishedVersion(template)!.versionNumber }}
                      </UBadge>
                      <UBadge
                        v-if="draftCount(template) > 0"
                        color="warning"
                        variant="subtle"
                        size="xs"
                      >
                        Draf
                      </UBadge>
                      <UBadge
                        v-if="!template.isActive"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                      >
                        Nonaktif
                      </UBadge>
                      <UDropdownMenu v-if="auth.canManageMasterData" :items="moreActions(template)">
                        <UButton
                          icon="i-lucide-ellipsis-vertical"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          :aria-label="`Aksi lain untuk ${template.name}`"
                        />
                      </UDropdownMenu>
                    </div>
                  </div>

                  <!-- Status penerbitan -->
                  <p class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    <template v-if="publishedVersion(template)">
                      <UIcon name="i-lucide-circle-check" class="size-3.5 text-success" />
                      <span class="text-muted">
                        Diterbitkan {{ formatDate(publishedVersion(template)!.publishedAt) }}
                      </span>
                    </template>
                    <template v-else>
                      <UIcon name="i-lucide-triangle-alert" class="size-3.5 text-warning" />
                      <span class="text-muted">Belum ada versi yang diterbitkan</span>
                    </template>
                  </p>

                  <!-- Metadata: Jabatan lebih sering dicari, jadi ditampilkan lebih dulu -->
                  <div class="mt-3 grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p class="mb-0.5 text-xs font-semibold tracking-wide text-muted">
                        Jabatan
                      </p>
                      <p class="text-sm text-highlighted">
                        {{ template.jobRole?.name ?? '—' }}
                      </p>
                    </div>
                    <div>
                      <p class="mb-0.5 text-xs font-semibold tracking-wide text-muted">
                        Jumlah Kontrak
                      </p>
                      <p class="text-sm text-highlighted">
                        <span class="font-semibold tabular-nums">{{ usageCount(template) }}</span>
                        <span class="text-muted"> kontrak</span>
                      </p>
                    </div>
                    <div v-if="template.contractType" class="col-span-2">
                      <p class="mb-0.5 text-xs font-semibold tracking-wide text-muted">
                        Tipe Kontrak
                      </p>
                      <p class="text-sm text-highlighted">
                        {{ template.contractType.name }}
                      </p>
                    </div>
                    <div v-if="template.description" class="col-span-2">
                      <p class="line-clamp-2 text-xs text-muted italic">
                        {{ template.description }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Actions footer (selalu di dasar kartu agar tinggi kartu sejajar) -->
                <div class="mt-auto border-t border-default bg-elevated/30 px-4 py-3">
                  <UButton
                    label="Kelola Konten Template"
                    icon="i-lucide-file-pen-line"
                    color="primary"
                    variant="subtle"
                    class="w-full"
                    @click="openContentEditor(template)"
                  />
                  <p class="mt-2 text-center text-xs text-muted">
                    Kelola versi, sunting pasal, lalu terbitkan
                  </p>
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
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
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
          <UFormField
            label="Template Key"
            name="templateKey"
            required
            hint="Menentukan konten dokumen PDF yang digenerate"
          >
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
            <USelect
              v-model="state.contractTypeId"
              :items="contractTypeOptions"
              placeholder="Opsional"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jabatan" name="jobRoleId">
            <USelect
              v-model="state.jobRoleId"
              :items="jobRoleOptions"
              placeholder="Opsional"
              class="w-full"
            />
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
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="formOpen = false"
          />
          <UButton
            type="submit"
            label="Simpan"
            color="primary"
            :loading="saving"
          />
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
