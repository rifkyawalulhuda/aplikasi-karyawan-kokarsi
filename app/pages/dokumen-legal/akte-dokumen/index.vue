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
const { exportAkteDokumenExcel } = useExport()
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
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]

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

// --- Export ---
const isExporting = ref(false)
function handleExport() {
  const data = filteredData.value
  if (!data.length) {
    toast.add({ title: 'Tidak ada data', description: 'Belum ada data Akte Dokumen untuk diekspor.', color: 'warning' })
    return
  }
  isExporting.value = true
  try {
    exportAkteDokumenExcel(data)
    toast.add({ title: 'Export berhasil', description: `${data.length} data berhasil diekspor ke Excel.`, color: 'success' })
  } catch {
    toast.add({ title: 'Export gagal', color: 'error' })
  } finally {
    isExporting.value = false
  }
}

// --- Context Menu (klik kanan) ---
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<AkteDokumen | null>(null)

async function openContextMenu(e: MouseEvent, doc: AkteDokumen) {
  e.preventDefault()
  contextMenuTarget.value = doc
  contextMenu.value = true
  await nextTick()
  const menuEl = document.querySelector('[data-context-menu]') as HTMLElement
  const menuWidth = menuEl?.offsetWidth ?? 192
  const menuHeight = menuEl?.offsetHeight ?? 220
  contextMenuX.value = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
  contextMenuY.value = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
}

function closeContextMenu() {
  contextMenu.value = false
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

async function handleOpenId(openId: string | null | (string | null)[] | undefined) {
  if (!openId) return
  const unwatch = watch(documents, (val) => {
    if (!val.length) return
    const doc = val.find(d => d.id === Number(openId))
    if (doc) {
      openDetail(doc)
      unwatch()
    }
  }, { immediate: true })
}

onMounted(() => handleOpenId(route.query.openId))
watch(() => route.query.openId, (newId) => handleOpenId(newId))

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
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
            <UIcon name="i-lucide-file-signature" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data akte dokumen</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            Menampilkan {{ filteredData.length }} akte dokumen
          </div>
          <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
            class="w-20"
            aria-label="Jumlah baris per halaman"
          />
        </div>
        <UPagination
          :key="`pagination-${pagination.pageSize}`"
          :page="pagination.pageIndex + 1"
          :items-per-page="pagination.pageSize"
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

        <!-- Unduh File (kondisional) -->
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
