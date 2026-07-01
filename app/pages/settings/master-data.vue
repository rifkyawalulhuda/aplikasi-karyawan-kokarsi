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

interface AddState {
  open: boolean
  name: string
  loading: boolean
}

const editState = reactive<EditState>({ open: false, id: null, name: '', loading: false })
const addState = reactive<Record<ResourceKey, AddState>>({
  'work-locations': { open: false, name: '', loading: false },
  'job-roles': { open: false, name: '', loading: false },
  'job-levels': { open: false, name: '', loading: false },
  'tax-status': { open: false, name: '', loading: false },
  'contract-types': { open: false, name: '', loading: false },
})
const editResource = ref<ResourceKey>('work-locations')
const deleteLoading = ref<number | null>(null)

async function loadAllLookups() {
  const data = await $fetch<LookupsResponse>('/api/lookups')
  workLocations.value = data.workLocations ?? []
  jobRoles.value = data.jobRoles ?? []
  jobLevels.value = data.jobLevels ?? []
  taxStatuses.value = data.taxStatus ?? []
  contractTypes.value = data.contractTypes ?? []
}

async function loadResource(resource: ResourceKey) {
  if (resource === 'work-locations') {
    workLocations.value = await $fetch<LookupItem[]>('/api/lookups/work-locations')
  } else if (resource === 'job-roles') {
    jobRoles.value = await $fetch<LookupItem[]>('/api/lookups/job-roles')
  } else if (resource === 'job-levels') {
    jobLevels.value = await $fetch<LookupItem[]>('/api/lookups/job-levels')
  } else if (resource === 'tax-status') {
    taxStatuses.value = await $fetch<LookupItem[]>('/api/lookups/tax-status')
  } else if (resource === 'contract-types') {
    contractTypes.value = await $fetch<LookupItem[]>('/api/lookups/contract-types')
  }
}

onMounted(async () => {
  try {
    await loadAllLookups()
  } catch (error) {
    console.error('Gagal memuat master data', error)
  }
})

function openEdit(resource: ResourceKey, item: LookupItem) {
  editResource.value = resource
  editState.id = item.id
  editState.name = item.name
  editState.open = true
}

async function saveEdit() {
  if (!editState.id) return
  editState.loading = true
  try {
    await $fetch(`/api/lookups/${editResource.value}/${editState.id}`, {
      method: 'PUT',
      body: { name: editState.name },
    })
    toast.add({ title: 'Berhasil diperbarui', color: 'success' })
    editState.open = false
    await loadResource(editResource.value)
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    editState.loading = false
  }
}

async function doAdd(resource: ResourceKey) {
  const s = addState[resource]
  if (!s.name.trim()) return
  s.loading = true
  try {
    await $fetch(`/api/lookups/${resource}`, {
      method: 'POST',
      body: { name: s.name.trim() },
    })
    toast.add({ title: 'Berhasil ditambahkan', color: 'success' })
    s.name = ''
    s.open = false
    await loadResource(resource)
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    s.loading = false
  }
}

async function doDelete(resource: ResourceKey, id: number) {
  confirmDeleteToast({
    title: 'Hapus data master?',
    description: `Data ${resourceLabelMap[resource]} ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Data',
    onConfirm: () => deleteLookup(resource, id),
  })
}

const resourceLabelMap: Record<ResourceKey, string> = {
  'work-locations': 'Lokasi Kerja',
  'job-roles': 'Jabatan',
  'job-levels': 'Level Jabatan',
  'tax-status': 'Status Pajak',
  'contract-types': 'Tipe Kontrak',
}

async function deleteLookup(resource: ResourceKey, id: number) {
  deleteLoading.value = id
  try {
    await $fetch(`/api/lookups/${resource}/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Berhasil dihapus', color: 'success' })
    await loadResource(resource)
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = null
  }
}

// ── Cards config ─────────────────────────────────────────────────────
const cards = computed(() => [
  {
    key: 'work-locations' as ResourceKey,
    label: 'Lokasi Kerja',
    icon: 'i-lucide-map-pin',
    items: workLocations.value ?? [],
  },
  {
    key: 'job-roles' as ResourceKey,
    label: 'Jabatan (Job Role)',
    icon: 'i-lucide-briefcase',
    items: jobRoles.value ?? [],
  },
  {
    key: 'job-levels' as ResourceKey,
    label: 'Level Jabatan',
    icon: 'i-lucide-layers',
    items: jobLevels.value ?? [],
  },
  {
    key: 'tax-status' as ResourceKey,
    label: 'Status Pajak',
    icon: 'i-lucide-receipt',
    items: taxStatuses.value ?? [],
  },
  {
    key: 'contract-types' as ResourceKey,
    label: 'Tipe Kontrak',
    icon: 'i-lucide-badge-info',
    items: contractTypes.value ?? [],
  },
])
</script>

<template>
  <UDashboardPanel id="settings-master-data">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 sm:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl">
          <UCard
            v-for="card in cards"
            :key="card.key"
            :ui="{ body: 'p-0' }"
          >
            <template #header>
              <div class="flex items-center justify-between px-4 py-3">
                <div class="flex items-center gap-2">
                  <UIcon :name="card.icon" class="size-4 text-muted" />
                  <span class="font-semibold text-sm text-highlighted">{{ card.label }}</span>
                  <UBadge :label="String(card.items.length)" color="neutral" variant="subtle" size="sm" />
                </div>
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  variant="ghost"
                  color="primary"
                  @click="addState[card.key].open = !addState[card.key].open"
                />
              </div>
            </template>

            <!-- Form tambah inline -->
            <div
              v-if="addState[card.key].open"
              class="px-4 py-2 border-b border-default bg-elevated/30"
            >
              <div class="flex gap-2">
                <UInput
                  v-model="addState[card.key].name"
                  placeholder="Nama baru..."
                  size="sm"
                  class="flex-1"
                  @keyup.enter="doAdd(card.key)"
                />
                <UButton
                  label="Simpan"
                  size="sm"
                  color="primary"
                  :loading="addState[card.key].loading"
                  @click="doAdd(card.key)"
                />
                <UButton
                  icon="i-lucide-x"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  @click="addState[card.key].open = false; addState[card.key].name = ''"
                />
              </div>
            </div>

            <!-- List items -->
            <ul class="divide-y divide-default">
              <li
                v-if="card.items.length === 0"
                class="px-4 py-6 text-center text-sm text-muted"
              >
                Belum ada data
              </li>
              <li
                v-for="item in card.items"
                :key="item.id"
                class="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-elevated/40 transition-colors"
              >
                <span class="text-highlighted">{{ item.name }}</span>
                <div class="flex gap-1">
                  <UButton
                    icon="i-lucide-pencil"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="openEdit(card.key, item)"
                  />
                  <UButton
                    icon="i-lucide-trash"
                    size="xs"
                    variant="ghost"
                    color="error"
                    :loading="deleteLoading === item.id"
                    @click="doDelete(card.key, item.id)"
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
  <UModal v-model:open="editState.open" title="Edit Data">
    <template #body>
      <UFormField label="Nama" required>
        <UInput
          v-model="editState.name"
          class="w-full"
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
