<script setup lang="ts">
import type { TableColumn, FormSubmitEvent } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import { h } from 'vue'
import * as z from 'zod'
import { CalendarDate } from '@internationalized/date'

definePageMeta({ layout: 'default' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const toast = useToast()
const auth = useAuthStore()
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()
const { confirmActionToast } = useConfirmActionToast()
const { exportOperationalVehicleUsagesExcel } = useExport()

interface Usage {
  id: number
  usedAt: string
  vehicleNumber: string
  driver: string
  destination: string
  user: string
  requester: string
  status: 'BATAL' | null
  cancelledAt?: string | null
  cancelledByName?: string | null
  cancelledByRole?: string | null
}

const vehicles = ['Xenia B 2845 FON', 'Grand max B 9043 FCM'] as const
const vehicleItems: { label: string; value: string }[] = vehicles.map(value => ({ label: value, value }))
const usages = ref<Usage[]>([])
const loading = ref(false)
const saving = ref(false)
const cancelling = ref<number | null>(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const monthFilter = ref('all')
const sorting = ref<{ key: string; direction: 'asc' | 'desc' } | null>(null)
const pagination = ref({ pageIndex: 0, pageSize: 15 })
const table = useTemplateRef('table')
const formOpen = ref(false)
const exportOpen = ref(false)
const exportMode = ref<'all' | 'month'>('all')
const exportMonth = ref(new Date().getMonth() + 1)
const exportYear = ref(new Date().getFullYear())

const dateCal = shallowRef<CalendarDate | null>(toCalDate(new Date().toISOString().slice(0, 10)))
const schema = z.object({
  usedDate: z.string().min(1, 'Tanggal wajib diisi'),
  usedTime: z.string().min(1, 'Jam wajib diisi'),
  vehicleNumber: z.string().min(1, 'No. Polisi wajib dipilih'),
  driver: z.string().min(1, 'Driver wajib diisi'),
  destination: z.string().min(1, 'Destination wajib diisi'),
  user: z.string().min(1, 'User wajib diisi'),
  requester: z.string().min(1, 'Requester wajib diisi'),
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({
  usedDate: new Date().toISOString().slice(0, 10), usedTime: '', vehicleNumber: vehicles[0]!,
  driver: '', destination: '', user: '', requester: '',
})
watch(dateCal, value => { state.usedDate = fromCalDate(value) })

const pageSizeOptions = [15, 30, 50, 100]
const monthFilterItems = [
  { label: 'Semua Bulan', value: 'all' },
  ...Array.from({ length: 12 }, (_, index) => ({
    label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2020, index, 1)),
    value: String(index + 1),
  })),
]

const hasActiveFilters = computed(() =>
  searchQuery.value.trim().length > 0 || statusFilter.value !== 'all' || monthFilter.value !== 'all',
)

function monthInJakarta(value: string) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', month: 'numeric' }).format(new Date(value)))
}

const filteredUsages = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('id-ID')
  return usages.value.filter((item) => {
    const matchesSearch = !query || [item.vehicleNumber, item.driver, item.destination, item.user, item.requester]
      .some(value => value.toLocaleLowerCase('id-ID').includes(query))
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'cancelled' ? item.status === 'BATAL' : item.status === null)
    const matchesMonth = monthFilter.value === 'all' || monthInJakarta(item.usedAt) === Number(monthFilter.value)
    return matchesSearch && matchesStatus && matchesMonth
  })
})

const sortedUsages = computed(() => {
  const sort = sorting.value
  if (!sort) return filteredUsages.value

  return [...filteredUsages.value].sort((a, b) => {
    const aValue = sort.key === 'status' ? (a.status ?? '') : String((a as any)[sort.key] ?? '')
    const bValue = sort.key === 'status' ? (b.status ?? '') : String((b as any)[sort.key] ?? '')
    const result = sort.key === 'usedAt'
      ? new Date(aValue).getTime() - new Date(bValue).getTime()
      : aValue.localeCompare(bValue, 'id', { sensitivity: 'base' })
    return sort.direction === 'asc' ? result : -result
  })
})

watch([searchQuery, statusFilter, monthFilter], () => {
  pagination.value.pageIndex = 0
})

watch(() => pagination.value.pageSize, async () => {
  await nextTick()
  table.value?.tableApi?.setPageIndex(0)
})

function resetFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  monthFilter.value = 'all'
}

async function fetchUsages() {
  loading.value = true
  try { usages.value = await $fetch<Usage[]>('/api/operational-vehicle-usages') }
  catch (error: any) { toast.add({ title: 'Gagal memuat catatan', description: error?.data?.message ?? 'Terjadi kesalahan', color: 'error' }) }
  finally { loading.value = false }
}
if (auth.isLoggedIn) await fetchUsages()

