<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { Contract, ContractDocumentPreview, ContractStatus } from '~/types'

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
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
  finished: selectedEmployeeContracts.value.filter(contract => contract.status === 'SELESAI').length,
}))

const statusFilter = ref('all')
const searchQuery = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 10 })
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)

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

async function openPreview(contract: Contract) {
  previewContract.value = contract
  previewModal.value = true
  previewLoading.value = true
  previewData.value = null
  previewPdfSrc.value = ''

  try {
    previewData.value = await $fetch<ContractDocumentPreview>(`/api/contracts/${contract.id}/document-preview`)
    if ((previewData.value?.missingFields?.length ?? 0) === 0) {
      // PdfViewer will fetch and render this URL to canvas
      previewPdfSrc.value = `/api/contracts/${contract.id}/download-pdf?preview=${Date.now()}`
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

async function generateContractDocument(contract: Contract) {
  try {
    const result = await $fetch<{ generatedPdfUrl?: string | null; pdfReady?: boolean; renderEngine?: 'PDF_NATIVE'; layoutMode?: 'LEGAL_PDF_TEMPLATE' }>(`/api/contracts/${contract.id}/generate-document`, {
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
    if (previewContract.value?.id === contract.id) {
      await openPreview(contract)
    }
  } catch (e: any) {
    const missing = e?.data?.missingFields
    toast.add({
      title: 'Gagal generate dokumen',
      description: Array.isArray(missing) ? `Lengkapi dulu: ${missing.join(', ')}` : e?.data?.message ?? 'Terjadi kesalahan',
      color: 'error',
    })
  }
}

function downloadGenerated(contract: Contract, format: 'pdf') {
  window.open(`/api/contracts/${contract.id}/download-${format}`, '_blank', 'noopener,noreferrer')
}

function confirmDelete(contract: Contract) {
  confirmDeleteToast({
    title: 'Hapus data kontrak?',
    description: `Kontrak ${contract.contractNo} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Kontrak',
    onConfirm: () => doDelete(contract),
  })
}

async function doDelete(contract: Contract) {
  deleteLoading.value = true
  try {
    await $fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
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

function getSortValue(contract: Contract, key: string) {
  switch (key) {
    case 'contractNo':
      return contract.contractNo ?? ''
    case 'employee':
      return contract.employee?.fullName ?? ''
    case 'contractType':
      return contract.contractType?.name ?? ''
    case 'startDate':
      return contract.startDate ?? ''
    case 'endDate':
      return contract.endDate ?? ''
    case 'status':
      return contract.status ?? ''
    default:
      return ''
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

const statusColorMap: Record<ContractStatus, string> = {
  DRAFT: 'neutral',
  AKTIF: 'success',
  AKAN_HABIS: 'warning',
  EXPIRED: 'error',
  SELESAI: 'info',
  DIBATALKAN: 'neutral'
}

const statusLabelMap: Record<ContractStatus, string> = {
  DRAFT: 'Draft',
  AKTIF: 'Aktif',
  AKAN_HABIS: 'Akan Habis',
  EXPIRED: 'Expired',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
}

function getRowItems(row: Row<Contract>) {
  return [
    { type: 'label', label: 'Aksi' },
    {
      label: 'Preview Dokumen',
      icon: 'i-lucide-file-search',
      onSelect() { openPreview(row.original) }
    },
    {
      label: 'Generate Dokumen',
      icon: 'i-lucide-file-cog',
      onSelect() { generateContractDocument(row.original) }
    },
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
      label: 'Unduh PDF',
      icon: 'i-lucide-download',
      onSelect() {
        downloadGenerated(row.original, 'pdf')
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
    header: () => sortableHeader('No. Kontrak', 'contractNo'),
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-muted' }, row.original.contractNo)
  },
  {
    accessorKey: 'employee',
    header: () => sortableHeader('Karyawan', 'employee'),
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-between gap-3' }, [
        h('div', undefined, [
          h(resolveComponent('NuxtLink'), {
            to: `/karyawan/${row.original.employeeId}`,
            class: 'font-medium text-highlighted text-sm hover:text-primary hover:underline'
          }, () => row.original.employee?.fullName ?? '-'),
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

  const sort = sorting.value
  if (!sort) return list

  return [...list].sort((a, b) => {
    const aValue = getSortValue(a, sort.key)
    const bValue = getSortValue(b, sort.key)
    let result = 0

    if (sort.key === 'startDate' || sort.key === 'endDate') {
      result = new Date(aValue).getTime() - new Date(bValue).getTime()
    } else {
      result = String(aValue).localeCompare(String(bValue), 'id', { sensitivity: 'base' })
    }

    return sort.direction === 'asc' ? result : -result
  })
})

const counts = computed(() => {
  const list = contracts.value
  const uniqueEmployees = new Set(list.map(c => c.employeeId)).size
  return {
    total: list.length,
    aktif: list.filter(c => c.status === 'AKTIF').length,
    akanHabis: list.filter(c => c.status === 'AKAN_HABIS').length,
    expired: list.filter(c => c.status === 'EXPIRED').length,
    selesai: list.filter(c => c.status === 'SELESAI').length,
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
        <UBadge variant="subtle" color="info" size="lg">
          Selesai: {{ counts.selesai }}
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
            { label: 'Draft', value: 'DRAFT' },
            { label: 'Aktif', value: 'AKTIF' },
            { label: 'Akan Habis', value: 'AKAN_HABIS' },
            { label: 'Expired', value: 'EXPIRED' },
            { label: 'Selesai', value: 'SELESAI' },
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
            <UBadge variant="subtle" color="info">Selesai {{ selectedEmployeeStats.finished }}</UBadge>
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
                      {{ contract.contractType?.name || '-' }}
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
          <p class="text-sm text-muted truncate">
            {{ previewContract?.employee?.fullName ?? '-' }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            label="Generate Ulang"
            icon="i-lucide-file-cog"
            color="neutral"
            variant="subtle"
            :disabled="!previewContract"
            @click="previewContract && generateContractDocument(previewContract)"
          />
          <UButton
            label="Unduh PDF"
            icon="i-lucide-download"
            color="primary"
            :disabled="!previewContract"
            @click="previewContract && downloadGenerated(previewContract, 'pdf')"
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
                <div class="mt-3 flex flex-wrap gap-2">
                  <UBadge color="info" variant="subtle">{{ previewData.renderEngine }}</UBadge>
                  <UBadge color="neutral" variant="subtle">{{ previewData.layoutMode }}</UBadge>
                </div>
              </div>

              <div class="rounded-2xl border border-default bg-default p-4 text-sm">
                <p class="font-semibold text-highlighted">Template Referensi</p>
                <p class="mt-2">{{ previewData.template.name ?? 'Template kontrak' }}</p>
                <p v-if="previewData.template.templateKey" class="text-muted">
                  Key: {{ previewData.template.templateKey }}
                </p>
                <p v-if="previewData.template.sourceTemplateRelativePath" class="mt-2 break-all text-muted">
                  Referensi PDF: {{ previewData.template.sourceTemplateRelativePath }}
                </p>
                <p v-if="previewData.template.fidelityNote" class="mt-2 text-muted">
                  {{ previewData.template.fidelityNote }}
                </p>
              </div>

              <div class="rounded-2xl border border-default bg-default p-4 text-sm">
                <p class="font-semibold text-highlighted">Ringkasan Data</p>
                <div class="mt-3 space-y-2 text-muted">
                  <p><span class="text-highlighted">Karyawan:</span> {{ previewData.employee.fullName }}</p>
                  <p><span class="text-highlighted">No. Induk:</span> {{ previewData.employee.employeeNo }}</p>
                  <p><span class="text-highlighted">Posisi:</span> {{ previewData.contract.positionLabel }}</p>
                  <p><span class="text-highlighted">Lokasi:</span> {{ previewData.contract.locationLabel }}</p>
                  <p><span class="text-highlighted">Periode:</span> {{ previewData.contract.startDate }} - {{ previewData.contract.endDate }}</p>
                  <p><span class="text-highlighted">{{ previewData.compensationLabel }}:</span> {{ previewData.contract.compensation }}</p>
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
</template>


