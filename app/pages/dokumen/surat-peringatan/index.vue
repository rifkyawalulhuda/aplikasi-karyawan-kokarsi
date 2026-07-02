<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { WarningLetter } from '~/types'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const table = useTemplateRef('table')

const searchQuery = ref('')
const levelFilter = ref('all')
const addModal = ref(false)

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

const filteredData = computed(() => {
  let result = letters.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(letter =>
      letter.letterNumber.toLowerCase().includes(q) ||
      letter.employee?.fullName?.toLowerCase().includes(q) ||
      letter.processedByName.toLowerCase().includes(q),
    )
  }

  if (levelFilter.value !== 'all') {
    result = result.filter(letter => letter.warningLevel === +levelFilter.value)
  }

  return result
})

const pagination = ref({ pageIndex: 0, pageSize: 10 })

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function spBadgeColor(level: number) {
  if (level === 1) return 'info'
  if (level === 2) return 'warning'
  return 'error'
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
    header: 'Nomor Surat',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.letterNumber),
  },
  {
    accessorKey: 'employee',
    header: 'Nama Karyawan',
    cell: ({ row }) => h('div', undefined, [
      h('p', { class: 'font-medium text-sm text-highlighted' }, row.original.employee?.fullName ?? '-'),
      h('p', { class: 'text-xs text-muted' }, row.original.employee?.employeeNo ?? '-'),
    ]),
  },
  {
    accessorKey: 'warningLevel',
    header: 'Level SP',
    cell: ({ row }) => h(UBadge, {
      color: spBadgeColor(row.original.warningLevel),
      variant: 'subtle',
      label: `SP ${row.original.warningLevel}`,
    }),
  },
  {
    accessorKey: 'letterDate',
    header: 'Tanggal Surat',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.original.letterDate)),
  },
  {
    accessorKey: 'validUntil',
    header: 'Berlaku Sampai',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDate(row.original.validUntil)),
  },
  {
    accessorKey: 'processedByName',
    header: 'Pengurus Koperasi',
    cell: ({ row }) => h('span', { class: 'text-sm text-highlighted' }, row.original.processedByName || '-'),
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
      h(UDropdownMenu, {
        items: [
          [{ label: 'Unduh PDF', icon: 'i-lucide-download', onClick: () => handleGeneratePDF(row.original) }],
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
</template>
