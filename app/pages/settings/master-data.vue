<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { RowSelectionState, SortingState, Column } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { h } from 'vue'
import type { MasterListColumn, MasterRow, ResourceKey } from '~/components/master-data/resources'
import {
  RESOURCES,
  RESOURCE_ORDER,
  displayValue,
  matchesSearch,
  toExportRows
} from '~/components/master-data/resources'

interface LookupsResponse {
  workLocations: MasterRow[]
  jobRoles: MasterRow[]
  jobLevels: MasterRow[]
  taxStatus: MasterRow[]
  contractTypes: MasterRow[]
  departments: MasterRow[]
  documentTypes?: MasterRow[]
  companies?: MasterRow[]
  banks?: MasterRow[]
}

const auth = useAuthStore()
const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const { exportMasterDataExcel } = useExport()

const UIcon = resolveComponent('UIcon')
const UBadge = resolveComponent('UBadge')
const UCheckbox = resolveComponent('UCheckbox')
const RowActions = resolveComponent('MasterDataRowActions')

// ── Data ──────────────────────────────────────────────────────────────
const resourceData = reactive<Record<ResourceKey, MasterRow[]>>({
  'work-locations': [],
  'departments': [],
  'job-roles': [],
  'job-levels': [],
  'contract-types': [],
  'tax-status': [],
  'document-types': [],
  'companies': [],
  'banks': []
})

const loading = ref(true)
const activeTab = ref<ResourceKey>('work-locations')
const currentDef = computed(() => RESOURCES[activeTab.value])
const activeRows = computed(() => resourceData[activeTab.value])

const totalCount = computed(() =>
  RESOURCE_ORDER.reduce((sum, key) => sum + resourceData[key].length, 0)
)

