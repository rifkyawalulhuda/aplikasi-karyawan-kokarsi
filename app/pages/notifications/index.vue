<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import { h } from 'vue'

definePageMeta({ layout: 'default' })

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const router = useRouter()

const {
  notifications,
  unreadCount,
  isLoading,
  fetchNotifications,
  markAllRead,
  markOneRead,
} = useNotifications()

onMounted(() => {
  fetchNotifications(100)
})

// --- Maps ---
const categoryIconMap: Record<string, string> = {
  KONTRAK_KARYAWAN: 'i-lucide-file-text',
  SERTIFIKASI_IJIN: 'i-lucide-file-badge',
  KONTRAK_VENDOR: 'i-lucide-building-2',
  LEGAL_KOPERASI: 'i-lucide-file-signature',
  AGENDA: 'i-lucide-calendar-days',
  SPACE: 'i-lucide-kanban',
}

const categoryLabel: Record<string, string> = {
  KONTRAK_KARYAWAN: 'Kontrak Karyawan',
  SERTIFIKASI_IJIN: 'Sertifikasi & Ijin',
  KONTRAK_VENDOR: 'Kontrak Vendor',
  LEGAL_KOPERASI: 'Legal Koperasi',
  AGENDA: 'Agenda',
  SPACE: 'Space',
}

const severityLabel: Record<string, string> = {
  WARNING: 'Peringatan',
  CRITICAL: 'Kritis',
}

const severityColor: Record<string, string> = {
  WARNING: 'warning',
  CRITICAL: 'error',
}

// --- Filters ---
const categoryFilter = ref('all')
const severityFilter = ref('all')
const readFilter = ref('all')
const pagination = ref({ pageIndex: 0, pageSize: 20 })
const table = useTemplateRef('table')

// Active notifications only (resolvedAt is null)
const activeNotifications = computed(() =>
  notifications.value.filter(n => n.resolvedAt === null),
)

const counts = computed(() => ({
  total: activeNotifications.value.length,
  unread: activeNotifications.value.filter(n => !n.isRead).length,
  critical: activeNotifications.value.filter(n => n.severity === 'CRITICAL').length,
  warning: activeNotifications.value.filter(n => n.severity === 'WARNING').length,
}))

const filteredData = computed(() => {
  let result = activeNotifications.value

  if (categoryFilter.value !== 'all') {
    result = result.filter(n => n.category === categoryFilter.value)
  }

  if (severityFilter.value !== 'all') {
    result = result.filter(n => n.severity === severityFilter.value)
  }

  if (readFilter.value === 'unread') {
    result = result.filter(n => !n.isRead)
  }
  else if (readFilter.value === 'read') {
    result = result.filter(n => n.isRead)
  }

  return result
})

watch([categoryFilter, severityFilter, readFilter], () => {
  table.value?.tableApi?.setPageIndex(0)
})

// --- Helpers ---
function formatDate(date: string) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

// --- Row click: mark read + navigate ---
async function handleRowClick(notif: any) {
  await markOneRead(notif.id)
  await router.push(notif.deeplink)
}

// --- Tandai Semua Dibaca ---
const isMarkingAll = ref(false)
async function handleMarkAllRead() {
  isMarkingAll.value = true
  await markAllRead()
  isMarkingAll.value = false
}

// --- Columns ---
type AppNotificationRow = (typeof notifications.value)[number]

const columns: TableColumn<AppNotificationRow>[] = [
  {
    id: 'status',
    header: '',
    size: 32,
    cell: ({ row }: { row: Row<AppNotificationRow> }) =>
      h('div', { class: 'flex items-center justify-center' }, [
        h('span', {
          class: [
            'inline-block size-2 rounded-full flex-shrink-0',
            row.original.isRead ? 'bg-muted' : 'bg-primary',
          ],
          title: row.original.isRead ? 'Sudah dibaca' : 'Belum dibaca',
        }),
      ]),
  },
  {
    id: 'category',
    header: 'Kategori',
    cell: ({ row }: { row: Row<AppNotificationRow> }) => {
      const cat = row.original.category
      return h('div', { class: 'flex items-center gap-1.5' }, [
        h(UIcon, {
          name: categoryIconMap[cat] ?? 'i-lucide-bell',
          class: 'size-4 text-muted flex-shrink-0',
        }),
        h(UBadge, {
          label: categoryLabel[cat] ?? cat,
          color: 'neutral',
          variant: 'subtle',
          size: 'sm',
        }),
      ])
    },
  },
  {
    id: 'pesan',
    header: 'Pesan',
    cell: ({ row }: { row: Row<AppNotificationRow> }) =>
      h('div', { class: 'min-w-0' }, [
        h('p', {
          class: ['text-sm font-medium truncate', row.original.isRead ? 'text-muted' : 'text-default'],
        }, row.original.title),
        h('p', { class: 'text-xs text-muted mt-0.5 line-clamp-1' }, row.original.message),
      ]),
  },
  {
    id: 'severity',
    header: 'Tingkat',
    cell: ({ row }: { row: Row<AppNotificationRow> }) => {
      const s = row.original.severity
      return h(UBadge, {
        label: severityLabel[s] ?? s,
        color: severityColor[s] ?? 'neutral',
        variant: 'subtle',
        size: 'sm',
      })
    },
  },
  {
    id: 'expiryDate',
    header: 'Tgl. Expired',
    cell: ({ row }: { row: Row<AppNotificationRow> }) =>
      h('span', { class: 'text-sm text-muted whitespace-nowrap' }, formatDate(row.original.expiryDate)),
  },
  {
    id: 'createdAt',
    header: 'Dibuat',
    cell: ({ row }: { row: Row<AppNotificationRow> }) =>
      h('span', { class: 'text-xs text-muted whitespace-nowrap' }, relativeTime(row.original.createdAt)),
  },
  {
    id: 'actions',
    header: 'Aksi',
    cell: ({ row }: { row: Row<AppNotificationRow> }) =>
      h('div', { class: 'flex justify-end' }, [
        h(UButton, {
          label: 'Buka Dokumen',
          size: 'xs',
          color: 'primary',
          variant: 'ghost',
          trailingIcon: 'i-lucide-arrow-right',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            handleRowClick(row.original)
          },
        }),
      ]),
  },
]
</script>

