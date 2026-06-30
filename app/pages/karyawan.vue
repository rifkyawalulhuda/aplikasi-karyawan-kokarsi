<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { Employee } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const table = useTemplateRef('table')
const { data: employeesRes, status, refresh } = await useFetch<{ data: Employee[]; total: number }>('/api/employees', { lazy: true })

const data = computed<Employee[]>(() => employeesRes.value?.data ?? [])

// Filter state
const searchQuery = ref('')
const statusFilter = ref('all')

const columnVisibility = ref({})
const rowSelection = ref({})
const pagination = ref({ pageIndex: 0, pageSize: 10 })

// Delete state
const deleteModal = ref(false)
const deleteTarget = ref<Employee | null>(null)
const deleteLoading = ref(false)

function confirmDelete(employee: Employee) {
  deleteTarget.value = employee
  deleteModal.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/employees/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Karyawan dihapus', color: 'success' })
    deleteModal.value = false
    deleteTarget.value = null
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = false
  }
}

function getRowItems(row: Row<Employee>) {
  return [
    { type: 'label', label: 'Aksi' },
    {
      label: 'Edit Data',
      icon: 'i-lucide-pencil',
      onSelect() {
        navigateTo(`/karyawan/${row.original.id}/edit`)
      }
    },
    { type: 'separator' },
    {
      label: 'Hapus',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect() {
        confirmDelete(row.original)
      }
    }
  ]
}

const columns: TableColumn<Employee>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        'ariaLabel': 'Pilih semua'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        'modelValue': row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'ariaLabel': 'Pilih baris'
      })
  },
  {
    accessorKey: 'employeeNo',
    header: 'No. Induk',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.employeeNo)
  },
  {
    accessorKey: 'fullName',
    header: 'Nama Lengkap',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', {
          class: 'size-8 rounded-full bg-primary/10 ring ring-primary/25 flex items-center justify-center shrink-0'
        }, [
          h('span', { class: 'text-xs font-semibold text-primary' },
            row.original.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
          )
        ]),
        h('div', undefined, [
          h('p', { class: 'font-medium text-highlighted text-sm' }, row.original.fullName),
          h('p', { class: 'text-xs text-muted' }, row.original.email)
        ])
      ])
  },
  {
    accessorKey: 'employmentStatus',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => {
      const color = row.original.employmentStatus === 'MITRA' ? 'success' : 'warning'
      return h(UBadge, { variant: 'subtle', color }, () => row.original.employmentStatus)
    }
  },
  {
    accessorKey: 'workLocation',
    header: 'Lokasi',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.workLocation?.name ?? '-')
  },
  {
    accessorKey: 'jobRole',
    header: 'Jabatan',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.jobRole?.name ?? '-')
  },
  {
    accessorKey: 'jobLevel',
    header: 'Level',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.original.jobLevel?.name ?? '-')
  },
  {
    accessorKey: 'joinDate',
    header: 'Tgl. Bergabung',
    cell: ({ row }) => {
      const d = new Date(row.original.joinDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
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

// Filter computed
const filteredData = computed(() => {
  let list = data.value ?? []
  if (statusFilter.value !== 'all') {
    list = list.filter(e => e.employmentStatus === statusFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e =>
      e.fullName.toLowerCase().includes(q) ||
      e.employeeNo.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q)
    )
  }
  return list
})

watch([statusFilter, searchQuery], () => {
  pagination.value.pageIndex = 0
})
</script>

<template>
  <UDashboardPanel id="karyawan">
    <template #header>
      <UDashboardNavbar title="Data Karyawan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <KaryawanAddModal @added="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Toolbar filter -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari nama, NIK, email..."
        />

        <div class="flex items-center gap-2">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'Semua Status', value: 'all' },
              { label: 'MITRA', value: 'MITRA' },
              { label: 'KONTRAK', value: 'KONTRAK' }
            ]"
            placeholder="Filter status"
            class="min-w-36"
          />
        </div>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
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
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} dipilih dari
          {{ filteredData.length }} karyawan
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

  <!-- Modal Konfirmasi Hapus -->
  <UModal v-model:open="deleteModal" title="Konfirmasi Hapus">
    <template #body>
      <p class="text-sm text-muted">
        Yakin ingin menghapus karyawan <span class="font-semibold text-highlighted">{{ deleteTarget?.fullName }}</span>?
        Tindakan ini tidak dapat dibatalkan.
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="subtle" @click="deleteModal = false" />
        <UButton label="Hapus" color="error" variant="solid" :loading="deleteLoading" @click="doDelete" />
      </div>
    </template>
  </UModal>
</template>
