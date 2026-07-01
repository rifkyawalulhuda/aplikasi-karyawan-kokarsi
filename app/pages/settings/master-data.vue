<script setup lang="ts">
interface LookupItem { id: number; name: string }

interface LookupsResponse {
  workLocations: LookupItem[]
  jobRoles: LookupItem[]
  jobLevels: LookupItem[]
  taxStatus: LookupItem[]
  contractTypes: LookupItem[]
}

const workLocations = ref<LookupItem[]>([])
const jobRoles = ref<LookupItem[]>([])
const jobLevels = ref<LookupItem[]>([])
const taxStatuses = ref<LookupItem[]>([])
const contractTypes = ref<LookupItem[]>([])

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()

// ── Generic CRUD state ──────────────────────────────────────────────
type ResourceKey = 'work-locations' | 'job-roles' | 'job-levels' | 'tax-status' | 'contract-types'

interface EditState {
  open: boolean
  id: number | null
  name: string
  loading: boolean
}

const editState = reactive<EditState>({ open: false, id: null, name: '', loading: false })
const addName = ref('')
const addOpen = ref(false)
const addLoading = ref(false)
const activeTab = ref<ResourceKey>('work-locations')
const searchQuery = ref('')
const deleteLoading = ref<number | null>(null)

const resourceLabelMap: Record<ResourceKey, string> = {
  'work-locations': 'Lokasi Kerja',
  'job-roles': 'Jabatan',
  'job-levels': 'Level Jabatan',
  'tax-status': 'Status Pajak',
  'contract-types': 'Tipe Kontrak',
}

const resourceIconMap: Record<ResourceKey, string> = {
  'work-locations': 'i-lucide-map-pin',
  'job-roles': 'i-lucide-briefcase',
  'job-levels': 'i-lucide-layers',
  'tax-status': 'i-lucide-receipt',
  'contract-types': 'i-lucide-file-text',
}

const resourceDescMap: Record<ResourceKey, string> = {
  'work-locations': 'Daftar lokasi kerja karyawan',
  'job-roles': 'Daftar jabatan karyawan',
  'job-levels': 'Daftar level jabatan karyawan',
  'tax-status': 'Daftar status pajak karyawan',
  'contract-types': 'Daftar tipe kontrak kerja',
}

const tabs = computed(() => [
  { key: 'work-locations' as ResourceKey, label: 'Lokasi Kerja', icon: 'i-lucide-map-pin', count: workLocations.value.length },
  { key: 'job-roles' as ResourceKey, label: 'Jabatan', icon: 'i-lucide-briefcase', count: jobRoles.value.length },
  { key: 'job-levels' as ResourceKey, label: 'Level Jabatan', icon: 'i-lucide-layers', count: jobLevels.value.length },
  { key: 'tax-status' as ResourceKey, label: 'Status Pajak', icon: 'i-lucide-receipt', count: taxStatuses.value.length },
  { key: 'contract-types' as ResourceKey, label: 'Tipe Kontrak', icon: 'i-lucide-file-text', count: contractTypes.value.length },
])

