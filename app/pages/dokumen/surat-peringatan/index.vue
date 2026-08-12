<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { WarningLetter } from '~/types'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { exportWarningLettersExcel } = useExport()
const table = useTemplateRef('table')

// --- Export ---
const currentYear = new Date().getFullYear()
const availableYears = computed(() => {
  const years = new Set(
    (letters.value ?? []).map((l: any) => new Date(l.letterDate).getFullYear())
  )
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
})
const exportModal = ref(false)
const exportYear = ref<number | 'all'>(currentYear)
const exportYearOptions = computed(() => [
  { label: 'Semua Tahun', value: 'all' as const },
  ...availableYears.value.map(y => ({ label: String(y), value: y })),
])
function handleExport() {
  const year = exportYear.value === 'all' ? undefined : exportYear.value
  const ok = exportWarningLettersExcel(letters.value, year)
  if (ok) {
    toast.add({ title: 'Export berhasil', description: `Data surat peringatan${year ? ` tahun ${year}` : ''} berhasil diekspor.`, color: 'success' })
    exportModal.value = false
  } else {
    toast.add({ title: 'Tidak ada data', description: `Tidak ada surat peringatan${year ? ` di tahun ${year}` : ''}.`, color: 'warning' })
  }
}

const searchQuery = ref('')
const levelFilter = ref('all')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<WarningLetter | null>(null)
const previewModal = ref(false)
const previewTarget = ref<WarningLetter | null>(null)
const previewLoading = ref(false)
const previewPdfSrc = ref('')

const { data: lettersRes, status, refresh } = await useFetch<{ data: WarningLetter[]; total: number }>('/api/warning-letters', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})

const letters = computed<WarningLetter[]>(() => lettersRes.value?.data ?? [])

const counts = computed(() => ({
  total: letters.value.length,
  sp1: letters.value.filter(l => l.warningLevel === 1).length,
  sp2: letters.value.filter(l => l.warningLevel === 2).length,
  sp3: letters.value.filter(l => l.warningLevel === 3).length,
}))

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getSearchTokens(letter: WarningLetter) {
  return [
    letter.letterNumber,
    String(letter.warningLevel),
    `SP ${letter.warningLevel}`,
    letter.letterDate,
    formatDate(letter.letterDate),
    letter.validUntil,
    formatDate(letter.validUntil),
    letter.processedByName,
    letter.employee?.fullName,
    letter.employee?.employeeNo,
    letter.employee?.jobRole?.name,
    ...(letter.violationType ?? []),
  ]
    .flatMap(value => String(value ?? '').toLowerCase().split(/\s+/))
    .filter(Boolean)
}

function getSearchText(letter: WarningLetter) {
  return getSearchTokens(letter).join(' ')
}

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

function getSortValue(letter: WarningLetter, key: string) {
  switch (key) {
    case 'letterNumber':
      return letter.letterNumber ?? ''
    case 'employee':
      return `${letter.employee?.fullName ?? ''} ${letter.employee?.employeeNo ?? ''}`
    case 'warningLevel':
      return letter.warningLevel ?? 0
    case 'letterDate':
      return letter.letterDate ?? ''
    case 'validUntil':
      return letter.validUntil ?? ''
    case 'processedByName':
      return letter.processedByName ?? ''
    case 'violationType':
      return (letter.violationType ?? []).join(' ')
    default:
      return ''
  }
}

const filteredData = computed(() => {
  let result = letters.value

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim().replace(/\s+/g, ' ')
    result = result.filter(letter => getSearchText(letter).includes(q))
  }

  if (levelFilter.value !== 'all') {
    result = result.filter(letter => letter.warningLevel === +levelFilter.value)
  }

  const sort = sorting.value
  if (!sort) return result

  return [...result].sort((a, b) => {
    const aValue = getSortValue(a, sort.key)
    const bValue = getSortValue(b, sort.key)
    let compare = 0

    if (sort.key === 'warningLevel') {
      compare = Number(aValue) - Number(bValue)
    } else if (sort.key === 'letterDate' || sort.key === 'validUntil') {
      compare = new Date(String(aValue)).getTime() - new Date(String(bValue)).getTime()
    } else {
      compare = String(aValue).localeCompare(String(bValue), 'id', { sensitivity: 'base' })
    }

    return sort.direction === 'asc' ? compare : -compare
  })
})

