<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Contract, ContractSummaryRow, ContractHistoryResponse, ContractStatus, ContractDocumentPreview } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const table = useTemplateRef('table')

const { data: summaryRes, status, refresh } = await useFetch<ContractSummaryRow[]>('/api/contracts/summary', {
  lazy: true,
})

const summaryRows = computed<ContractSummaryRow[]>(() => summaryRes.value ?? [])

const statusFilter = ref<string[]>([])
const contractTypeFilter = ref<string[]>([])
const searchQuery = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)

const contractTypeOptions = computed(() =>
  [...new Set(summaryRows.value
    .map(r => r.contractType?.name)
    .filter(Boolean) as string[])]
    .sort()
    .map(name => ({ label: name, value: name }))
)

const hasActiveFilters = computed(() =>
  statusFilter.value.length > 0 || contractTypeFilter.value.length > 0
)

// Modal state
const addModal = ref(false)
const editModal = ref(false)
const editTarget = ref<Contract | null>(null)
const deleteLoading = ref(false)
const previewModal = ref(false)
const previewLoading = ref(false)
const previewContract = ref<Contract | null>(null)
const previewData = ref<ContractDocumentPreview | null>(null)
const previewPdfSrc = ref('')

// History modal
const historyModal = ref(false)
const historyLoading = ref(false)
const historyEmployee = ref<ContractHistoryResponse['employee'] | null>(null)
const historyContracts = ref<Contract[]>([])
const reopenHistoryAfterEdit = ref(false)
const reopenHistoryAfterPreview = ref(false)
const lastHistoryEmployeeId = ref<number | null>(null)

// Context Menu (klik kanan)
const contextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuTarget = ref<ContractSummaryRow | null>(null)

async function openContextMenu(e: MouseEvent, row: ContractSummaryRow) {
  e.preventDefault()
  contextMenuTarget.value = row
  contextMenu.value = true
  await nextTick()
  const menuEl = document.querySelector('[data-context-menu]') as HTMLElement
  const menuWidth = menuEl?.offsetWidth ?? 192
  const menuHeight = menuEl?.offsetHeight ?? 280
  contextMenuX.value = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
  contextMenuY.value = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
}

function closeContextMenu() {
  contextMenu.value = false
}

// Renew modal
const renewModal = ref(false)
const renewParent = ref<Contract | null>(null)

const historyStats = computed(() => {
  const list = historyContracts.value
  return {
    total: list.length,
    aktif: list.filter(c => c.status === 'AKTIF').length,
    akanHabis: list.filter(c => c.status === 'AKAN_HABIS').length,
    expired: list.filter(c => c.status === 'EXPIRED').length,
    selesai: list.filter(c => c.status === 'SELESAI').length,
  }
})

function hasBeenRenewed(contract: Contract, allContracts: Contract[]): boolean {
  return allContracts.some(c => c.parentContractId === contract.id)
}

// Auto-reopen history modal after preview is closed
watch(previewModal, async (isOpen) => {
  if (!isOpen && reopenHistoryAfterPreview.value && lastHistoryEmployeeId.value) {
    reopenHistoryAfterPreview.value = false
    const employeeId = lastHistoryEmployeeId.value
    lastHistoryEmployeeId.value = null
    await nextTick()
    await openHistoryById(employeeId)
  }
})

const statusColorMap: Record<string, string> = {
  DRAFT: 'neutral',
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral',
  SUDAH_DIPERPANJANG: 'info',
}

const statusLabelMap: Record<string, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  SUDAH_DIPERPANJANG: 'Sudah Diperpanjang',
}

// Tampilkan "Sudah Diperpanjang" jika kontrak ini sudah di-perpanjang di riwayat
function getDisplayStatus(contract: Contract, allContracts: Contract[]): string {
  if (hasBeenRenewed(contract, allContracts)) return 'SUDAH_DIPERPANJANG'
  return contract.status
}

