<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { h } from 'vue'

definePageMeta({ layout: 'default' })

const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { exportGeneralArchivesExcel } = useExport()
const route = useRoute()

interface Archive {
  id: number
  documentName: string
  documentNumber?: string | null
  createdDate?: string | null
  expiryDate?: string | null
  notes?: string | null
  fileUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

const searchQuery = ref('')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<Archive | null>(null)
const detailDrawer = ref(false)
const detailTarget = ref<Archive | null>(null)
const table = useTemplateRef('table')

const { data: res, status, refresh } = await useFetch<{ data: Archive[]; total: number }>('/api/general-archives', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

const archives = computed(() => res.value?.data ?? [])
const filteredData = computed(() => {
  let result = archives.value
  const query = searchQuery.value.trim().toLowerCase()
  if (query) result = result.filter(item => [item.documentName, item.documentNumber ?? '', item.notes ?? ''].some(value => value.toLowerCase().includes(query)))
  const sort = sorting.value
  if (!sort) return result
  return [...result].sort((a, b) => {
    const aRaw = (a as any)[sort.key]
    const bRaw = (b as any)[sort.key]
    const comparison = sort.key === 'createdDate' || sort.key === 'expiryDate'
      ? new Date(aRaw ?? 0).getTime() - new Date(bRaw ?? 0).getTime()
      : String(aRaw ?? '').localeCompare(String(bRaw ?? ''), 'id')
    return sort.direction === 'asc' ? comparison : -comparison
  })
})

function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }
function isExpired(value?: string | null) { return !!value && new Date(value).getTime() < Date.now() }
function toggleSort(key: string) {
  if (sorting.value?.key !== key) sorting.value = { key, direction: 'asc' }
  else if (sorting.value.direction === 'asc') sorting.value = { key, direction: 'desc' }
  else sorting.value = null
}
function sortableHeader(label: string, key: string) {
  const active = sorting.value?.key === key
  const icon = !active ? 'i-lucide-arrow-up-down' : sorting.value?.direction === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'
  return h('button', { type: 'button', class: 'inline-flex items-center gap-1.5 text-left font-medium text-highlighted hover:text-primary', onClick: () => toggleSort(key) }, [h('span', label), h(UIcon, { name: icon, class: 'size-3.5 text-muted' })])
}

function openDetail(item: Archive) { detailTarget.value = item; detailDrawer.value = true }
function openEdit(item: Archive) { editTarget.value = item; editModal.value = true; detailDrawer.value = false }
function confirmDelete(item: Archive) {
  confirmDeleteToast({
    title: 'Hapus Arsip Umum',
    description: `Arsip "${item.documentName}" akan dihapus permanen. Lanjutkan?`,
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      await $fetch(`/api/general-archives/${item.id}`, { method: 'DELETE' })
      await refresh()
      toast.add({ title: 'Arsip berhasil dihapus', color: 'success' })
    },
  })
}
function handleExport() {
  if (!exportGeneralArchivesExcel(filteredData.value)) toast.add({ title: 'Tidak ada data untuk diekspor', color: 'warning' })
  else toast.add({ title: 'Export berhasil', color: 'success' })
}
async function handleOpenId(value: string | null | (string | null)[] | undefined) {
  if (!value) return
  const id = Number(Array.isArray(value) ? value[0] : value)
  const item = archives.value.find(archive => archive.id === id)
  if (item) openDetail(item)
}
onMounted(() => handleOpenId(route.query.openId))
watch(() => route.query.openId, value => handleOpenId(value))

