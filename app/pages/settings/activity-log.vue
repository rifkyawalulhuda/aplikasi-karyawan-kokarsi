<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

const auth = useAuthStore()
const toast = useToast()
const { exportActivityLogsExcel } = useExport()
const { toCalDate, fromCalDate, formatDisplay } = useDatePicker()

// ── DatePicker CalendarDate refs untuk filter dan purge ───────────────────────
const dateFromCal  = shallowRef<CalendarDate | null>(null)
const dateToCal    = shallowRef<CalendarDate | null>(null)
const purgeDateCal = shallowRef<CalendarDate | null>(null)

watch(dateFromCal,  val => { dateFrom.value  = fromCalDate(val) })
watch(dateToCal,    val => { dateTo.value    = fromCalDate(val) })
watch(purgeDateCal, val => { purgeDate.value = fromCalDate(val) })

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

// Panel state
const filtersOpen = ref(false)
const retentionOpen = ref(false)

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
  dateFromCal.value = null
  dateToCal.value = null
  pagination.value.pageIndex = 0
  fetchLogs()
}

const activeFilterCount = computed(() => {
  let n = 0
  if (moduleFilter.value && moduleFilter.value !== 'all') n++
  if (actionFilter.value && actionFilter.value !== 'all') n++
  if (performedByFilter.value) n++
  if (dateFrom.value) n++
  if (dateTo.value) n++
  return n
})

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

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

// ── Format baris terminal ─────────────────────────────────────────────────────
function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const actionLabelMap: Record<string, string> = {
  CREATE: 'Buat',
  UPDATE: 'Edit',
  DELETE: 'Hapus',
}

const actionTextClass: Record<string, string> = {
  CREATE: 'text-emerald-600 dark:text-emerald-400',
  UPDATE: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
}

