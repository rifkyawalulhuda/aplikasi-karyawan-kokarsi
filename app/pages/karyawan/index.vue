<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Contract, Employee, EmploymentStatus } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UCheckbox = resolveComponent('UCheckbox')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const table = useTemplateRef('table')
const { exportExcel, exportPDF } = useExport()
const { data: employeesRes, status, refresh } = await useFetch<{ data: Employee[]; total: number }>('/api/employees', { lazy: true, credentials: 'include', query: { limit: 10000 } })

const data = computed<Employee[]>(() => employeesRes.value?.data ?? [])

// Filter state
const searchQuery = ref('')
const statusFilter = ref<string[]>([])
const locationFilter = ref<string[]>([])
const departmentFilter = ref<string[]>([])

const locationOptions = computed(() =>
  [...new Set(data.value.map(e => e.workLocation?.name).filter(Boolean) as string[])]
    .sort()
    .map(name => ({ label: name, value: name }))
)

const departmentOptions = computed(() =>
  [...new Set(data.value.map(e => e.department?.name).filter(Boolean) as string[])]
    .sort()
    .map(name => ({ label: name, value: name }))
)

const hasActiveFilters = computed(() =>
  statusFilter.value.length > 0 || locationFilter.value.length > 0 || departmentFilter.value.length > 0
)

const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)

// Delete state
const deleteLoading = ref(false)

// Edit state
const editModal = ref(false)
const editTarget = ref<Employee | null>(null)
const offboardingModal = ref(false)
const offboardingTarget = ref<Employee | null>(null)

// Import state
const importModal = ref(false)

// History state
const historyModal = ref(false)
const historyLoading = ref(false)
const historyTarget = ref<Employee | null>(null)
const historyContracts = ref<Contract[]>([])

function openEdit(employee: Employee) {
  editTarget.value = employee
  editModal.value = true
}