const currentItems = computed<LookupItem[]>(() => {
  let items: LookupItem[] = []
  if (activeTab.value === 'work-locations') items = workLocations.value
  else if (activeTab.value === 'job-roles') items = jobRoles.value
  else if (activeTab.value === 'job-levels') items = jobLevels.value
  else if (activeTab.value === 'tax-status') items = taxStatuses.value
  else if (activeTab.value === 'contract-types') items = contractTypes.value

  if (!searchQuery.value) return items
  return items.filter(i => i.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const totalCount = computed(() =>
  workLocations.value.length + jobRoles.value.length + jobLevels.value.length + taxStatuses.value.length + contractTypes.value.length
)

async function loadAllLookups() {
  const data = await $fetch<LookupsResponse>('/api/lookups')
  workLocations.value = data.workLocations ?? []
  jobRoles.value = data.jobRoles ?? []
  jobLevels.value = data.jobLevels ?? []
  taxStatuses.value = data.taxStatus ?? []
  contractTypes.value = data.contractTypes ?? []
}

async function loadResource(resource: ResourceKey) {
  if (resource === 'work-locations') workLocations.value = await $fetch<LookupItem[]>('/api/lookups/work-locations')
  else if (resource === 'job-roles') jobRoles.value = await $fetch<LookupItem[]>('/api/lookups/job-roles')
  else if (resource === 'job-levels') jobLevels.value = await $fetch<LookupItem[]>('/api/lookups/job-levels')
  else if (resource === 'tax-status') taxStatuses.value = await $fetch<LookupItem[]>('/api/lookups/tax-status')
  else if (resource === 'contract-types') contractTypes.value = await $fetch<LookupItem[]>('/api/lookups/contract-types')
}

onMounted(async () => {
  try {
    await loadAllLookups()
  } catch (error) {
    console.error('Gagal memuat master data', error)
  }
})

function openEdit(item: LookupItem) {
  editState.id = item.id
  editState.name = item.name
  editState.open = true
}

async function saveEdit() {
  if (!editState.id) return
  editState.loading = true
  try {
    await $fetch(`/api/lookups/${activeTab.value}/${editState.id}`, {
      method: 'PUT',
      body: { name: editState.name },
    })
    toast.add({ title: 'Berhasil diperbarui', color: 'success' })
    editState.open = false
    await loadResource(activeTab.value)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    editState.loading = false
  }
}

async function doAdd() {
  if (!addName.value.trim()) return
  addLoading.value = true
  try {
    await $fetch(`/api/lookups/${activeTab.value}`, {
      method: 'POST',
      body: { name: addName.value.trim() },
    })
    toast.add({ title: 'Berhasil ditambahkan', color: 'success' })
    addName.value = ''
    addOpen.value = false
    await loadResource(activeTab.value)
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    addLoading.value = false
  }
}

async function doDelete(id: number) {
  confirmDeleteToast({
    title: 'Hapus data master?',
    description: `Data ${resourceLabelMap[activeTab.value]} ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Data',
    onConfirm: () => deleteLookup(id),
  })
}

async function deleteLookup(id: number) {
  deleteLoading.value = id
  try {
    await $fetch(`/api/lookups/${activeTab.value}/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Berhasil dihapus', color: 'success' })
    await loadResource(activeTab.value)
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = null
  }
}

function onTabChange(key: ResourceKey) {
  activeTab.value = key
  searchQuery.value = ''
  addOpen.value = false
}
</script>

<template>
  <UDashboardPanel id="settings-master-data">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah Data"
            icon="i-lucide-plus"
            color="primary"
            variant="solid"
            size="sm"
            @click="addOpen = !addOpen"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 sm:p-6 lg:p-8">
        <!-- Page description -->
        <div class="mb-6 max-w-3xl">
          <p class="text-sm text-muted leading-6">
            Kelola data referensi untuk lokasi kerja, jabatan, level jabatan, status pajak, dan tipe kontrak.
            Data ini dipakai di form karyawan dan kontrak.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UBadge variant="subtle" color="neutral" size="sm">
              <UIcon name="i-lucide-database" class="size-3 mr-1" />
              {{ totalCount }} total data
            </UBadge>
            <UBadge variant="subtle" color="primary" size="sm">
              <UIcon name="i-lucide-layout-grid" class="size-3 mr-1" />
              {{ tabs.length }} kategori
            </UBadge>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-6 border-b border-default">
          <div class="flex flex-wrap gap-1 -mb-px">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-highlighted hover:bg-elevated/50'"
              @click="onTabChange(tab.key)"
            >
              <UIcon :name="tab.icon" class="size-4" />
              <span>{{ tab.label }}</span>
              <span
                class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                :class="activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'bg-elevated text-muted'"
              >{{ tab.count }}</span>
            </button>
          </div>
        </div>

        <!-- Content area -->
        <div class="max-w-3xl">
          <!-- Toolbar: search + add -->
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <div class="relative flex-1 min-w-[200px]">
              <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              <UInput
                v-model="searchQuery"
                :placeholder="`Cari ${resourceLabelMap[activeTab]}...`"
                size="sm"
                class="w-full"
                :ui="{ base: 'pl-9' }"
              />
            </div>
            <UButton
              v-if="!addOpen"
              label="Tambah"
              icon="i-lucide-plus"
              size="sm"
              color="primary"
              variant="subtle"
              @click="addOpen = true"
            />
          </div>

          <!-- Inline add form -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="addOpen"
              class="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
            >
              <div class="flex items-center gap-2 mb-3">
                <UIcon :name="resourceIconMap[activeTab]" class="size-4 text-primary" />
                <span class="text-sm font-medium text-highlighted">
                  Tambah {{ resourceLabelMap[activeTab] }}
                </span>
              </div>
              <div class="flex gap-2">
                <UInput
                  v-model="addName"
                  :placeholder="`Nama ${resourceLabelMap[activeTab]}...`"
                  size="sm"
                  class="flex-1"
                  @keyup.enter="doAdd()"
                />
                <UButton
                  label="Simpan"
                  size="sm"
                  color="primary"
                  :loading="addLoading"
                  @click="doAdd()"
                />
                <UButton
                  icon="i-lucide-x"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  @click="addOpen = false; addName = ''"
                />
              </div>
            </div>
          </Transition>

          <!-- List -->
          <UCard :ui="{ body: 'p-0', header: 'p-0' }">
            <!-- List header -->
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-default bg-elevated/30">
              <span class="text-xs font-medium uppercase tracking-wider text-muted">
                {{ resourceDescMap[activeTab] }}
              </span>
              <span class="text-xs text-muted tabular-nums">
                {{ currentItems.length }} dari {{ tabs.find(t => t.key === activeTab)?.count ?? 0 }}
              </span>
            </div>

            <!-- Empty state -->
            <div
              v-if="currentItems.length === 0"
              class="flex flex-col items-center justify-center py-12 px-4 text-center"
            >
              <div class="flex size-12 items-center justify-center rounded-full bg-elevated mb-3">
                <UIcon :name="resourceIconMap[activeTab]" class="size-5 text-muted" />
              </div>
              <p class="text-sm font-medium text-highlighted">
                {{ searchQuery ? 'Tidak ditemukan' : 'Belum ada data' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{ searchQuery ? `Tidak ada ${resourceLabelMap[activeTab]} yang cocok dengan "${searchQuery}"` : `Tambahkan ${resourceLabelMap[activeTab]} pertama Anda` }}
              </p>
              <UButton
                v-if="!searchQuery"
                label="Tambah Data"
                icon="i-lucide-plus"
                size="xs"
                color="primary"
                variant="subtle"
                class="mt-4"
                @click="addOpen = true"
              />
            </div>

            <!-- Items list -->
            <ul v-else class="divide-y divide-default">
              <li
                v-for="(item, index) in currentItems"
                :key="item.id"
                class="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-elevated/40 group"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="text-xs font-medium text-dimmed tabular-nums w-6 shrink-0">
                    {{ String(index + 1).padStart(2, '0') }}
                  </span>
                  <span class="text-sm text-highlighted truncate">{{ item.name }}</span>
                </div>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <UButton
                    icon="i-lucide-pencil"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="openEdit(item)"
                  />
                  <UButton
                    icon="i-lucide-trash"
                    size="xs"
                    variant="ghost"
                    color="error"
                    :loading="deleteLoading === item.id"
                    @click="doDelete(item.id)"
                  />
                </div>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Edit -->
  <UModal v-model:open="editState.open" title="Edit Data" :description="`Perbarui ${resourceLabelMap[activeTab]}`">
    <template #body>
      <UFormField label="Nama" required>
        <UInput
          v-model="editState.name"
          class="w-full"
          autofocus
          @keyup.enter="saveEdit"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="subtle" @click="editState.open = false" />
        <UButton label="Simpan" color="primary" :loading="editState.loading" @click="saveEdit" />
      </div>
    </template>
  </UModal>
</template>
