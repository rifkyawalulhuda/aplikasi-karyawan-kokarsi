<script setup lang="ts">
import type { CalendarEventInput, CalendarItem } from '~/types'

const toast = useToast()
const router = useRouter()
const requestFetch = useRequestFetch()
const today = new Date()
const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
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
    items.value = await requestFetch<CalendarItem[]>('/api/calendar', {
      query: { start: isoDate(rangeStart.value), end: isoDate(rangeEnd.value) }
    })
  } catch (error: unknown) {
    items.value = []
    toast.add({ title: 'Gagal memuat kalender', description: errorMessage(error), color: 'error' })
  } finally {
    loading.value = false
  }
}

watch([rangeStart, rangeEnd], loadItems, { immediate: true })

function shiftMonth(amount: number) {
  displayedMonth.value = new Date(displayedMonth.value.getFullYear(), displayedMonth.value.getMonth() + amount, 1)
  selectedDate.value = null
}

function resetForm() {
  formMode.value = 'create'
  editingId.value = null
  assignAll.value = false
  selectedUserIds.value = []
  Object.assign(form, { title: '', description: '', location: '', startDate: '', endDate: '', startTime: '', endTime: '', color: 'blue', assignedUserIds: [] })
}

function openCreate(date = isoDate(today)) {
  resetForm()
  form.startDate = date
  form.endDate = date
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
  if (item.readOnly || !confirm(`Hapus agenda "${item.title}"?`)) return
  try {
    await requestFetch(`/api/calendar/${item.sourceId}`, { method: 'DELETE' })
    selectedDate.value = null
    await loadItems()
    toast.add({ title: 'Agenda dihapus', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: 'Gagal menghapus agenda', description: errorMessage(error), color: 'error' })
  }
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
              {{ monthLabel }}
            </h2>
            <p class="text-sm text-muted">
              Agenda bersama dan tanggal berakhir dokumen.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              aria-label="Bulan sebelumnya"
              @click="shiftMonth(-1)"
            />
            <UButton
              label="Hari Ini"
              color="neutral"
              variant="outline"
              @click="displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1)"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              aria-label="Bulan berikutnya"
              @click="shiftMonth(1)"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          <span v-for="legend in [{ c: 'green', t: 'Agenda' }, { c: 'yellow', t: 'Kontrak' }, { c: 'red', t: 'Dokumen' }, { c: 'blue', t: 'Vendor' }, { c: 'purple', t: 'Legal' }]" :key="legend.t" class="flex items-center gap-1.5">
            <span class="size-2 rounded-full" :class="colorClass(legend.c).split(' ')[0]" />{{ legend.t }}
          </span>
        </div>

        <div class="overflow-x-auto rounded-md border border-default bg-default">
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
                @dblclick="openCreate(isoDate(date))"
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
            <UInput v-model="form.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Tanggal Selesai" required>
            <UInput v-model="form.endDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Jam Mulai" required>
            <UInput v-model="form.startTime" type="time" class="w-full" />
          </UFormField>
          <UFormField label="Jam Selesai">
            <UInput v-model="form.endTime" type="time" class="w-full" />
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
</template>