function openOffboarding(employee: Employee) {
  offboardingTarget.value = employee
  offboardingModal.value = true
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

function getSortValue(employee: Employee, key: string) {
  switch (key) {
    case 'employeeNo':
      return employee.employeeNo ?? ''
    case 'fullName':
      return employee.fullName ?? ''
    case 'employmentStatus':
      return employee.employmentStatus ?? ''
    case 'workLocation':
      return employee.workLocation?.name ?? ''
    case 'jobRole':
      return employee.jobRole?.name ?? ''
    case 'department':
      return employee.department?.name ?? ''
    case 'joinDate':
      return employee.joinDate ?? ''
    default:
      return ''
  }
}

function formatFilterDate(dateValue?: string | null) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getSearchTokens(employee: Employee) {
  const employeeWithContracts = employee as Employee & { contracts?: Contract[] }
  const activeContract = employeeWithContracts.contracts?.find((contract: Contract) => ['AKTIF', 'AKAN_HABIS'].includes(contract.status))
    ?? employeeWithContracts.contracts?.[0]

  return [
    employee.employeeNo,
    employee.fullName,
    employee.employmentStatus,
    employmentStatusLabelMap[employee.employmentStatus],
    employee.gender,
    employee.birthDate,
    employee.joinDate,
    employee.email,
    employee.phoneNumber,
    employee.educationLevel,
    employee.workLocation?.name,
    employee.jobRole?.name,
    employee.department?.name,
    employee.jobLevel?.name,
    employee.taxStatus?.name,
    employee.fotoKaryawan,
    activeContract?.contractNo,
    activeContract?.contractType?.name,
    activeContract?.startDate,
    activeContract?.endDate,
    activeContract ? contractStatusLabelMap[resolveContractStatus(activeContract)] : null,
    formatFilterDate(employee.birthDate),
    formatFilterDate(employee.joinDate),
    formatFilterDate(activeContract?.startDate),
    formatFilterDate(activeContract?.endDate),
  ]
    .flatMap(value => String(value ?? '').toLowerCase().split(/\s+/))
    .filter(Boolean)
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

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function resolveContractStatus(contract: Contract) {
  return contract.status
}

const contractStatusColorMap: Record<string, string> = {
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral',
}

const contractStatusLabelMap: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const employmentStatusColorMap: Record<EmploymentStatus, string> = {
  AKTIF: 'success',
  KONTRAK_EXPIRED: 'warning',
  RESIGN: 'neutral',
  PHK: 'error',
}

const employmentStatusLabelMap: Record<EmploymentStatus, string> = {
  AKTIF: 'Aktif',
  KONTRAK_EXPIRED: 'Kontrak Expired',
  RESIGN: 'Resign',
  PHK: 'PHK',
}

async function openHistory(employee: Employee) {
  historyTarget.value = employee
  historyModal.value = true
  historyLoading.value = true
  try {
    const detail = await $fetch<Employee & { contracts?: Contract[] }>(`/api/employees/${employee.id}`)
    historyContracts.value = [...(detail.contracts ?? [])].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    )
  } catch (e: any) {
    toast.add({
      title: 'Gagal memuat riwayat kontrak',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
    historyContracts.value = []
  } finally {
    historyLoading.value = false
  }
}

function confirmDelete(employee: Employee) {
  confirmDeleteToast({
    title: 'Hapus data karyawan?',
    description: `Data ${employee.fullName} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Karyawan',
    onConfirm: () => doDelete(employee),
  })
}

async function doDelete(employee: Employee) {
  deleteLoading.value = true
  try {
    await $fetch(`/api/employees/${employee.id}`, { method: 'DELETE' })
    toast.add({ title: 'Karyawan dihapus', color: 'success' })
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = false
  }
}

// Context Menu (klik kanan)
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<Employee | null>(null)

async function openContextMenu(e: MouseEvent, employee: Employee) {
  e.preventDefault()
  contextMenuTarget.value = employee
  contextMenu.value = true
  await nextTick()
  const menuEl = document.querySelector('[data-context-menu]') as HTMLElement
  const menuWidth = menuEl?.offsetWidth ?? 192
  const menuHeight = menuEl?.offsetHeight ?? 240
  contextMenuX.value = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
  contextMenuY.value = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
}

function closeContextMenu() {
  contextMenu.value = false
}

const columns: TableColumn<Employee>[] = [
  {
    accessorKey: 'employeeNo',
    header: () => sortableHeader('No. Induk', 'employeeNo'),
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.employeeNo)
  },
  {
    accessorKey: 'fullName',
    header: () => sortableHeader('Nama Lengkap', 'fullName'),
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-3' }, [
        row.original.fotoKaryawan
          ? h('img', {
              src: row.original.fotoKaryawan,
              alt: row.original.fullName,
              class: 'size-8 rounded-full object-cover ring ring-primary/25 shrink-0'
            })
          : h('div', {
              class: 'size-8 rounded-full bg-primary/10 ring ring-primary/25 flex items-center justify-center shrink-0'
            }, [
              h('span', { class: 'text-xs font-semibold text-primary' },
                row.original.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
              )
            ]),
        h('div', undefined, [
          h(resolveComponent('NuxtLink'), {
            to: `/karyawan/${row.original.id}`,
            class: 'font-medium text-highlighted text-sm hover:text-primary hover:underline'
          }, () => row.original.fullName),
          h('p', { class: 'text-xs text-muted' }, row.original.email)
        ])
      ])
  },
  {
    accessorKey: 'employmentStatus',
    header: () => sortableHeader('Status', 'employmentStatus'),
    filterFn: 'equals',
    cell: ({ row }) => {
      const status = row.original.employmentStatus
      return h(UBadge, { variant: 'subtle', color: employmentStatusColorMap[status] as any }, () => employmentStatusLabelMap[status])
    }
  },
  {
    accessorKey: 'workLocation',
    header: () => sortableHeader('Lokasi', 'workLocation'),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.workLocation?.name ?? '-')
  },
  {
    accessorKey: 'jobRole',
    header: () => sortableHeader('Pekerjaan', 'jobRole'),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.jobRole?.name ?? '-')
  },
  {
    accessorKey: 'department',
    header: () => sortableHeader('Departement', 'department'),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, row.original.department?.name ?? '-')
  },
  {
    accessorKey: 'joinDate',
    header: () => sortableHeader('Tgl. Bergabung', 'joinDate'),
    cell: ({ row }) => {
      const d = new Date(row.original.joinDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
    }
  }
]

// Filter computed
const filteredData = computed(() => {
  let list = data.value ?? []

  if (statusFilter.value.length > 0) {
    list = list.filter(e => statusFilter.value.includes(e.employmentStatus))
  }
  if (locationFilter.value.length > 0) {
    list = list.filter(e => locationFilter.value.includes(e.workLocation?.name ?? ''))
  }
  if (departmentFilter.value.length > 0) {
    list = list.filter(e => departmentFilter.value.includes(e.department?.name ?? ''))
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e => getSearchTokens(e).some(token => token?.toLowerCase().includes(q)))
  }

  const sort = sorting.value
  if (!sort) return list

  return [...list].sort((a, b) => {
    const aValue = getSortValue(a, sort.key)
    const bValue = getSortValue(b, sort.key)
    let result = 0

    if (sort.key === 'joinDate') {
      result = new Date(aValue).getTime() - new Date(bValue).getTime()
    } else {
      result = String(aValue).localeCompare(String(bValue), 'id', { sensitivity: 'base' })
    }

    return sort.direction === 'asc' ? result : -result
  })
})

watch([statusFilter, locationFilter, departmentFilter, searchQuery], () => {
  table.value?.tableApi?.setPageIndex(0)
})

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
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
          <UButton
            label="Import"
            icon="i-lucide-upload"
            color="neutral"
            variant="subtle"
            @click="importModal = true"
          />
          <UDropdownMenu
            :items="[
              [
                { label: 'Export Excel', icon: 'i-lucide-file-spreadsheet', onSelect: () => exportExcel('data-karyawan') },
                { label: 'Export PDF', icon: 'i-lucide-file-text', onSelect: () => exportPDF('data-karyawan') }
              ]
            ]"
          >
            <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" />
          </UDropdownMenu>
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

        <div class="flex items-center gap-2 flex-wrap">
          <USelectMenu
            v-model="statusFilter"
            :items="[
              { label: 'Aktif', value: 'AKTIF' },
              { label: 'Kontrak Expired', value: 'KONTRAK_EXPIRED' },
              { label: 'Resign', value: 'RESIGN' },
              { label: 'PHK', value: 'PHK' }
            ]"
            value-key="value"
            multiple
            placeholder="Semua Status"
            class="min-w-36"
          />
          <USelectMenu
            v-model="locationFilter"
            :items="locationOptions"
            value-key="value"
            multiple
            placeholder="Semua Lokasi"
            class="min-w-36"
          />
          <USelectMenu
            v-model="departmentFilter"
            :items="departmentOptions"
            value-key="value"
            multiple
            placeholder="Semua Departemen"
            class="min-w-40"
          />
          <UButton
            v-if="hasActiveFilters"
            label="Reset"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            @click="statusFilter = []; locationFilter = []; departmentFilter = []"
          />
        </div>
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
        :on-select="(_e: any, row: any) => navigateTo(`/karyawan/${row.original.id}`)"
        :on-contextmenu="(e: any, row: any) => openContextMenu(e, row.original)"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            {{ filteredData.length }} karyawan
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
          @update:page="(p: number) => { table?.tableApi?.setPageIndex(p - 1) }"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal Edit Karyawan -->
  <KaryawanEditModal
    v-model="editModal"
    :employee="editTarget"
    @updated="refresh()"
  />

  <KaryawanOffboardingModal
    v-model="offboardingModal"
    :employee="offboardingTarget"
    @saved="refresh()"
  />

  <UModal
    v-model:open="historyModal"
    title="Riwayat Kontrak Karyawan"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="historyTarget" class="space-y-4">
        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-default bg-elevated/40 p-4">
          <div class="size-12 rounded-full bg-primary/10 ring ring-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="historyTarget.fotoKaryawan"
              :src="historyTarget.fotoKaryawan"
              :alt="historyTarget.fullName"
              class="w-full h-full object-cover rounded-full"
            />
            <span v-else class="text-sm font-semibold text-primary">
              {{ historyTarget.fullName.split(' ').map(n => n[0]).slice(0, 2).join('') }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ historyTarget.fullName }}</p>
            <p class="text-sm text-muted">{{ historyTarget.employeeNo }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge variant="subtle" color="neutral">Total {{ historyContracts.length }} kontrak</UBadge>
            <UBadge variant="subtle" color="success">
              Aktif {{ historyContracts.filter(c => resolveContractStatus(c) === 'AKTIF').length }}
            </UBadge>
            <UBadge variant="subtle" color="warning">
              Akan Habis {{ historyContracts.filter(c => resolveContractStatus(c) === 'AKAN_HABIS').length }}
            </UBadge>
            <UBadge variant="subtle" color="error">
              Expired {{ historyContracts.filter(c => resolveContractStatus(c) === 'EXPIRED').length }}
            </UBadge>
            <UBadge variant="subtle" color="info">
              Selesai {{ historyContracts.filter(c => resolveContractStatus(c) === 'SELESAI').length }}
            </UBadge>
          </div>
        </div>

        <div v-if="historyLoading" class="space-y-3">
          <USkeleton class="h-24 w-full rounded-2xl" />
          <USkeleton class="h-24 w-full rounded-2xl" />
        </div>

        <div v-else class="relative">
          <div class="absolute left-5 top-2 bottom-2 w-px bg-border/70" />
          <div class="space-y-3">
            <div
              v-for="(contract, index) in historyContracts"
              :key="contract.id"
              class="relative pl-14"
            >
              <div class="absolute left-0 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-default bg-background shadow-sm">
                <div class="h-3 w-3 rounded-full" :class="index === 0 ? 'bg-primary' : 'bg-muted-foreground/40'" />
              </div>

              <div class="rounded-2xl border border-default bg-elevated/30 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                      <p class="font-medium text-highlighted">{{ contract.contractNo }}</p>
                      <UBadge variant="subtle" color="neutral" size="sm">
                        #{{ historyContracts.length - index }}
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted">
                      {{ contract.contractType?.name || '-' }}
                      <span class="mx-1">&bull;</span>
                      {{ formatDate(contract.startDate) }}
                      -
                      {{ formatDate(contract.endDate) }}
                    </p>
                  </div>
                  <UBadge variant="subtle" :color="contractStatusColorMap[resolveContractStatus(contract)] as any">
                    {{ contractStatusLabelMap[resolveContractStatus(contract)] }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Import Modal -->
  <KaryawanImportModal
    v-model:open="importModal"
    @imported="refresh()"
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
          @click="navigateTo(`/karyawan/${contextMenuTarget!.id}`); closeContextMenu()"
        >
          <UIcon name="i-lucide-eye" class="size-4 text-muted shrink-0" />
          Lihat Detail
        </button>

        <!-- Riwayat Kontrak -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openHistory(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-history" class="size-4 text-muted shrink-0" />
          Riwayat Kontrak
        </button>

        <!-- Edit Data -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openEdit(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-pencil" class="size-4 text-muted shrink-0" />
          Edit Data
        </button>

        <!-- Offboarding -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
          :class="contextMenuTarget?.employmentStatus === 'RESIGN' || contextMenuTarget?.employmentStatus === 'PHK'
            ? 'text-muted cursor-not-allowed opacity-50'
            : 'text-highlighted hover:bg-elevated/60'"
          :disabled="contextMenuTarget?.employmentStatus === 'RESIGN' || contextMenuTarget?.employmentStatus === 'PHK'"
          @click="contextMenuTarget?.employmentStatus !== 'RESIGN' && contextMenuTarget?.employmentStatus !== 'PHK' && (openOffboarding(contextMenuTarget!), closeContextMenu())"
        >
          <UIcon name="i-lucide-user-x" class="size-4 text-muted shrink-0" />
          Offboarding
        </button>

        <!-- Divider -->
        <hr class="border-default my-1" />

        <!-- Hapus -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
          @click="confirmDelete(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-trash" class="size-4 text-error shrink-0" />
          Hapus Karyawan
        </button>
      </div>
    </div>
  </Teleport>
</template>
