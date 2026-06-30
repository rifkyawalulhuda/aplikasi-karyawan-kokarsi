<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { Contract, ContractStatus } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')

const { data: contractsRes, status } = await useFetch<{ data: Contract[]; total: number }>('/api/contracts', { lazy: true })

const contracts = computed<Contract[]>(() => contractsRes.value?.data ?? [])

const statusFilter = ref('all')
const searchQuery = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 10 })

const statusColorMap: Record<ContractStatus, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  DIBATALKAN: 'neutral'
}

const statusLabelMap: Record<ContractStatus, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  DIBATALKAN: 'Dibatalkan'
}

function getRowItems(row: Row<Contract>) {
  return [
    { type: 'label', label: 'Aksi' },
    {
      label: 'Lihat Detail',
      icon: 'i-lucide-eye'
    },
    {
      label: 'Unduh Dokumen',
      icon: 'i-lucide-download',
      disabled: !row.original.documentUrl
    },
    { type: 'separator' },
    {
      label: 'Perbarui Kontrak',
      icon: 'i-lucide-refresh-cw',
      onSelect() {
        toast.add({
          title: 'Perbarui Kontrak',
          description: `Kontrak ${row.original.contractNo} akan diperbarui.`
        })
      }
    }
  ]
}

const columns: TableColumn<Contract>[] = [
  {
    accessorKey: 'contractNo',
    header: 'No. Kontrak',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.contractNo)
  },
  {
    accessorKey: 'employee',
    header: 'Karyawan',
    cell: ({ row }) =>
      h('div', undefined, [
        h('p', { class: 'font-medium text-highlighted text-sm' }, row.original.employee?.fullName ?? '-'),
        h('p', { class: 'text-xs text-muted' }, row.original.employee?.employeeNo ?? '-')
      ])
  },
  {
    accessorKey: 'contractType',
    header: 'Tipe',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.contractType)
  },
  {
    accessorKey: 'startDate',
    header: 'Tgl. Mulai',
    cell: ({ row }) => {
      const d = new Date(row.original.startDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
    }
  },
  {
    accessorKey: 'endDate',
    header: 'Tgl. Selesai',
    cell: ({ row }) => {
      const d = new Date(row.original.endDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const s = row.original.status as ContractStatus
      return h(UBadge, {
        variant: 'subtle',
        color: statusColorMap[s] as any
      }, () => statusLabelMap[s])
    }
  },
  {
    id: 'actions',
    cell: ({ row }) =>
      h('div', { class: 'text-right' },
        h(UDropdownMenu, {
          content: { align: 'end' },
          items: getRowItems(row)
        }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            class: 'ml-auto'
          })
        )
      )
  }
]

const filteredData = computed(() => {
  let list = contracts.value
  if (statusFilter.value !== 'all') {
    list = list.filter(c => c.status === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.contractNo.toLowerCase().includes(q) ||
      c.employee?.fullName?.toLowerCase().includes(q) ||
      c.employee?.employeeNo?.toLowerCase().includes(q)
    )
  }
  return list
})

// Summary counts
const counts = computed(() => {
  const list = contracts.value
  return {
    total: list.length,
    aktif: list.filter(c => c.status === 'AKTIF').length,
    akanHabis: list.filter(c => c.status === 'AKAN_HABIS').length,
    expired: list.filter(c => c.status === 'EXPIRED').length
  }
})

watch([statusFilter, searchQuery], () => {
  pagination.value.pageIndex = 0
})
</script>

<template>
  <UDashboardPanel id="kontrak">
    <template #header>
      <UDashboardNavbar title="Manajemen Kontrak">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="Tambah Kontrak" icon="i-lucide-plus" color="primary" />
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
          Akan Habis: {{ counts.akanHabis }}
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
          placeholder="Cari no. kontrak atau karyawan..."
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Semua Status', value: 'all' },
            { label: 'Aktif', value: 'AKTIF' },
            { label: 'Akan Habis', value: 'AKAN_HABIS' },
            { label: 'Expired', value: 'EXPIRED' },
            { label: 'Dibatalkan', value: 'DIBATALKAN' }
          ]"
          placeholder="Filter status"
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
          Menampilkan {{ filteredData.length }} kontrak
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
</template>