function resetForm() {
  dateCal.value = toCalDate(new Date().toISOString().slice(0, 10))
  state.usedDate = new Date().toISOString().slice(0, 10)
  state.usedTime = ''; state.vehicleNumber = vehicles[0]!; state.driver = ''; state.destination = ''; state.user = ''; state.requester = ''
}

async function submit(event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    await $fetch('/api/operational-vehicle-usages', {
      method: 'POST',
      body: { ...event.data, usedAt: `${event.data.usedDate}T${event.data.usedTime}:00+07:00` },
    })
    toast.add({ title: 'Pemakaian kendaraan berhasil ditambahkan', color: 'success' })
    formOpen.value = false; resetForm(); await fetchUsages()
  } catch (error: any) {
    toast.add({ title: 'Gagal menambahkan pemakaian kendaraan', description: error?.data?.message ?? 'Terjadi kesalahan', color: 'error' })
  } finally { saving.value = false }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(',', '')
}

function confirmCancel(item: Usage) {
  confirmActionToast({
    title: 'Batalkan pemakaian kendaraan?',
    description: 'Data yang dibatalkan tidak dapat dikembalikan dan tidak dapat dibatalkan ulang.',
    confirmLabel: 'Batalkan Pemakaian', confirmColor: 'error',
    onConfirm: () => cancelUsage(item),
  })
}
async function cancelUsage(item: Usage) {
  cancelling.value = item.id
  try { await $fetch(`/api/operational-vehicle-usages/${item.id}/cancel`, { method: 'POST' }); toast.add({ title: 'Pemakaian kendaraan dibatalkan', color: 'success' }); await fetchUsages() }
  catch (error: any) { toast.add({ title: 'Gagal membatalkan pemakaian', description: error?.data?.message ?? 'Terjadi kesalahan', color: 'error' }) }
  finally { cancelling.value = null }
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
  }, [h('span', label), h(UIcon, { name: icon, class: 'size-3.5 text-muted' })])
}

const columns: TableColumn<Usage>[] = [
  { accessorKey: 'usedAt', header: () => sortableHeader('Tanggal dan Jam', 'usedAt'), cell: ({ row }) => h('span', { class: 'whitespace-nowrap text-sm' }, formatDateTime(row.original.usedAt)) },
  { accessorKey: 'vehicleNumber', header: () => sortableHeader('No. Polisi', 'vehicleNumber') },
  { accessorKey: 'driver', header: () => sortableHeader('Driver', 'driver') },
  { accessorKey: 'destination', header: () => sortableHeader('Destination', 'destination') },
  { accessorKey: 'user', header: () => sortableHeader('User', 'user') },
  { accessorKey: 'requester', header: () => sortableHeader('Requester', 'requester') },
  { accessorKey: 'status', header: () => sortableHeader('Status', 'status'), cell: ({ row }) => row.original.status ? h(UBadge, { label: 'Batal', color: 'error', variant: 'subtle', size: 'sm' }) : h('span', { class: 'text-muted' }, '-') },
  { id: 'actions', header: 'Aksi', cell: ({ row }) => row.original.status
    ? h('div', { class: 'min-w-44 space-y-0.5 text-xs text-muted' }, [
        h('p', { class: 'font-medium text-highlighted' }, 'Dibatalkan'),
        h('p', `${row.original.cancelledByName ?? '-'} · ${row.original.cancelledByRole ?? '-'}`),
        h('p', formatDateTime(row.original.cancelledAt)),
      ])
    : h(UButton, { label: 'Batal', icon: 'i-lucide-ban', size: 'xs', color: 'error', variant: 'soft', loading: cancelling.value === row.original.id, onClick: (event: MouseEvent) => { event.stopPropagation(); confirmCancel(row.original) } }) },
]

const exportMonthItems = Array.from({ length: 12 }, (_, i) => ({ label: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2020, i, 1)), value: i + 1 }))
const yearItems = Array.from({ length: 7 }, (_, i) => ({ label: String(new Date().getFullYear() - 3 + i), value: new Date().getFullYear() - 3 + i }))
function doExport() {
  const ok = exportMode.value === 'month' ? exportOperationalVehicleUsagesExcel(usages.value, exportMonth.value, exportYear.value) : exportOperationalVehicleUsagesExcel(usages.value)
  if (!ok) toast.add({ title: 'Tidak ada data untuk diekspor', color: 'warning' }); else exportOpen.value = false
}
</script>

