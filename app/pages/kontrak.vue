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

const { data: contractsRes, status, refresh } = await useFetch<{ data: Contract[]; total: number }>('/api/contracts', {
  query: { limit: 999 },
  lazy: true
})

const contracts = computed<Contract[]>(() => contractsRes.value?.data ?? [])

const selectedEmployeeId = ref<number | null>(null)
const historyModal = ref(false)
const reopenHistoryAfterEdit = ref(false)

const employeeContractCounts = computed<Record<number, number>>(() => {
  return contracts.value.reduce((acc, contract) => {
    acc[contract.employeeId] = (acc[contract.employeeId] ?? 0) + 1
    return acc
  }, {} as Record<number, number>)
})

const selectedEmployeeContracts = computed(() => {
  if (!selectedEmployeeId.value) return []
  return contracts.value
    .filter(contract => contract.employeeId === selectedEmployeeId.value)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
})

const selectedEmployee = computed(() => selectedEmployeeContracts.value[0]?.employee ?? null)
const selectedEmployeeStats = computed(() => ({
  total: selectedEmployeeContracts.value.length,
  active: selectedEmployeeContracts.value.filter(contract => contract.status === 'AKTIF').length,
  expiring: selectedEmployeeContracts.value.filter(contract => contract.status === 'AKAN_HABIS').length,
  expired: selectedEmployeeContracts.value.filter(contract => contract.status === 'EXPIRED').length,
}))

const statusFilter = ref('all')
const searchQuery = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 10 })

// Modal state
const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<Contract | null>(null)
const deleteModal = ref(false)
const deleteTarget = ref<Contract | null>(null)
const deleteLoading = ref(false)

function openEdit(contract: Contract) {
  reopenHistoryAfterEdit.value = false
  editTarget.value = contract
  editModal.value = true
}

function openHistory(contract: Contract) {
  reopenHistoryAfterEdit.value = false
  selectedEmployeeId.value = contract.employeeId
  historyModal.value = true
}

function openEditFromHistory(contract: Contract) {
  reopenHistoryAfterEdit.value = true
  selectedEmployeeId.value = contract.employeeId
  historyModal.value = false
  editTarget.value = contract
  nextTick(() => {
    editModal.value = true
  })
}

async function handleEditSaved() {
  await refresh()

  if (!reopenHistoryAfterEdit.value || !selectedEmployeeId.value) return

  const employeeId = selectedEmployeeId.value
  reopenHistoryAfterEdit.value = false
  selectedEmployeeId.value = employeeId
  await nextTick()
  historyModal.value = true
}

