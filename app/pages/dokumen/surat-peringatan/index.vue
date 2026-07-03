<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { WarningLetter } from '~/types'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const table = useTemplateRef('table')

const searchQuery = ref('')
const levelFilter = ref('all')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<WarningLetter | null>(null)
const previewModal = ref(false)
const previewTarget = ref<WarningLetter | null>(null)
const previewLoading = ref(false)

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

function formatLongDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
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

const pagination = ref({ pageIndex: 0, pageSize: 10 })

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
  previewModal.value = false
}

async function openPreview(letter: WarningLetter) {
  previewTarget.value = letter
  previewLoading.value = false
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

watch([searchQuery, levelFilter], () => {
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
        items: [
          [{ label: 'Lihat Dokumen', icon: 'i-lucide-eye', onClick: () => openPreview(row.original) }],
          [{ label: 'Unduh PDF', icon: 'i-lucide-download', onClick: () => handleGeneratePDF(row.original) }],
          [{ label: 'Edit', icon: 'i-lucide-pencil', onClick: () => openEdit(row.original) }],
          [{ label: 'Hapus', icon: 'i-lucide-trash', onClick: () => handleDelete(row.original.id) }],
        ],
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
        <div class="text-sm text-muted">
          Menampilkan {{ filteredData.length }} surat peringatan
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
        <div v-if="previewLoading" class="flex h-full items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-muted animate-spin" />
        </div>
        <div
          v-else-if="previewTarget"
          class="mx-auto w-full max-w-[794px] rounded-[20px] border border-slate-200 bg-[#f4f1ea] p-3 shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
        >
          <div
            class="min-h-[1123px] rounded-[16px] bg-white px-5 py-6 text-slate-950 md:px-9 md:py-7"
            style="font-family: Calibri, Arial, sans-serif;"
          >
            <div class="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4">
              <div class="flex h-[86px] w-[88px] items-center justify-center rounded-full border border-slate-300 text-center">
                <div class="leading-tight">
                  <p class="text-[11px] font-semibold tracking-[0.18em] text-slate-700">KK</p>
                  <p class="text-[9px] uppercase tracking-[0.12em] text-slate-500">Kokarsi</p>
                </div>
              </div>
              <div class="pt-1 text-center text-slate-950" style="font-family: 'Times New Roman', serif;">
                <p class="text-[21px] font-bold uppercase leading-none">KOPERASI KARYAWAN</p>
                <p class="mt-2 text-[21px] font-bold uppercase leading-none">PT. SANKYU INDONESIA INTERNASIONAL</p>
                <p class="mt-2 text-[21px] font-bold uppercase leading-none">UNIT KANTOR PUSAT</p>
                <div class="mt-3 text-[14px] leading-[1.2] text-slate-800">
                  <p>Jl. Kawasan Industri Terpadu Indonesia Cina (KITIC) Kav.20</p>
                  <p class="mt-1">GIIC - KOTA DELTAMAS - CIKARANG PUSAT - BEKASI 17330</p>
                  <p class="mt-1">TELP. 021 - 50555340, FAX. 021- 50555341</p>
                </div>
              </div>
            </div>

            <div class="mt-4 border-t border-slate-900" />

            <div class="mt-4 text-center">
              <h3 class="text-[18px] font-bold uppercase tracking-[0.02em]">
                SURAT PERINGATAN KARYAWAN
              </h3>
              <p class="mt-1 text-[16px] font-bold">
                No : {{ previewTarget.letterNumber }}
              </p>
            </div>

            <div class="mx-auto mt-10 max-w-[640px] text-[16px] leading-[1.45]">
              <p>Surat peringatan ini di tujukan kepada&nbsp;&nbsp;:</p>

              <div class="mt-6 grid grid-cols-[120px_20px_minmax(0,1fr)] gap-y-3">
                <div>Nama</div>
                <div>:</div>
                <div>{{ previewTarget.employee?.fullName ?? '-' }}</div>

                <div>NIK</div>
                <div>:</div>
                <div>{{ previewTarget.employee?.employeeNo ?? '-' }}</div>

                <div>Jabatan</div>
                <div>:</div>
                <div>{{ previewTarget.employee?.jobRole?.name ?? '-' }}</div>

                <div class="self-start">Jenis Pelanggaran</div>
                <div class="self-start">:</div>
                <div />
              </div>

              <div class="mt-3 space-y-3">
                <template v-if="previewTarget.violationType?.length">
                  <p
                    v-for="(violation, index) in previewTarget.violationType"
                    :key="`${previewTarget.id}-violation-${index}`"
                    class="text-justify"
                  >
                    {{ index + 1 }}. {{ violation }}
                  </p>
                </template>
                <p v-else>-</p>
              </div>

              <p class="mt-5 text-justify">
                Surat peringatan ini diterbitkan berdasarkan kesalahan yang telah saudara {{ previewTarget.employee?.fullName ?? '-' }} lakukan.
                Oleh karena itu perusahaan memberikan Surat Peringatan Ke {{ previewTarget.warningLevel }}, hal ini bertujuan untuk dapat
                memberikan arahan serta peringatan terhadap saudara agar mematuhi tata tertib perusahaan dan tidak melakukan kesalahan lagi
                yang dapat merugikan perusahaan.
              </p>

              <p class="mt-6 text-justify">
                Surat peringatan ini berlaku semenjak di terbitkan sampai dengan {{ formatLongDate(previewTarget.validUntil) }}.
                Surat peringatan ini dibuat agar dapat diperhatikan dan ditaati oleh yang bersangkutan.
              </p>

              <div class="mt-16">
                <p>Bekasi, {{ formatLongDate(previewTarget.letterDate) }}</p>

                <div class="mt-16 grid grid-cols-2 gap-16 text-center">
                  <div>
                    <p>Penerima SP</p>
                    <p class="mt-24">( {{ previewTarget.employee?.fullName ?? '-' }} )</p>
                  </div>
                  <div>
                    <p>Pengurus Koperasi</p>
                    <p class="mt-24">( {{ previewTarget.processedByName || '-' }} )</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="flex h-full items-center justify-center text-sm text-muted">
          Preview tidak tersedia.
        </div>
      </div>
    </template>
  </UModal>
</template>
