<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { h } from 'vue'

interface LookupItem { id: number, name: string }

interface DocumentTypeItem {
  id: number
  name: string
  documentType: string
  issuer: string
  category: 'PERSONAL' | 'CERTIFICATION'
}

interface CompanyItem {
  id: number
  name: string
  address?: string | null
  email?: string | null
  phone?: string | null
}

interface LookupsResponse {
  workLocations: LookupItem[]
  jobRoles: LookupItem[]
  jobLevels: LookupItem[]
  taxStatus: LookupItem[]
  contractTypes: LookupItem[]
  departments: LookupItem[]
}

const workLocations = ref<LookupItem[]>([])
const jobRoles = ref<LookupItem[]>([])
const jobLevels = ref<LookupItem[]>([])
const taxStatuses = ref<LookupItem[]>([])
const contractTypes = ref<LookupItem[]>([])
const departments = ref<LookupItem[]>([])
const documentTypes = ref<DocumentTypeItem[]>([])
const companies = ref<CompanyItem[]>([])

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const UIcon = resolveComponent('UIcon')

// ── Generic CRUD state ──────────────────────────────────────────────
type ResourceKey = 'work-locations' | 'job-roles' | 'job-levels' | 'tax-status' | 'contract-types' | 'departments' | 'document-types' | 'companies'

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

// ── Table state ──────────────────────────────────────────────────────
const table = useTemplateRef('table')
const loading = ref(false)
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)

function toggleSort(key: string) {
  if (sorting.value?.key !== key) {
    sorting.value = { key, direction: 'asc' }
    return
  }
  if (sorting.value.direction === 'asc') {
    sorting.value = { key, direction: 'desc' }
    return
  }
  sorting.value = null
}

function sortableHeader(label: string, key: string) {
  const isActive = sorting.value?.key === key
  const icon = !isActive
    ? 'i-lucide-arrow-up-down'
    : sorting.value?.direction === 'asc'
      ? 'i-lucide-arrow-up'
      : 'i-lucide-arrow-down'

  return h('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 text-left font-medium text-highlighted hover:text-primary transition-colors',
    onClick: () => toggleSort(key),
    title: `Urutkan ${label}`,
  }, [
    h('span', label),
    h(UIcon, { name: icon, class: 'size-3.5 text-muted' }),
  ])
}

type MasterRow = LookupItem | DocumentTypeItem | CompanyItem

const filteredData = computed(() => {
  let list: MasterRow[] = []

  if (activeTab.value === 'work-locations') list = workLocations.value
  else if (activeTab.value === 'job-roles') list = jobRoles.value
  else if (activeTab.value === 'job-levels') list = jobLevels.value
  else if (activeTab.value === 'tax-status') list = taxStatuses.value
  else if (activeTab.value === 'contract-types') list = contractTypes.value
  else if (activeTab.value === 'departments') list = departments.value
  else if (activeTab.value === 'document-types') list = documentTypes.value as unknown as MasterRow[]
  else if (activeTab.value === 'companies') list = companies.value as unknown as MasterRow[]

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(item => {
      if (activeTab.value === 'companies') {
        const c = item as CompanyItem
        return (
          c.name.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q) ||
          (c.address ?? '').toLowerCase().includes(q)
        )
      }
      if (activeTab.value === 'document-types') {
        const d = item as DocumentTypeItem
        return (
          d.name.toLowerCase().includes(q) ||
          d.documentType.toLowerCase().includes(q) ||
          (d.issuer ?? '').toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
        )
      }
      return (item as LookupItem).name.toLowerCase().includes(q)
    })
  }

  // Sorting
  const sort = sorting.value
  if (sort) {
    list = [...list].sort((a, b) => {
      let aVal = ''
      let bVal = ''

      if (sort.key === 'name') {
        aVal = (a as LookupItem).name ?? ''
        bVal = (b as LookupItem).name ?? ''
      } else if (sort.key === 'issuer' && activeTab.value === 'document-types') {
        aVal = (a as DocumentTypeItem).issuer ?? ''
        bVal = (b as DocumentTypeItem).issuer ?? ''
      } else {
        return 0
      }

      const cmp = aVal.localeCompare(bVal, 'id', { sensitivity: 'base' })
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }

  return list
})