function rowTooltip(log: ActivityLog) {
  const label = actionLabelMap[log.action] ?? log.action
  const parts = [
    `${formatTimestamp(log.timestamp)} · ${label} (${log.action})`,
    `${log.module} · ${log.targetLabel}`,
  ]
  if (log.detail) parts.push(log.detail)
  parts.push(`oleh ${log.performedBy} (${log.performedByRole})`)
  return parts.join('  —  ')
}

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

      <!-- Filter toolbar (collapsible) -->
      <UCollapsible v-model:open="filtersOpen" :unmount-on-hide="false" class="mb-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <UButton
            :label="filtersOpen ? 'Sembunyikan filter' : 'Tampilkan filter'"
            icon="i-lucide-sliders-horizontal"
            color="neutral"
            variant="ghost"
            size="sm"
            :trailing-icon="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          />
          <div class="flex items-center gap-2">
            <UBadge
              v-if="activeFilterCount"
              :label="`${activeFilterCount} filter aktif`"
              color="primary"
              variant="subtle"
              size="sm"
            />
            <span class="text-xs text-muted tabular-nums">{{ total }} baris</span>
          </div>
        </div>

        <template #content>
          <div class="flex flex-wrap items-end gap-2 pt-3">
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
            <div class="flex items-center gap-2">
              <UPopover>
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="min-w-36 justify-start font-normal"
                  :class="!dateFromCal && 'text-muted'"
                >
                  {{ dateFromCal ? formatDisplay(dateFromCal) : 'Dari tanggal' }}
                </UButton>
                <template #content>
                  <CalendarPicker v-model="dateFromCal" class="p-2" />
                </template>
              </UPopover>
              <UButton
                v-if="dateFromCal"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Hapus tanggal awal"
                @click="dateFromCal = null"
              />
            </div>
            <span class="text-sm text-muted self-center">s/d</span>
            <div class="flex items-center gap-2">
              <UPopover>
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-calendar"
                  class="min-w-36 justify-start font-normal"
                  :class="!dateToCal && 'text-muted'"
                >
                  {{ dateToCal ? formatDisplay(dateToCal) : 'Sampai tanggal' }}
                </UButton>
                <template #content>
                  <CalendarPicker v-model="dateToCal" class="p-2" />
                </template>
              </UPopover>
              <UButton
                v-if="dateToCal"
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="Hapus tanggal akhir"
                @click="dateToCal = null"
              />
            </div>
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
        </template>
      </UCollapsible>

      <!-- Terminal log -->
      <div class="overflow-hidden rounded-xl border border-default bg-zinc-50 font-mono dark:bg-zinc-950">
        <!-- Title bar -->
        <div class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <span class="flex items-center gap-1.5" aria-hidden="true">
            <span class="size-2.5 rounded-full bg-rose-400/80" />
            <span class="size-2.5 rounded-full bg-amber-400/80" />
            <span class="size-2.5 rounded-full bg-emerald-400/80" />
          </span>
          <UIcon name="i-lucide-terminal" class="ml-1 size-3.5 text-zinc-500" />
          <span class="text-xs font-medium text-zinc-500">activity.log</span>
          <span class="ml-auto text-xs text-zinc-400 tabular-nums dark:text-zinc-500">{{ total }} baris</span>
        </div>

        <!-- Viewport -->
        <div class="terminal-viewport" role="log" aria-live="polite" :aria-busy="loading">
          <p v-if="loading" class="terminal-empty text-zinc-500">memuat log...</p>
          <p v-else-if="!logs.length" class="terminal-empty text-zinc-500">-- tidak ada log aktivitas --</p>
          <template v-else>
            <UPopover
              v-for="log in logs"
              :key="log.id"
              mode="hover"
              enable-touch
              :open-delay="80"
              :close-delay="80"
              :content="{ side: 'top', align: 'start', collisionPadding: 12, sideOffset: 6 }"
            >
              <button
                type="button"
                class="terminal-row text-zinc-700 hover:bg-black/[0.045] focus-visible:bg-black/[0.045] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset focus-visible:outline-none dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.06]"
                :aria-label="rowTooltip(log)"
              >
                <span class="cell cell--time text-zinc-500">{{ formatTimestamp(log.timestamp) }}</span>
                <span class="cell cell--action font-semibold tracking-wide" :class="actionTextClass[log.action]">{{ log.action }}</span>
                <span class="cell cell--module text-zinc-600 dark:text-zinc-400">{{ log.module }}</span>
                <span class="cell cell--data font-medium text-zinc-900 dark:text-zinc-50">{{ log.targetLabel }}</span>
                <span class="cell cell--user text-zinc-600 dark:text-zinc-400">{{ log.performedBy }} <span class="text-zinc-400 dark:text-zinc-500">({{ log.performedByRole }})</span></span>
              </button>

              <template #content>
                <div class="w-72 space-y-1.5 p-3 font-mono text-xs">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold" :class="actionTextClass[log.action]">{{ log.action }}</span>
                    <span class="text-muted">{{ actionLabelMap[log.action] ?? log.action }}</span>
                    <span class="ml-auto text-muted tabular-nums">{{ formatTimestamp(log.timestamp) }}</span>
                  </div>
                  <div class="text-highlighted break-words">
                    <span class="text-muted">{{ log.module }}</span> · {{ log.targetLabel }}
                  </div>
                  <div v-if="log.detail" class="text-muted whitespace-pre-wrap break-words">{{ log.detail }}</div>
                  <div class="border-t border-default pt-1.5 text-muted">
                    oleh {{ log.performedBy }} ({{ log.performedByRole }})
                  </div>
                </div>
              </template>
            </UPopover>
          </template>
        </div>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between gap-3 pt-4">
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted">{{ total }} log</div>
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

      <!-- Retention settings (collapsible) -->
      <UCollapsible v-model:open="retentionOpen" class="mt-8">
        <div class="flex items-center justify-between gap-3 rounded-xl border border-default bg-elevated/30 px-4 py-3">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <UIcon name="i-lucide-shield-alert" class="size-4 text-muted" />
            <span class="text-sm font-medium text-highlighted">Retensi & Pembersihan Log</span>
            <span class="text-xs text-muted">· simpan {{ retentionDays }} hari</span>
          </div>
          <UIcon
            :name="retentionOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-4 shrink-0 text-muted"
          />
        </div>

        <template #content>
          <div class="mt-2 space-y-4 rounded-xl border border-default bg-elevated/30 p-5">
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
                  <div class="flex items-center gap-2">
                    <UPopover>
                      <UButton
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-calendar"
                        class="min-w-40 justify-start font-normal"
                        :class="!purgeDateCal && 'text-muted'"
                      >
                        {{ purgeDateCal ? formatDisplay(purgeDateCal) : 'Pilih tanggal' }}
                      </UButton>
                      <template #content>
                        <CalendarPicker v-model="purgeDateCal" class="p-2" />
                      </template>
                    </UPopover>
                    <UButton
                      v-if="purgeDateCal"
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      aria-label="Hapus tanggal"
                      @click="purgeDateCal = null"
                    />
                  </div>
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
      </UCollapsible>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.terminal-viewport {
  max-height: 62vh;
  min-height: 16rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.terminal-row {
  display: grid;
  grid-template-columns: 19ch 7ch 14ch minmax(0, 1fr) 18ch;
  align-items: baseline;
  column-gap: 1.5rem;
  width: 100%;
  padding: 0.3rem 0.9rem;
  text-align: left;
  font-size: 0.8125rem;
  line-height: 1.7;
  cursor: default;
  transition: background-color 120ms ease;
}

.cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-empty {
  padding: 3.5rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
}

.terminal-viewport::-webkit-scrollbar {
  width: 10px;
}

.terminal-viewport::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 9999px;
  border: 3px solid transparent;
  background-clip: content-box;
}

@media (max-width: 1024px) {
  .terminal-row {
    grid-template-columns: 19ch 7ch 14ch minmax(0, 1fr);
  }
  .cell--user {
    display: none;
  }
}

@media (max-width: 768px) {
  .terminal-row {
    grid-template-columns: 19ch 7ch minmax(0, 1fr);
  }
  .cell--module {
    display: none;
  }
}

@media (max-width: 560px) {
  .terminal-row {
    display: block;
    padding: 0.5rem 0.9rem;
  }
  .terminal-row .cell {
    display: block;
  }
  .cell--time {
    font-size: 0.75rem;
  }
}
</style>