const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]

function spBadgeColor(level: number) {
  if (level === 1) return 'info'
  if (level === 2) return 'warning'
  return 'error'
}

function openEdit(letter: WarningLetter) {
  editTarget.value = letter
  editModal.value = true
}

function closePreview() {
  previewTarget.value = null
  previewLoading.value = false
  previewPdfSrc.value = ''
  previewModal.value = false
}

async function openPreview(letter: WarningLetter) {
  previewTarget.value = letter
  previewLoading.value = false
  // PdfViewer will fetch and render this URL to canvas
  previewPdfSrc.value = `/api/warning-letters/${letter.id}/preview?preview=${Date.now()}`
  previewModal.value = true
}

function openDownload(letter: WarningLetter) {
  handleGeneratePDF(letter)
}

async function handleDelete(id: number) {
  confirmDeleteToast({
    title: 'Hapus surat peringatan?',
    description: 'Surat peringatan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
    confirmLabel: 'Hapus',
    onConfirm: async () => {
      try {
        await $fetch(`/api/warning-letters/${id}`, { method: 'DELETE', credentials: 'include' })
        await refresh()
        toast.add({ title: 'Surat peringatan berhasil dihapus', color: 'success' })
      } catch {
        toast.add({ title: 'Gagal menghapus', color: 'error' })
      }
    },
  })
}

async function handleGeneratePDF(letter: WarningLetter) {
  try {
    const blob = await $fetch(`/api/warning-letters/${letter.id}/generate`, {
      responseType: 'blob',
      credentials: 'include',
    })
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SP-${letter.letterNumber}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.add({ title: 'PDF berhasil diunduh', color: 'success' })
  } catch {
    toast.add({ title: 'Gagal mengunduh PDF', color: 'error' })
  }
}

function getRowItems(row: Row<WarningLetter>): DropdownMenuItem[][] {
  const group1: DropdownMenuItem[] = [
    { label: 'Lihat Dokumen', icon: 'i-lucide-eye', onSelect: () => openPreview(row.original) },
    { label: 'Unduh PDF', icon: 'i-lucide-download', onSelect: () => handleGeneratePDF(row.original) },
    { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => openEdit(row.original) },
  ]

  if (row.original.documentUrl) {
    group1.push({
      label: 'Unduh Dokumen',
      icon: 'i-lucide-file-down',
      onSelect: () => window.open(row.original.documentUrl!, '_blank'),
    })
  }

  return [
    group1,
    [{ label: 'Hapus', icon: 'i-lucide-trash', color: 'error', onSelect: () => handleDelete(row.original.id) }],
  ]
}

watch([searchQuery, levelFilter], () => {
  pagination.value.pageIndex = 0
})

watch(() => pagination.value.pageSize, () => {
  pagination.value.pageIndex = 0
})

