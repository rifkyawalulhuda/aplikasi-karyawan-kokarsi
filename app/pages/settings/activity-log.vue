<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { h } from 'vue'

const auth = useAuthStore()
const toast = useToast()
const { exportActivityLogsExcel } = useExport()

interface ActivityLog {
  id: number
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  module: string
  targetLabel: string
  performedBy: string
  performedByRole: string
  detail?: string | null
  timestamp: string
}

// Filter state
const moduleFilter = ref('all')
const actionFilter = ref('all')
const performedByFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const pagination = ref({ pageIndex: 0, pageSize: 50 })
const pageSizeOptions = [25, 50, 100, 200]

// Data state
const loading = ref(false)
const exportLoading = ref(false)
const logs = ref<ActivityLog[]>([])
const total = ref(0)
const modules = ref<string[]>([])

// Retention state
const retentionDays = ref(365)
const retentionLoading = ref(false)
const purgeLoading = ref(false)
const purgeDate = ref('')

const table = useTemplateRef('table')

// Computed purge date label
const purgeDateLabel = computed(() => {
  if (!purgeDate.value) return ''
  return new Date(purgeDate.value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
})

async function fetchLogs() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(pagination.value.pageIndex + 1),
      limit: String(pagination.value.pageSize),
    }
    if (moduleFilter.value && moduleFilter.value !== 'all') params.module = moduleFilter.value
    if (actionFilter.value && actionFilter.value !== 'all') params.action = actionFilter.value
    if (performedByFilter.value) params.performedBy = performedByFilter.value
    if (dateFrom.value) params.from = dateFrom.value
    if (dateTo.value) params.to = dateTo.value

    const res = await $fetch<{ data: ActivityLog[]; total: number }>('/api/activity-logs', {
      credentials: 'include',
      query: params,
    })
    logs.value = res.data
    total.value = res.total
  } catch (e: any) {
    toast.add({ title: 'Gagal memuat log aktivitas', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function fetchModules() {
  try {
    modules.value = await $fetch<string[]>('/api/activity-logs/modules', { credentials: 'include' })
  } catch {}
}

async function fetchRetention() {
  try {
    const res = await $fetch<{ value: string }>('/api/settings/general', { credentials: 'include' })
    const settings = res as any
    const val = settings?.activityLogRetentionDays ?? settings?.settings?.activityLogRetentionDays
    if (val) retentionDays.value = Number(val)
  } catch {}
}

async function saveRetention() {
  retentionLoading.value = true
  try {
    await $fetch('/api/settings/general', {
      method: 'PUT',
      credentials: 'include',
      body: { activityLogRetentionDays: String(retentionDays.value) },
    })
    toast.add({ title: 'Pengaturan retensi disimpan', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Gagal menyimpan', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    retentionLoading.value = false
  }
}

async function doPurge() {
  if (!purgeDate.value) {
    toast.add({ title: 'Pilih tanggal hapus terlebih dahulu', color: 'warning' })
    return
  }
  purgeLoading.value = true
  try {
    const res = await $fetch<{ deleted: number }>('/api/activity-logs/purge', {
      method: 'DELETE',
      credentials: 'include',
      query: { before: purgeDate.value },
    })
    toast.add({ title: `${res.deleted} log berhasil dihapus`, color: 'success' })
    await fetchLogs()
  } catch (e: any) {
    toast.add({ title: 'Gagal menghapus log', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    purgeLoading.value = false
  }
}

function resetFilters() {
  moduleFilter.value = 'all'
  actionFilter.value = 'all'
  performedByFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  pagination.value.pageIndex = 0
  fetchLogs()
}

const hasActiveFilters = computed(() =>
  moduleFilter.value || actionFilter.value || performedByFilter.value || dateFrom.value || dateTo.value
)

function applyFilters() {
  pagination.value.pageIndex = 0
  fetchLogs()
}

async function handleExport() {
  exportLoading.value = true
  try {
    const params: Record<string, string> = { page: '1', limit: '10000' }
    if (moduleFilter.value && moduleFilter.value !== 'all') params.module = moduleFilter.value
    if (actionFilter.value && actionFilter.value !== 'all') params.action = actionFilter.value
    if (performedByFilter.value) params.performedBy = performedByFilter.value
    if (dateFrom.value) params.from = dateFrom.value
    if (dateTo.value) params.to = dateTo.value

    const res = await $fetch<{ data: any[]; total: number }>('/api/activity-logs', {
      credentials: 'include',
      query: params,
    })

    if (!res.data.length) {
      toast.add({ title: 'Tidak ada data untuk diekspor', color: 'warning' })
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    exportActivityLogsExcel(res.data, `log-aktivitas-${today}`)
    toast.add({ title: `${res.data.length} log berhasil diekspor ke Excel`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Export gagal', description: e?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally {
    exportLoading.value = false
  }
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const actionColorMap: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'error',
}

const actionLabelMap: Record<string, string> = {
  CREATE: 'Buat',
  UPDATE: 'Edit',
  DELETE: 'Hapus',
}

const UBadge = resolveComponent('UBadge')

const columns: TableColumn<ActivityLog>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Waktu',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted whitespace-nowrap tabular-nums' }, formatDate(row.original.timestamp)),
  },
  {
    accessorKey: 'action',
    header: 'Aksi',
    cell: ({ row }) => h(UBadge, {
      label: actionLabelMap[row.original.action] ?? row.original.action,
      color: actionColorMap[row.original.action] ?? 'neutral',
      variant: 'subtle',
      size: 'sm',
    }),
  },
  {
    accessorKey: 'module',
    header: 'Modul',
    cell: ({ row }) => h('span', { class: 'text-sm font-medium' }, row.original.module),
  },
  {
    accessorKey: 'targetLabel',
    header: 'Data',
    cell: ({ row }) => h('div', { class: 'max-w-xs min-w-0' }, [
      h('p', { class: 'text-sm text-highlighted truncate' }, row.original.targetLabel),
      row.original.detail
        ? h('p', { class: 'text-xs text-muted truncate' }, row.original.detail)
        : null,
    ]),
  },
  {
    accessorKey: 'performedBy',
    header: 'Dilakukan Oleh',
    cell: ({ row }) => h('div', undefined, [
      h('p', { class: 'text-sm' }, row.original.performedBy),
      h('p', { class: 'text-xs text-muted' }, row.original.performedByRole),
    ]),
  },
]

// Init
onMounted(async () => {
  await Promise.all([fetchLogs(), fetchModules(), fetchRetention()])
})

watch(() => pagination.value.pageSize, () => {
  pagination.value.pageIndex = 0
  fetchLogs()
})
</script>

<template>
  <UDashboardPanel id="activity-log">
    <template #header>
      <UDashboardNavbar title="Log Aktivitas">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Export Excel"
            icon="i-lucide-file-spreadsheet"
            color="neutral"
            variant="subtle"
            :loading="exportLoading"
            @click="handleExport"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Description -->
      <p class="text-sm text-muted mb-4">
        Rekam jejak semua perubahan data di sistem — tambah, edit, dan hapus — untuk keperluan audit dan pelacakan ketidaksesuaian data.
      </p>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-end gap-2 mb-4">
        <USelect
          v-model="moduleFilter"
          :items="[{ label: 'Semua Modul', value: 'all' }, ...modules.map(m => ({ label: m, value: m }))]"
          value-key="value"
          class="min-w-40"
        />
        <USelect
          v-model="actionFilter"
          :items="[
            { label: 'Semua Aksi', value: 'all' },
            { label: 'Buat', value: 'CREATE' },
            { label: 'Edit', value: 'UPDATE' },
            { label: 'Hapus', value: 'DELETE' },
          ]"
          value-key="value"
          class="min-w-36"
        />
        <UInput
          v-model="performedByFilter"
          placeholder="Cari nama user..."
          icon="i-lucide-user"
          class="min-w-40"
        />
        <UInput
          v-model="dateFrom"
          type="date"
          class="min-w-36"
        />
        <span class="text-sm text-muted self-center">s/d</span>
        <UInput
          v-model="dateTo"
          type="date"
          class="min-w-36"
        />
        <UButton
          label="Terapkan"
          icon="i-lucide-search"
          color="primary"
          @click="applyFilters"
        />
        <UButton
          v-if="hasActiveFilters"
          label="Reset"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="resetFilters"
        />
      </div>

      <!-- Table -->
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :data="logs"
        :columns="columns"
        :loading="loading"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
        }"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-2 py-12 text-muted">
            <UIcon name="i-lucide-activity" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada log aktivitas</p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">
            {{ total }} log
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
          :total="total"
          @update:page="(p: number) => { pagination.pageIndex = p - 1; fetchLogs() }"
        />
      </div>

      <!-- Retention settings -->
      <div class="mt-8 rounded-xl border border-default bg-elevated/30 p-5 space-y-4">
        <div>
          <p class="font-semibold text-highlighted">Pengaturan Retensi Log</p>
          <p class="text-sm text-muted mt-0.5">Tentukan berapa lama log aktivitas disimpan sebelum bisa dihapus secara manual.</p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <UFormField label="Simpan log selama (hari)">
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="retentionDays"
                type="number"
                :min="1"
                :max="3650"
                class="w-28"
              />
              <UButton
                label="Simpan"
                icon="i-lucide-save"
                color="primary"
                variant="subtle"
                :loading="retentionLoading"
                @click="saveRetention"
              />
            </div>
          </UFormField>
        </div>

        <div class="border-t border-default pt-4">
          <p class="text-sm font-medium text-highlighted mb-2">Hapus Log Lama</p>
          <p class="text-xs text-muted mb-3">Hapus semua log aktivitas sebelum tanggal tertentu. Tindakan ini permanen dan tidak bisa dibatalkan.</p>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Hapus log sebelum">
              <UInput
                v-model="purgeDate"
                type="date"
                class="min-w-40"
              />
            </UFormField>
            <UButton
              :label="purgeDate ? `Hapus Log Sebelum ${purgeDateLabel}` : 'Pilih tanggal dulu'"
              icon="i-lucide-trash-2"
              color="error"
              variant="subtle"
              :disabled="!purgeDate"
              :loading="purgeLoading"
              @click="doPurge"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
