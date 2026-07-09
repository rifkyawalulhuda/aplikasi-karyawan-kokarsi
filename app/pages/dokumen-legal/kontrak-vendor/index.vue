<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const table = useTemplateRef('table')

// --- Types ---
interface VendorContract {
  id: number
  category: 'CUSTOMER' | 'VENDOR'
  companyId: number
  documentName: string
  documentNumber: string
  documentType: 'DOKUMEN_KONTRAK' | 'DOKUMEN_PERJANJIAN' | 'SURAT_PENAWARAN' | 'ADDENDUM' | 'AMENDMENT' | 'SURAT'
  createdDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  motherAgreementId?: number | null
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  company: { id: number; name: string }
  motherAgreement?: { id: number; documentName: string; documentNumber: string } | null
  renewals?: { id: number; documentName: string; documentNumber: string; status: string; fileUrl?: string | null; endDate?: string | null }[]
  renewedFrom?: { id: number; documentName: string; documentNumber: string; fileUrl?: string | null; createdDate: string } | null
  renewedTo?: { id: number; documentName: string; documentNumber: string; status: string; createdDate: string } | null
  createdAt: string
  updatedAt: string
}

// --- State ---
const searchQuery = ref('')
const categoryFilter = ref('all')
const statusFilter = ref('all')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<VendorContract | null>(null)
const renewModal = ref(false)
const renewTarget = ref<VendorContract | null>(null)
const detailDrawer = ref(false)
const detailTarget = ref<VendorContract | null>(null)

// --- Fetch Data ---
const res = ref<{ data: VendorContract[]; total: number } | null>(null)
const status = ref<'pending' | 'success' | 'error'>('pending')

async function fetchContracts() {
  status.value = 'pending'
  try {
    const params: Record<string, string> = {
      page: String(pagination.value.pageIndex + 1),
      limit: String(pagination.value.pageSize),
    }
    if (searchQuery.value) params.search = searchQuery.value
    if (categoryFilter.value !== 'all') params.category = categoryFilter.value
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    res.value = await $fetch<{ data: VendorContract[]; total: number }>('/api/vendor-contracts', {
      query: params,
      credentials: 'include',
    })
    status.value = 'success'
  }
  catch {
    status.value = 'error'
  }
}

await fetchContracts()

function refresh() {
  fetchContracts()
}

watch([searchQuery, categoryFilter, statusFilter], () => {
  pagination.value.pageIndex = 0
  fetchContracts()
})

const contracts = computed<VendorContract[]>(() => res.value?.data ?? [])
const totalContracts = computed(() => res.value?.total ?? 0)

// Client-side sort applied on top of server-fetched page
const sortedContracts = computed<VendorContract[]>(() => {
  const sort = sorting.value
  if (!sort) return contracts.value

  return [...contracts.value].sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sort.key) {
      case 'company':
        aVal = a.company?.name ?? ''
        bVal = b.company?.name ?? ''
        break
      case 'documentName':
        aVal = a.documentName ?? ''
        bVal = b.documentName ?? ''
        break
      case 'documentNumber':
        aVal = a.documentNumber ?? ''
        bVal = b.documentNumber ?? ''
        break
      case 'createdDate':
        aVal = a.createdDate ?? ''
        bVal = b.createdDate ?? ''
        break
      case 'endDate':
        aVal = a.endDate ?? ''
        bVal = b.endDate ?? ''
        break
      case 'status':
        aVal = getDisplayStatus(a)
        bVal = getDisplayStatus(b)
        break
      default:
        aVal = (a as any)[sort.key] ?? ''
        bVal = (b as any)[sort.key] ?? ''
    }

    const isDate = sort.key === 'createdDate' || sort.key === 'endDate'
    let compare = 0
    if (isDate) {
      compare = new Date(String(aVal || 0)).getTime() - new Date(String(bVal || 0)).getTime()
    }
    else {
      compare = String(aVal).localeCompare(String(bVal), 'id')
    }
    return sort.direction === 'asc' ? compare : -compare
  })
})

const counts = computed(() => ({
  total: totalContracts.value,
  aktif: contracts.value.filter(d => d.status === 'AKTIF').length,
  akanBerakhir: contracts.value.filter(d => d.status === 'AKAN_BERAKHIR').length,
  expired: contracts.value.filter(d => d.status === 'EXPIRED').length,
}))

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_BERAKHIR: 'warning',
  EXPIRED: 'error',
  TIDAK_AKTIF: 'neutral',
  SUDAH_DIPERPANJANG: 'info',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_BERAKHIR: 'Akan Berakhir',
  EXPIRED: 'Expired',
  TIDAK_AKTIF: 'Tidak Aktif',
  SUDAH_DIPERPANJANG: 'Sudah Diperpanjang',
}

