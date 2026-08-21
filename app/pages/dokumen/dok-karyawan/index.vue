<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UTooltip = resolveComponent('UTooltip')

// Tipe dokumen PERSONAL yang fix — digunakan untuk tampilkan slot kosong
const PERSONAL_DOC_CODES = ['KTP', 'SIM', 'NPWP', 'KK', 'PASPOR', 'BPJS_TK', 'BPJS_KES', 'IJAZAH', 'SERTIFIKAT']

function formatDocDate(val: string) {
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

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
const statusFilter = ref('all')
const page = ref(1)
const limit = ref(15)
const pageSizeOptions = [15, 30, 50, 100]

const pagination = ref({ pageIndex: 0, pageSize: limit.value })
const table = useTemplateRef('table')

const drawerOpen = ref(false)
const selectedEmployeeId = ref<number | null>(null)

function openDrawer(employeeId: number) {
  selectedEmployeeId.value = employeeId
  drawerOpen.value = true
}

// --- Add Doc Modal ---
const addDocModal = ref(false)
const addDocEmployeeId = ref<number | null>(null)

const { data: employeesRes } = await useFetch<{ data: { id: number; fullName: string; employeeNo: string }[] }>('/api/employees', {
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
const { data: summaryRes, status, refresh: refreshSummary } = await useFetch<SummaryResponse>('/api/employee-documents/summary', {
  query: computed(() => ({
    page: page.value,
    limit: limit.value,
    search: searchQuery.value || undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
  })),
  watch: [page, searchQuery, limit, statusFilter],
  lazy: true,
  credentials: 'include',
})

const rows = computed<EmployeeSummary[]>(() => summaryRes.value?.data ?? [])
const total = computed(() => summaryRes.value?.total ?? 0)
const totalPages = computed(() => summaryRes.value?.totalPages ?? 1)

// Reset page saat filter berubah
watch([searchQuery, statusFilter], () => { page.value = 1 })

const hasActiveFilters = computed(() => !!searchQuery.value || statusFilter.value !== 'all')

function resetFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  page.value = 1
}

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

// --- Deep-link: ?openId=<id> ---
const route = useRoute()

async function handleOpenId(openId: string | null | (string | null)[] | undefined) {
  if (!openId) return
  try {
    const doc = await $fetch<{ employeeId: number }>(`/api/employee-documents/${openId}`, {
      credentials: 'include',
    })
    if (doc?.employeeId) openDrawer(doc.employeeId)
  }
  catch { /* silent */ }
}

onMounted(() => handleOpenId(route.query.openId))
watch(() => route.query.openId, (newId) => handleOpenId(newId))

// --- Reset page on limit change ---
watch(limit, () => {
  page.value = 1
  pagination.value.pageIndex = 0
  pagination.value.pageSize = limit.value
})

// --- Sorting ---
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)

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

// Priority map untuk sorting status: EXPIRED paling atas saat asc
const statusPriority: Record<string, number> = { EXPIRED: 0, AKAN_EXPIRED: 1, AKTIF: 2 }

const sortedRows = computed<EmployeeSummary[]>(() => {
  const sort = sorting.value
  if (!sort) return rows.value

  return [...rows.value].sort((a, b) => {
    let compare = 0
    switch (sort.key) {
      case 'employee':
        compare = (a.employee.fullName ?? '').localeCompare(b.employee.fullName ?? '', 'id')
        break
      default:
        compare = 0
    }
    return sort.direction === 'asc' ? compare : -compare
  })
})

// --- Table Columns ---
const columns: TableColumn<EmployeeSummary>[] = [
  {
    accessorKey: 'employee',
    header: () => sortableHeader('Karyawan', 'employee'),
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
    accessorKey: 'documents',
    header: 'Kelengkapan Dokumen',
    cell: ({ row }: { row: Row<EmployeeSummary> }) => {
      const docs = row.original.documents as any[]
      const chips: any[] = []

      // Slot PERSONAL (9 kode fix) — isi berwarna, kosong outline abu
      for (const code of PERSONAL_DOC_CODES) {
        const doc = docs.find((d: any) => d.documentType?.documentType === code)
        if (doc) {
          const tooltipText = [
            doc.documentType?.name,
            doc.documentNumber,
            doc.expiryDate ? `s/d ${formatDocDate(doc.expiryDate)}` : null,
          ].filter(Boolean).join(' · ')

          chips.push(
            h(UTooltip, { text: tooltipText, delay: 200 }, () =>
              h(UBadge, {
                label: code,
                color: (statusColor[doc.status] ?? 'neutral') as any,
                variant: 'subtle',
                size: 'xs',
                class: 'cursor-default',
              })
            )
          )
        } else {
          chips.push(
            h(UTooltip, { text: `${code} belum diinput`, delay: 200 }, () =>
              h('span', {
                class: 'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-dashed border-default text-dimmed leading-none',
              }, code)
            )
          )
        }
      }

      // Chip CERTIFICATION yang sudah diinput (max 3 + overflow)
      const certDocs = docs.filter((d: any) =>
        !PERSONAL_DOC_CODES.includes(d.documentType?.documentType ?? '')
      )
      certDocs.slice(0, 3).forEach((doc: any) => {
        const label = (doc.documentType?.name ?? '').slice(0, 10)
        const tooltipText = [
          doc.documentType?.name,
          doc.documentNumber,
          doc.expiryDate ? `s/d ${formatDocDate(doc.expiryDate)}` : null,
        ].filter(Boolean).join(' · ')
        chips.push(
          h(UTooltip, { text: tooltipText, delay: 200 }, () =>
            h(UBadge, {
              label,
              color: (statusColor[doc.status] ?? 'neutral') as any,
              variant: 'subtle',
              size: 'xs',
              class: 'cursor-default',
            })
          )
        )
      })
      if (certDocs.length > 3) {
        chips.push(
          h('span', { class: 'text-xs text-muted self-center' }, `+${certDocs.length - 3} lainnya`)
        )
      }

      return h('div', { class: 'flex flex-wrap gap-1 py-1 max-w-lg' }, chips)
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

</script>

<template>
  <UDashboardPanel id="dok-karyawan">
    <template #header>
      <UDashboardNavbar title="Dok. Karyawan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah Dokumen"
            icon="i-lucide-plus"
            color="primary"
            @click="addDocModal = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
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
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari nama atau no. karyawan..."
        />
        <div class="flex items-center gap-2 flex-wrap">
          <USelect
            v-model="statusFilter"
            :items="[
              { label: 'Semua Status', value: 'all' },
              { label: 'Aktif', value: 'AKTIF' },
              { label: 'Akan Expired', value: 'AKAN_EXPIRED' },
              { label: 'Expired', value: 'EXPIRED' },
            ]"
            class="min-w-40"
            aria-label="Filter status dokumen"
          />
          <UButton
            v-if="hasActiveFilters"
            label="Reset"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="resetFilters"
          />
        </div>
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="sortedRows"
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
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            Menampilkan {{ rows.length }} dari {{ total }} karyawan
          </div>
          <USelect
            v-model="limit"
            :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
            class="w-20"
            aria-label="Jumlah baris per halaman"
          />
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
    @saved="refreshSummary"
  />

  <!-- Add Doc Modal: pick employee first -->
  <UModal v-model:open="addDocModal" title="Tambah Dokumen Karyawan">
    <template #body>
      <div class="space-y-4 p-1">
        <UFormField label="Pilih Karyawan" required>
          <USelectMenu
            v-model="addDocEmployeeId"
            :items="employeeOptions"
            value-key="value"
            placeholder="Cari dan pilih karyawan..."
            class="w-full"
            :search-input="{ placeholder: 'Cari nama atau no. karyawan...' }"
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
