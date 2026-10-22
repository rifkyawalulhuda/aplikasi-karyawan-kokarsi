<script setup lang="ts">
import type { ContractTemplate } from '~/types'

const toast = useToast()
const auth = useAuthStore()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { confirmActionToast } = useConfirmActionToast()

const { data: templatesRes, refresh } = await useFetch<ContractTemplate[]>('/api/contract-templates')

const templates = computed(() => templatesRes.value ?? [])

// --- Form modal ---
const formOpen = ref(false)
const formMode = ref<'create' | 'edit' | 'duplicate'>('create')
const formTemplate = ref<ContractTemplate | null>(null)
const formSource = ref<ContractTemplate | null>(null)

function openCreate() {
  formMode.value = 'create'
  formTemplate.value = null
  formSource.value = null
  formOpen.value = true
}

function openEdit(template: ContractTemplate) {
  formMode.value = 'edit'
  formTemplate.value = template
  formSource.value = null
  formOpen.value = true
}

/**
 * Salinan diambil dari versi PUBLISHED terakhir template sumber (bukan definisi
 * bawaan) lewat `POST /contract-templates/:id/duplicate`.
 */
function openDuplicate(template: ContractTemplate) {
  formMode.value = 'duplicate'
  formTemplate.value = null
  formSource.value = template
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
 * kontrak memakai template ini.
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

async function copyCode(template: ContractTemplate) {
  try {
    await navigator.clipboard.writeText(template.code)
    toast.add({ title: 'Kode template disalin', description: template.code, color: 'success' })
  } catch {
    toast.add({ title: 'Gagal menyalin kode template', color: 'error' })
  }
}

// --- Content editor modal ---
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

async function handleSaved() {
  await refresh()
}

/** Setelah duplikat: segarkan daftar lalu buka editor konten salinan (masih DRAFT). */
async function handleDuplicated(template: ContractTemplate) {
  await refresh()
  openContentEditor(template)
}

// --- Usage/status helpers ---
function usageCount(template: ContractTemplate) {
  return template._count?.contracts ?? 0
}

function publishedVersion(template: ContractTemplate) {
  return template.versions?.[0] ?? null
}

function apiErrorMessage(error: unknown, fallback = 'Terjadi kesalahan') {
  const e = error as { data?: { message?: string }, message?: string }
  return e?.data?.message ?? e?.message ?? fallback
}

// --- Search & filters (client-side; daftar template kecil & sudah di-fetch) ---
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive' | 'unpublished'>('all')
const familyFilter = ref<'all' | 'PKWT' | 'MITRA'>('all')
const sortBy = ref<'family' | 'name' | 'usage' | 'published'>('family')

// Info bar bisa dilipat karena isinya penjelasan statis.
const showInfo = useLocalStorage('contract-templates-info-open', false)

function matchesFilters(template: ContractTemplate) {
  const query = search.value.trim().toLowerCase()
  if (query) {
    const haystack = [template.name, template.code, template.templateKey, template.jobRole?.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(query)) return false
  }

  if (familyFilter.value !== 'all' && template.family !== familyFilter.value) return false

  switch (statusFilter.value) {
    case 'active':
      return template.isActive
    case 'inactive':
      return !template.isActive
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

  const byUsage = (a: ContractTemplate, b: ContractTemplate) => usageCount(b) - usageCount(a)
  const byName = (a: ContractTemplate, b: ContractTemplate) => a.name.localeCompare(b.name, 'id')
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

// Filter keluarga TIDAK dihitung untuk pesan "tidak ada yang cocok" di dalam
// satu keluarga: keluarga kosong berarti "belum ada", bukan "tidak cocok".
const hasNarrowingFilter = computed(() =>
  search.value.trim().length > 0 || statusFilter.value !== 'all'
)

function resetFilters() {
  search.value = ''
  statusFilter.value = 'all'
  familyFilter.value = 'all'
}

// --- Ringkasan ---
const summary = computed(() => {
  const list = templates.value
  const active = list.filter(t => t.isActive).length
  const unpublished = list.filter(t => !publishedVersion(t)).length
  return [
    {
      key: 'total',
      label: 'Total Template',
      value: list.length,
      detail: 'PKWT & MITRA',
      icon: 'i-lucide-layout-template',
      tone: 'text-primary bg-primary/10'
    },
    {
      key: 'active',
      label: 'Aktif',
      value: active,
      detail: 'Muncul di form kontrak',
      icon: 'i-lucide-circle-check',
      tone: 'text-success-700 bg-success/10 dark:text-success-400'
    },
    {
      key: 'inactive',
      label: 'Nonaktif',
      value: list.length - active,
      detail: 'Disembunyikan dari form',
      icon: 'i-lucide-power-off',
      tone: 'text-muted bg-elevated'
    },
    {
      key: 'unpublished',
      label: 'Belum Terbit',
      value: unpublished,
      detail: 'Tidak bisa dipakai kontrak',
      icon: 'i-lucide-triangle-alert',
      tone: 'text-warning-700 bg-warning/10 dark:text-warning-400'
    }
  ]
})

const statusChips = computed(() => [
  { label: 'Semua', value: 'all' as const, count: totalCount.value },
  { label: 'Aktif', value: 'active' as const, count: templates.value.filter(t => t.isActive).length },
  { label: 'Nonaktif', value: 'inactive' as const, count: templates.value.filter(t => !t.isActive).length },
  { label: 'Belum terbit', value: 'unpublished' as const, count: templates.value.filter(t => !publishedVersion(t)).length }
])

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
    ringClass: 'bg-primary/10 text-primary'
  },
  MITRA: {
    label: 'MITRA',
    fullName: 'Perjanjian Kemitraan',
    icon: 'i-lucide-handshake',
    ringClass: 'bg-warning/10 text-warning'
  }
} as const

const familyKeys = ['PKWT', 'MITRA'] as const

const visibleFamilyKeys = computed(() =>
  familyFilter.value === 'all'
    ? [...familyKeys]
    : familyKeys.filter(key => key === familyFilter.value)
)

// --- Row actions ---
// Hapus dinonaktifkan (bukan disembunyikan) saat template masih dipakai, agar
// admin paham alasannya. Backend juga menolak, jadi ini hanya lapisan UX.
function moreActions(template: ContractTemplate) {
  const used = usageCount(template)
  const hasPublished = !!publishedVersion(template)
  const actions: { label: string, icon: string, onSelect?: () => void, disabled?: boolean }[][] = [
    [
      { label: 'Kelola konten template', icon: 'i-lucide-file-pen-line', onSelect: () => openContentEditor(template) },
      { label: 'Edit detail template', icon: 'i-lucide-pencil', onSelect: () => openEdit(template) }
    ],
    [
      {
        label: hasPublished
          ? 'Duplikat template'
          : 'Duplikat template — belum ada versi terbit',
        icon: 'i-lucide-copy',
        disabled: !hasPublished || !auth.canManageMasterData,
        onSelect: () => openDuplicate(template)
      },
      { label: 'Salin kode template', icon: 'i-lucide-clipboard-copy', onSelect: () => copyCode(template) }
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

// --- Context menu (klik kanan kartu) ---
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<ContractTemplate | null>(null)

async function openContextMenu(event: MouseEvent, template: ContractTemplate) {
  event.preventDefault()
  contextMenuTarget.value = template
  contextMenu.value = true
  await nextTick()
  const menu = document.querySelector('[data-template-context-menu]') as HTMLElement | null
  const width = menu?.offsetWidth ?? 240
  const height = menu?.offsetHeight ?? 220
  contextMenuX.value = Math.min(event.clientX, window.innerWidth - width - 8)
  contextMenuY.value = Math.min(event.clientY, window.innerHeight - height - 8)
}

function closeContextMenu() {
  contextMenu.value = false
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
      <div class="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <!-- Ringkasan -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(item, index) in summary"
            :key="item.key"
            class="dossier-rise rounded-xl border border-default bg-default p-4"
            :style="{ animationDelay: `${index * 40}ms` }"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  {{ item.label }}
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted tabular-nums">
                  {{ item.value }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  {{ item.detail }}
                </p>
              </div>
              <span class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="item.tone">
                <UIcon :name="item.icon" class="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>

        <!-- Info bar (dapat dilipat) -->
        <div class="overflow-hidden rounded-xl border border-info/25 bg-info/5">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left"
            :aria-expanded="showInfo"
            aria-controls="contract-templates-info"
            @click="showInfo = !showInfo"
          >
            <UIcon name="i-lucide-info" class="size-4 shrink-0 text-info" aria-hidden="true" />
            <span class="flex-1 text-sm font-medium text-highlighted">Tentang template kontrak</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 text-muted transition-transform duration-200"
              :class="showInfo ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>
          <div v-show="showInfo" id="contract-templates-info" class="px-4 pb-3 ps-11">
            <p class="text-sm leading-relaxed text-muted">
              Template kontrak menentukan <strong class="text-highlighted">format dan konten dokumen PDF</strong> yang digenerate saat membuat kontrak karyawan.
              Setiap template terikat pada satu <strong class="text-highlighted">template key</strong> yang menentukan struktur pasal dan role karyawan.
              Template tanpa versi terbit tidak dapat dipakai membuat kontrak.
            </p>
          </div>
        </div>

        <!-- Empty state global -->
        <div v-if="templates.length === 0" class="flex flex-col items-center justify-center rounded-xl border border-dashed border-default py-16 text-center">
          <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-elevated text-muted">
            <UIcon name="i-lucide-file-x" class="size-6" aria-hidden="true" />
          </span>
          <p class="text-base font-medium text-highlighted">
            Belum ada template kontrak
          </p>
          <p class="mb-5 mt-1 max-w-md text-sm text-muted">
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
          <!-- Toolbar -->
          <div class="space-y-3 rounded-xl border border-default bg-default p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                placeholder="Cari nama, kode, template key, atau jabatan…"
                class="w-full lg:max-w-sm"
                aria-label="Cari template"
                :ui="{ trailing: 'pe-1' }"
              >
                <template v-if="search" #trailing>
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    square
                    class="size-6"
                    aria-label="Bersihkan pencarian"
                    @click="search = ''"
                  />
                </template>
              </UInput>

              <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
                <USelect
                  v-model="familyFilter"
                  :items="familyFilterOptions"
                  value-key="value"
                  icon="i-lucide-folder-tree"
                  class="w-full sm:w-44"
                  aria-label="Filter keluarga template"
                />
                <USelect
                  v-model="sortBy"
                  :items="sortOptions"
                  value-key="value"
                  icon="i-lucide-arrow-up-down"
                  class="w-full sm:w-56"
                  aria-label="Urutkan template"
                />
                <UButton
                  v-if="hasFilter"
                  label="Reset"
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="resetFilters"
                />
              </div>
            </div>

            <!-- Chip status -->
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="chip in statusChips"
                :key="chip.value"
                type="button"
                class="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                :class="statusFilter === chip.value
                  ? 'border-primary/40 bg-primary/10 text-primary-700 dark:text-primary-300'
                  : 'border-default bg-elevated/30 text-muted hover:border-primary/30 hover:text-highlighted'"
                :aria-pressed="statusFilter === chip.value"
                @click="statusFilter = chip.value"
              >
                {{ chip.label }}
                <span class="tabular-nums opacity-70">{{ chip.count }}</span>
              </button>

              <span v-if="hasFilter" class="ms-auto text-xs text-muted">
                Menampilkan <span class="font-medium text-highlighted">{{ resultCount }}</span>
                dari {{ totalCount }} template
              </span>
            </div>
          </div>

          <!-- Family sections -->
          <div v-for="familyKey in visibleFamilyKeys" :key="familyKey" class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-lg" :class="familyConfig[familyKey].ringClass">
                <UIcon :name="familyConfig[familyKey].icon" class="size-5" aria-hidden="true" />
              </div>
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <h2 class="font-semibold text-highlighted">
                  {{ familyConfig[familyKey].label }}
                </h2>
                <span class="hidden text-sm text-muted sm:inline">— {{ familyConfig[familyKey].fullName }}</span>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  class="tabular-nums"
                >
                  {{ filteredByFamily[familyKey].length }} template
                </UBadge>
              </div>
            </div>

            <!-- Empty family state -->
            <div
              v-if="filteredByFamily[familyKey].length === 0"
              class="rounded-xl border border-dashed border-default bg-elevated/30 px-6 py-10 text-center"
            >
              <template v-if="hasNarrowingFilter">
                <UIcon name="i-lucide-search-x" class="mx-auto mb-2 size-7 text-muted" aria-hidden="true" />
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
                <UIcon name="i-lucide-file-plus" class="mx-auto mb-2 size-7 text-muted" aria-hidden="true" />
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

            <!-- Cards -->
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KontrakTemplateCard
                v-for="(template, index) in filteredByFamily[familyKey]"
                :key="template.id"
                :template="template"
                :actions="moreActions(template)"
                :can-manage="auth.canManageMasterData"
                :style="{ animationDelay: `${Math.min(index, 6) * 30}ms` }"
                @manage="openContentEditor(template)"
                @toggle="(value: boolean) => value ? setTemplateActive(template, true) : toggleActive(template)"
                @copy="copyCode(template)"
                @contextmenu="(event: MouseEvent) => openContextMenu(event, template)"
              />
            </div>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>

  <KontrakTemplateFormModal
    v-model:open="formOpen"
    :mode="formMode"
    :template="formTemplate"
    :source="formSource"
    @saved="handleSaved"
    @duplicated="handleDuplicated"
  />

  <KontrakTemplateContentModal
    v-model:open="contentModalOpen"
    :template="contentModalTemplate"
    @saved="refresh()"
  />

  <!-- Menu kontekstual kartu -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="fixed inset-0 z-50"
      @click="closeContextMenu"
      @contextmenu.prevent="closeContextMenu"
    >
      <div
        data-template-context-menu
        class="absolute z-50 min-w-56 overflow-hidden rounded-xl border border-default bg-default py-1 shadow-xl"
        :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="openContentEditor(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-file-pen-line" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Kelola konten template
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="openEdit(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-pencil" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Edit detail template
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="copyCode(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-clipboard-copy" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Salin kode template
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="contextMenuTarget ? !publishedVersion(contextMenuTarget) : true"
          @click="contextMenuTarget && publishedVersion(contextMenuTarget) && (openDuplicate(contextMenuTarget), closeContextMenu())"
        >
          <UIcon name="i-lucide-copy" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          Duplikat template
        </button>

        <hr class="my-1 border-default">

        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted transition-colors hover:bg-elevated/60"
          @click="contextMenuTarget && toggleActive(contextMenuTarget), closeContextMenu()"
        >
          <UIcon
            :name="contextMenuTarget?.isActive ? 'i-lucide-power' : 'i-lucide-circle-check'"
            class="size-4 shrink-0 text-muted"
            aria-hidden="true"
          />
          {{ contextMenuTarget?.isActive ? 'Nonaktifkan template' : 'Aktifkan template' }}
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          :class="contextMenuTarget && usageCount(contextMenuTarget) === 0 ? 'text-error hover:bg-error/10' : 'text-muted'"
          :disabled="contextMenuTarget ? usageCount(contextMenuTarget) > 0 : true"
          @click="contextMenuTarget && usageCount(contextMenuTarget) === 0 && (removeTemplate(contextMenuTarget.id, contextMenuTarget.name), closeContextMenu())"
        >
          <UIcon name="i-lucide-trash-2" class="size-4 shrink-0" aria-hidden="true" />
          {{ contextMenuTarget && usageCount(contextMenuTarget) > 0
            ? `Dipakai ${usageCount(contextMenuTarget)} kontrak`
            : 'Hapus template' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