// Computed display status — if contract has been renewed, show "Sudah Diperpanjang"
function getDisplayStatus(doc: VendorContract): string {
  if (doc.renewedTo) return 'SUDAH_DIPERPANJANG'
  return doc.status
}

const docTypeLabel: Record<string, string> = {
  DOKUMEN_KONTRAK: 'Kontrak',
  DOKUMEN_PERJANJIAN: 'Perjanjian',
  SURAT_PENAWARAN: 'Penawaran',
  ADDENDUM: 'Addendum',
  AMENDMENT: 'Amendment',
  SURAT: 'Surat',
}

const docTypeColor: Record<string, string> = {
  DOKUMEN_KONTRAK: 'blue',
  DOKUMEN_PERJANJIAN: 'violet',
  SURAT_PENAWARAN: 'amber',
  ADDENDUM: 'orange',
  AMENDMENT: 'pink',
  SURAT: 'gray',
}

// --- Sorting ---
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

// --- Row Actions ---
function getRowItems(row: Row<VendorContract>): DropdownMenuItem[][] {
  const doc = row.original
  const group1: DropdownMenuItem[] = [
    { label: 'Lihat Detail', icon: 'i-lucide-eye', onSelect: () => openDetail(doc) },
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(doc) },
  ]
  if (doc.needsRenewal && (doc.status === 'AKAN_BERAKHIR' || doc.status === 'EXPIRED') && !doc.renewedTo) {
    group1.push({ label: 'Perpanjang', icon: 'i-lucide-refresh-cw', onSelect: () => openRenew(doc) })
  }

  const group2: DropdownMenuItem[] = []
  if (doc.fileUrl) {
    group2.push({ label: 'Unduh File', icon: 'i-lucide-download', onSelect: () => window.open(doc.fileUrl!, '_blank') })
  }
  group2.push({ label: 'Hapus', icon: 'i-lucide-trash', color: 'error', onSelect: () => confirmDelete(doc) })

  return [group1, group2]
}