const columns: TableColumn<Archive>[] = [
  { accessorKey: 'documentName', header: () => sortableHeader('Dokumen', 'documentName'), cell: ({ row }) => h('div', { class: 'min-w-0' }, [h('p', { class: 'truncate text-sm font-medium text-highlighted' }, row.original.documentName), h('p', { class: 'text-xs text-muted' }, row.original.documentNumber ?? 'Nomor tidak tersedia')]) },
  { accessorKey: 'createdDate', header: () => sortableHeader('Tanggal Dibuat', 'createdDate'), cell: ({ row }) => h('span', { class: 'whitespace-nowrap text-sm tabular-nums' }, formatDate(row.original.createdDate)) },
  { accessorKey: 'expiryDate', header: () => sortableHeader('Tanggal Berakhir', 'expiryDate'), cell: ({ row }) => h('span', { class: ['whitespace-nowrap text-sm tabular-nums', isExpired(row.original.expiryDate) ? 'text-error' : ''] }, formatDate(row.original.expiryDate)) },
  { accessorKey: 'notes', header: 'Keterangan', cell: ({ row }) => h('p', { class: 'max-w-xs truncate text-sm text-muted' }, row.original.notes ?? '-') },
  { accessorKey: 'fileUrl', header: 'File', cell: ({ row }) => row.original.fileUrl ? h('button', { type: 'button', class: 'inline-flex items-center gap-1 text-xs text-primary hover:underline', onClick: () => openDetail(row.original) }, [h(UIcon, { name: 'i-lucide-eye', class: 'size-3.5' }), 'Preview']) : h('span', { class: 'text-xs text-muted' }, '-') },
  { id: 'actions', header: 'Aksi', cell: ({ row }) => h('div', { class: 'flex items-center justify-end gap-1' }, [h(UButton, { icon: 'i-lucide-eye', color: 'neutral', variant: 'ghost', size: 'xs', 'aria-label': 'Lihat detail', onClick: () => openDetail(row.original) }), h(UButton, { icon: 'i-lucide-pencil', color: 'neutral', variant: 'ghost', size: 'xs', 'aria-label': 'Edit arsip', onClick: () => openEdit(row.original) }), h(UButton, { icon: 'i-lucide-trash-2', color: 'error', variant: 'ghost', size: 'xs', 'aria-label': 'Hapus arsip', onClick: () => confirmDelete(row.original) })]) },
]
</script>

<template>
  <UDashboardPanel id="arsip-umum">
    <template #header>
      <UDashboardNavbar title="Arsip Umum">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" @click="handleExport" />
          <UButton label="Tambah Arsip" icon="i-lucide-plus" color="primary" @click="addModal = true" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <p class="mb-4 text-sm text-muted">Kelola dokumen umum koperasi beserta masa berlakunya.</p>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <UInput v-model="searchQuery" icon="i-lucide-search" class="max-w-sm" placeholder="Cari nama, nomor, atau keterangan..." />
      </div>
      <UTable ref="table" v-model:pagination="pagination" :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }" class="shrink-0" :data="filteredData" :columns="columns" :loading="status === 'pending'" :ui="{ base: 'table-fixed border-separate border-spacing-0', thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none', tbody: '[&>tr]:last:[&>td]:border-b-0', th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r', td: 'border-b border-default', separator: 'h-0' }">
        <template #empty><div class="flex flex-col items-center gap-2 py-12 text-muted"><UIcon name="i-lucide-archive" class="size-10 opacity-40" /><p class="text-sm">Belum ada data Arsip Umum</p></div></template>
      </UTable>
      <div class="mt-auto flex items-center justify-between gap-3 border-t border-default pt-4"><div class="flex items-center gap-3"><span class="text-sm text-muted">{{ filteredData.length }} arsip</span><USelect v-model="pagination.pageSize" :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))" class="w-20" aria-label="Jumlah baris per halaman" /></div><UPagination :key="`pagination-${pagination.pageSize}`" :page="pagination.pageIndex + 1" :items-per-page="pagination.pageSize" :total="filteredData.length" @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)" /></div>
    </template>
  </UDashboardPanel>
  <ArsipUmumFormModal v-model:open="addModal" mode="add" @saved="refresh" />
  <ArsipUmumFormModal v-model:open="editModal" mode="edit" :initial-data="editTarget" @saved="refresh" />
  <ArsipUmumDetailDrawer v-model:open="detailDrawer" :archive="detailTarget" @edit="openEdit" />
</template>