// Watchers to reset pagination
watch([activeTab, searchQuery], async () => {
  pagination.value.pageIndex = 0
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})
watch(() => pagination.value.pageSize, async () => {
  pagination.value.pageIndex = 0
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

const resourceLabelMap: Record<ResourceKey, string> = {
  'work-locations': 'Site',
  'job-roles': 'Pekerjaan',
  'job-levels': 'Level Jabatan',
  'tax-status': 'Status Pajak',
  'contract-types': 'Tipe Kontrak',
  'departments': 'Departement',
  'document-types': 'Dokumen',
  'companies': 'Perusahaan'
}

const resourceIconMap: Record<ResourceKey, string> = {
  'work-locations': 'i-lucide-map-pin',
  'job-roles': 'i-lucide-briefcase',
  'job-levels': 'i-lucide-layers',
  'tax-status': 'i-lucide-receipt',
  'contract-types': 'i-lucide-file-text',
  'departments': 'i-lucide-building-2',
  'document-types': 'i-lucide-file-text',
  'companies': 'i-lucide-building-2'
}

const resourceDescMap: Record<ResourceKey, string> = {
  'work-locations': 'Daftar site/lokasi kerja karyawan',
  'job-roles': 'Daftar pekerjaan karyawan',
  'job-levels': 'Daftar level jabatan karyawan',
  'tax-status': 'Daftar status pajak karyawan',
  'contract-types': 'Daftar tipe kontrak kerja',
  'departments': 'Daftar departement kerja',
  'document-types': 'Kelola master tipe dokumen',
  'companies': 'Kelola master data perusahaan'
}

const tabs = computed(() => [
  { key: 'work-locations' as ResourceKey, label: 'Site', icon: 'i-lucide-map-pin', count: workLocations.value.length },
  { key: 'departments' as ResourceKey, label: 'Departement', icon: 'i-lucide-building-2', count: departments.value.length },
  { key: 'job-roles' as ResourceKey, label: 'Pekerjaan', icon: 'i-lucide-briefcase', count: jobRoles.value.length },
  { key: 'job-levels' as ResourceKey, label: 'Level Jabatan', icon: 'i-lucide-layers', count: jobLevels.value.length },
  { key: 'contract-types' as ResourceKey, label: 'Tipe Kontrak', icon: 'i-lucide-file-text', count: contractTypes.value.length },
  { key: 'tax-status' as ResourceKey, label: 'Status Pajak', icon: 'i-lucide-receipt', count: taxStatuses.value.length },
  { key: 'document-types' as ResourceKey, label: 'Dokumen', icon: 'i-lucide-file-text', count: documentTypes.value.length },
  { key: 'companies' as ResourceKey, label: 'Perusahaan', icon: 'i-lucide-building-2', count: companies.value.length }
])

const totalCount = computed(() =>
  workLocations.value.length + jobRoles.value.length + jobLevels.value.length + taxStatuses.value.length + contractTypes.value.length + departments.value.length + documentTypes.value.length + companies.value.length
)

async function loadAllLookups() {
  loading.value = true
  try {
    const [data, docTypes, comp] = await Promise.all([
      $fetch<LookupsResponse>('/api/lookups'),
      $fetch<DocumentTypeItem[]>('/api/lookups/document-types').catch(() => []),
      $fetch<CompanyItem[]>('/api/lookups/companies').catch(() => [])
    ])
    workLocations.value = data.workLocations ?? []
    jobRoles.value = data.jobRoles ?? []
    jobLevels.value = data.jobLevels ?? []
    taxStatuses.value = data.taxStatus ?? []
    contractTypes.value = data.contractTypes ?? []
    departments.value = data.departments ?? []
    documentTypes.value = docTypes
    companies.value = comp
  } catch (error) {
    console.error('Gagal memuat master data', error)
  } finally {
    loading.value = false
  }
}

async function loadResource(resource: ResourceKey) {
  if (resource === 'work-locations') workLocations.value = await $fetch<LookupItem[]>('/api/lookups/work-locations')
  else if (resource === 'job-roles') jobRoles.value = await $fetch<LookupItem[]>('/api/lookups/job-roles')
  else if (resource === 'job-levels') jobLevels.value = await $fetch<LookupItem[]>('/api/lookups/job-levels')
  else if (resource === 'tax-status') taxStatuses.value = await $fetch<LookupItem[]>('/api/lookups/tax-status')
  else if (resource === 'contract-types') contractTypes.value = await $fetch<LookupItem[]>('/api/lookups/contract-types')
  else if (resource === 'departments') departments.value = await $fetch<LookupItem[]>('/api/lookups/departments')
  else if (resource === 'document-types') documentTypes.value = await $fetch<DocumentTypeItem[]>('/api/lookups/document-types')
  else if (resource === 'companies') companies.value = await $fetch<CompanyItem[]>('/api/lookups/companies')
}

onMounted(async () => {
  await loadAllLookups()
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
      body: { name: editState.name }
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
      body: { name: addName.value.trim() }
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
    onConfirm: () => deleteLookup(id)
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
  sorting.value = null
  pagination.value.pageIndex = 0
}

// ── Table columns ──────────────────────────────────────────────────────
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

function openEditFor(row: MasterRow) {
  if (activeTab.value === 'document-types') openEditDoc(row as DocumentTypeItem)
  else if (activeTab.value === 'companies') openEditCompany(row as CompanyItem)
  else openEdit(row as LookupItem)
}

function getRowNumber(index: number): string {
  return String(pagination.value.pageIndex * pagination.value.pageSize + index + 1).padStart(2, '0')
}

const documentTypeBadgeColor: Record<string, string> = {
  SERTIFIKAT: 'info',
  LISENSI: 'success',
  IZIN: 'warning',
  RAHASIA: 'error',
  LAINNYA: 'neutral'
}

const simpleColumns = computed<TableColumn<MasterRow>[]>(() => [
  {
    accessorKey: 'no',
    header: () => h('th', { class: 'w-10 text-center' }, '#'),
    cell: ({ row }) => h('td', { class: 'text-center text-xs font-medium text-dimmed tabular-nums' }, getRowNumber(row.index)),
  },
  {
    accessorKey: 'name',
    header: () => sortableHeader('Nama', 'name'),
    cell: ({ row }) => h('td', { class: 'font-medium text-highlighted truncate max-w-xs' }, (row.original as LookupItem).name),
  },
  {
    accessorKey: 'actions',
    header: () => h('th', { class: 'w-24 text-right' }, 'Aksi'),
    cell: ({ row }) => h('td', { class: 'text-right' }, [
      h(UButton, {
        icon: 'i-lucide-pencil',
        size: 'xs',
        variant: 'ghost',
        color: 'neutral',
        class: 'mr-1',
        onClick: () => openEditFor(row.original),
      }),
      h(UButton, {
        icon: 'i-lucide-trash',
        size: 'xs',
        variant: 'ghost',
        color: 'error',
        loading: deleteLoading.value === row.original.id,
        onClick: () => doDelete(row.original.id),
      }),
    ]),
  },
])

const docColumns = computed<TableColumn<MasterRow>[]>(() => [
  {
    accessorKey: 'no',
    header: () => h('th', { class: 'w-10 text-center' }, '#'),
    cell: ({ row }) => h('td', { class: 'text-center text-xs font-medium text-dimmed tabular-nums' }, getRowNumber(row.index)),
  },
  {
    accessorKey: 'name',
    header: () => sortableHeader('Nama Dokumen', 'name'),
    cell: ({ row }) => h('td', { class: 'font-medium text-highlighted truncate max-w-xs' }, (row.original as DocumentTypeItem).name),
  },
  {
    accessorKey: 'documentType',
    header: () => sortableHeader('Tipe', 'documentType'),
    cell: ({ row }) => {
      const d = row.original as DocumentTypeItem
      return h('td', { class: 'whitespace-nowrap' }, [
        h(UBadge, {
          label: d.documentType,
          color: (documentTypeBadgeColor[d.documentType] as any) ?? 'neutral',
          variant: 'subtle',
          size: 'xs',
        }),
      ])
    },
  },
  {
    accessorKey: 'issuer',
    header: () => sortableHeader('Penerbit', 'issuer'),
    cell: ({ row }) => h('td', { class: 'text-muted truncate max-w-xs' }, (row.original as DocumentTypeItem).issuer ?? '-'),
  },
  {
    accessorKey: 'category',
    header: () => sortableHeader('Kategori', 'category'),
    cell: ({ row }) => {
      const d = row.original as DocumentTypeItem
      return h('td', { class: 'whitespace-nowrap' }, [
        h(UBadge, {
          label: d.category === 'PERSONAL' ? 'Dokumen Pribadi' : 'Sertifikasi & Ijin',
          color: d.category === 'PERSONAL' ? 'primary' : 'warning',
          variant: 'subtle',
          size: 'xs',
        }),
      ])
    },
  },
  {
    accessorKey: 'actions',
    header: () => h('th', { class: 'w-24 text-right' }, 'Aksi'),
    cell: ({ row }) => h('td', { class: 'text-right' }, [
      h(UButton, {
        icon: 'i-lucide-pencil',
        size: 'xs',
        variant: 'ghost',
        color: 'neutral',
        class: 'mr-1',
        onClick: () => openEditFor(row.original),
      }),
      h(UButton, {
        icon: 'i-lucide-trash',
        size: 'xs',
        variant: 'ghost',
        color: 'error',
        loading: deleteLoading.value === row.original.id,
        onClick: () => doDelete(row.original.id),
      }),
    ]),
  },
])

const companyColumns = computed<TableColumn<MasterRow>[]>(() => [
  {
    accessorKey: 'no',
    header: () => h('th', { class: 'w-10 text-center' }, '#'),
    cell: ({ row }) => h('td', { class: 'text-center text-xs font-medium text-dimmed tabular-nums' }, getRowNumber(row.index)),
  },
  {
    accessorKey: 'name',
    header: () => sortableHeader('Nama Perusahaan', 'name'),
    cell: ({ row }) => h('td', { class: 'font-semibold text-highlighted truncate max-w-xs' }, (row.original as CompanyItem).name),
  },
  {
    accessorKey: 'contact',
    header: () => sortableHeader('Kontak', 'contact'),
    cell: ({ row }) => {
      const c = row.original as CompanyItem
      return h('td', { class: 'text-sm' }, [
        c.email && h('div', { class: 'text-muted truncate' }, [
          h(UIcon, { name: 'i-lucide-mail', class: 'size-3 inline mr-1' }),
          c.email,
        ]),
        c.phone && h('div', { class: 'text-muted truncate' }, [
          h(UIcon, { name: 'i-lucide-phone', class: 'size-3 inline mr-1' }),
          c.phone,
        ]),
        !c.email && !c.phone && h('span', { class: 'text-dimmed text-xs' }, '-'),
      ])
    },
  },
  {
    accessorKey: 'address',
    header: () => sortableHeader('Alamat', 'address'),
    cell: ({ row }) => {
      const c = row.original as CompanyItem
      return h('td', { class: 'text-muted text-xs truncate max-w-md', title: c.address ?? '' }, c.address ?? '-')
    },
  },
  {
    accessorKey: 'actions',
    header: () => h('th', { class: 'w-24 text-right' }, 'Aksi'),
    cell: ({ row }) => h('td', { class: 'text-right' }, [
      h(UButton, {
        icon: 'i-lucide-pencil',
        size: 'xs',
        variant: 'ghost',
        color: 'neutral',
        class: 'mr-1',
        onClick: () => openEditFor(row.original),
      }),
      h(UButton, {
        icon: 'i-lucide-trash',
        size: 'xs',
        variant: 'ghost',
        color: 'error',
        loading: deleteLoading.value === row.original.id,
        onClick: () => doDelete(row.original.id),
      }),
    ]),
  },
])

const columns = computed<TableColumn<MasterRow>[]>(() => {
  if (activeTab.value === 'document-types') return docColumns.value
  if (activeTab.value === 'companies') return companyColumns.value
  return simpleColumns.value
})

// ── Document Types CRUD state ────────────────────────────────────────
const newDocName = ref('')
const newDocType = ref('')
const newDocIssuer = ref('')
const newDocCategory = ref<'PERSONAL' | 'CERTIFICATION'>('CERTIFICATION')
const addDocLoading = ref(false)

const editDocState = reactive({
  documentType: '',
  issuer: '',
  category: 'CERTIFICATION' as 'PERSONAL' | 'CERTIFICATION'
})

const documentTypeOptions = [
  { label: 'Sertifikat', value: 'SERTIFIKAT' },
  { label: 'Lisensi', value: 'LISENSI' },
  { label: 'Izin', value: 'IZIN' },
  { label: 'Rahasia', value: 'RAHASIA' },
  { label: 'Lainnya', value: 'LAINNYA' }
]

function openEditDoc(item: DocumentTypeItem) {
  editState.id = item.id
  editState.name = item.name
  editDocState.documentType = item.documentType
  editDocState.issuer = item.issuer
  editDocState.category = item.category ?? 'CERTIFICATION'
  editState.open = true
}

async function doAddDoc() {
  if (!newDocName.value.trim() || !newDocType.value) return
  addDocLoading.value = true
  try {
    await $fetch('/api/lookups/document-types', {
      method: 'POST',
      body: { name: newDocName.value.trim(), documentType: newDocType.value, issuer: newDocIssuer.value.trim(), category: newDocCategory.value }
    })
    toast.add({ title: 'Berhasil ditambahkan', color: 'success' })
    newDocName.value = ''
    newDocType.value = ''
    newDocIssuer.value = ''
    newDocCategory.value = 'CERTIFICATION'
    addOpen.value = false
    await loadResource('document-types')
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    addDocLoading.value = false
  }
}

async function saveEditDoc() {
  if (!editState.id) return
  editState.loading = true
  try {
    await $fetch(`/api/lookups/document-types/${editState.id}`, {
      method: 'PUT',
      body: { name: editState.name, documentType: editDocState.documentType, issuer: editDocState.issuer, category: editDocState.category }
    })
    toast.add({ title: 'Berhasil diperbarui', color: 'success' })
    editState.open = false
    await loadResource('document-types')
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    editState.loading = false
  }
}

// ── Companies CRUD state ─────────────────────────────────────────────
const newCompanyName = ref('')
const newCompanyAddress = ref('')
const newCompanyEmail = ref('')
const newCompanyPhone = ref('')
const addCompanyLoading = ref(false)
const companyImportOpen = ref(false)

const editCompanyState = reactive({
  open: false,
  id: null as number | null,
  name: '',
  address: '',
  email: '',
  phone: '',
  loading: false
})

async function doAddCompany() {
  if (!newCompanyName.value.trim()) return
  addCompanyLoading.value = true
  try {
    await $fetch('/api/lookups/companies', {
      method: 'POST',
      body: {
        name: newCompanyName.value.trim(),
        address: newCompanyAddress.value.trim() || undefined,
        email: newCompanyEmail.value.trim() || undefined,
        phone: newCompanyPhone.value.trim() || undefined
      }
    })
    toast.add({ title: 'Berhasil ditambahkan', color: 'success' })
    newCompanyName.value = ''
    newCompanyAddress.value = ''
    newCompanyEmail.value = ''
    newCompanyPhone.value = ''
    addOpen.value = false
    await loadResource('companies')
  } catch (e: any) {
    toast.add({ title: 'Gagal menambahkan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    addCompanyLoading.value = false
  }
}

function openEditCompany(item: CompanyItem) {
  editCompanyState.id = item.id
  editCompanyState.name = item.name
  editCompanyState.address = item.address ?? ''
  editCompanyState.email = item.email ?? ''
  editCompanyState.phone = item.phone ?? ''
  editCompanyState.open = true
}

async function saveEditCompany() {
  if (!editCompanyState.id) return
  editCompanyState.loading = true
  try {
    await $fetch(`/api/lookups/companies/${editCompanyState.id}`, {
      method: 'PUT',
      body: {
        name: editCompanyState.name.trim(),
        address: editCompanyState.address.trim() || undefined,
        email: editCompanyState.email.trim() || undefined,
        phone: editCompanyState.phone.trim() || undefined
      }
    })
    toast.add({ title: 'Berhasil diperbarui', color: 'success' })
    editCompanyState.open = false
    await loadResource('companies')
  } catch (e: any) {
    toast.add({ title: 'Gagal memperbarui', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    editCompanyState.loading = false
  }
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
            v-if="activeTab === 'companies'"
            label="Import Excel"
            icon="i-lucide-upload"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="companyImportOpen = true"
          />
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
            Kelola data referensi untuk lokasi kerja, jabatan, level jabatan, status pajak, tipe kontrak, departement, dan perusahaan.
            Data ini dipakai sebagai referensi sistem agar input tetap konsisten.
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

        <!-- Tabs (polished: horizontal scroll on mobile, no wrap) -->
        <div class="mb-6 border-b border-default">
          <div class="flex gap-1 -mb-px overflow-x-auto pb-1" role="tablist">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              :class="activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-highlighted hover:bg-elevated/50'"
              @click="onTabChange(tab.key)"
              role="tab"
              :aria-selected="activeTab === tab.key"
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

        <!-- Content area (full width for table) -->
        <div class="space-y-4">
          <!-- UCard wrapper with header + toolbar + UTable + pagination -->
          <UCard :ui="{ body: 'p-0', header: 'p-0' }">
            <!-- Card header: title + description + add button -->
            <template #header>
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">{{ resourceLabelMap[activeTab] }}</h2>
                  <p class="mt-1 text-xs text-muted">{{ resourceDescMap[activeTab] }}</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs text-muted tabular-nums">
                    {{ filteredData.length }} dari {{ tabs.find(t => t.key === activeTab)?.count ?? 0 }}
                  </span>
                  <UButton
                    label="Tambah"
                    icon="i-lucide-plus"
                    color="primary"
                    size="sm"
                    @click="addOpen = true"
                  />
                </div>
              </div>
            </template>

            <!-- Toolbar row (search) -->
            <div class="px-4 py-3 border-b border-default bg-elevated/30">
              <div class="relative max-w-md">
                <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                <UInput
                  v-model="searchQuery"
                  :placeholder="`Cari ${resourceLabelMap[activeTab]}...`"
                  size="sm"
                  class="w-full"
                  :ui="{ base: 'pl-9' }"
                />
              </div>
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
                class="px-4 py-3 border-b border-primary/20 bg-primary/5"
              >
                <div class="flex items-center gap-2 mb-3">
                  <UIcon :name="resourceIconMap[activeTab]" class="size-4 text-primary" />
                  <span class="text-sm font-medium text-highlighted">
                    Tambah {{ resourceLabelMap[activeTab] }}
                  </span>
                </div>
                <!-- Form: regular resources -->
                <div v-if="activeTab !== 'document-types' && activeTab !== 'companies'" class="flex gap-2">
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

                <!-- Form: companies (4 fields) -->
                <div v-else-if="activeTab === 'companies'" class="flex flex-col gap-2">
                  <UInput
                    v-model="newCompanyName"
                    placeholder="Nama Perusahaan"
                    size="sm"
                    class="w-full"
                  />
                  <UTextarea
                    v-model="newCompanyAddress"
                    placeholder="Alamat"
                    :rows="2"
                    size="sm"
                    class="w-full"
                  />
                  <div class="flex gap-2">
                    <UInput
                      v-model="newCompanyEmail"
                      type="email"
                      placeholder="Email"
                      size="sm"
                      class="flex-1"
                    />
                    <UInput
                      v-model="newCompanyPhone"
                      type="tel"
                      placeholder="No. Kontak"
                      size="sm"
                      class="flex-1"
                    />
                  </div>
                  <div class="flex gap-2 justify-end">
                    <UButton
                      label="Simpan"
                      size="sm"
                      color="primary"
                      :loading="addCompanyLoading"
                      @click="doAddCompany()"
                    />
                    <UButton
                      icon="i-lucide-x"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      @click="addOpen = false; newCompanyName = ''; newCompanyAddress = ''; newCompanyEmail = ''; newCompanyPhone = ''"
                    />
                  </div>
                </div>

                <!-- Form: document-types (3 fields) -->
                <div v-else class="flex flex-col gap-2">
                  <div class="flex gap-2">
                    <UInput
                      v-model="newDocName"
                      placeholder="Nama Dokumen"
                      size="sm"
                      class="flex-1"
                    />
                    <USelect
                      v-model="newDocType"
                      :items="documentTypeOptions"
                      placeholder="Tipe Dokumen"
                      size="sm"
                      class="flex-1"
                    />
                  </div>
                  <div class="flex gap-2">
                    <UInput
                      v-model="newDocIssuer"
                      placeholder="Penerbit"
                      size="sm"
                      class="flex-1"
                    />
                    <USelect
                      v-model="newDocCategory"
                      :items="[
                        { label: 'Dokumen Pribadi (KTP, SIM, NPWP, dll)', value: 'PERSONAL' },
                        { label: 'Sertifikasi & Ijin', value: 'CERTIFICATION' },
                      ]"
                      placeholder="Pilih kategori..."
                      size="sm"
                      class="flex-1"
                    />
                  </div>
                  <div class="flex gap-2 justify-end">
                    <UButton
                      label="Simpan"
                      size="sm"
                      color="primary"
                      :loading="addDocLoading"
                      @click="doAddDoc()"
                    />
                    <UButton
                      icon="i-lucide-x"
                      size="sm"
                      color="neutral"
                      variant="ghost"
                      @click="addOpen = false; newDocName = ''; newDocType = ''; newDocIssuer = ''; newDocCategory = 'CERTIFICATION'"
                    />
                  </div>
                </div>
              </div>
            </Transition>

            <!-- UTable -->
            <UTable
              ref="table"
              v-model:pagination="pagination"
              :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
              class="shrink-0"
              :data="filteredData"
              :columns="columns"
              :loading="loading"
              :ui="{
                base: 'table-fixed border-separate border-spacing-0',
                thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
                th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
                td: 'border-b border-default',
                separator: 'h-0'
              }"
            >
              <template #empty>
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
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
              </template>
            </UTable>

            <!-- Pagination footer -->
            <div class="flex items-center justify-between gap-3 border-t border-default px-4 py-4 mt-auto">
              <div class="flex items-center gap-3">
                <div class="text-sm text-muted">
                  Menampilkan {{ filteredData.length }} {{ resourceLabelMap[activeTab] }}
                </div>
                <USelect
                  v-model="pagination.pageSize"
                  :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
                  class="w-20"
                  aria-label="Jumlah baris per halaman"
                />
              </div>
              <UPagination
                :key="`pagination-${pagination.pageSize}-${pagination.pageIndex}`"
                :page="pagination.pageIndex + 1"
                :items-per-page="pagination.pageSize"
                :total="filteredData.length"
                @update:page="(p: number) => { pagination.pageIndex = p - 1; table?.tableApi?.setPageIndex(p - 1) }"
              />
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Edit -->
  <UModal v-model:open="editState.open" title="Edit Data" :description="`Perbarui ${resourceLabelMap[activeTab]}`">
    <template #body>
      <!-- Regular resources: single name field -->
      <template v-if="activeTab !== 'document-types' && activeTab !== 'companies'">
        <UFormField label="Nama" required>
          <UInput
            v-model="editState.name"
            class="w-full"
            autofocus
            @keyup.enter="saveEdit"
          />
        </UFormField>
      </template>

      <!-- Document types: three fields -->
      <template v-else-if="activeTab === 'document-types'">
        <div class="flex flex-col gap-3">
          <UFormField label="Nama Dokumen" required>
            <UInput
              v-model="editState.name"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Tipe Dokumen" required>
            <USelect
              v-model="editDocState.documentType"
              :items="documentTypeOptions"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Penerbit">
            <UInput
              v-model="editDocState.issuer"
              class="w-full"
              placeholder="Penerbit"
            />
          </UFormField>
          <UFormField label="Kategori" required>
            <USelect
              v-model="editDocState.category"
              :items="[
                { label: 'Dokumen Pribadi (KTP, SIM, NPWP, dll)', value: 'PERSONAL' },
                { label: 'Sertifikasi & Ijin', value: 'CERTIFICATION' },
              ]"
              placeholder="Pilih kategori..."
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="subtle"
          @click="editState.open = false"
        />
        <UButton
          label="Simpan"
          color="primary"
          :loading="editState.loading"
          @click="activeTab !== 'document-types' ? saveEdit() : saveEditDoc()"
        />
      </div>
    </template>
  </UModal>

  <!-- Modal Edit Company -->
  <UModal v-model:open="editCompanyState.open" title="Edit Perusahaan">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nama Perusahaan" required>
          <UInput v-model="editCompanyState.name" class="w-full" />
        </UFormField>
        <UFormField label="Alamat">
          <UTextarea v-model="editCompanyState.address" :rows="3" class="w-full" />
        </UFormField>
        <UFormField label="Email">
          <UInput v-model="editCompanyState.email" type="email" class="w-full" />
        </UFormField>
        <UFormField label="No. Kontak">
          <UInput v-model="editCompanyState.phone" type="tel" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="subtle"
            @click="editCompanyState.open = false"
          />
          <UButton
            label="Simpan"
            color="primary"
            :loading="editCompanyState.loading"
            @click="saveEditCompany"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal Import Company (Excel) -->
  <MasterDataCompanyImportModal
    v-model:open="companyImportOpen"
    @imported="loadResource('companies')"
  />
</template>
