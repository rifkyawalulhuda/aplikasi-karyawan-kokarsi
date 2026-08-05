<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, Time } from '@internationalized/date'
import type { CalendarEventInput, CalendarItem } from '~/types'

const toast = useToast()
const { confirmDeleteToast } = useConfirmDeleteToast()
const router = useRouter()
const requestFetch = useRequestFetch()
const today = new Date()

// ── DatePicker state ────────────────────────────────────────────────────────
const dfLong = new DateFormatter('id-ID', { dateStyle: 'long' })

function toCalDate(s: string): CalendarDate | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new CalendarDate(y, m, d)
}

function fromCalDate(c: CalendarDate | null): string {
  if (!c) return ''
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
}

const startDateCal = shallowRef<CalendarDate | null>(null)
const endDateCal   = shallowRef<CalendarDate | null>(null)

watch(startDateCal, val => { form.startDate = fromCalDate(val) })
watch(endDateCal,   val => { form.endDate   = fromCalDate(val) })

// ── TimePicker state ────────────────────────────────────────────────────────
function toTime(s: string): Time | null {
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  return new Time(h ?? 0, m ?? 0)
}

function fromTime(t: Time | null): string {
  if (!t) return ''
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
}

const startTimeCal = shallowRef<Time | null>(null)
const endTimeCal   = shallowRef<Time | null>(null)

watch(startTimeCal, val => { form.startTime = fromTime(val) })
watch(endTimeCal,   val => { form.endTime   = fromTime(val) })

// ── View state ─────────────────────────────────────────────────────────────
type CalendarView = 'month' | 'week' | 'day'
const activeView = ref<CalendarView>('month')
const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))

// Week View: Senin dari minggu yang sedang tampil
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}
const displayedWeekStart = ref<Date>(getMondayOf(today))

// Day View: hari yang sedang tampil
const displayedDay = ref<Date>(new Date(today.getFullYear(), today.getMonth(), today.getDate()))

// Tooltip untuk Week/Day View
const tooltipItem = ref<CalendarItem | null>(null)
const tooltipAnchor = ref<{ x: number; y: number } | null>(null)
const timeGridRef = ref<HTMLElement | null>(null)

// Month View modal detail
const selectedDate = ref<string | null>(null)
const detailOpen = computed({
  get: () => selectedDate.value !== null,
  set: (value: boolean) => { if (!value) selectedDate.value = null }
})

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)
const loading = ref(false)
const items = ref<CalendarItem[]>([])

// Users untuk multi-select penerima notifikasi
const { data: usersRes } = await useFetch<{ id: number; name: string }[]>('/api/users/pengurus', { lazy: true, credentials: 'include' })
const userOptions = computed(() => usersRes.value?.map(u => ({ label: u.name, value: u.id })) ?? [])
const assignAll = ref(false)
const selectedUserIds = ref<number[]>([])

