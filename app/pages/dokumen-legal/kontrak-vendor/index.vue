<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { exportVendorContractsExcel } = useExport()
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
const categoryFilter = ref<string[]>([])
const statusFilter = ref<string[]>([])
const documentTypeFilter = ref<string[]>([])
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]

const hasActiveFilters = computed(() =>
  categoryFilter.value.length > 0 || statusFilter.value.length > 0 || documentTypeFilter.value.length > 0
)

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
    res.value = await $fetch<{ data: VendorContract[]; total: number }>('/api/vendor-contracts', {
      query: { limit: 10000 },
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

const contracts = computed<VendorContract[]>(() => res.value?.data ?? [])
const totalContracts = computed(() => filteredContracts.value.length)

// --- Client-side filter ---
const filteredContracts = computed(() => {
  let list = contracts.value

  if (categoryFilter.value.length > 0) {
    list = list.filter(c => categoryFilter.value.includes(c.category))
  }
  if (statusFilter.value.length > 0) {
    list = list.filter(c => statusFilter.value.includes(c.status))
  }
  if (documentTypeFilter.value.length > 0) {
    list = list.filter(c => documentTypeFilter.value.includes(c.documentType))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.documentName?.toLowerCase().includes(q) ||
      c.documentNumber?.toLowerCase().includes(q) ||
      c.company?.name?.toLowerCase().includes(q)
    )
  }

  return list
})

watch([searchQuery, categoryFilter, statusFilter, documentTypeFilter], () => {
  pagination.value.pageIndex = 0
})

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

// Client-side sort applied on top of filtered data
const sortedContracts = computed<VendorContract[]>(() => {
  const sort = sorting.value
  if (!sort) return filteredContracts.value

  return [...filteredContracts.value].sort((a, b) => {
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
  total: contracts.value.length,
  aktif: contracts.value.filter(d => d.status === 'AKTIF').length,
  akanBerakhir: contracts.value.filter(d => d.status === 'AKAN_BERAKHIR').length,
  expired: contracts.value.filter(d => d.status === 'EXPIRED').length,
}))

// --- Export ---
const currentYear = new Date().getFullYear()
const exportModal = ref(false)
const exportYear = ref<number | 'all'>(currentYear)

const availableYears = computed(() => {
  const years = new Set(
    (contracts.value ?? []).map((c: any) => new Date(c.createdDate).getFullYear())
  )
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
})

const exportYearOptions = computed(() => [
  { label: 'Semua Tahun', value: 'all' as const },
  ...availableYears.value.map(y => ({ label: String(y), value: y })),
])

async function handleExport() {
  try {
    const year = exportYear.value === 'all' ? undefined : exportYear.value
    const ok = exportVendorContractsExcel(contracts.value, year)
    if (ok) {
      toast.add({ title: 'Export berhasil', description: `Data kontrak customer/vendor${year ? ` tahun ${year}` : ''} berhasil diekspor.`, color: 'success' })
      exportModal.value = false
    } else {
      toast.add({ title: 'Tidak ada data', description: `Tidak ada kontrak${year ? ` di tahun ${year}` : ''}.`, color: 'warning' })
    }
  } catch {
    toast.add({ title: 'Export gagal', color: 'error' })
  }
}

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

// --- Context Menu (klik kanan) ---
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<VendorContract | null>(null)

async function openContextMenu(e: MouseEvent, doc: VendorContract) {
  e.preventDefault()
  contextMenuTarget.value = doc
  contextMenu.value = true
  await nextTick()
  const menuEl = document.querySelector('[data-context-menu]') as HTMLElement
  const menuWidth = menuEl?.offsetWidth ?? 192
  const menuHeight = menuEl?.offsetHeight ?? 260
  contextMenuX.value = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
  contextMenuY.value = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
}

function closeContextMenu() {
  contextMenu.value = false
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

// --- Deep-link: ?openId=<id> ---
const route = useRoute()
onMounted(async () => {
  const openId = route.query.openId
  if (openId) {
    await openContractById(Number(openId))
  }
})
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
            label="Export"
            icon="i-lucide-download"
            color="neutral"
            variant="subtle"
            @click="exportModal = true"
          />
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
        <div class="flex items-center gap-2 flex-wrap">
          <USelectMenu
            v-model="categoryFilter"
            :items="[
              { label: 'Customer', value: 'CUSTOMER' },
              { label: 'Vendor', value: 'VENDOR' },
            ]"
            value-key="value"
            multiple
            placeholder="Semua Kategori"
            class="min-w-40"
          />
          <USelectMenu
            v-model="statusFilter"
            :items="[
              { label: 'Aktif', value: 'AKTIF' },
              { label: 'Akan Berakhir', value: 'AKAN_BERAKHIR' },
              { label: 'Expired', value: 'EXPIRED' },
              { label: 'Tidak Aktif', value: 'TIDAK_AKTIF' },
            ]"
            value-key="value"
            multiple
            placeholder="Semua Status"
            class="min-w-40"
          />
          <USelectMenu
            v-model="documentTypeFilter"
            :items="[
              { label: 'Kontrak', value: 'DOKUMEN_KONTRAK' },
              { label: 'Perjanjian', value: 'DOKUMEN_PERJANJIAN' },
              { label: 'Penawaran', value: 'SURAT_PENAWARAN' },
              { label: 'Addendum', value: 'ADDENDUM' },
              { label: 'Amendment', value: 'AMENDMENT' },
              { label: 'Surat', value: 'SURAT' },
            ]"
            value-key="value"
            multiple
            placeholder="Semua Jenis"
            class="min-w-36"
          />
          <UButton
            v-if="hasActiveFilters"
            label="Reset"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            @click="categoryFilter = []; statusFilter = []; documentTypeFilter = []"
          />
        </div>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="sortedContracts"
        :columns="columns"
        :loading="status === 'pending'"
        :on-select="(_e: any, row: any) => openDetail(row.original)"
        :on-contextmenu="(e: any, row: any) => openContextMenu(e, row.original)"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
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
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            {{ totalContracts }} kontrak
          </div>
          <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
            class="w-20"
            aria-label="Jumlah baris per halaman"
          />
        </div>
        <UPagination
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
          :total="totalContracts"
          @update:page="(p: number) => { pagination.pageIndex = p - 1 }"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Export -->
  <UModal v-model:open="exportModal" title="Export Kontrak Customer/Vendor" :ui="{ content: 'sm:max-w-sm w-full' }">
    <template #body>
      <div class="space-y-4 py-2">
        <UFormField label="Pilih Tahun">
          <USelect
            v-model="exportYear"
            :items="exportYearOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton label="Batal" color="neutral" variant="ghost" @click="exportModal = false" />
        <UButton
          label="Export Excel"
          icon="i-lucide-file-spreadsheet"
          color="primary"
          @click="handleExport"
        />
      </div>
    </template>
  </UModal>

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

  <!-- Context Menu (klik kanan) -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="fixed inset-0 z-50"
      @click="closeContextMenu"
      @contextmenu.prevent="closeContextMenu"
    >
      <div
        data-context-menu
        class="absolute z-50 min-w-48 rounded-xl border border-default bg-default shadow-xl py-1 overflow-hidden"
        :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }"
        @click.stop
      >
        <!-- Lihat Detail -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openDetail(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-eye" class="size-4 text-muted shrink-0" />
          Lihat Detail
        </button>

        <!-- Edit -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openEdit(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-pencil" class="size-4 text-muted shrink-0" />
          Edit
        </button>

        <!-- Perpanjang (kondisional) -->
        <button
          v-if="contextMenuTarget?.needsRenewal && (contextMenuTarget?.status === 'AKAN_BERAKHIR' || contextMenuTarget?.status === 'EXPIRED') && !contextMenuTarget?.renewedTo"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openRenew(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4 text-muted shrink-0" />
          Perpanjang
        </button>

        <!-- Divider sebelum Unduh File (jika ada) -->
        <template v-if="contextMenuTarget?.fileUrl">
          <hr class="border-default my-1" />
          <a
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors cursor-pointer"
            :href="contextMenuTarget!.fileUrl!"
            target="_blank"
            rel="noopener noreferrer"
            @click="closeContextMenu()"
          >
            <UIcon name="i-lucide-download" class="size-4 text-muted shrink-0" />
            Unduh File
          </a>
        </template>

        <!-- Divider sebelum Hapus -->
        <hr class="border-default my-1" />

        <!-- Hapus -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
          @click="confirmDelete(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-trash" class="size-4 text-error shrink-0" />
          Hapus
        </button>
      </div>
    </div>
  </Teleport>
</template>