// --- Table Columns ---
const columns: TableColumn<VendorContract>[] = [
  {
    accessorKey: 'company',
    header: () => sortableHeader('Perusahaan', 'company'),
    cell: ({ row }: { row: Row<VendorContract> }) => {
      const doc = row.original
      return h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
        h('p', { class: 'font-medium text-sm text-highlighted' }, doc.company?.name ?? '-'),
        h(UBadge, {
          label: doc.category,
          color: doc.category === 'CUSTOMER' ? 'blue' : 'green',
          variant: 'subtle',
          size: 'sm',
          class: 'mt-0.5 w-fit',
        }),
      ])
    },
  },
  {
    accessorKey: 'documentName',
    header: () => sortableHeader('Nama Dokumen', 'documentName'),
    cell: ({ row }: { row: Row<VendorContract> }) =>
      h('span', { class: 'text-sm text-highlighted' }, row.original.documentName ?? '-'),
  },
  {
    accessorKey: 'documentNumber',
    header: () => sortableHeader('No. Dokumen', 'documentNumber'),
    cell: ({ row }: { row: Row<VendorContract> }) =>
      h('span', { class: 'text-sm font-mono text-muted' }, row.original.documentNumber ?? '-'),
  },
  {
    accessorKey: 'documentType',
    header: 'Jenis',
    cell: ({ row }: { row: Row<VendorContract> }) => {
      const type = row.original.documentType
      return h(UBadge, {
        label: docTypeLabel[type] ?? type,
        color: docTypeColor[type] ?? 'gray',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    accessorKey: 'createdDate',
    header: () => sortableHeader('Tanggal Dibuat', 'createdDate'),
    cell: ({ row }: { row: Row<VendorContract> }) =>
      h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(row.original.createdDate)),
  },
  {
    accessorKey: 'endDate',
    header: () => sortableHeader('Tanggal Berakhir', 'endDate'),
    cell: ({ row }: { row: Row<VendorContract> }) => {
      const doc = row.original
      if (!doc.needsRenewal || !doc.endDate) return h('span', { class: 'text-sm text-muted' }, '-')
      return h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(doc.endDate))
    },
  },
  {
    accessorKey: 'status',
    header: () => sortableHeader('Status', 'status'),
    cell: ({ row }: { row: Row<VendorContract> }) => {
      const doc = row.original
      if (!doc.needsRenewal) return h('span', { class: 'text-sm text-muted' }, '-')
      const s = getDisplayStatus(doc)
      return h(UBadge, {
        label: statusLabel[s] ?? s,
        color: statusColor[s] ?? 'neutral',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }: { row: Row<VendorContract> }) => h('div', { class: 'flex justify-end' }, [
      h(UDropdownMenu, {
        items: getRowItems(row),
      }, () => h(UButton, { icon: 'i-lucide-ellipsis', variant: 'ghost', color: 'neutral' })),
    ]),
  },
]

// --- Delete ---
function confirmDelete(doc: VendorContract) {
  confirmDeleteToast({
    title: 'Hapus kontrak?',
    description: `Kontrak "${doc.documentName}" milik ${doc.company?.name} akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/vendor-contracts/${doc.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        await refresh()
        toast.add({ title: 'Kontrak berhasil dihapus', color: 'success' })
      }
      catch {
        toast.add({ title: 'Gagal menghapus kontrak', color: 'error' })
      }
    },
  })
}

// --- Edit ---
function openEdit(doc: VendorContract) {
  editTarget.value = doc
  editModal.value = true
}

// --- Renew ---
function openRenew(doc: VendorContract) {
  renewTarget.value = doc
  renewModal.value = true
}

// --- Detail ---
function openDetail(doc: VendorContract) {
  detailTarget.value = doc
  detailDrawer.value = true
}

// --- Open contract by ID (for renewedTo link in drawer) ---
async function openContractById(id: number) {
  try {
    const contract = await $fetch<VendorContract>(`/api/vendor-contracts/${id}`, {
      credentials: 'include',
    })
    detailTarget.value = contract
    detailDrawer.value = true
  }
  catch {
    toast.add({ title: 'Gagal memuat detail kontrak', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="kontrak-vendor">
    <template #header>
      <UDashboardNavbar title="Kontrak Customer/Vendor">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah Kontrak"
            icon="i-lucide-plus"
            color="primary"
            @click="addModal = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary badges -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UBadge variant="subtle" color="neutral" size="lg">
          Total: {{ counts.total }}
        </UBadge>
        <UBadge variant="subtle" color="success" size="lg">
          Aktif: {{ counts.aktif }}
        </UBadge>
        <UBadge variant="subtle" color="warning" size="lg">
          Akan Berakhir: {{ counts.akanBerakhir }}
        </UBadge>
        <UBadge variant="subtle" color="error" size="lg">
          Expired: {{ counts.expired }}
        </UBadge>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari perusahaan atau nomor dokumen..."
        />
        <div class="flex flex-wrap gap-2">
          <USelect
            v-model="categoryFilter"
            :items="[
              { label: 'Semua Kategori', value: 'all' },
              { label: 'Customer', value: 'CUSTOMER' },
              { label: 'Vendor', value: 'VENDOR' },
            ]"
            placeholder="Filter kategori"
            class="min-w-44"
          />
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'Semua Status', value: 'all' },
              { label: 'Aktif', value: 'AKTIF' },
              { label: 'Akan Berakhir', value: 'AKAN_BERAKHIR' },
              { label: 'Expired', value: 'EXPIRED' },
              { label: 'Tidak Aktif', value: 'TIDAK_AKTIF' },
            ]"
            placeholder="Filter status"
            class="min-w-44"
          />
        </div>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        class="shrink-0"
        :data="sortedContracts"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-2 py-12 text-muted">
            <UIcon name="i-lucide-file-text" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data kontrak</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ contracts.length }} dari {{ totalContracts }} kontrak
        </div>
        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="table?.tableApi?.getState().pagination.pageSize"
          :total="contracts.length"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Tambah -->
  <VendorContractsFormModal
    v-model:open="addModal"
    mode="add"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <VendorContractsFormModal
    v-if="editTarget"
    v-model:open="editModal"
    mode="edit"
    :initial-data="editTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { editModal = v; if (!v) editTarget = null }"
  />

  <!-- Modal Perpanjang -->
  <VendorContractsFormModal
    v-if="renewTarget"
    v-model:open="renewModal"
    mode="renew"
    :initial-data="renewTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { renewModal = v; if (!v) renewTarget = null }"
  />

  <!-- Detail Drawer -->
  <VendorContractsDetailDrawer
    v-if="detailTarget"
    v-model:open="detailDrawer"
    :contract="detailTarget"
    @update:open="(v: boolean) => { detailDrawer = v; if (!v) detailTarget = null }"
    @edit="(doc) => { detailDrawer = false; openEdit(doc) }"
    @open-contract="openContractById"
  />
</template>