<template>
  <UDashboardPanel id="operasional-pemakaian-kendaraan">
    <template #header>
      <UDashboardNavbar title="Catatan Pemakaian Mobil Operasional">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton label="Export" icon="i-lucide-download" color="neutral" variant="subtle" @click="exportOpen = true" />
          <UButton label="Tambah Data" icon="i-lucide-plus" color="primary" @click="formOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <p class="mb-4 text-sm text-muted">Data pemakaian kendaraan bersifat permanen. Data hanya dapat dibatalkan.</p>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <UInput v-model="searchQuery" class="max-w-xs" icon="i-lucide-search" placeholder="Cari driver, tujuan, user, atau requester..." />
        <div class="flex flex-wrap items-center gap-2">
          <USelect v-model="statusFilter" :items="[
            { label: 'Semua Status', value: 'all' },
            { label: 'Belum Batal', value: 'active' },
            { label: 'Batal', value: 'cancelled' },
          ]" class="min-w-36" />
          <USelect v-model="monthFilter" :items="monthFilterItems" class="min-w-36" />
          <UButton v-if="hasActiveFilters" label="Reset" color="neutral" variant="ghost" size="sm" icon="i-lucide-x" @click="resetFilters" />
        </div>
      </div>
      <UTable
        ref="table"
        v-model:pagination="pagination"
        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
        class="shrink-0"
        :data="sortedUsages"
        :columns="columns"
        :loading="loading"
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
            <UIcon name="i-lucide-car-front" class="size-10 opacity-40" />
            <p class="text-sm">Belum ada data pemakaian kendaraan</p>
          </div>
        </template>
      </UTable>
      <div class="mt-auto flex items-center justify-between gap-3 border-t border-default pt-4">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">{{ sortedUsages.length }} pemakaian</div>
          <USelect v-model="pagination.pageSize" :items="pageSizeOptions.map(n => ({ label: `${n}`, value: n }))" class="w-20" aria-label="Jumlah baris per halaman" />
        </div>
        <UPagination :key="`pagination-${pagination.pageSize}`" :page="pagination.pageIndex + 1" :items-per-page="pagination.pageSize" :total="sortedUsages.length" @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)" />
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="formOpen" title="Tambah Pemakaian Kendaraan" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Tanggal" name="usedDate" required><UPopover><UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start font-normal" :class="!dateCal && 'text-muted'">{{ dateCal ? formatDisplay(dateCal) : 'Pilih tanggal' }}</UButton><template #content><CalendarPicker v-model="dateCal" class="p-2" /></template></UPopover></UFormField>
          <UFormField label="Jam" name="usedTime" required><UInput v-model="state.usedTime" type="time" class="w-full" /></UFormField>
          <UFormField label="No. Polisi" name="vehicleNumber" required><USelect v-model="state.vehicleNumber" :items="vehicleItems" class="w-full" /></UFormField>
          <UFormField label="Driver" name="driver" required><UInput v-model="state.driver" class="w-full" /></UFormField>
          <UFormField label="Destination" name="destination" required><UInput v-model="state.destination" class="w-full" /></UFormField>
          <UFormField label="User" name="user" required><UInput v-model="state.user" class="w-full" /></UFormField>
        </div>
        <UFormField label="Requester" name="requester" required><UInput v-model="state.requester" class="w-full" /></UFormField>
        <div class="flex justify-end gap-2"><UButton label="Batal" color="neutral" variant="subtle" @click="formOpen = false" /><UButton type="submit" label="Simpan" color="primary" :loading="saving" /></div>
      </UForm>
    </template>
  </UModal>

  <UModal v-model:open="exportOpen" title="Export Excel" :ui="{ content: 'sm:max-w-md' }">
    <template #body><div class="space-y-4"><UFormField label="Periode"><USelect v-model="exportMode" :items="[{ label: 'Semua', value: 'all' }, { label: 'Bulan', value: 'month' }]" class="w-full" /></UFormField><div v-if="exportMode === 'month'" class="grid grid-cols-2 gap-3"><UFormField label="Bulan"><USelect v-model="exportMonth" :items="exportMonthItems" class="w-full" /></UFormField><UFormField label="Tahun"><USelect v-model="exportYear" :items="yearItems" class="w-full" /></UFormField></div></div></template>
    <template #footer><div class="flex w-full justify-end gap-2"><UButton label="Batal" color="neutral" variant="ghost" @click="exportOpen = false" /><UButton label="Export Excel" icon="i-lucide-file-spreadsheet" color="primary" @click="doExport" /></div></template>
  </UModal>
</template>