const columns: TableColumn<WarningLetter>[] = [
  {
    accessorKey: 'letterNumber',
    header: () => sortableHeader('Nomor Surat', 'letterNumber'),
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.letterNumber),
  },
  {
    accessorKey: 'employee',
    header: () => sortableHeader('Nama Karyawan', 'employee'),
    cell: ({ row }) => h('div', undefined, [
      h('p', { class: 'font-medium text-sm text-highlighted' }, row.original.employee?.fullName ?? '-'),
      h('p', { class: 'text-xs text-muted' }, row.original.employee?.employeeNo ?? '-'),
    ]),
  },
  {
    accessorKey: 'warningLevel',
    header: () => sortableHeader('Level SP', 'warningLevel'),
    cell: ({ row }) => h(UBadge, {
      color: spBadgeColor(row.original.warningLevel),
      variant: 'subtle',
      label: `SP ${row.original.warningLevel}`,
    }),
  },
  {
    accessorKey: 'letterDate',
    header: () => sortableHeader('Tanggal Surat', 'letterDate'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.original.letterDate)),
  },
  {
    accessorKey: 'validUntil',
    header: () => sortableHeader('Berlaku Sampai', 'validUntil'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.original.validUntil)),
  },
  {
    accessorKey: 'processedByName',
    header: () => sortableHeader('Pengurus Koperasi', 'processedByName'),
    cell: ({ row }) => h('span', { class: 'text-sm text-highlighted' }, row.original.processedByName || '-'),
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
      h(UDropdownMenu, {
        items: getRowItems(row),
      }, () => h(UButton, { icon: 'i-lucide-ellipsis', variant: 'ghost', color: 'neutral' })),
    ]),
  },
]
</script>

<template>
  <UDashboardPanel id="surat-peringatan">
    <template #header>
      <UDashboardNavbar title="Surat Peringatan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" @click="exportModal = true" />
          <UButton label="Tambah Surat" icon="i-lucide-plus" color="primary" @click="addModal = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary badges -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UBadge variant="subtle" color="neutral" size="lg">
          Total: {{ counts.total }}
        </UBadge>
        <UBadge variant="subtle" color="info" size="lg">
          SP 1: {{ counts.sp1 }}
        </UBadge>
        <UBadge variant="subtle" color="warning" size="lg">
          SP 2: {{ counts.sp2 }}
        </UBadge>
        <UBadge variant="subtle" color="error" size="lg">
          SP 3: {{ counts.sp3 }}
        </UBadge>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari nomor surat atau karyawan..."
        />
        <USelect
          v-model="levelFilter"
          :items="[
            { label: 'Semua Level', value: 'all' },
            { label: 'SP 1', value: '1' },
            { label: 'SP 2', value: '2' },
            { label: 'SP 3', value: '3' },
          ]"
          placeholder="Filter level"
          class="min-w-40"
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
          separator: 'h-0'
        }"
      />

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            Menampilkan {{ filteredData.length }} surat peringatan
          </div>
          <USelect
            v-model="pagination.pageSize"
            :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
            class="w-20"
            aria-label="Jumlah baris per halaman"
          />
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

  <!-- Modal Export -->
  <UModal v-model:open="exportModal" title="Export Surat Peringatan" :ui="{ width: 'sm:max-w-sm' }">
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
  <WarningLettersAddModal
    v-model:open="addModal"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <WarningLettersEditModal
    v-model:open="editModal"
    :warning-letter="editTarget"
    @saved="refresh()"
  />

  <UModal
    v-model:open="previewModal"
    title="Preview Surat Peringatan"
    :ui="{ content: 'max-w-5xl h-[90vh]' }"
    @update:open="(open) => { if (!open) closePreview() }"
  >
    <template #body>
      <div class="flex items-center justify-between gap-3 border-b border-default pb-3 mb-3">
        <div class="min-w-0">
          <p class="font-semibold text-highlighted truncate">
            {{ previewTarget?.letterNumber ?? 'Preview Surat Peringatan' }}
          </p>
          <p class="text-sm text-muted truncate">
            {{ previewTarget?.employee?.fullName ?? '-' }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            label="Unduh PDF"
            icon="i-lucide-download"
            color="primary"
            :disabled="!previewTarget"
            @click="previewTarget && openDownload(previewTarget)"
          />
        </div>
      </div>

      <div class="h-[calc(90vh-8rem)] rounded-xl border border-default bg-elevated/30 overflow-auto p-4 md:p-6">
        <div class="mx-auto h-full w-full max-w-[794px] rounded-xl bg-white p-2">
          <PdfViewer v-if="previewPdfSrc" :src="previewPdfSrc" />
        </div>
      </div>
    </template>
  </UModal>
</template>