async function loadAll() {
  loading.value = true
  try {
    const [bulk, docTypes, companies] = await Promise.all([
      $fetch<LookupsResponse>('/api/lookups'),
      $fetch<MasterRow[]>('/api/lookups/document-types').catch(() => []),
      $fetch<MasterRow[]>('/api/lookups/companies').catch(() => [])
    ])
    resourceData['work-locations'] = bulk.workLocations ?? []
    resourceData['departments'] = bulk.departments ?? []
    resourceData['job-roles'] = bulk.jobRoles ?? []
    resourceData['job-levels'] = bulk.jobLevels ?? []
    resourceData['contract-types'] = bulk.contractTypes ?? []
    resourceData['tax-status'] = bulk.taxStatus ?? []
    resourceData['document-types'] = docTypes.length ? docTypes : (bulk.documentTypes ?? [])
    resourceData['companies'] = companies.length ? companies : (bulk.companies ?? [])
    resourceData['banks'] = bulk.banks ?? []
  } catch (error) {
    console.error('Gagal memuat master data', error)
    toast.add({ title: 'Gagal memuat master data', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadResource(key: ResourceKey) {
  const def = RESOURCES[key]
  resourceData[key] = await $fetch<MasterRow[]>(def.loadPath)
}

onMounted(loadAll)

// ── Tabs ──────────────────────────────────────────────────────────────
const tabs = computed(() => RESOURCE_ORDER.map(key => ({
  value: key,
  label: RESOURCES[key].label,
  icon: RESOURCES[key].icon,
  badge: String(resourceData[key].length)
})))

function onTabChange(key: ResourceKey) {
  activeTab.value = key
  categoryQuery.value = ''
  globalQuery.value = ''
  sorting.value = []
  rowSelection.value = {}
  pagination.value.pageIndex = 0
}

const activeTabModel = computed({
  get: () => activeTab.value,
  set: (value: string | number) => {
    const key = value as ResourceKey
    if (key === activeTab.value) return
    if (!confirmLeaveForm()) return
    onTabChange(key)
  }
})

// ── Search ────────────────────────────────────────────────────────────
const categoryQuery = ref('')
const globalQuery = ref('')
const isGlobalSearch = computed(() => globalQuery.value.trim().length > 0)

const filteredRows = computed(() => {
  if (!categoryQuery.value.trim()) return activeRows.value
  return activeRows.value.filter(row => matchesSearch(currentDef.value, row, categoryQuery.value))
})

const searchGroups = computed(() => {
  const q = globalQuery.value.trim()
  if (!q) return []
  return RESOURCE_ORDER
    .map(key => ({
      resource: RESOURCES[key],
      rows: resourceData[key].filter(row => matchesSearch(RESOURCES[key], row, q))
    }))
    .filter(group => group.rows.length > 0)
})

// ── Table state ───────────────────────────────────────────────────────
const table = useTemplateRef('table')
const tableEl = useTemplateRef<HTMLElement>('tableEl')
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const pageSizeOptions = [15, 30, 50, 100]
const sorting = ref<SortingState>([])
const rowSelection = ref<RowSelectionState>({})

const selectedIds = computed(() =>
  Object.keys(rowSelection.value)
    .filter(id => rowSelection.value[id])
    .map(Number)
)
const selectedRows = computed(() => activeRows.value.filter(row => selectedIds.value.includes(row.id)))

watch([categoryQuery, activeTab], async () => {
  pagination.value.pageIndex = 0
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

watch(() => pagination.value.pageSize, async () => {
  pagination.value.pageIndex = 0
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

// ── Accessibility: aria-sort pada <th> ────────────────────────────────
function syncAriaSort() {
  const root = tableEl.value
  if (!root) return
  const sortableKeys = currentDef.value.listColumns.filter(col => col.sortable !== false).map(col => col.key)
  root.querySelectorAll<HTMLTableCellElement>('th[data-slot="th"]').forEach((th) => {
    const key = sortableKeys.find(k => th.classList.contains(`md-col-${k}`))
    if (!key) {
      th.removeAttribute('aria-sort')
      return
    }
    const state = sorting.value.find(s => s.id === key)
    th.setAttribute('aria-sort', !state ? 'none' : state.desc ? 'descending' : 'ascending')
  })
}

watch([sorting, filteredRows], () => {
  nextTick(syncAriaSort)
})
onMounted(() => nextTick(syncAriaSort))

// ── Table columns ─────────────────────────────────────────────────────
function getRowNumber(index: number): string {
  return String(pagination.value.pageIndex * pagination.value.pageSize + index + 1).padStart(2, '0')
}

function sortableHeader(label: string, column: Column<MasterRow, unknown>) {
  const sorted = column.getIsSorted()
  const icon = !sorted
    ? 'i-lucide-arrow-up-down'
    : sorted === 'asc'
      ? 'i-lucide-arrow-up'
      : 'i-lucide-arrow-down'

  return h('button', {
    type: 'button',
    class: 'inline-flex items-center gap-1.5 text-left font-medium text-highlighted hover:text-primary transition-colors',
    onClick: column.getToggleSortingHandler(),
    title: `Urutkan ${label}`
  }, [
    h('span', label),
    h(UIcon, { name: icon, class: 'size-3.5 text-muted' })
  ])
}

function renderCell(col: MasterListColumn, row: MasterRow) {
  const value = displayValue(col, row)

  if (col.variant === 'badge') {
    const raw = row[col.key]
    const color = raw ? (col.badgeColorMap?.[String(raw)] ?? 'neutral') : 'neutral'
    return h('div', { class: 'whitespace-nowrap' }, [
      h(UBadge, { label: value, color, variant: 'subtle', size: 'xs' })
    ])
  }

  if (col.variant === 'contact') {
    const email = row.email ? String(row.email) : ''
    const phone = row.phone ? String(row.phone) : ''
    if (!email && !phone) return h('span', { class: 'text-xs text-dimmed' }, '-')
    return h('div', { class: 'space-y-0.5 text-sm' }, [
      email
        ? h('div', { class: 'flex items-center gap-1 text-muted' }, [
            h(UIcon, { name: 'i-lucide-mail', class: 'size-3 shrink-0' }),
            h('span', { class: 'truncate' }, email)
          ])
        : null,
      phone
        ? h('div', { class: 'flex items-center gap-1 text-muted' }, [
            h(UIcon, { name: 'i-lucide-phone', class: 'size-3 shrink-0' }),
            h('span', { class: 'truncate' }, phone)
          ])
        : null
    ])
  }

  const isPrimary = col.variant === 'primary'
  return h('div', {
    class: isPrimary
      ? 'font-medium text-highlighted truncate max-w-xs'
      : 'text-muted truncate max-w-md',
    title: value
  }, value)
}

const columns = computed<TableColumn<MasterRow>[]>(() => {
  const def = currentDef.value
  const cols: TableColumn<MasterRow>[] = []

  if (auth.canManageMasterData) {
    cols.push({
      id: 'select',
      header: ({ table }) => h('div', {
        class: 'flex items-center',
        onClick: (e: Event) => e.stopPropagation()
      }, [
        h(UCheckbox, {
          'modelValue': table.getIsAllPageRowsSelected(),
          'indeterminate': table.getIsSomePageRowsSelected(),
          'onUpdate:modelValue': (value: boolean) => table.toggleAllPageRowsSelected(value),
          'aria-label': 'Pilih semua baris di halaman ini'
        })
      ]),
      cell: ({ row }) => h('div', {
        class: 'flex items-center',
        onClick: (e: Event) => e.stopPropagation()
      }, [
        h(UCheckbox, {
          'modelValue': row.getIsSelected(),
          'disabled': !row.getCanSelect(),
          'onUpdate:modelValue': (value: boolean) => row.toggleSelected(value),
          'aria-label': 'Pilih baris ini'
        })
      ]),
      enableSorting: false,
      meta: { class: { th: 'w-10', td: 'w-10' } }
    })
  }

  cols.push({
    id: 'no',
    header: () => h('span', { class: 'block text-center' }, '#'),
    cell: ({ row }) => h('span', { class: 'block text-center text-xs font-medium text-dimmed tabular-nums' }, getRowNumber(row.index)),
    enableSorting: false,
    meta: { class: { th: 'w-10' } },
  })

  for (const col of def.listColumns) {
    cols.push({
      id: col.key,
      accessorKey: col.key,
      enableSorting: col.sortable !== false,
      meta: { class: { th: `md-col-${col.key}` } },
      header: ({ column }) => sortableHeader(col.label, column),
      cell: ({ row }) => renderCell(col, row.original)
    })
  }

  cols.push({
    id: 'actions',
    header: () => h('span', { class: 'sr-only' }, 'Aksi'),
    cell: ({ row }) => h('div', { class: 'flex justify-end' }, [
      h(RowActions, {
        onEdit: () => openForm(row.original),
        onDelete: () => askDelete(row.original)
      })
    ]),
    enableSorting: false,
    meta: { class: { th: 'w-12', td: 'w-12' } }
  })

  return cols
})

// ── Form modal (tambah + edit terunifikasi) ───────────────────────────
const formOpen = ref(false)
const formItem = ref<MasterRow | null>(null)
const formLoading = ref(false)
const formError = ref('')

function openForm(item: MasterRow | null = null) {
  formItem.value = item
  formError.value = ''
  formOpen.value = true
}

function confirmLeaveForm(): boolean {
  if (!formOpen.value) return true
  return window.confirm('Form sedang terbuka. Tutup form dan lanjutkan?')
}

async function submitForm(payload: Record<string, unknown>) {
  if (!auth.canManageMasterData) return
  const def = currentDef.value
  const base = def.loadPath
  formLoading.value = true
  formError.value = ''
  try {
    if (formItem.value) {
      await $fetch(`${base}/${formItem.value.id}`, { method: 'PUT', body: payload })
      toast.add({ title: `${def.singular} berhasil diperbarui`, color: 'success' })
    } else {
      await $fetch(base, { method: 'POST', body: payload })
      toast.add({ title: `${def.singular} berhasil ditambahkan`, color: 'success' })
    }
    formOpen.value = false
    await loadResource(activeTab.value)
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Terjadi kesalahan saat menyimpan'
  } finally {
    formLoading.value = false
  }
}

// ── Delete (tunggal & massal) ─────────────────────────────────────────
const bulkDeleting = ref(false)

function askDelete(row: MasterRow) {
  const def = currentDef.value
  confirmDeleteToast({
    title: `Hapus ${def.singular}?`,
    description: `"${String(row.name)}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: 'Hapus Data',
    onConfirm: () => deleteRows([row.id])
  })
}

function askBulkDelete() {
  const count = selectedIds.value.length
  if (count === 0) return
  const def = currentDef.value
  confirmDeleteToast({
    title: `Hapus ${count} ${def.singular}?`,
    description: `${count} data terpilih akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel: `Hapus ${count} Data`,
    onConfirm: () => deleteRows(selectedIds.value)
  })
}

async function deleteRows(ids: number[]) {
  if (!auth.canManageMasterData || ids.length === 0) return
  const base = currentDef.value.loadPath
  bulkDeleting.value = true
  const results = await Promise.allSettled(
    ids.map(id => $fetch(`${base}/${id}`, { method: 'DELETE' }))
  )
  const ok = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - ok

  rowSelection.value = {}
  await loadResource(activeTab.value)
  bulkDeleting.value = false

  if (failed === 0) {
    toast.add({ title: `${ok} data berhasil dihapus`, color: 'success' })
  } else if (ok === 0) {
    toast.add({
      title: 'Gagal menghapus',
      description: 'Data mungkin masih dipakai oleh karyawan atau kontrak lain.',
      color: 'error'
    })
  } else {
    toast.add({
      title: `${ok} berhasil, ${failed} gagal dihapus`,
      description: 'Sebagian data masih dipakai oleh data lain.',
      color: 'warning'
    })
  }
}

// ── Export ────────────────────────────────────────────────────────────
function exportCurrent() {
  const def = currentDef.value
  const ok = exportMasterDataExcel(
    toExportRows(def, filteredRows.value),
    def.exportSheet,
    `master-data-${def.key}`
  )
  if (!ok) toast.add({ title: 'Tidak ada data untuk diexport', color: 'warning' })
  else toast.add({ title: `${def.singular} berhasil diexport`, color: 'success' })
}

function exportSelected() {
  const def = currentDef.value
  const ok = exportMasterDataExcel(
    toExportRows(def, selectedRows.value),
    def.exportSheet,
    `master-data-${def.key}-terpilih`
  )
  if (!ok) toast.add({ title: 'Tidak ada data terpilih', color: 'warning' })
}

const exportItems = computed(() => [[
  { label: 'Export kategori ini', icon: 'i-lucide-file-spreadsheet', onSelect: exportCurrent }
]])

// ── Import (khusus Perusahaan) ────────────────────────────────────────
const companyImportOpen = ref(false)
</script>

<template>
  <UDashboardPanel id="settings-master-data">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="activeTab === 'companies'"
            label="Import"
            icon="i-lucide-upload"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="companyImportOpen = true"
          />
          <UDropdownMenu :items="exportItems">
            <UButton
              label="Export"
              icon="i-lucide-download"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </UDropdownMenu>
          <UButton
            v-if="auth.canManageMasterData"
            :label="`Tambah ${currentDef.singular}`"
            icon="i-lucide-plus"
            color="primary"
            variant="solid"
            size="sm"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        <!-- Ringkasan -->
        <div class="mb-6 max-w-3xl">
          <p class="text-sm leading-6 text-muted">
            Kelola data referensi untuk lokasi kerja, jabatan, level jabatan, status pajak, tipe kontrak, departement, dokumen, perusahaan, dan bank.
            Data ini dipakai sebagai referensi sistem agar input tetap konsisten.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UBadge variant="subtle" color="neutral" size="sm">
              <UIcon name="i-lucide-database" class="mr-1 size-3" />
              {{ totalCount }} total data
            </UBadge>
            <UBadge variant="subtle" color="primary" size="sm">
              <UIcon name="i-lucide-layout-grid" class="mr-1 size-3" />
              {{ tabs.length }} kategori
            </UBadge>
          </div>
        </div>

        <!-- Pencarian global -->
        <div class="mb-4 max-w-md">
          <UInput
            v-model="globalQuery"
            icon="i-lucide-search"
            :placeholder="'Cari di semua kategori...'"
            class="w-full"
            :ui="{ trailing: 'pe-1' }"
          >
            <template v-if="globalQuery" #trailing>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Bersihkan pencarian"
                @click="globalQuery = ''"
              />
            </template>
          </UInput>
        </div>

        <!-- Mode hasil pencarian global -->
        <MasterDataGlobalSearchResults
          v-if="isGlobalSearch"
          :query="globalQuery"
          :groups="searchGroups"
          @open="(_key, row) => openForm(row)"
        />

        <!-- Mode normal: tab + tabel -->
        <template v-else>
          <div class="-mb-px mb-6 overflow-x-auto">
            <UTabs
              v-model="activeTabModel"
              :items="tabs"
              variant="link"
              :content="false"
              :ui="{ trigger: 'whitespace-nowrap' }"
            />
          </div>

          <UCard :ui="{ body: 'p-0' }">
            <!-- Header kartu -->
            <template #header>
              <div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-highlighted">
                    {{ currentDef.label }}
                  </h2>
                  <p class="mt-1 text-xs text-muted">
                    {{ currentDef.description }}
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs tabular-nums text-muted">
                    {{ filteredRows.length }} dari {{ activeRows.length }}
                  </span>
                  <UButton
                    v-if="auth.canManageMasterData"
                    label="Tambah"
                    icon="i-lucide-plus"
                    color="primary"
                    size="sm"
                    @click="openForm(null)"
                  />
                </div>
              </div>
            </template>

            <!-- Toolbar pencarian kategori -->
            <div class="border-b border-default bg-elevated/30 px-4 py-3">
              <UInput
                v-model="categoryQuery"
                icon="i-lucide-search"
                :placeholder="`Cari ${currentDef.singular.toLowerCase()}...`"
                size="sm"
                class="w-full max-w-md"
              />
            </div>

            <!-- Tabel (desktop) -->
            <div ref="tableEl" class="hidden md:block">
              <UTable
                ref="table"
                v-model:pagination="pagination"
                v-model:sorting="sorting"
                v-model:row-selection="rowSelection"
                :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
                :row-selection-options="{ enableRowSelection: auth.canManageMasterData }"
                :get-row-id="(row: MasterRow) => String(row.id)"
                :data="filteredRows"
                :columns="columns"
                :loading="loading"
                :on-select="auth.canManageMasterData ? (_e: Event, row: { original: MasterRow }) => openForm(row.original) : undefined"
                class="shrink-0"
                :ui="{
                  base: 'table-fixed border-separate border-spacing-0',
                  thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
                  tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:hover:bg-elevated/40 [&>tr]:transition-colors',
                  th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
                  td: 'border-b border-default',
                  separator: 'h-0'
                }"
              >
                <template #empty>
                  <div class="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-elevated">
                      <UIcon :name="currentDef.icon" class="size-5 text-muted" />
                    </div>
                    <p class="text-sm font-medium text-highlighted">
                      {{ categoryQuery ? 'Tidak ditemukan' : 'Belum ada data' }}
                    </p>
                    <p class="mt-1 text-xs text-muted">
                      {{ categoryQuery
                        ? `Tidak ada ${currentDef.singular.toLowerCase()} yang cocok dengan "${categoryQuery}"`
                        : `Tambahkan ${currentDef.singular.toLowerCase()} pertama Anda` }}
                    </p>
                    <UButton
                      v-if="!categoryQuery && auth.canManageMasterData"
                      label="Tambah Data"
                      icon="i-lucide-plus"
                      size="xs"
                      color="primary"
                      variant="subtle"
                      class="mt-4"
                      @click="openForm(null)"
                    />
                  </div>
                </template>
              </UTable>
            </div>

            <!-- Kartu (mobile) -->
            <MasterDataCardList
              :resource="currentDef"
              :rows="filteredRows"
              :selected-ids="selectedIds"
              @edit="openForm"
              @delete="askDelete"
              @toggle="(row) => { rowSelection[String(row.id)] = !rowSelection[String(row.id)] }"
            />

            <!-- Footer pagination -->
            <div class="mt-auto flex items-center justify-between gap-3 border-t border-default px-4 py-4">
              <div class="flex items-center gap-3">
                <div class="text-sm text-muted">
                  {{ filteredRows.length }} {{ currentDef.singular.toLowerCase() }}
                </div>
                <USelect
                  v-model="pagination.pageSize"
                  :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))"
                  class="w-20"
                  aria-label="Jumlah baris per halaman"
                />
              </div>
              <UPagination
                :key="`pagination-${pagination.pageSize}-${pagination.pageIndex}`"
                :page="pagination.pageIndex + 1"
                :items-per-page="pagination.pageSize"
                :total="filteredRows.length"
                @update:page="(p: number) => { pagination.pageIndex = p - 1; table?.tableApi?.setPageIndex(p - 1) }"
              />
            </div>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Bar aksi massal -->
  <MasterDataBulkActionBar
    :count="selectedIds.length"
    :loading="bulkDeleting"
    @clear="rowSelection = {}"
    @delete="askBulkDelete"
    @export="exportSelected"
  />

  <!-- Modal tambah/edit terunifikasi -->
  <MasterDataFormModal
    v-model:open="formOpen"
    :resource="currentDef"
    :item="formItem"
    :loading="formLoading"
    :error-message="formError"
    @submit="submitForm"
  />

  <!-- Modal import perusahaan -->
  <MasterDataCompanyImportModal
    v-model:open="companyImportOpen"
    @imported="loadResource('companies')"
  />
</template>
