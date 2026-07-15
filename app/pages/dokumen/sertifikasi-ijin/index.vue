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
const { exportEmployeeDocumentsExcel } = useExport()

// --- Export ---
const isExporting = ref(false)
async function handleExport() {
  if (!documents.value.length) {
    toast.add({ title: 'Tidak ada data', description: 'Belum ada data Sertifikasi & Ijin untuk diekspor.', color: 'warning' })
    return
  }
  isExporting.value = true
  try {
    exportEmployeeDocumentsExcel(documents.value)
    toast.add({ title: 'Export berhasil', description: `${documents.value.length} data berhasil diekspor ke Excel.`, color: 'success' })
  } catch {
    toast.add({ title: 'Export gagal', color: 'error' })
  } finally {
    isExporting.value = false
  }
}

// --- Types ---
interface EmployeeDocument {
  id: number
  employeeId: number
  documentTypeId: number
  documentNumber: string
  expiryDate: string
  notes?: string
  fileUrl?: string
  status: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  employee: { id: number; employeeNo: string; fullName: string }
  documentType: { id: number; name: string; documentType: string; issuer: string }
  createdAt: string
  updatedAt: string
}

// --- State ---
const searchQuery = ref('')
const statusFilter = ref('all')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<EmployeeDocument | null>(null)
const detailDrawer = ref(false)
const detailTarget = ref<EmployeeDocument | null>(null)

function openDetail(doc: EmployeeDocument) {
  detailTarget.value = doc
  detailDrawer.value = true
}

// --- Fetch Data ---
const { data: docsRes, status, refresh } = await useFetch<{ data: EmployeeDocument[]; total: number }>('/api/employee-documents', {
  query: { limit: 999, documentTypeCategory: 'CERTIFICATION' },
  lazy: true,
  credentials: 'include',
})

const documents = computed<EmployeeDocument[]>(() => docsRes.value?.data ?? [])

const counts = computed(() => ({
  total: documents.value.length,
  aktif: documents.value.filter(d => d.status === 'AKTIF').length,
  akanExpired: documents.value.filter(d => d.status === 'AKAN_EXPIRED').length,
  expired: documents.value.filter(d => d.status === 'EXPIRED').length,
}))

// --- Helpers ---
function formatDate(date: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

const docTypeColor: Record<string, string> = {
  SERTIFIKAT: 'blue',
  LISENSI: 'green',
  IZIN: 'yellow',
  RAHASIA: 'red',
  LAINNYA: 'gray',
}

// --- Search / Filter ---
function getSearchText(doc: EmployeeDocument) {
  return [
    doc.employee?.fullName,
    doc.employee?.employeeNo,
    doc.documentNumber,
    doc.documentType?.name,
    doc.documentType?.issuer,
    doc.documentType?.documentType,
    formatDate(doc.expiryDate),
    statusLabel[doc.status],
  ]
    .flatMap(v => String(v ?? '').toLowerCase().split(/\s+/))
    .filter(Boolean)
    .join(' ')
}

const filteredData = computed(() => {
  let result = documents.value

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim().replace(/\s+/g, ' ')
    result = result.filter(doc => getSearchText(doc).includes(q))
  }

  if (statusFilter.value !== 'all') {
    result = result.filter(doc => doc.status === statusFilter.value)
  }

  const sort = sorting.value
  if (!sort) return result

  return [...result].sort((a, b) => {
    let aVal: string | number = ''
    let bVal: string | number = ''

    switch (sort.key) {
      case 'employee':
        aVal = a.employee?.fullName ?? ''
        bVal = b.employee?.fullName ?? ''
        break
      case 'documentName':
        aVal = a.documentType?.name ?? ''
        bVal = b.documentType?.name ?? ''
        break
      case 'documentNumber':
        aVal = a.documentNumber ?? ''
        bVal = b.documentNumber ?? ''
        break
      case 'expiryDate':
        aVal = a.expiryDate ?? ''
        bVal = b.expiryDate ?? ''
        break
      case 'status':
        aVal = a.status ?? ''
        bVal = b.status ?? ''
        break
    }

    let compare = 0
    if (sort.key === 'expiryDate') {
      compare = new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime()
    }
    else {
      compare = String(aVal).localeCompare(String(bVal), 'id')
    }

    return sort.direction === 'asc' ? compare : -compare
  })
})

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
function getRowItems(row: Row<EmployeeDocument>): DropdownMenuItem[][] {
  const doc = row.original
  const group1: DropdownMenuItem[] = [
    { label: 'Lihat Detail', icon: 'i-lucide-eye', onSelect: () => openDetail(doc) },
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(doc) },
  ]
  if (doc.status !== 'AKTIF') {
    group1.push({ label: 'Perpanjang', icon: 'i-lucide-refresh-cw', onSelect: () => openRenew(doc) })
  }
  if (doc.fileUrl) {
    group1.push({ label: 'Unduh File', icon: 'i-lucide-download', onSelect: () => window.open(doc.fileUrl, '_blank') })
  }
  return [
    group1,
    [
      { label: 'Hapus', icon: 'i-lucide-trash', color: 'error', onSelect: () => confirmDelete(doc) },
    ],
  ]
}