function openDocument(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function confirmDelete(contract: Contract) {
  deleteTarget.value = contract
  deleteModal.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await $fetch(`/api/contracts/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Kontrak berhasil dihapus', color: 'success' })
    deleteModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = false
  }
}

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
      label: 'Riwayat Karyawan',
      icon: 'i-lucide-history',
      onSelect() { openHistory(row.original) }
    },
    {
      label: 'Edit Kontrak',
      icon: 'i-lucide-pencil',
      onSelect() { openEdit(row.original) }
    },
    {
      label: 'Unduh Dokumen',
      icon: 'i-lucide-download',
      disabled: !row.original.documentUrl,
      onSelect() {
        if (row.original.documentUrl) window.open(row.original.documentUrl, '_blank')
      }
    },
    { type: 'separator' },
    {
      label: 'Hapus Kontrak',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      onSelect() { confirmDelete(row.original) }
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
      h('div', { class: 'flex items-center justify-between gap-3' }, [
        h('div', undefined, [
          h('p', { class: 'font-medium text-highlighted text-sm' }, row.original.employee?.fullName ?? '-'),
          h('p', { class: 'text-xs text-muted' }, row.original.employee?.employeeNo ?? '-')
        ]),
        h(UButton, {
          size: 'xs',
          color: 'neutral',
          variant: 'subtle',
          icon: 'i-lucide-history',
          label: `${employeeContractCounts.value[row.original.employeeId] ?? 0} riwayat`,
          onClick: () => openHistory(row.original),
        })
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

const counts = computed(() => {
  const list = contracts.value
  const uniqueEmployees = new Set(list.map(c => c.employeeId)).size
  return {
    total: list.length,
    aktif: list.filter(c => c.status === 'AKTIF').length,
    akanHabis: list.filter(c => c.status === 'AKAN_HABIS').length,
    expired: list.filter(c => c.status === 'EXPIRED').length,
    employees: uniqueEmployees
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
          <UButton label="Tambah Kontrak" icon="i-lucide-plus" color="primary" @click="addModal = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary badges -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UBadge variant="subtle" color="neutral" size="lg">
          Total: {{ counts.total }}
        </UBadge>
        <UBadge variant="subtle" color="primary" size="lg">
          Karyawan: {{ counts.employees }}
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

  <!-- Modal Tambah -->
  <KontrakAddContractModal
    v-model:open="addModal"
    @saved="refresh()"
  />

  <!-- Modal Edit -->
  <KontrakEditContractModal
    v-model:open="editModal"
    :contract="editTarget"
    @saved="handleEditSaved"
  />

  <!-- Modal Konfirmasi Hapus -->
  <UModal v-model:open="deleteModal" title="Konfirmasi Hapus">
    <template #body>
      <p class="text-sm text-muted">
        Yakin ingin menghapus kontrak
        <span class="font-semibold text-highlighted">{{ deleteTarget?.contractNo }}</span>?
        Tindakan ini tidak dapat dibatalkan.
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Batal" color="neutral" variant="subtle" @click="deleteModal = false" />
        <UButton label="Hapus" color="error" :loading="deleteLoading" @click="doDelete()" />
      </div>
    </template>
  </UModal>

  <!-- Modal Riwayat Kontrak per Karyawan -->
  <UModal
    v-model:open="historyModal"
    title="Riwayat Kontrak Karyawan"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="selectedEmployee" class="space-y-4">
        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-default bg-elevated/40 p-4">
          <div class="size-12 rounded-full bg-primary/10 ring ring-primary/20 flex items-center justify-center shrink-0">
            <span class="text-sm font-semibold text-primary">
              {{ selectedEmployee.fullName.split(' ').map(n => n[0]).slice(0, 2).join('') }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ selectedEmployee.fullName }}</p>
            <p class="text-sm text-muted">{{ selectedEmployee.employeeNo }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge variant="subtle" color="neutral">Total {{ selectedEmployeeStats.total }} kontrak</UBadge>
            <UBadge variant="subtle" color="success">Aktif {{ selectedEmployeeStats.active }}</UBadge>
            <UBadge variant="subtle" color="warning">Akan Habis {{ selectedEmployeeStats.expiring }}</UBadge>
            <UBadge variant="subtle" color="error">Expired {{ selectedEmployeeStats.expired }}</UBadge>
          </div>
        </div>

        <div class="relative">
          <div class="absolute left-5 top-2 bottom-2 w-px bg-border/70" />
          <div class="space-y-3">
            <div
              v-for="(contract, index) in selectedEmployeeContracts"
              :key="contract.id"
              class="relative pl-14"
            >
              <div class="absolute left-0 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-default bg-background shadow-sm">
                <div class="h-3 w-3 rounded-full" :class="index === 0 ? 'bg-primary' : 'bg-muted-foreground/40'" />
              </div>

              <div class="rounded-2xl border border-default bg-elevated/30 p-4 transition-colors hover:bg-elevated/50">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                      <p class="font-medium text-highlighted">{{ contract.contractNo }}</p>
                      <UBadge variant="subtle" color="neutral" size="sm">
                        #{{ selectedEmployeeContracts.length - index }}
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted">
                      {{ contract.contractType || '-' }}
                      <span class="mx-1">&bull;</span>
                      {{ new Date(contract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                      -
                      {{ new Date(contract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                    </p>
                  </div>
                  <UBadge variant="subtle" :color="statusColorMap[contract.status] as any">
                    {{ statusLabelMap[contract.status] }}
                  </UBadge>
                </div>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <UButton
                    v-if="contract.documentUrl"
                    label="Unduh Dokumen"
                    icon="i-lucide-download"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    @click="openDocument(contract.documentUrl)"
                  />
                  <UButton
                    label="Edit"
                    icon="i-lucide-pencil"
                    color="primary"
                    variant="ghost"
                    size="xs"
                    @click="openEditFromHistory(contract)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p class="text-xs text-muted">
          Riwayat diurutkan dari kontrak terbaru. Ini menampilkan seluruh kontrak karyawan untuk memudahkan pelacakan masa kerja.
        </p>
      </div>
      <div v-else class="text-sm text-muted">
        Belum ada karyawan yang dipilih.
      </div>
    </template>
  </UModal>
</template>


