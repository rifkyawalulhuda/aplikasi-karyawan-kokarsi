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
interface AkteDokumen {
  id: number
  tanggal: string
  notaris: string
  nomorAkte: string
  judulAkte: string
  nomorSk?: string | null
  tanggalSk?: string | null
  keterangan?: string | null
  fileUrl?: string | null
  createdAt: string
  updatedAt: string
}

// --- State ---
const searchQuery = ref('')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<AkteDokumen | null>(null)
const detailDrawer = ref(false)
const detailTarget = ref<AkteDokumen | null>(null)

function openDetail(doc: AkteDokumen) {
  detailTarget.value = doc
  detailDrawer.value = true
}

// --- Fetch Data ---
const { data: res, status, refresh } = await useFetch<{ data: AkteDokumen[]; total: number }>('/api/akte-dokumen', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

const documents = computed<AkteDokumen[]>(() => res.value?.data ?? [])

// --- Helpers ---
function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// --- Search / Filter ---
const filteredData = computed(() => {
  let result = documents.value

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(doc =>
      [doc.judulAkte, doc.nomorAkte, doc.notaris, doc.nomorSk ?? '']
        .some(v => v.toLowerCase().includes(q)),
    )
  }

  const sort = sorting.value
  if (!sort) return result

  return [...result].sort((a, b) => {
    let aVal: any = ''
    let bVal: any = ''
    switch (sort.key) {
      case 'tanggal': aVal = a.tanggal; bVal = b.tanggal; break
      case 'judulAkte': aVal = a.judulAkte; bVal = b.judulAkte; break
      case 'notaris': aVal = a.notaris; bVal = b.notaris; break
      case 'nomorAkte': aVal = a.nomorAkte; bVal = b.nomorAkte; break
    }
    const compare = String(aVal).localeCompare(String(bVal), 'id')
    return sort.direction === 'asc' ? compare : -compare
  })
})

function toggleSort(key: string) {
  if (sorting.value?.key !== key) { sorting.value = { key, direction: 'asc' }; return }
  if (sorting.value.direction === 'asc') { sorting.value = { key, direction: 'desc' }; return }
  sorting.value = null
}

function sortableHeader(label: string, key: string) {
  const isActive = sorting.value?.key === key
  const icon = !isActive ? 'i-lucide-arrow-up-down'
    : sorting.value?.direction === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
  return h('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 text-left font-medium text-highlighted hover:text-primary transition-colors',
    onClick: () => toggleSort(key),
  }, [h('span', label), h(UIcon, { name: icon, class: 'size-3.5 text-muted' })])
}

// --- Row Actions ---
function getRowItems(row: Row<AkteDokumen>): DropdownMenuItem[][] {
  const doc = row.original
  const group1: DropdownMenuItem[] = [
    { label: 'Lihat Detail', icon: 'i-lucide-eye', onSelect: () => openDetail(doc) },
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(doc) },
  ]
  if (doc.fileUrl) {
    group1.push({ label: 'Unduh File', icon: 'i-lucide-download', onSelect: () => window.open(doc.fileUrl!, '_blank') })
  }
  return [
    group1,
    [{ label: 'Hapus', icon: 'i-lucide-trash', color: 'error', onSelect: () => confirmDelete(doc) }],
  ]
}

// --- Table Columns ---
const columns: TableColumn<AkteDokumen>[] = [
  {
    accessorKey: 'judulAkte',
    header: () => sortableHeader('Judul Akte', 'judulAkte'),
    cell: ({ row }: { row: Row<AkteDokumen> }) => {
      const doc = row.original
      return h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
        h('p', { class: 'font-medium text-sm text-highlighted truncate' }, doc.judulAkte),
        h('p', { class: 'text-xs text-muted font-mono' }, doc.nomorAkte),
      ])
    },
  },
  {
    accessorKey: 'notaris',
    header: () => sortableHeader('Notaris', 'notaris'),
    cell: ({ row }: { row: Row<AkteDokumen> }) => h('p', { class: 'text-sm' }, row.original.notaris),
  },
  {
    accessorKey: 'tanggal',
    header: () => sortableHeader('Tanggal', 'tanggal'),
    cell: ({ row }: { row: Row<AkteDokumen> }) => h('p', { class: 'text-sm tabular-nums' }, formatDate(row.original.tanggal)),
  },
  {
    accessorKey: 'nomorSk',
    header: 'No. SK',
    cell: ({ row }: { row: Row<AkteDokumen> }) => h('p', { class: 'text-sm font-mono text-muted' }, row.original.nomorSk ?? '-'),
  },
  {
    accessorKey: 'fileUrl',
    header: 'File',
    cell: ({ row }: { row: Row<AkteDokumen> }) => {
      const doc = row.original
      if (!doc.fileUrl) return h('span', { class: 'text-muted text-xs' }, '-')
      return h('a', {
        href: doc.fileUrl,
        target: '_blank',
        class: 'inline-flex items-center gap-1 text-primary hover:underline text-xs',
      }, [h(UIcon, { name: 'i-lucide-paperclip', class: 'size-3.5' }), 'Lihat'])
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }: { row: Row<AkteDokumen> }) =>
      h(UDropdownMenu, { items: getRowItems(row) }, () =>
        h(UButton, { icon: 'i-lucide-ellipsis-vertical', color: 'neutral', variant: 'ghost', size: 'xs' }),
      ),
  },
]

// --- Edit ---
function openEdit(doc: AkteDokumen) {
  editTarget.value = doc
  editModal.value = true
}

// --- Delete ---
function confirmDelete(doc: AkteDokumen) {
  confirmDeleteToast({
    title: 'Hapus Akte Dokumen?',
    description: `"${doc.judulAkte}" akan dihapus permanen.`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/akte-dokumen/${doc.id}`, { method: 'DELETE', credentials: 'include' })
        toast.add({ title: 'Akte berhasil dihapus', color: 'success' })
        await refresh()
      } catch (e: any) {
        toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
      }
    },
  })
}

// Deep-link: ?openId=<id>
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
  <UDashboardPanel id="akte-dokumen">
    <template #header>
      <UDashboardNavbar title="Akte Dokumen">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah Akte"
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
          Total: {{ documents.length }}
        </UBadge>
      </div>

      <!-- Search bar -->
      <div class="mb-4">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Cari judul akte, nomor, notaris..."
          class="w-full sm:max-w-xs"
          @update:model-value="pagination.pageIndex = 0"
        />
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :data="filteredData"
        :columns="columns"
        :loading="status === 'pending'"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
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
            <UIcon name="i-lucide-file-signature" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data akte dokumen</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ filteredData.length }} akte dokumen
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
  <AkteDokumenDetailDrawer
    v-model:open="detailDrawer"
    :document="detailTarget"
    @update:open="(v: boolean) => { detailDrawer = v; if (!v) detailTarget = null }"
    @edit="(doc) => { detailDrawer = false; openEdit(doc) }"
  />

  <!-- Modal Tambah -->
  <AkteDokumenFormModal
    v-model:open="addModal"
    mode="add"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <AkteDokumenFormModal
    v-if="editTarget"
    v-model:open="editModal"
    mode="edit"
    :initial-data="editTarget"
    @saved="refresh()"
    @update:open="(v: boolean) => { editModal = v; if (!v) editTarget = null }"
  />
</template>
