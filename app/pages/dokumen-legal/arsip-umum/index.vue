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
const currentYear = new Date().getFullYear()

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
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<Archive | null>(null)
const previewOpen = ref(false)
const previewTarget = ref<Archive | null>(null)
const exportModal = ref(false)
const exportYear = ref<number | 'all'>(currentYear)
const table = useTemplateRef('table')

const { data: res, status, refresh } = await useFetch<{ data: Archive[]; total: number }>('/api/general-archives', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

const archives = computed(() => res.value?.data ?? [])
const availableYears = computed(() => {
  const years = new Set(archives.value.filter(item => item.createdDate).map(item => new Date(item.createdDate!).getFullYear()))
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
})
const exportYearOptions = computed(() => [
  { label: 'Semua Tahun', value: 'all' as const },
  ...availableYears.value.map(year => ({ label: String(year), value: year })),
])
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
function isPdf(url?: string | null) { return !!url && url.toLowerCase().includes('.pdf') }
function openPreview(item: Archive) {
  if (!item.fileUrl) return
  previewTarget.value = item
  previewOpen.value = true
}
async function openContextMenu(event: MouseEvent, item: Archive) {
  event.preventDefault()
  contextMenuTarget.value = item
  contextMenu.value = true
  await nextTick()
  const menu = document.querySelector('[data-context-menu]') as HTMLElement | null
  const width = menu?.offsetWidth ?? 192
  const height = menu?.offsetHeight ?? 220
  contextMenuX.value = Math.min(event.clientX, window.innerWidth - width - 8)
  contextMenuY.value = Math.min(event.clientY, window.innerHeight - height - 8)
}
function closeContextMenu() { contextMenu.value = false }
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
  const year = exportYear.value === 'all' ? undefined : exportYear.value
  if (!exportGeneralArchivesExcel(archives.value, year)) {
    toast.add({ title: 'Tidak ada data', description: `Tidak ada arsip${year ? ` dengan tanggal dibuat tahun ${year}` : ''}.`, color: 'warning' })
    return
  }
  toast.add({ title: 'Export berhasil', description: `Data Arsip Umum${year ? ` tahun ${year}` : ''} berhasil diekspor.`, color: 'success' })
  exportModal.value = false
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
  { accessorKey: 'fileUrl', header: 'File', cell: ({ row }) => row.original.fileUrl ? h('button', { type: 'button', class: 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10', onClick: () => openPreview(row.original) }, [h(UIcon, { name: 'i-lucide-eye', class: 'size-3.5' }), 'Preview']) : h('span', { class: 'text-xs text-muted' }, '-') },
]
</script>

<template>
  <UDashboardPanel id="arsip-umum">
    <template #header>
      <UDashboardNavbar title="Arsip Umum">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" @click="exportModal = true" />
          <UButton label="Tambah Arsip" icon="i-lucide-plus" color="primary" @click="addModal = true" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <p class="mb-4 text-sm text-muted">Kelola dokumen umum koperasi beserta masa berlakunya.</p>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <UInput v-model="searchQuery" icon="i-lucide-search" class="max-w-sm" placeholder="Cari nama, nomor, atau keterangan..." />
      </div>
      <UTable ref="table" v-model:pagination="pagination" :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }" class="shrink-0" :data="filteredData" :columns="columns" :loading="status === 'pending'" :on-select="(_event: any, row: any) => openDetail(row.original)" :on-contextmenu="(event: any, row: any) => openContextMenu(event, row.original)" :ui="{ base: 'table-fixed border-separate border-spacing-0', thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none', tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-context-menu [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors', th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r', td: 'border-b border-default', separator: 'h-0' }">
        <template #empty><div class="flex flex-col items-center gap-2 py-12 text-muted"><UIcon name="i-lucide-archive" class="size-10 opacity-40" /><p class="text-sm">Belum ada data Arsip Umum</p></div></template>
      </UTable>
      <div class="mt-auto flex items-center justify-between gap-3 border-t border-default pt-4"><div class="flex items-center gap-3"><span class="text-sm text-muted">{{ filteredData.length }} arsip</span><USelect v-model="pagination.pageSize" :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))" class="w-20" aria-label="Jumlah baris per halaman" /></div><UPagination :key="`pagination-${pagination.pageSize}`" :page="pagination.pageIndex + 1" :items-per-page="pagination.pageSize" :total="filteredData.length" @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)" /></div>
    </template>
  </UDashboardPanel>
  <ArsipUmumFormModal v-model:open="addModal" mode="add" @saved="refresh" />
  <ArsipUmumFormModal v-model:open="editModal" mode="edit" :initial-data="editTarget" @saved="refresh" />
  <ArsipUmumDetailDrawer v-model:open="detailDrawer" :archive="detailTarget" @edit="openEdit" />

  <UModal v-model:open="exportModal" title="Export Arsip Umum" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <UFormField label="Tahun Export">
        <USelect v-model="exportYear" :items="exportYearOptions" class="w-full" />
        <p class="mt-1.5 text-xs text-muted">Arsip tanpa tanggal dibuat hanya tersedia pada opsi Semua Tahun.</p>
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="ghost" @click="exportModal = false" />
        <UButton label="Export Excel" icon="i-lucide-file-spreadsheet" color="primary" @click="handleExport" />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="previewOpen" :title="previewTarget?.documentName ?? 'Preview Dokumen'" :ui="{ content: 'sm:max-w-4xl w-full' }">
    <template #body>
      <div v-if="previewTarget?.fileUrl" class="overflow-hidden rounded-lg border border-default bg-elevated/20">
        <div v-if="isPdf(previewTarget.fileUrl)" class="h-[70vh] min-h-[420px]">
          <PdfViewer :src="previewTarget.fileUrl" />
        </div>
        <img v-else :src="previewTarget.fileUrl" :alt="`Preview ${previewTarget.documentName}`" class="max-h-[70vh] w-full object-contain" />
      </div>
    </template>
  </UModal>

  <Teleport to="body">
    <div v-if="contextMenu" class="fixed inset-0 z-50" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu">
      <div data-context-menu class="absolute z-50 min-w-48 overflow-hidden rounded-xl border border-default bg-default py-1 shadow-xl" :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }" @click.stop>
        <button class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60" @click="openDetail(contextMenuTarget!); closeContextMenu()"><UIcon name="i-lucide-eye" class="size-4 text-muted" />Lihat Detail</button>
        <button class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60" @click="openEdit(contextMenuTarget!); closeContextMenu()"><UIcon name="i-lucide-pencil" class="size-4 text-muted" />Edit</button>
        <template v-if="contextMenuTarget?.fileUrl">
          <hr class="my-1 border-default" />
          <button class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60" @click="openPreview(contextMenuTarget!); closeContextMenu()"><UIcon name="i-lucide-file-text" class="size-4 text-muted" />Lihat Preview</button>
          <a :href="contextMenuTarget.fileUrl" target="_blank" rel="noopener noreferrer" class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60" @click="closeContextMenu"><UIcon name="i-lucide-download" class="size-4 text-muted" />Unduh File</a>
        </template>
        <hr class="my-1 border-default" />
        <button class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-error/10" @click="confirmDelete(contextMenuTarget!); closeContextMenu()"><UIcon name="i-lucide-trash-2" class="size-4 text-error" />Hapus</button>
      </div>
    </div>
  </Teleport>
</template>
