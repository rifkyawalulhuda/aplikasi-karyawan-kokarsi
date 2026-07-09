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
interface LegalKoperasi {
  id: number
  category: 'IZIN' | 'SERTIFIKAT' | 'KEBIJAKAN' | 'DOKUMEN_INTERNAL' | 'DOKUMEN_B3' | 'LAIN_LAIN'
  documentName: string
  documentNumber: string
  publisher: string
  documentDate: string
  needsRenewal: boolean
  startDate?: string | null
  endDate?: string | null
  status: 'AKTIF' | 'AKAN_BERAKHIR' | 'EXPIRED' | 'TIDAK_AKTIF'
  location?: string | null
  notes?: string | null
  fileUrl?: string | null
  renewedFrom?: { id: number; documentName: string; documentNumber: string; fileUrl?: string | null; documentDate: string } | null
  renewedTo?: { id: number; documentName: string; documentNumber: string; status: string; documentDate: string } | null
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
const editTarget = ref<LegalKoperasi | null>(null)
const renewModal = ref(false)
const renewTarget = ref<LegalKoperasi | null>(null)
const detailDrawer = ref(false)
const detailTarget = ref<LegalKoperasi | null>(null)

// --- Fetch Data ---
const res = ref<{ data: LegalKoperasi[]; total: number } | null>(null)
const fetchStatus = ref<'pending' | 'success' | 'error'>('pending')

async function fetchDocuments() {
  fetchStatus.value = 'pending'
  try {
    const params: Record<string, string> = {
      page: String(pagination.value.pageIndex + 1),
      limit: String(pagination.value.pageSize),
    }
    if (searchQuery.value) params.search = searchQuery.value
    if (categoryFilter.value !== 'all') params.category = categoryFilter.value
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    res.value = await $fetch<{ data: LegalKoperasi[]; total: number }>('/api/legal-koperasi', {
      query: params,
      credentials: 'include',
    })
    fetchStatus.value = 'success'
  }
  catch {
    fetchStatus.value = 'error'
  }
}

await fetchDocuments()

function refresh() {
  fetchDocuments()
}

watch([searchQuery, categoryFilter, statusFilter], () => {
  pagination.value.pageIndex = 0
  fetchDocuments()
})

const documents = computed<LegalKoperasi[]>(() => res.value?.data ?? [])
const totalDocuments = computed(() => res.value?.total ?? 0)

// Client-side sort applied on top of server-fetched page
const sortedDocuments = computed<LegalKoperasi[]>(() => {
  const sort = sorting.value
  if (!sort) return documents.value

  return [...documents.value].sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sort.key) {
      case 'documentName':
        aVal = a.documentName ?? ''
        bVal = b.documentName ?? ''
        break
      case 'documentNumber':
        aVal = a.documentNumber ?? ''
        bVal = b.documentNumber ?? ''
        break
      case 'publisher':
        aVal = a.publisher ?? ''
        bVal = b.publisher ?? ''
        break
      case 'documentDate':
        aVal = a.documentDate ?? ''
        bVal = b.documentDate ?? ''
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

    const isDate = sort.key === 'documentDate' || sort.key === 'endDate'
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
  total: totalDocuments.value,
  aktif: documents.value.filter(d => d.status === 'AKTIF').length,
  akanBerakhir: documents.value.filter(d => d.status === 'AKAN_BERAKHIR').length,
  expired: documents.value.filter(d => d.status === 'EXPIRED').length,
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

// Computed display status — if document has been renewed, show "Sudah Diperpanjang"
function getDisplayStatus(doc: LegalKoperasi): string {
  if (doc.renewedTo) return 'SUDAH_DIPERPANJANG'
  return doc.status
}

const categoryLabel: Record<string, string> = {
  IZIN: 'Izin',
  SERTIFIKAT: 'Sertifikat',
  KEBIJAKAN: 'Kebijakan',
  DOKUMEN_INTERNAL: 'Dok. Internal',
  DOKUMEN_B3: 'Dok. B3',
  LAIN_LAIN: 'Lain-lain',
}

const categoryColor: Record<string, string> = {
  IZIN: 'warning',
  SERTIFIKAT: 'info',
  KEBIJAKAN: 'success',
  DOKUMEN_INTERNAL: 'primary',
  DOKUMEN_B3: 'error',
  LAIN_LAIN: 'neutral',
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
function getRowItems(row: Row<LegalKoperasi>): DropdownMenuItem[][] {
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
const columns: TableColumn<LegalKoperasi>[] = [
  {
    accessorKey: 'documentName',
    header: () => sortableHeader('Nama Dokumen', 'documentName'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) => {
      const doc = row.original
      return h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
        h('p', { class: 'font-medium text-sm text-highlighted' }, doc.documentName ?? '-'),
        h(UBadge, {
          label: categoryLabel[doc.category] ?? doc.category,
          color: categoryColor[doc.category] ?? 'neutral',
          variant: 'subtle',
          size: 'sm',
          class: 'mt-0.5 w-fit',
        }),
      ])
    },
  },
  {
    accessorKey: 'documentNumber',
    header: () => sortableHeader('No. Dokumen', 'documentNumber'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) =>
      h('span', { class: 'text-sm font-mono text-muted' }, row.original.documentNumber ?? '-'),
  },
  {
    accessorKey: 'publisher',
    header: () => sortableHeader('Penerbit', 'publisher'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) =>
      h('span', { class: 'text-sm text-highlighted' }, row.original.publisher ?? '-'),
  },
  {
    accessorKey: 'documentDate',
    header: () => sortableHeader('Tanggal', 'documentDate'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) =>
      h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(row.original.documentDate)),
  },
  {
    accessorKey: 'endDate',
    header: () => sortableHeader('Tanggal Berakhir', 'endDate'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) => {
      const doc = row.original
      if (!doc.needsRenewal || !doc.endDate) return h('span', { class: 'text-sm text-muted' }, '-')
      return h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(doc.endDate))
    },
  },
  {
    accessorKey: 'status',
    header: () => sortableHeader('Status', 'status'),
    cell: ({ row }: { row: Row<LegalKoperasi> }) => {
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
    cell: ({ row }: { row: Row<LegalKoperasi> }) => h('div', { class: 'flex justify-end' }, [
      h(UDropdownMenu, {
        items: getRowItems(row),
      }, () => h(UButton, { icon: 'i-lucide-ellipsis', variant: 'ghost', color: 'neutral' })),
    ]),
  },
]

// --- Delete ---
function confirmDelete(doc: LegalKoperasi) {
  confirmDeleteToast({
    title: 'Hapus dokumen?',
    description: `Dokumen "${doc.documentName}" akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/legal-koperasi/${doc.id}`, {
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
function openEdit(doc: LegalKoperasi) {
  editTarget.value = doc
  editModal.value = true
}

// --- Renew ---
function openRenew(doc: LegalKoperasi) {
  renewTarget.value = doc
  renewModal.value = true
}

// --- Detail ---
function openDetail(doc: LegalKoperasi) {
  detailTarget.value = doc
  detailDrawer.value = true
}

// --- Open document by ID (for renewedTo link in drawer) ---
async function openDocumentById(id: number) {
  try {
    const doc = await $fetch<LegalKoperasi>(`/api/legal-koperasi/${id}`, {
      credentials: 'include',
    })
    detailTarget.value = doc
    detailDrawer.value = true
  }
  catch {
    toast.add({ title: 'Gagal memuat detail dokumen', color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="legal-koperasi">
    <template #header>
      <UDashboardNavbar title="Legal Koperasi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
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
          placeholder="Cari nama atau nomor dokumen..."
        />
        <div class="flex flex-wrap gap-2">
          <USelect
            v-model="categoryFilter"
            :items="[
              { label: 'Semua Kategori', value: 'all' },
              { label: 'Izin', value: 'IZIN' },
              { label: 'Sertifikat', value: 'SERTIFIKAT' },
              { label: 'Kebijakan', value: 'KEBIJAKAN' },
              { label: 'Dok. Internal', value: 'DOKUMEN_INTERNAL' },
              { label: 'Dok. B3', value: 'DOKUMEN_B3' },
              { label: 'Lain-lain', value: 'LAIN_LAIN' },
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
        :data="sortedDocuments"
        :columns="columns"
        :loading="fetchStatus === 'pending'"
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
            <p class="text-sm">Belum ada data dokumen legal</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ documents.length }} dari {{ totalDocuments }} dokumen
        </div>
        <UPagination
          :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
          :items-per-page="table?.tableApi?.getState().pagination.pageSize"
          :total="documents.length"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Tambah -->
  <LegalKoperasiFormModal
    v-model:open="addModal"
    mode="add"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <LegalKoperasiFormModal
    v-if="editTarget"
    v-model:open="editModal"
    mode="edit"
    :initial-data="editTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { editModal = v; if (!v) editTarget = null }"
  />

  <!-- Modal Perpanjang -->
  <LegalKoperasiFormModal
    v-if="renewTarget"
    v-model:open="renewModal"
    mode="renew"
    :initial-data="renewTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { renewModal = v; if (!v) renewTarget = null }"
  />

  <!-- Detail Drawer -->
  <LegalKoperasiDetailDrawer
    v-if="detailTarget"
    v-model:open="detailDrawer"
    :document="detailTarget"
    @update:open="(v: boolean) => { detailDrawer = v; if (!v) detailTarget = null }"
    @edit="(doc) => { detailDrawer = false; openEdit(doc) }"
    @open-document="openDocumentById"
  />
</template>
