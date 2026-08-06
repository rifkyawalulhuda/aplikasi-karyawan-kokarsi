<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

const props = defineProps<{
  modelValue: CalendarDate | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: CalendarDate | null]
}>()

// ── View state ──────────────────────────────────────────────────────────────
type PickerView = 'day' | 'month' | 'year'
const view = ref<PickerView>('day')

// Tracking bulan dan tahun yang sedang ditampilkan di day view
// Sync dari modelValue, atau fallback ke hari ini
const today = new Date()
const displayYear  = ref(props.modelValue?.year  ?? today.getFullYear())
const displayMonth = ref(props.modelValue?.month ?? today.getMonth() + 1)

// Saat value berubah dari luar, sync display
watch(() => props.modelValue, (val) => {
  if (val) {
    displayYear.value  = val.year
    displayMonth.value = val.month
  }
})

// Internal v-model untuk UCalendar — sync dua arah dengan parent
const internalValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// ── Month names ──────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April',
  'Mei', 'Juni', 'Juli', 'Agustus',
  'September', 'Oktober', 'November', 'Desember',
]

// ── Year grid ────────────────────────────────────────────────────────────────
// Tampilkan 12 tahun sekaligus (1 dekade + 1 di tiap sisi)
const yearGridStart = ref(Math.floor(displayYear.value / 12) * 12)
const yearGrid = computed(() =>
  Array.from({ length: 12 }, (_, i) => yearGridStart.value + i)
)
const yearGridLabel = computed(
  () => `${yearGridStart.value} – ${yearGridStart.value + 11}`
)

function prevYearGrid() { yearGridStart.value -= 12 }
function nextYearGrid() { yearGridStart.value += 12 }

// ── Heading yang ditampilkan di day view ────────────────────────────────────
// UCalendar expose slot #heading dengan value string seperti "Agustus 2026"
// Kita parse untuk mendapatkan bulan+tahun yang sedang tampil di kalender
// dan sinkronkan ke displayYear/displayMonth

// Handler klik heading "Agustus 2026" → pindah ke month view
function onHeadingClick(headingValue: string) {
  // Heading value dari UCalendar adalah "Bulan Tahun" dalam locale aktif
  // Kita ambil displayYear/displayMonth yang sudah kita track
  view.value = 'month'
}

// Handler pilih bulan di month view
function selectMonth(month: number) {
  displayMonth.value = month
  // Jika sudah ada value, update ke bulan baru di tahun yang sama
  if (props.modelValue) {
    internalValue.value = new CalendarDate(displayYear.value, month, props.modelValue.day)
  } else {
    internalValue.value = new CalendarDate(displayYear.value, month, 1)
  }
  view.value = 'day'
}

// Handler pilih tahun di year view
function selectYear(year: number) {
  displayYear.value = year
  yearGridStart.value = Math.floor(year / 12) * 12
  view.value = 'month'
}

// Navigasi prev/next di month view
function prevMonthView() {
  if (displayYear.value > 1) displayYear.value--
}
function nextMonthView() {
  displayYear.value++
}

// Navigasi prev/next di day view — track displayYear/displayMonth saat UCalendar pindah bulan
// UCalendar menggunakan placeholder untuk tracking posisi kalender
const calendarPlaceholder = computed(() =>
  new CalendarDate(displayYear.value, displayMonth.value, 1)
)

// Ketika kalender pindah halaman, update displayYear/displayMonth
function onCalendarUpdate(val: CalendarDate | null) {
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="w-fit">
    <!-- ── Day View ──────────────────────────────────────────────────────── -->
    <div v-if="view === 'day'">
      <UCalendar
        v-model="internalValue"
        v-model:placeholder="calendarPlaceholder"
        @update:model-value="onCalendarUpdate"
      >
        <template #heading="{ value }">
          <button
            type="button"
            class="rounded px-2 py-0.5 text-sm font-semibold text-highlighted transition-colors hover:bg-elevated"
            @click="onHeadingClick(value)"
          >
            {{ value }}
          </button>
        </template>
      </UCalendar>
    </div>

    <!-- ── Month View ────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'month'" class="w-[280px]">
      <!-- Header tahun — klikable untuk ke year view -->
      <div class="mb-3 flex items-center justify-between px-1">
        <button
          type="button"
          class="rounded p-1 text-muted transition-colors hover:bg-elevated hover:text-highlighted"
          aria-label="Tahun sebelumnya"
          @click="prevMonthView"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" />
        </button>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-sm font-semibold text-highlighted transition-colors hover:bg-elevated"
          @click="view = 'year'"
        >
          {{ displayYear }}
        </button>
        <button
          type="button"
          class="rounded p-1 text-muted transition-colors hover:bg-elevated hover:text-highlighted"
          aria-label="Tahun berikutnya"
          @click="nextMonthView"
        >
          <UIcon name="i-lucide-chevron-right" class="size-4" />
        </button>
      </div>
      <!-- Grid 4×3 bulan -->
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(name, idx) in MONTH_NAMES"
          :key="idx"
          type="button"
          class="rounded-md py-2 text-center text-sm transition-colors hover:bg-elevated"
          :class="[
            idx + 1 === displayMonth && displayYear === (modelValue?.year ?? 0)
              ? 'bg-primary font-semibold text-inverted'
              : 'text-highlighted',
            idx + 1 === (new Date().getMonth() + 1) && displayYear === today.getFullYear()
              ? 'ring-1 ring-primary'
              : '',
          ]"
          @click="selectMonth(idx + 1)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <!-- ── Year View ─────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'year'" class="w-[280px]">
      <!-- Header dekade -->
      <div class="mb-3 flex items-center justify-between px-1">
        <button
          type="button"
          class="rounded p-1 text-muted transition-colors hover:bg-elevated hover:text-highlighted"
          aria-label="Dekade sebelumnya"
          @click="prevYearGrid"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" />
        </button>
        <span class="text-sm font-semibold text-highlighted">{{ yearGridLabel }}</span>
        <button
          type="button"
          class="rounded p-1 text-muted transition-colors hover:bg-elevated hover:text-highlighted"
          aria-label="Dekade berikutnya"
          @click="nextYearGrid"
        >
          <UIcon name="i-lucide-chevron-right" class="size-4" />
        </button>
      </div>
      <!-- Grid 4×3 tahun -->
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="year in yearGrid"
          :key="year"
          type="button"
          class="rounded-md py-2 text-center text-sm transition-colors hover:bg-elevated"
          :class="[
            year === displayYear
              ? 'bg-primary font-semibold text-inverted'
              : 'text-highlighted',
            year === today.getFullYear()
              ? 'ring-1 ring-primary'
              : '',
          ]"
          @click="selectYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </div>
  </div>
</template>