const form = reactive<CalendarEventInput>({
  title: '', description: '', location: '', startDate: '', endDate: '', startTime: '', endTime: '', color: 'blue', assignedUserIds: []
})

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const monthLabel = computed(() => displayedMonth.value.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
const monthStart = computed(() => new Date(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth(), 1))
const monthEnd = computed(() => new Date(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth() + 1, 0))
const rangeStart = computed(() => {
  const date = new Date(monthStart.value)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
})
const rangeEnd = computed(() => {
  const date = new Date(monthEnd.value)
  const day = date.getDay() // 0 = Minggu
  // Jika bukan Minggu, tambahkan hari sampai Minggu berikutnya
  // Jika sudah Minggu (0), tetap tambahkan 7 hari agar baris terakhir tampil penuh
  date.setDate(date.getDate() + (day === 0 ? 7 : (7 - day)))
  return date
})
const days = computed(() => {
  const result: Date[] = []
  const cursor = new Date(rangeStart.value)
  while (cursor <= rangeEnd.value) {
    result.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
})
const selectedItems = computed(() => selectedDate.value
  ? items.value.filter(item => item.startDate <= selectedDate.value! && item.endDate >= selectedDate.value!)
  : [])

function itemsFor(date: Date) {
  const value = isoDate(date)
  return items.value.filter(item => item.startDate <= value && item.endDate >= value)
}

// ── Week View computed ──────────────────────────────────────────────────────
const weekDays = computed(() => {
  const result: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(displayedWeekStart.value)
    d.setDate(d.getDate() + i)
    result.push(d)
  }
  return result
})

const weekLabel = computed(() => {
  const start = weekDays.value[0]
  const end = weekDays.value[6]
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('id-ID', { day: 'numeric' })}–${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  return `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
})

// ── Day View computed ───────────────────────────────────────────────────────
const dayLabel = computed(() =>
  displayedDay.value.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

// ── Shared time-grid helpers ────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT_REM = 4 // 4rem = 64px per jam

function allDayItemsFor(date: Date): CalendarItem[] {
  const value = isoDate(date)
  return items.value.filter(item =>
    item.startDate <= value && item.endDate >= value && !item.startTime
  )
}

function timedItemsFor(date: Date): CalendarItem[] {
  const value = isoDate(date)
  return items.value.filter(item =>
    item.startDate <= value && item.endDate >= value && !!item.startTime
  )
}

function parseTime(t: string): number {
  // "HH:MM" → minutes from midnight
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function itemTopStyle(item: CalendarItem): string {
  if (!item.startTime) return 'top: 0'
  const mins = parseTime(item.startTime)
  return `top: ${(mins / 60) * HOUR_HEIGHT_REM}rem`
}

function itemHeightStyle(item: CalendarItem): string {
  if (!item.startTime) return `height: ${HOUR_HEIGHT_REM}rem`
  const startMins = parseTime(item.startTime)
  const endMins = item.endTime ? parseTime(item.endTime) : startMins + 60
  const duration = Math.max(endMins - startMins, 30) // min 30 menit
  return `height: ${(duration / 60) * HOUR_HEIGHT_REM}rem`
}

// ── Current time indicator ──────────────────────────────────────────────────
const currentTimeStyle = computed(() => {
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  return `top: ${(mins / 60) * HOUR_HEIGHT_REM}rem`
})

function isToday(date: Date): boolean {
  return isoDate(date) === isoDate(today)
}

// ── Tooltip popup ───────────────────────────────────────────────────────────
function openTooltip(item: CalendarItem, event: MouseEvent) {
  tooltipItem.value = item
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipAnchor.value = { x: rect.left, y: rect.top }
}

function closeTooltip() {
  tooltipItem.value = null
  tooltipAnchor.value = null
}

const COLOR_OPTIONS = [
  { value: 'blue',   bg: 'bg-blue-500',   label: 'Biru' },
  { value: 'sky',    bg: 'bg-sky-500',    label: 'Biru Muda' },
  { value: 'teal',   bg: 'bg-teal-500',   label: 'Teal' },
  { value: 'green',  bg: 'bg-green-500',  label: 'Hijau' },
  { value: 'yellow', bg: 'bg-amber-400',  label: 'Kuning' },
  { value: 'orange', bg: 'bg-orange-500', label: 'Oranye' },
  { value: 'red',    bg: 'bg-red-500',    label: 'Merah' },
  { value: 'pink',   bg: 'bg-pink-500',   label: 'Pink' },
  { value: 'purple', bg: 'bg-purple-500', label: 'Ungu' },
  { value: 'indigo', bg: 'bg-indigo-500', label: 'Indigo' },
  { value: 'gray',   bg: 'bg-gray-400',   label: 'Abu-abu' },
  { value: 'slate',  bg: 'bg-slate-500',  label: 'Slate' },
] as const

function colorClass(color: string) {
  return ({
    blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    sky:    'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    teal:   'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
    green:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    red:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    pink:   'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
    slate:  'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  } as Record<string, string>)[color] ?? 'bg-gray-100 text-gray-700'
}

function typeLabel(type: CalendarItem['type']) {
  return ({ agenda: 'Agenda', employee_contract: 'Kontrak Karyawan', employee_document: 'Dokumen Karyawan', vendor_contract: 'Kontrak Vendor', legal_koperasi: 'Legal Koperasi' })[type]
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return 'Terjadi kesalahan.'
}

async function loadItems() {
  loading.value = true
  try {
    let start: string
    let end: string
    if (activeView.value === 'month') {
      start = isoDate(rangeStart.value)
      end = isoDate(rangeEnd.value)
    } else if (activeView.value === 'week') {
      start = isoDate(displayedWeekStart.value)
      const weekEnd = new Date(displayedWeekStart.value)
      weekEnd.setDate(weekEnd.getDate() + 6)
      end = isoDate(weekEnd)
    } else {
      start = isoDate(displayedDay.value)
      end = isoDate(displayedDay.value)
    }
    items.value = await requestFetch<CalendarItem[]>('/api/calendar', {
      query: { start, end }
    })
  } catch (error: unknown) {
    items.value = []
    toast.add({ title: 'Gagal memuat kalender', description: errorMessage(error), color: 'error' })
  } finally {
    loading.value = false
  }
}

// Watch semua trigger untuk loadItems
watch([rangeStart, rangeEnd], () => { if (activeView.value === 'month') loadItems() }, { immediate: true })
watch(displayedWeekStart, () => { if (activeView.value === 'week') loadItems() })
watch(displayedDay, () => { if (activeView.value === 'day') loadItems() })
watch(activeView, () => loadItems())

// Auto-scroll ke jam pertama agenda atau jam 07:00
async function scrollToFirstEvent() {
  await nextTick()
  const el = timeGridRef.value
  if (!el) return
  const todayStr = activeView.value === 'day' ? isoDate(displayedDay.value) : isoDate(today)
  const todayItems = items.value.filter(item => item.startDate <= todayStr && item.endDate >= todayStr && item.startTime)
  const earliest = todayItems.reduce<number | null>((min, item) => {
    const mins = parseTime(item.startTime!)
    return min === null || mins < min ? mins : min
  }, null)
  const scrollHour = earliest !== null ? Math.max(0, Math.floor(earliest / 60) - 1) : 7
  el.scrollTop = scrollHour * HOUR_HEIGHT_REM * 16 // 1rem = 16px
}

watch([activeView, items], scrollToFirstEvent, { flush: 'post' })

// ── Navigasi ────────────────────────────────────────────────────────────────
function shiftMonth(amount: number) {
  displayedMonth.value = new Date(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth() + amount, 1)
  selectedDate.value = null
}

function shiftWeek(amount: number) {
  const d = new Date(displayedWeekStart.value)
  d.setDate(d.getDate() + amount * 7)
  displayedWeekStart.value = d
}

function shiftDay(amount: number) {
  const d = new Date(displayedDay.value)
  d.setDate(d.getDate() + amount)
  displayedDay.value = d
}

function goToToday() {
  if (activeView.value === 'month') {
    displayedMonth.value = new Date(today.getFullYear(), today.getMonth(), 1)
    selectedDate.value = null
  } else if (activeView.value === 'week') {
    displayedWeekStart.value = getMondayOf(today)
  } else {
    displayedDay.value = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }
}

function navigate(amount: number) {
  if (activeView.value === 'month') shiftMonth(amount)
  else if (activeView.value === 'week') shiftWeek(amount)
  else shiftDay(amount)
}

function switchToDayView(date: Date) {
  displayedDay.value = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  activeView.value = 'day'
}

// ── Header label per view ────────────────────────────────────────────────────
const headerLabel = computed(() => {
  if (activeView.value === 'month') return monthLabel.value
  if (activeView.value === 'week') return weekLabel.value
  return dayLabel.value
})

function resetForm() {
  formMode.value = 'create'
  editingId.value = null
  assignAll.value = false
  selectedUserIds.value = []
  startDateCal.value = null
  endDateCal.value = null
  startTimeCal.value = null
  endTimeCal.value = null
  Object.assign(form, { title: '', description: '', location: '', startDate: '', endDate: '', startTime: '', endTime: '', color: 'blue', assignedUserIds: [] })
}

function openCreate(date = isoDate(today)) {
  resetForm()
  startDateCal.value = toCalDate(date)
  endDateCal.value   = toCalDate(date)
  selectedDate.value = null  // tutup modal detail sebelum buka form
  formOpen.value = true
}

function openEdit(item: CalendarItem) {
  if (item.readOnly) return
  formMode.value = 'edit'
  editingId.value = item.sourceId
  Object.assign(form, {
    title: item.title, description: item.description ?? '', location: item.location ?? '',
    startDate: item.startDate, endDate: item.endDate, startTime: item.startTime ?? '', endTime: item.endTime ?? '', color: item.color,
    assignedUserIds: item.assignedUserIds ?? [],
  })
  startDateCal.value = toCalDate(item.startDate)
  endDateCal.value   = toCalDate(item.endDate)
  startTimeCal.value = toTime(item.startTime ?? '')
  endTimeCal.value   = toTime(item.endTime ?? '')
  assignAll.value = false
  selectedUserIds.value = item.assignedUserIds ?? []
  selectedDate.value = null
  formOpen.value = true
}

async function saveEvent() {
  if (!form.title.trim() || !form.startDate || !form.endDate || !form.startTime) {
    toast.add({ title: 'Data agenda belum lengkap', description: 'Judul, tanggal, dan jam mulai wajib diisi.', color: 'warning' })
    return
  }
  // Sync assignedUserIds dari state ke form sebelum kirim
  form.assignedUserIds = assignAll.value
    ? userOptions.value.map(u => u.value)
    : selectedUserIds.value
  saving.value = true
  try {
    const url = formMode.value === 'edit' ? `/api/calendar/${editingId.value}` : '/api/calendar'
    await requestFetch(url, { method: formMode.value === 'edit' ? 'PUT' : 'POST', body: form })
    formOpen.value = false
    await loadItems()
    toast.add({ title: formMode.value === 'edit' ? 'Agenda diperbarui' : 'Agenda ditambahkan', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: 'Gagal menyimpan agenda', description: errorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function removeEvent(item: CalendarItem) {
  if (item.readOnly) return
  confirmDeleteToast({
    title: 'Hapus Agenda',
    description: `Agenda "${item.title}" akan dihapus permanen.`,
    onConfirm: async () => {
      try {
        await requestFetch(`/api/calendar/${item.sourceId}`, { method: 'DELETE' })
        selectedDate.value = null
        await loadItems()
        toast.add({ title: 'Agenda dihapus', color: 'success' })
      } catch (error: unknown) {
        toast.add({ title: 'Gagal menghapus agenda', description: errorMessage(error), color: 'error' })
      }
    },
  })
}

function openItem(item: CalendarItem) {
  if (item.readOnly && item.deeplink) router.push(item.deeplink)
  else openEdit(item)
}
</script>

<template>
  <UDashboardPanel id="calendar">
    <template #header>
      <UDashboardNavbar title="Kalender">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Tambah Agenda"
            icon="i-lucide-plus"
            color="primary"
            @click="openCreate()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold capitalize text-highlighted">
              {{ headerLabel }}
            </h2>
            <p class="text-sm text-muted">
              Agenda bersama dan tanggal berakhir dokumen.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <!-- Toggle View: Month / Week / Day -->
            <div class="flex rounded-lg border border-default overflow-hidden text-sm">
              <button
                v-for="v in [{ key: 'month', label: 'Bulan' }, { key: 'week', label: 'Minggu' }, { key: 'day', label: 'Hari' }]"
                :key="v.key"
                type="button"
                class="px-3 py-1.5 font-medium transition-colors"
                :class="activeView === v.key ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted hover:bg-elevated/60'"
                @click="activeView = v.key as CalendarView"
              >{{ v.label }}</button>
            </div>
            <!-- Navigasi prev / today / next -->
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              :aria-label="activeView === 'month' ? 'Bulan sebelumnya' : activeView === 'week' ? 'Minggu sebelumnya' : 'Hari sebelumnya'"
              @click="navigate(-1)"
            />
            <UButton
              label="Hari Ini"
              color="neutral"
              variant="outline"
              @click="goToToday"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              :aria-label="activeView === 'month' ? 'Bulan berikutnya' : activeView === 'week' ? 'Minggu berikutnya' : 'Hari berikutnya'"
              @click="navigate(1)"
            />
          </div>
        </div>

        <!-- ── Legend ─────────────────────────────────────────────────────── -->
        <div v-if="activeView === 'month'" class="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          <span v-for="legend in [{ c: 'green', t: 'Agenda' }, { c: 'yellow', t: 'Kontrak' }, { c: 'red', t: 'Dokumen' }, { c: 'blue', t: 'Vendor' }, { c: 'purple', t: 'Legal' }]" :key="legend.t" class="flex items-center gap-1.5">
            <span class="size-2 rounded-full" :class="colorClass(legend.c).split(' ')[0]" />{{ legend.t }}
          </span>
        </div>

        <!-- ── Month View ─────────────────────────────────────────────────── -->
        <div v-if="activeView === 'month'" class="overflow-x-auto rounded-md border border-default bg-default">
          <div class="min-w-[840px]">
            <div class="grid grid-cols-7 border-b border-default bg-elevated/50 text-center text-xs font-medium text-muted">
              <div v-for="day in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']" :key="day" class="py-2.5">
                {{ day }}
              </div>
            </div>
            <div v-if="loading" class="flex h-80 items-center justify-center">
              <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
            </div>
            <div v-else class="grid grid-cols-7">
              <button
                v-for="date in days"
                :key="isoDate(date)"
                type="button"
                class="min-h-32 border-b border-r border-default p-2 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary"
                :class="date.getMonth() !== displayedMonth.getMonth() ? 'bg-elevated/20 text-dimmed' : 'bg-default'"
                @click="selectedDate = isoDate(date)"
                @dblclick="switchToDayView(date)"
              >
                <span class="mb-2 inline-flex size-7 items-center justify-center rounded-full text-sm font-medium" :class="isoDate(date) === isoDate(today) ? 'bg-primary text-inverted' : ''">{{ date.getDate() }}</span>
                <div class="space-y-1">
                  <div
                    v-for="item in itemsFor(date).slice(0, 3)"
                    :key="item.id"
                    class="truncate rounded px-1.5 py-1 text-xs font-medium"
                    :class="colorClass(item.color)"
                  >
                    {{ item.startTime || '' }} {{ item.title }}
                  </div>
                  <p v-if="itemsFor(date).length > 3" class="px-1 text-xs text-muted">
                    +{{ itemsFor(date).length - 3 }} lainnya
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- ── Week View ──────────────────────────────────────────────────── -->
        <div v-else-if="activeView === 'week'" class="overflow-hidden rounded-md border border-default bg-default">
          <!-- Header hari -->
          <div class="grid border-b border-default bg-elevated/50" style="grid-template-columns: 3.5rem repeat(7, 1fr)">
            <div class="border-r border-default" />
            <div
              v-for="date in weekDays"
              :key="isoDate(date)"
              class="border-r border-default py-2 text-center last:border-r-0"
            >
              <div class="text-xs font-medium text-muted">{{ ['Sen','Sel','Rab','Kam','Jum','Sab','Min'][date.getDay() === 0 ? 6 : date.getDay() - 1] }}</div>
              <div
                class="mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold"
                :class="isToday(date) ? 'bg-primary text-inverted' : 'text-highlighted'"
              >{{ date.getDate() }}</div>
            </div>
          </div>

          <!-- All-day strip -->
          <div class="grid border-b border-default" style="grid-template-columns: 3.5rem repeat(7, 1fr)">
            <div class="flex items-center justify-end border-r border-default pr-2">
              <span class="text-[10px] text-muted leading-none">Sepanjang<br>Hari</span>
            </div>
            <div
              v-for="date in weekDays"
              :key="'allday-' + isoDate(date)"
              class="min-h-8 border-r border-default p-1 last:border-r-0"
            >
              <div
                v-for="item in allDayItemsFor(date)"
                :key="item.id"
                class="mb-0.5 cursor-pointer truncate rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                :class="colorClass(item.color)"
                @click="openTooltip(item, $event)"
              >{{ item.title }}</div>
            </div>
          </div>

          <!-- Time grid -->
          <div v-if="loading" class="flex h-64 items-center justify-center">
            <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
          </div>
          <div v-else ref="timeGridRef" class="overflow-y-auto" style="max-height: 600px">
            <div class="relative grid" style="grid-template-columns: 3.5rem repeat(7, 1fr)">
              <!-- Jam label kiri -->
              <div class="border-r border-default">
                <div
                  v-for="hour in HOURS"
                  :key="hour"
                  class="flex items-start justify-end border-b border-default/50 pr-2 pt-1"
                  :style="`height: ${HOUR_HEIGHT_REM}rem`"
                >
                  <span class="text-[10px] text-muted">{{ String(hour).padStart(2, '0') }}:00</span>
                </div>
              </div>
              <!-- Kolom hari -->
              <div
                v-for="date in weekDays"
                :key="'col-' + isoDate(date)"
                class="relative border-r border-default last:border-r-0"
                :style="`height: ${HOUR_HEIGHT_REM * 24}rem`"
              >
                <!-- Grid lines -->
                <div
                  v-for="hour in HOURS"
                  :key="hour"
                  class="absolute w-full border-b border-default/50"
                  :style="`top: ${hour * HOUR_HEIGHT_REM}rem; height: ${HOUR_HEIGHT_REM}rem`"
                />
                <!-- Current time indicator -->
                <div
                  v-if="isToday(date)"
                  class="absolute z-10 w-full border-t-2 border-primary"
                  :style="currentTimeStyle"
                >
                  <div class="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-primary" />
                </div>
                <!-- Timed events -->
                <button
                  v-for="item in timedItemsFor(date)"
                  :key="item.id"
                  type="button"
                  class="absolute left-0.5 right-0.5 z-20 overflow-hidden rounded px-1.5 py-1 text-left text-xs font-medium shadow-sm transition-opacity hover:opacity-90"
                  :class="colorClass(item.color)"
                  :style="`${itemTopStyle(item)}; ${itemHeightStyle(item)}`"
                  @click="openTooltip(item, $event)"
                >
                  <div class="truncate font-semibold leading-tight">{{ item.title }}</div>
                  <div class="truncate text-[10px] opacity-80">{{ item.startTime }}<span v-if="item.endTime">–{{ item.endTime }}</span></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Day View ───────────────────────────────────────────────────── -->
        <div v-else-if="activeView === 'day'" class="overflow-hidden rounded-md border border-default bg-default">
          <!-- Header hari -->
          <div class="border-b border-default bg-elevated/50 px-4 py-3 text-center">
            <div
              class="inline-flex size-9 items-center justify-center rounded-full text-lg font-bold"
              :class="isToday(displayedDay) ? 'bg-primary text-inverted' : 'text-highlighted'"
            >{{ displayedDay.getDate() }}</div>
            <div class="mt-0.5 text-xs font-medium capitalize text-muted">
              {{ displayedDay.toLocaleDateString('id-ID', { weekday: 'long', month: 'long', year: 'numeric' }) }}
            </div>
          </div>

          <!-- All-day strip -->
          <div
            v-if="allDayItemsFor(displayedDay).length"
            class="flex flex-wrap gap-1.5 border-b border-default bg-elevated/20 px-4 py-2"
          >
            <span class="self-center text-[10px] font-medium text-muted">Sepanjang Hari</span>
            <div
              v-for="item in allDayItemsFor(displayedDay)"
              :key="item.id"
              class="cursor-pointer rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
              :class="colorClass(item.color)"
              @click="openTooltip(item, $event)"
            >{{ item.title }}</div>
          </div>

          <!-- Time grid -->
          <div v-if="loading" class="flex h-64 items-center justify-center">
            <UIcon name="i-lucide-loader-circle" class="size-7 animate-spin text-muted" />
          </div>
          <div v-else ref="timeGridRef" class="overflow-y-auto" style="max-height: 600px">
            <div class="relative flex">
              <!-- Jam label kiri -->
              <div class="w-14 shrink-0 border-r border-default">
                <div
                  v-for="hour in HOURS"
                  :key="hour"
                  class="flex items-start justify-end border-b border-default/50 pr-2 pt-1"
                  :style="`height: ${HOUR_HEIGHT_REM}rem`"
                >
                  <span class="text-[10px] text-muted">{{ String(hour).padStart(2, '0') }}:00</span>
                </div>
              </div>
              <!-- Kolom kejadian -->
              <div class="relative flex-1" :style="`height: ${HOUR_HEIGHT_REM * 24}rem`">
                <!-- Grid lines -->
                <div
                  v-for="hour in HOURS"
                  :key="hour"
                  class="absolute w-full border-b border-default/50"
                  :style="`top: ${hour * HOUR_HEIGHT_REM}rem`"
                />
                <!-- Current time indicator -->
                <div
                  v-if="isToday(displayedDay)"
                  class="absolute z-10 w-full border-t-2 border-primary"
                  :style="currentTimeStyle"
                >
                  <div class="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-primary" />
                </div>
                <!-- Timed events -->
                <button
                  v-for="item in timedItemsFor(displayedDay)"
                  :key="item.id"
                  type="button"
                  class="absolute left-1 right-1 z-20 overflow-hidden rounded-lg px-2 py-1.5 text-left text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
                  :class="colorClass(item.color)"
                  :style="`${itemTopStyle(item)}; ${itemHeightStyle(item)}`"
                  @click="openTooltip(item, $event)"
                >
                  <div class="truncate font-semibold leading-tight">{{ item.title }}</div>
                  <div class="mt-0.5 text-xs opacity-80">
                    {{ item.startTime }}<span v-if="item.endTime">–{{ item.endTime }}</span>
                    <span v-if="item.location"> · {{ item.location }}</span>
                  </div>
                  <div v-if="item.createdByName" class="mt-0.5 flex items-center gap-1 text-xs opacity-70">
                    <UIcon name="i-lucide-user" class="size-3" />{{ item.createdByName }}
                  </div>
                </button>
                <!-- Tombol tambah agenda di slot waktu kosong -->
                <div
                  v-for="hour in HOURS"
                  :key="'add-' + hour"
                  class="group absolute w-full cursor-pointer"
                  :style="`top: ${hour * HOUR_HEIGHT_REM}rem; height: ${HOUR_HEIGHT_REM}rem`"
                  @dblclick="openCreate(`${isoDate(displayedDay)}`)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="formOpen" :title="formMode === 'edit' ? 'Edit Agenda' : 'Tambah Agenda'" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Judul" required>
          <UInput v-model="form.title" class="w-full" />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Tanggal Mulai" required>
            <UPopover :content="{ side: 'bottom', align: 'start' }">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!startDateCal ? 'text-muted' : ''"
              >
                {{ startDateCal ? dfLong.format(startDateCal.toDate(getLocalTimeZone())) : 'Pilih tanggal mulai' }}
              </UButton>
              <template #content>
                <UCalendar v-model="startDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Tanggal Selesai" required>
            <UPopover :content="{ side: 'bottom', align: 'start' }">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-calendar"
                class="w-full justify-start font-normal"
                :class="!endDateCal ? 'text-muted' : ''"
              >
                {{ endDateCal ? dfLong.format(endDateCal.toDate(getLocalTimeZone())) : 'Pilih tanggal selesai' }}
              </UButton>
              <template #content>
                <UCalendar v-model="endDateCal" class="p-2" />
              </template>
            </UPopover>
          </UFormField>
          <UFormField label="Jam Mulai" required>
            <UInputTime v-model="startTimeCal" :hour-cycle="24" class="w-full" />
          </UFormField>
          <UFormField label="Jam Selesai">
            <UInputTime v-model="endTimeCal" :hour-cycle="24" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Lokasi">
          <UInput v-model="form.location" class="w-full" />
        </UFormField>
        <UFormField label="Deskripsi">
          <UTextarea v-model="form.description" :rows="3" class="w-full" />
        </UFormField>
        <UFormField label="Notifikasi ke">
          <div class="space-y-2">
            <label class="flex cursor-pointer items-center gap-2 text-sm">
              <input v-model="assignAll" type="checkbox" class="rounded" />
              <span class="font-medium">Semua User</span>
            </label>
            <div v-if="!assignAll" class="max-h-40 overflow-y-auto rounded-md border border-default bg-elevated/30 p-2">
              <div v-if="userOptions.length === 0" class="py-2 text-center text-xs text-muted">
                Memuat daftar user...
              </div>
              <label
                v-for="opt in userOptions"
                :key="opt.value"
                class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-elevated"
              >
                <input
                  type="checkbox"
                  class="rounded"
                  :value="opt.value"
                  :checked="selectedUserIds.includes(opt.value)"
                  @change="(e) => {
                    const checked = (e.target as HTMLInputElement).checked
                    selectedUserIds = checked
                      ? [...selectedUserIds, opt.value]
                      : selectedUserIds.filter(id => id !== opt.value)
                  }"
                />
                {{ opt.label }}
              </label>
            </div>
            <p v-if="assignAll" class="text-xs text-muted">
              Notifikasi akan dikirim ke semua {{ userOptions.length }} user.
            </p>
            <p v-else-if="selectedUserIds.length > 0" class="text-xs text-muted">
              {{ selectedUserIds.length }} user dipilih.
            </p>
          </div>
        </UFormField>
        <UFormField label="Warna Label">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in COLOR_OPTIONS"
              :key="opt.value"
              type="button"
              class="size-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="[opt.bg, form.color === opt.value ? 'border-highlighted scale-110' : 'border-transparent']"
              :aria-label="`Pilih warna ${opt.label}`"
              :title="opt.label"
              @click="form.color = opt.value as CalendarEventInput['color']"
            />
          </div>
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="formOpen = false"
        /><UButton
          label="Simpan Agenda"
          color="primary"
          :loading="saving"
          @click="saveEvent"
        />
      </div>
    </template>
  </UModal>

  <UModal v-model:open="detailOpen" :title="selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Detail Agenda'">
    <template #body>
      <div v-if="selectedItems.length" class="space-y-3">
        <div v-for="item in selectedItems" :key="item.id" class="border-b border-default pb-3 last:border-0">
          <div class="flex items-start justify-between gap-3">
            <button class="min-w-0 text-left" type="button" @click="openItem(item)">
              <div class="mb-1 flex flex-wrap items-center gap-2">
                <UBadge :label="typeLabel(item.type)" color="neutral" variant="subtle" /><UBadge
                  v-if="item.status"
                  :label="item.status"
                  color="warning"
                  variant="subtle"
                />
              </div>
              <p class="font-medium text-highlighted">
                {{ item.title }}
              </p>
              <p v-if="item.description" class="text-sm text-muted">
                {{ item.description }}
              </p>
              <p v-if="item.startTime || item.location" class="mt-1 text-xs text-muted">
                {{ item.startTime }}<span v-if="item.endTime">–{{ item.endTime }}</span><span v-if="item.location"> · {{ item.location }}</span>
              </p>
              <p v-if="item.type === 'agenda' && item.createdByName" class="mt-1 flex items-center gap-1 text-xs text-muted">
                <UIcon name="i-lucide-user" class="size-3 shrink-0" />
                {{ item.createdByName }}
              </p>
            </button>
            <div v-if="!item.readOnly" class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                aria-label="Edit agenda"
                @click="openEdit(item)"
              /><UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                aria-label="Hapus agenda"
                @click="removeEvent(item)"
              />
            </div>
            <UButton
              v-else
              icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="ghost"
              aria-label="Buka detail"
              @click="openItem(item)"
            />
          </div>
        </div>
      </div>
      <div v-else class="py-8 text-center text-sm text-muted">
        Tidak ada agenda pada tanggal ini.
      </div>
    </template>
    <template #footer>
      <UButton
        label="Tambah Agenda"
        icon="i-lucide-plus"
        color="primary"
        @click="selectedDate && openCreate(selectedDate)"
      />
    </template>
  </UModal>

  <!-- ── Tooltip Popup (Week/Day View) ──────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="tooltipItem"
        class="fixed z-50 w-72 rounded-xl border border-default bg-default shadow-xl"
        :style="tooltipAnchor ? `top: ${Math.min(tooltipAnchor.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320)}px; left: ${Math.min(tooltipAnchor.x + 8, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300)}px` : ''"
        @click.stop
      >
        <!-- Color stripe + judul -->
        <div class="rounded-t-xl px-4 pt-4 pb-3" :class="colorClass(tooltipItem.color)">
          <div class="mb-1 flex flex-wrap items-center gap-1.5">
            <UBadge :label="typeLabel(tooltipItem.type)" color="neutral" variant="subtle" size="sm" />
            <UBadge v-if="tooltipItem.status" :label="tooltipItem.status" color="warning" variant="subtle" size="sm" />
          </div>
          <p class="text-sm font-semibold leading-snug text-highlighted">{{ tooltipItem.title }}</p>
        </div>

        <!-- Detail -->
        <div class="space-y-2 px-4 py-3 text-sm text-muted">
          <!-- Waktu -->
          <div v-if="tooltipItem.startTime" class="flex items-center gap-2">
            <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
            <span>{{ tooltipItem.startDate }}
              · {{ tooltipItem.startTime }}<span v-if="tooltipItem.endTime">–{{ tooltipItem.endTime }}</span>
            </span>
          </div>
          <!-- Lokasi -->
          <div v-if="tooltipItem.location" class="flex items-center gap-2">
            <UIcon name="i-lucide-map-pin" class="size-3.5 shrink-0" />
            <span class="truncate">{{ tooltipItem.location }}</span>
          </div>
          <!-- Deskripsi -->
          <div v-if="tooltipItem.description" class="flex items-start gap-2">
            <UIcon name="i-lucide-align-left" class="mt-0.5 size-3.5 shrink-0" />
            <span class="line-clamp-2">{{ tooltipItem.description }}</span>
          </div>
          <!-- Pembuat -->
          <div v-if="tooltipItem.type === 'agenda' && tooltipItem.createdByName" class="flex items-center gap-2">
            <UIcon name="i-lucide-user" class="size-3.5 shrink-0" />
            <span>{{ tooltipItem.createdByName }}</span>
          </div>
        </div>

        <!-- Aksi -->
        <div class="flex items-center justify-between gap-2 border-t border-default px-4 py-2.5">
          <div v-if="!tooltipItem.readOnly" class="flex gap-1.5">
            <UButton
              icon="i-lucide-pencil"
              size="sm"
              color="neutral"
              variant="ghost"
              label="Edit"
              @click="openEdit(tooltipItem!); closeTooltip()"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="ghost"
              label="Hapus"
              @click="removeEvent(tooltipItem!); closeTooltip()"
            />
          </div>
          <div v-else class="flex gap-1.5">
            <UButton
              v-if="tooltipItem.deeplink"
              icon="i-lucide-arrow-up-right"
              size="sm"
              color="neutral"
              variant="ghost"
              label="Buka"
              @click="router.push(tooltipItem!.deeplink!); closeTooltip()"
            />
          </div>
          <UButton
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            aria-label="Tutup"
            @click="closeTooltip"
          />
        </div>
      </div>
    </Transition>

    <!-- Backdrop untuk tutup tooltip saat klik di luar -->
    <div
      v-if="tooltipItem"
      class="fixed inset-0 z-40"
      @click="closeTooltip"
    />
  </Teleport>
</template>