<template>
  <UDashboardPanel id="notifications">
    <template #header>
      <UDashboardNavbar title="Notifikasi">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="unreadCount > 0"
            label="Tandai Semua Dibaca"
            icon="i-lucide-check-check"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isMarkingAll"
            @click="handleMarkAllRead"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Subtitle -->
      <p class="text-sm text-muted mb-4">
        Pengingat masa berlaku dokumen
      </p>

      <!-- Stats bar -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UBadge variant="subtle" color="neutral" size="lg">
          Total Aktif: {{ counts.total }}
        </UBadge>
        <UBadge variant="subtle" color="primary" size="lg">
          Belum Dibaca: {{ counts.unread }}
        </UBadge>
        <UBadge variant="subtle" color="error" size="lg">
          Kritis: {{ counts.critical }}
        </UBadge>
        <UBadge variant="subtle" color="warning" size="lg">
          Peringatan: {{ counts.warning }}
        </UBadge>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <USelect
          v-model="categoryFilter"
          :items="[
            { label: 'Semua Kategori', value: 'all' },
            { label: 'Kontrak Karyawan', value: 'KONTRAK_KARYAWAN' },
            { label: 'Sertifikasi & Ijin', value: 'SERTIFIKASI_IJIN' },
            { label: 'Kontrak Vendor', value: 'KONTRAK_VENDOR' },
            { label: 'Legal Koperasi', value: 'LEGAL_KOPERASI' },
            { label: 'Agenda', value: 'AGENDA' },
            { label: 'Space', value: 'SPACE' },
          ]"
          placeholder="Kategori"
          class="min-w-48"
        />
        <USelect
          v-model="severityFilter"
          :items="[
            { label: 'Semua Tingkat', value: 'all' },
            { label: 'Peringatan', value: 'WARNING' },
            { label: 'Kritis', value: 'CRITICAL' },
          ]"
          placeholder="Tingkat"
          class="min-w-36"
        />
        <USelect
          v-model="readFilter"
          :items="[
            { label: 'Semua Status Baca', value: 'all' },
            { label: 'Belum Dibaca', value: 'unread' },
            { label: 'Sudah Dibaca', value: 'read' },
          ]"
          placeholder="Status baca"
          class="min-w-44"
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
        :loading="isLoading"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0',
          tr: 'cursor-pointer hover:bg-elevated/60 transition-colors',
        }"
        @select="(row: any) => handleRowClick(row)"
      >
        <!-- Unread row highlight via class on tr -->
        <template #tr="{ row }">
          <tr
            :class="[
              'cursor-pointer hover:bg-elevated/60 transition-colors min-h-[44px]',
              !row.original.isRead ? 'bg-primary/5' : '',
            ]"
            @click="handleRowClick(row.original)"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="border-b border-default px-3 py-2.5"
            >
              <component :is="cell.column.columnDef.cell as any" :row="(row as any)" :cell="(cell as any)" />
            </td>
          </tr>
        </template>

        <template #empty>
          <div class="flex flex-col items-center gap-2 py-12 text-muted">
            <UIcon name="i-lucide-bell-off" class="size-10 opacity-40" />
            <p class="text-sm">
              Tidak ada notifikasi aktif
            </p>
          </div>
        </template>
      </UTable>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 border-t border-default pt-4 mt-auto">
        <div class="text-sm text-muted">
          Menampilkan {{ filteredData.length }} notifikasi
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
</template>