// --- Table Columns ---
const columns: TableColumn<EmployeeDocument>[] = [
  {
    accessorKey: 'employee',
    header: () => sortableHeader('Karyawan', 'employee'),
    cell: ({ row }: { row: Row<EmployeeDocument> }) => {
      const doc = row.original
      return h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
        h('p', { class: 'font-medium text-sm text-highlighted' }, doc.employee?.fullName ?? '-'),
        h('p', { class: 'text-xs text-muted' }, doc.employee?.employeeNo ?? '-'),
      ])
    },
  },
  {
    accessorKey: 'documentName',
    header: () => sortableHeader('Nama Dokumen', 'documentName'),
    cell: ({ row }: { row: Row<EmployeeDocument> }) =>
      h('span', { class: 'text-sm text-highlighted' }, row.original.documentType?.name ?? '-'),
  },
  {
    accessorKey: 'documentNumber',
    header: () => sortableHeader('No. Dokumen', 'documentNumber'),
    cell: ({ row }: { row: Row<EmployeeDocument> }) =>
      h('span', { class: 'text-sm font-mono text-muted' }, row.original.documentNumber ?? '-'),
  },
  {
    accessorKey: 'docType',
    header: 'Jenis',
    cell: ({ row }: { row: Row<EmployeeDocument> }) => {
      const type = row.original.documentType?.documentType ?? 'LAINNYA'
      return h(UBadge, {
        label: type,
        color: docTypeColor[type] ?? 'gray',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    accessorKey: 'issuer',
    header: 'Penerbit',
    cell: ({ row }: { row: Row<EmployeeDocument> }) =>
      h('span', { class: 'text-sm text-muted' }, row.original.documentType?.issuer ?? '-'),
  },
  {
    accessorKey: 'expiryDate',
    header: () => sortableHeader('Masa Berlaku', 'expiryDate'),
    cell: ({ row }: { row: Row<EmployeeDocument> }) =>
      h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(row.original.expiryDate)),
  },
  {
    accessorKey: 'status',
    header: () => sortableHeader('Status', 'status'),
    cell: ({ row }: { row: Row<EmployeeDocument> }) => {
      const s = row.original.status
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
    cell: ({ row }: { row: Row<EmployeeDocument> }) => h('div', { class: 'flex justify-end' }, [
      h(UDropdownMenu, {
        items: getRowItems(row),
      }, () => h(UButton, { icon: 'i-lucide-ellipsis', variant: 'ghost', color: 'neutral' })),
    ]),
  },
]

// --- Delete ---
function confirmDelete(doc: EmployeeDocument) {
  confirmDeleteToast({
    title: 'Hapus dokumen?',
    description: `Dokumen "${doc.documentType?.name}" milik ${doc.employee?.fullName} akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/employee-documents/${doc.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        await refresh()
        toast.add({ title: 'Dokumen berhasil dihapus', color: 'success' })
      }
      catch {
        toast.add({ title: 'Gagal menghapus dokumen', color: 'error' })
      }
    },
  })
}

// --- Edit ---
function openEdit(doc: EmployeeDocument) {
  editTarget.value = doc
  editModal.value = true
}

// --- Renew ---
const renewModal = ref(false)
const renewTarget = ref<EmployeeDocument | null>(null)

function openRenew(doc: EmployeeDocument) {
  renewTarget.value = doc
  renewModal.value = true
}

watch([searchQuery, statusFilter], () => {
  pagination.value.pageIndex = 0
})

// --- Deep-link: ?openId=<id> dari pencarian global ---
const route = useRoute()
onMounted(() => {
  const openId = route.query.openId
  if (openId) {
    const doc = documents.value.find(d => d.id === Number(openId))
    if (doc) openDetail(doc)
  }
})
</script>

<template>
  <UDashboardPanel id="sertifikasi-ijin">
    <template #header>
      <UDashboardNavbar title="Sertifikasi & Ijin">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UDropdownMenu
            :items="[
              [
                { label: 'Export Excel', icon: 'i-lucide-file-spreadsheet', onSelect: () => handleExport() }
              ]
            ]"
          >
            <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" :loading="isExporting" />
          </UDropdownMenu>
          <UButton
            label="Tambah Dokumen"
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
          Akan Expired: {{ counts.akanExpired }}
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
          placeholder="Cari karyawan atau nomor dokumen..."
        />
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Semua Status', value: 'all' },
            { label: 'Aktif', value: 'AKTIF' },
            { label: 'Akan Expired', value: 'AKAN_EXPIRED' },
            { label: 'Expired', value: 'EXPIRED' },
          ]"
          placeholder="Filter status"
          class="min-w-44"
        />
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="filteredData"
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
            <UIcon name="i-lucide-file-badge" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data dokumen</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ filteredData.length }} dokumen
        </div>
        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="table?.tableApi?.getState().pagination.pageSize"
          :total="filteredData.length"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Detail Drawer -->
  <SertifikasiIjinDetailDrawer
    v-model:open="detailDrawer"
    :document="detailTarget"
    @update:open="(v: boolean) => { detailDrawer = v; if (!v) detailTarget = null }"
    @edit="(doc) => { detailDrawer = false; openEdit(doc) }"
    @renew="(doc) => { detailDrawer = false; openRenew(doc) }"
  />

  <!-- Modal Tambah -->
  <SertifikasiIjinFormModal
    v-model:open="addModal"
    mode="add"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <SertifikasiIjinFormModal
    v-if="editTarget"
    v-model:open="editModal"
    mode="edit"
    :initial-data="editTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { editModal = v; if (!v) editTarget = null }"
  />

  <!-- Modal Perpanjang -->
  <SertifikasiIjinFormModal
    v-if="renewTarget"
    v-model:open="renewModal"
    mode="renew"
    :initial-data="renewTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { renewModal = v; if (!v) renewTarget = null }"
  />
</template>
