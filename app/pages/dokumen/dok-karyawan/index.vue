<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

// --- Types ---
interface EmployeeSummary {
  employee: {
    id: number
    employeeNo: string
    fullName: string
    fotoKaryawan?: string
  }
  totalDocs: number
  worstStatus: 'AKTIF' | 'AKAN_EXPIRED' | 'EXPIRED'
  documents: any[]
}

interface SummaryResponse {
  data: EmployeeSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// --- State ---
const searchQuery = ref('')
const page = ref(1)
const limit = ref(10)

const drawerOpen = ref(false)
const selectedEmployeeId = ref<number | null>(null)

function openDrawer(employeeId: number) {
  selectedEmployeeId.value = employeeId
  drawerOpen.value = true
}

// --- Add Doc Modal ---
const addDocModal = ref(false)
const addDocEmployeeId = ref<number | null>(null)

const { data: employeesRes } = await useFetch('/api/employees', {
  query: { limit: 999 },
  lazy: true,
  credentials: 'include',
})
const employeeOptions = computed(() =>
  (employeesRes.value?.data ?? []).map((e: any) => ({
    label: `${e.fullName} (${e.employeeNo})`,
    value: e.id,
  }))
)

function handleAddDocConfirm() {
  if (!addDocEmployeeId.value) return
  addDocModal.value = false
  openDrawer(addDocEmployeeId.value)
}

// --- Fetch Data ---
const { data: summaryRes, status } = await useFetch<SummaryResponse>('/api/employee-documents/summary', {
  query: computed(() => ({
    page: page.value,
    limit: limit.value,
    search: searchQuery.value || undefined,
  })),
  watch: [page, searchQuery],
  lazy: true,
  credentials: 'include',
})

const rows = computed<EmployeeSummary[]>(() => summaryRes.value?.data ?? [])
const total = computed(() => summaryRes.value?.total ?? 0)
const totalPages = computed(() => summaryRes.value?.totalPages ?? 1)

// --- Badge counts ---
const counts = computed(() => ({
  total: total.value,
  expired: rows.value.filter(r => r.worstStatus === 'EXPIRED').length,
  akanExpired: rows.value.filter(r => r.worstStatus === 'AKAN_EXPIRED').length,
}))

// --- Helpers ---
const statusColor: Record<string, string> = {
  AKTIF: 'success',
  AKAN_EXPIRED: 'warning',
  EXPIRED: 'error',
}

const statusLabel: Record<string, string> = {
  AKTIF: 'Aktif',
  AKAN_EXPIRED: 'Akan Expired',
  EXPIRED: 'Expired',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// --- Reset page on search ---
watch(searchQuery, () => {
  page.value = 1
})

// --- Table Columns ---
const columns: TableColumn<EmployeeSummary>[] = [
  {
    accessorKey: 'employee',
    header: 'Karyawan',
    cell: ({ row }: { row: Row<EmployeeSummary> }) => {
      const emp = row.original.employee
      const avatar = emp.fotoKaryawan
        ? h('img', {
            src: emp.fotoKaryawan,
            alt: emp.fullName,
            class: 'size-9 rounded-full object-cover shrink-0',
          })
        : h('div', {
            class: 'size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0',
          }, getInitials(emp.fullName))

      return h('div', { class: 'flex items-center gap-3 min-w-0' }, [
        avatar,
        h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, [
          h('p', { class: 'font-medium text-sm text-highlighted truncate' }, emp.fullName),
          h('p', { class: 'text-xs text-muted' }, emp.employeeNo),
        ]),
      ])
    },
  },
  {
    accessorKey: 'totalDocs',
    header: 'Jumlah Dokumen',
    cell: ({ row }: { row: Row<EmployeeSummary> }) =>
      h(UBadge, {
        label: String(row.original.totalDocs),
        color: 'neutral',
        variant: 'subtle',
        size: 'sm',
      }),
  },
  {
    accessorKey: 'worstStatus',
    header: 'Status',
    cell: ({ row }: { row: Row<EmployeeSummary> }) => {
      const s = row.original.worstStatus
      return h(UBadge, {
        label: statusLabel[s] ?? s,
        color: statusColor[s] ?? 'neutral',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }: { row: Row<EmployeeSummary> }) =>
      h(UButton, {
        label: 'Lihat Dokumen',
        icon: 'i-lucide-folder-open',
        color: 'primary',
        variant: 'subtle',
        size: 'sm',
        onClick: () => openDrawer(row.original.employee.id),
      }),
  },
]

const pagination = ref({ pageIndex: 0, pageSize: limit.value })
const table = useTemplateRef('table')
</script>

<template>
  <UDashboardPanel id="dok-karyawan">
    <template #header>
      <UDashboardNavbar title="Dok. Karyawan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Subtitle -->
      <p class="text-sm text-muted mb-4">Manajemen dokumen pribadi karyawan</p>

      <!-- Summary badges -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UBadge variant="subtle" color="neutral" size="lg">
          Total Karyawan: {{ counts.total }}
        </UBadge>
        <UBadge variant="subtle" color="error" size="lg">
          Ada Expired: {{ counts.expired }}
        </UBadge>
        <UBadge variant="subtle" color="warning" size="lg">
          Akan Expired: {{ counts.akanExpired }}
        </UBadge>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari nama atau no. karyawan..."
        />
        <UButton
          icon="i-lucide-plus"
          label="Tambah Dokumen"
          @click="addDocModal = true"
        />
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
        @select="(row: any) => openDrawer(row.original.employee.id)"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-2 py-12 text-muted">
            <UIcon name="i-lucide-folder-open" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data dokumen karyawan</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ rows.length }} dari {{ total }} karyawan
        </div>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="limit"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Detail Drawer -->
  <DokKaryawanDetailDrawer
    v-model:open="drawerOpen"
    :employee-id="selectedEmployeeId"
    @update:open="(v: boolean) => { drawerOpen = v; if (!v) selectedEmployeeId = null }"
  />

  <!-- Add Doc Modal: pick employee first -->
  <UModal v-model:open="addDocModal" title="Tambah Dokumen Karyawan">
    <template #body>
      <div class="space-y-4 p-1">
        <UFormField label="Pilih Karyawan" required>
          <USelect
            v-model="addDocEmployeeId"
            :items="employeeOptions"
            placeholder="Cari dan pilih karyawan..."
            searchable
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton label="Batal" color="neutral" variant="ghost" @click="addDocModal = false" />
          <UButton label="Lanjut" :disabled="!addDocEmployeeId" @click="handleAddDocConfirm" />
        </div>
      </div>
    </template>
  </UModal>
</template>