function openEditFromSummary(row: ContractSummaryRow) {
  reopenHistoryAfterEdit.value = false
  editTarget.value = { id: row.contractId } as Contract
  editModal.value = true
}

function openEditFromHistory(contract: Contract) {
  reopenHistoryAfterEdit.value = true
  editTarget.value = contract
  historyModal.value = false
  nextTick(() => {
    editModal.value = true
  })
}

async function handleEditSaved() {
  await refresh()
  if (!reopenHistoryAfterEdit.value || !historyEmployee.value) return
  const employeeId = historyEmployee.value.id
  reopenHistoryAfterEdit.value = false
  await nextTick()
  await openHistoryById(employeeId)
}

async function openHistory(row: ContractSummaryRow) {
  await openHistoryById(row.employeeId)
}

async function openHistoryById(employeeId: number) {
  historyLoading.value = true
  historyModal.value = true
  historyContracts.value = []
  historyEmployee.value = null
  lastHistoryEmployeeId.value = employeeId

  try {
    const res = await $fetch<ContractHistoryResponse>(`/api/contracts/history/${employeeId}`)
    historyEmployee.value = res.employee
    historyContracts.value = res.contracts
  } catch (e: any) {
    toast.add({
      title: 'Gagal memuat riwayat kontrak',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
    historyModal.value = false
  } finally {
    historyLoading.value = false
  }
}

function openRenewFromSummary(row: ContractSummaryRow) {
  const contract: Contract = {
    id: row.contractId,
    employeeId: row.employeeId,
    contractNo: row.contractNo,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    contractType: row.contractType,
  } as Contract
  openRenew(contract)
}

function openRenew(contract: Contract) {
  renewParent.value = contract
  renewModal.value = true
}

function handleRenewSaved() {
  refresh()
}

function openDocument(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function openPreview(contractId: number, contractObj?: Contract) {
  previewContract.value = contractObj ?? { id: contractId } as Contract
  previewModal.value = true
  previewLoading.value = true
  previewData.value = null
  previewPdfSrc.value = ''

  try {
    previewData.value = await $fetch<ContractDocumentPreview>(`/api/contracts/${contractId}/document-preview`)
    if ((previewData.value?.missingFields?.length ?? 0) === 0) {
      previewPdfSrc.value = `/api/contracts/${contractId}/download-pdf?preview=${Date.now()}`
    }
  } catch (e: any) {
    toast.add({
      title: 'Gagal memuat preview dokumen',
      description: e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
    previewModal.value = false
  } finally {
    previewLoading.value = false
  }
}

function openPreviewFromHistory(contract: Contract) {
  reopenHistoryAfterPreview.value = true
  historyModal.value = false
  nextTick(() => {
    openPreview(contract.id, contract)
  })
}

async function generateContractDocument(contractId: number, contractNo?: string) {
  try {
    const result = await $fetch<{ generatedPdfUrl?: string | null; pdfReady?: boolean }>(`/api/contracts/${contractId}/generate-document`, {
      method: 'POST',
    })
    toast.add({
      title: result.pdfReady ? 'Dokumen kontrak berhasil digenerate' : 'Preview kontrak diproses',
      description: result.pdfReady
        ? 'Dokumen memakai generator PDF native dan siap ditinjau atau diunduh.'
        : 'Dokumen kontrak sedang diproses.',
      color: 'success',
    })
    await refresh()
  } catch (e: any) {
    const missing = e?.data?.missingFields
    toast.add({
      title: 'Gagal generate dokumen',
      description: Array.isArray(missing) ? `Lengkapi dulu: ${missing.join(', ')}` : e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  }
}

function downloadGeneratedPdf(contractId: number) {
  window.open(`/api/contracts/${contractId}/download-pdf`, '_blank', 'noopener,noreferrer')
}

function confirmDelete(contractId: number, contractNo: string) {
  confirmDeleteToast({
    title: 'Hapus data kontrak?',
    description: `Kontrak ${contractNo} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Kontrak',
    onConfirm: () => doDelete(contractId),
  })
}

async function doDelete(contractId: number) {
  deleteLoading.value = true
  try {
    await $fetch(`/api/contracts/${contractId}`, { method: 'DELETE' })
    toast.add({ title: 'Kontrak berhasil dihapus', color: 'success' })
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    deleteLoading.value = false
  }
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

function getSortValue(row: ContractSummaryRow, key: string) {
  switch (key) {
    case 'fullName': return row.fullName ?? ''
    case 'employeeNo': return row.employeeNo ?? ''
    case 'contractNo': return row.contractNo ?? ''
    case 'contractType': return row.contractType?.name ?? ''
    case 'startDate': return row.startDate ?? ''
    case 'endDate': return row.endDate ?? ''
    case 'status': return row.status ?? ''
    case 'daysRemaining': return row.daysRemaining ?? 0
    default: return ''
  }
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

const columns: TableColumn<ContractSummaryRow>[] = [
  {
    accessorKey: 'employee',
    header: () => sortableHeader('Karyawan', 'fullName'),
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-between gap-3' }, [
        h('div', undefined, [
          h(resolveComponent('NuxtLink'), {
            to: `/karyawan/${row.original.employeeId}`,
            class: 'font-medium text-highlighted text-sm hover:text-primary hover:underline'
          }, () => row.original.fullName),
          h('p', { class: 'text-xs text-muted' }, row.original.employeeNo)
        ]),
        h(UButton, {
          size: 'xs',
          color: 'neutral',
          variant: 'subtle',
          icon: 'i-lucide-history',
          label: `${row.original.historyCount} riwayat`,
          onClick: () => openHistory(row.original),
        })
      ])
  },
  {
    accessorKey: 'contractNo',
    header: () => sortableHeader('No. Kontrak', 'contractNo'),
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.contractNo)
  },
  {
    accessorKey: 'contractType',
    header: () => sortableHeader('Tipe', 'contractType'),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.contractType?.name ?? '-')
  },
  {
    accessorKey: 'startDate',
    header: () => sortableHeader('Tgl. Mulai', 'startDate'),
    cell: ({ row }) => {
      const d = new Date(row.original.startDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
    }
  },
  {
    accessorKey: 'endDate',
    header: () => sortableHeader('Tgl. Selesai', 'endDate'),
    cell: ({ row }) => {
      const d = new Date(row.original.endDate)
      return h('span', { class: 'text-sm text-muted' },
        d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      )
    }
  },
  {
    accessorKey: 'status',
    header: () => sortableHeader('Status', 'status'),
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
    accessorKey: 'daysRemaining',
    header: () => sortableHeader('Sisa Hari', 'daysRemaining'),
    cell: ({ row }) => {
      const days = row.original.daysRemaining
      if (days < 0) return h('span', { class: 'text-sm text-error' }, 'Habis')
      if (days <= 30) return h('span', { class: 'text-sm text-warning font-medium' }, `${days} hari`)
      return h('span', { class: 'text-sm text-muted' }, `${days} hari`)
    }
  },
]

const filteredData = computed(() => {
  let list = summaryRows.value
  if (statusFilter.value.length > 0) {
    list = list.filter(c => statusFilter.value.includes(c.status))
  }
  if (contractTypeFilter.value.length > 0) {
    list = list.filter(c =>
      contractTypeFilter.value.includes(c.contractType?.name ?? '')
    )
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c =>
      c.contractNo.toLowerCase().includes(q) ||
      c.fullName?.toLowerCase().includes(q) ||
      c.employeeNo?.toLowerCase().includes(q)
    )
  }

  const sort = sorting.value
  if (!sort) return list

  return [...list].sort((a, b) => {
    const aValue = getSortValue(a, sort.key)
    const bValue = getSortValue(b, sort.key)
    let result = 0

    if (sort.key === 'startDate' || sort.key === 'endDate') {
      result = new Date(aValue).getTime() - new Date(bValue).getTime()
    } else if (sort.key === 'daysRemaining') {
      result = (aValue as number) - (bValue as number)
    } else {
      result = String(aValue).localeCompare(String(bValue), 'id', { sensitivity: 'base' })
    }

    return sort.direction === 'asc' ? result : -result
  })
})

const counts = computed(() => {
  const list = summaryRows.value
  return {
    total: list.length,
    aktif: list.filter(c => c.status === 'AKTIF').length,
    akanHabis: list.filter(c => c.status === 'AKAN_HABIS').length,
    expired: list.filter(c => c.status === 'EXPIRED').length,
    selesai: list.filter(c => c.status === 'SELESAI').length,
  }
})

watch([statusFilter, contractTypeFilter, searchQuery], () => {
  table.value?.tableApi?.setPageIndex(0)
})

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

// --- Deep-link: ?openId=<contractId> ---
const route = useRoute()

async function handleOpenId(openId: string | null | (string | null)[] | undefined) {
  if (!openId) return
  try {
    const contract = await $fetch<{ employeeId: number }>(`/api/contracts/${openId}`, {
      credentials: 'include',
    })
    await openHistoryById(contract.employeeId)
  }
  catch { /* silent */ }
}

onMounted(() => {
  if (route.query.search) searchQuery.value = String(route.query.search)
  handleOpenId(route.query.openId)
})
watch(() => route.query.openId, (newId) => handleOpenId(newId))
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
        <UBadge variant="subtle" color="info" size="lg">
          Selesai: {{ counts.selesai }}
        </UBadge>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari nama karyawan atau no. kontrak..."
        />
        <div class="flex items-center gap-2 flex-wrap">
          <USelectMenu
            v-model="statusFilter"
            :items="[
              { label: 'Aktif', value: 'AKTIF' },
              { label: 'Akan Habis', value: 'AKAN_HABIS' },
              { label: 'Expired', value: 'EXPIRED' },
              { label: 'Selesai', value: 'SELESAI' },
              { label: 'Dibatalkan', value: 'DIBATALKAN' },
              { label: 'Draft', value: 'DRAFT' },
            ]"
            value-key="value"
            multiple
            placeholder="Semua Status"
            class="min-w-36"
          />
          <USelectMenu
            v-model="contractTypeFilter"
            :items="contractTypeOptions"
            value-key="value"
            multiple
            placeholder="Semua Tipe"
            class="min-w-36"
          />
          <UButton
            v-if="hasActiveFilters"
            label="Reset"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            @click="statusFilter = []; contractTypeFilter = []"
          />
        </div>
      </div>

      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="filteredData"
        :columns="columns"
        :loading="status === 'pending'"
        :on-select="(_e: any, row: any) => openHistory(row.original)"
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

      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            Menampilkan {{ filteredData.length }} kontrak
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

  <!-- Modal Renew -->
  <KontrakRenewContractModal
    v-model:open="renewModal"
    :parent-contract="renewParent"
    @saved="handleRenewSaved"
  />

  <!-- Modal Riwayat Kontrak -->
  <UModal
    v-model:open="historyModal"
    title="Riwayat Kontrak Karyawan"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="historyLoading" class="flex items-center justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-muted animate-spin" />
      </div>

      <div v-else-if="historyEmployee" class="space-y-4">
        <div class="flex flex-wrap items-center gap-4 rounded-xl border border-default bg-elevated/40 p-4">
          <div class="size-12 rounded-full bg-primary/10 ring ring-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="historyEmployee.fotoKaryawan"
              :src="historyEmployee.fotoKaryawan"
              :alt="historyEmployee.fullName"
              class="w-full h-full object-cover rounded-full"
            />
            <span v-else class="text-sm font-semibold text-primary">
              {{ historyEmployee.fullName.split(' ').map(n => n[0]).slice(0, 2).join('') }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ historyEmployee.fullName }}</p>
            <p class="text-sm text-muted">{{ historyEmployee.employeeNo }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge variant="subtle" color="neutral">Total {{ historyStats.total }} kontrak</UBadge>
            <UBadge variant="subtle" color="success">Aktif {{ historyStats.aktif }}</UBadge>
            <UBadge variant="subtle" color="warning">Akan Habis {{ historyStats.akanHabis }}</UBadge>
            <UBadge variant="subtle" color="error">Expired {{ historyStats.expired }}</UBadge>
            <UBadge variant="subtle" color="info">Selesai {{ historyStats.selesai }}</UBadge>
          </div>
        </div>

        <div class="relative">
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

              <div class="rounded-2xl border border-default bg-elevated/30 p-4 transition-colors hover:bg-elevated/50">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                      <p class="font-medium text-highlighted">{{ contract.contractNo }}</p>
                      <UBadge variant="subtle" color="neutral" size="sm">
                        #{{ historyContracts.length - index }}
                      </UBadge>
                      <UBadge v-if="contract.parentContract" variant="subtle" color="neutral" size="sm">
                        Dari: {{ contract.parentContract.contractNo }}
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted">
                      {{ contract.contractType?.name || '-' }}
                      <span class="mx-1">&bull;</span>
                      {{ new Date(contract.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                      -
                      {{ new Date(contract.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                    </p>
                  </div>
                  <UBadge variant="subtle" :color="statusColorMap[getDisplayStatus(contract, historyContracts)] as any">
                    {{ statusLabelMap[getDisplayStatus(contract, historyContracts)] }}
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
                    @click="openDocument(contract.documentUrl!)"
                  />
                  <UButton
                    label="Preview"
                    icon="i-lucide-file-search"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    @click="openPreviewFromHistory(contract)"
                  />
                  <UButton
                    label="Unduh PDF"
                    icon="i-lucide-download"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    @click="downloadGeneratedPdf(contract.id)"
                  />
                  <UButton
                    label="Generate"
                    icon="i-lucide-file-cog"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                    @click="generateContractDocument(contract.id, contract.contractNo)"
                  />
                  <UButton
                    label="Edit"
                    icon="i-lucide-pencil"
                    color="primary"
                    variant="ghost"
                    size="xs"
                    @click="openEditFromHistory(contract)"
                  />
                  <UButton
                    v-if="(contract.status === 'AKAN_HABIS' || contract.status === 'EXPIRED') && !hasBeenRenewed(contract, historyContracts)"
                    label="Perpanjang"
                    icon="i-lucide-refresh-cw"
                    color="success"
                    variant="ghost"
                    size="xs"
                    @click="openRenew(contract)"
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
      <div v-else class="text-sm text-muted text-center py-8">
        Belum ada karyawan yang dipilih.
      </div>
    </template>
  </UModal>

  <!-- Modal Preview -->
  <UModal
    v-model:open="previewModal"
    title="Preview Dokumen Kontrak"
    :ui="{ content: 'max-w-5xl h-[90vh]' }"
  >
    <template #body>
      <div class="flex items-center justify-between gap-3 border-b border-default pb-3 mb-3">
        <div class="min-w-0">
          <p class="font-semibold text-highlighted truncate">
            {{ previewContract?.contractNo ?? 'Preview Dokumen' }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            label="Generate Ulang"
            icon="i-lucide-file-cog"
            color="neutral"
            variant="subtle"
            :disabled="!previewContract"
            @click="previewContract && generateContractDocument(previewContract.id)"
          />
          <UButton
            label="Unduh PDF"
            icon="i-lucide-download"
            color="primary"
            :disabled="!previewContract"
            @click="previewContract && downloadGeneratedPdf(previewContract.id)"
          />
        </div>
      </div>

      <div class="h-[calc(90vh-8rem)] rounded-xl border border-default bg-elevated/30 overflow-auto p-4 md:p-6">
        <div v-if="previewLoading" class="flex h-full items-center justify-center">
          <UIcon name="i-lucide-loader-circle" class="w-8 h-8 text-muted animate-spin" />
        </div>

        <div v-else-if="previewData" class="mx-auto flex h-full w-full max-w-6xl flex-col gap-4">
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_360px]">
            <div class="rounded-2xl border border-default bg-default p-2 shadow-sm">
              <div v-if="previewData.missingFields.length" class="flex h-[calc(90vh-15rem)] items-center justify-center rounded-xl border border-dashed border-warning/40 bg-warning/10 p-6 text-center text-sm text-warning">
                Lengkapi dulu data berikut sebelum preview PDF final bisa ditampilkan:
                {{ previewData.missingFields.join(', ') }}.
              </div>
              <div v-else class="h-[calc(90vh-15rem)] w-full rounded-xl bg-white p-2">
                <PdfViewer v-if="previewPdfSrc" :src="previewPdfSrc" />
              </div>
            </div>

            <div class="space-y-3">
              <div class="rounded-2xl border border-info/30 bg-info/10 p-4 text-sm text-info">
                <p class="font-semibold">Generator PDF Native</p>
                <p class="mt-1 text-slate-700">
                  Dokumen digenerate langsung dari sistem dan mengacu pada sample PDF legal internal.
                </p>
              </div>

              <div class="rounded-2xl border border-default bg-default p-4 text-sm">
                <p class="font-semibold text-highlighted">Ringkasan Data</p>
                <div class="mt-3 space-y-2 text-muted">
                  <p><span class="text-highlighted">Template:</span> {{ previewData.template.name ?? '-' }}</p>
                  <p><span class="text-highlighted">Karyawan:</span> {{ previewData.employee.fullName }}</p>
                  <p><span class="text-highlighted">Posisi:</span> {{ previewData.contract.positionLabel }}</p>
                  <p><span class="text-highlighted">Periode:</span> {{ previewData.contract.startDate }} - {{ previewData.contract.endDate }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex h-full items-center justify-center text-sm text-muted">
          Preview dokumen belum tersedia.
        </div>
      </div>
    </template>
  </UModal>

  <!-- Floating Context Menu (klik kanan) -->
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
        <!-- Riwayat Karyawan -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openHistory(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-history" class="size-4 text-muted shrink-0" />
          Riwayat Karyawan
        </button>

        <!-- Perpanjang Kontrak (kondisional: canRenew) -->
        <button
          v-if="contextMenuTarget?.canRenew"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openRenewFromSummary(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-refresh-cw" class="size-4 text-muted shrink-0" />
          Perpanjang Kontrak
        </button>

        <!-- Preview Dokumen -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openPreview(contextMenuTarget!.contractId); closeContextMenu()"
        >
          <UIcon name="i-lucide-file-search" class="size-4 text-muted shrink-0" />
          Preview Dokumen
        </button>

        <!-- Generate Dokumen -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="generateContractDocument(contextMenuTarget!.contractId, contextMenuTarget!.contractNo); closeContextMenu()"
        >
          <UIcon name="i-lucide-file-cog" class="size-4 text-muted shrink-0" />
          Generate Dokumen
        </button>

        <!-- Edit Kontrak -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="openEditFromSummary(contextMenuTarget!); closeContextMenu()"
        >
          <UIcon name="i-lucide-pencil" class="size-4 text-muted shrink-0" />
          Edit Kontrak
        </button>

        <!-- Unduh PDF -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-highlighted hover:bg-elevated/60 transition-colors"
          @click="downloadGeneratedPdf(contextMenuTarget!.contractId); closeContextMenu()"
        >
          <UIcon name="i-lucide-download" class="size-4 text-muted shrink-0" />
          Unduh PDF
        </button>

        <!-- Divider -->
        <hr class="border-default my-1" />

        <!-- Hapus Kontrak -->
        <button
          class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors"
          @click="confirmDelete(contextMenuTarget!.contractId, contextMenuTarget!.contractNo); closeContextMenu()"
        >
          <UIcon name="i-lucide-trash" class="size-4 text-error shrink-0" />
          Hapus Kontrak
        </button>
      </div>
    </div>
  </Teleport>
</template>
