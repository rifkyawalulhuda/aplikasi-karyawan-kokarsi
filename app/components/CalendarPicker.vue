<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

const props = defineProps<{
  modelValue: CalendarDate | null
  minDate?: CalendarDate | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: CalendarDate | null]
}>()

// ── View state ──────────────────────────────────────────────────────────────
type PickerView = 'day' | 'month' | 'year'
const view = ref<PickerView>('day')

const today = new Date()
const displayYear  = ref(props.modelValue?.year  ?? today.getFullYear())
const displayMonth = ref(props.modelValue?.month ?? today.getMonth() + 1)

watch(() => props.modelValue, (val) => {
  if (val) {
    displayYear.value  = val.year
    displayMonth.value = val.month
  }
})

const internalValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// ── minDate helpers ──────────────────────────────────────────────────────────
function isYearDisabled(year: number): boolean {
  if (!props.minDate) return false
  return year < props.minDate.year
}

function isMonthDisabled(month: number): boolean {
  if (!props.minDate) return false
  if (displayYear.value > props.minDate.year) return false
  if (displayYear.value < props.minDate.year) return true
  return month < props.minDate.month
}

// ── Month names ──────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April',
  'Mei', 'Juni', 'Juli', 'Agustus',
  'September', 'Oktober', 'November', 'Desember',
]

// ── Year grid ────────────────────────────────────────────────────────────────
const yearGridStart = ref(Math.floor(displayYear.value / 12) * 12)
const yearGrid = computed(() =>
  Array.from({ length: 12 }, (_, i) => yearGridStart.value + i)
)
const yearGridLabel = computed(
  () => `${yearGridStart.value} – ${yearGridStart.value + 11}`
)

function prevYearGrid() { yearGridStart.value -= 12 }
function nextYearGrid() { yearGridStart.value += 12 }

// ── Handlers ─────────────────────────────────────────────────────────────────
function onHeadingClick(_headingValue: string) {
  view.value = 'month'
}

function selectMonth(month: number) {
  if (isMonthDisabled(month)) return
  displayMonth.value = month
  if (props.modelValue) {
    internalValue.value = new CalendarDate(displayYear.value, month, props.modelValue.day)
  } else {
    internalValue.value = new CalendarDate(displayYear.value, month, 1)
  }
  view.value = 'day'
}

function selectYear(year: number) {
  if (isYearDisabled(year)) return
  displayYear.value = year
  yearGridStart.value = Math.floor(year / 12) * 12
  view.value = 'month'
}

function prevMonthView() {
  if (displayYear.value > 1) displayYear.value--
}
function nextMonthView() {
  displayYear.value++
}

const calendarPlaceholder = computed(() =>
  new CalendarDate(displayYear.value, displayMonth.value, 1)
)
</script>

<template>
  <div class="w-fit">
    <!-- ── Day View ──────────────────────────────────────────────────────── -->
    <div v-if="view === 'day'">
      <UCalendar
        v-model="internalValue"
        v-model:placeholder="calendarPlaceholder"
        :min-value="minDate ?? undefined"
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
    <div v-else-if="view === 'month'" class="w-[280px] p-2">
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
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="(name, idx) in MONTH_NAMES"
          :key="idx"
          type="button"
          class="rounded-md py-2 text-center text-sm transition-colors"
          :class="isMonthDisabled(idx + 1)
            ? 'cursor-not-allowed text-muted/40 opacity-40'
            : idx + 1 === displayMonth && displayYear === (modelValue?.year ?? 0)
              ? 'bg-primary font-semibold text-inverted hover:opacity-90'
              : idx + 1 === (today.getMonth() + 1) && displayYear === today.getFullYear()
                ? 'ring-1 ring-primary text-highlighted hover:bg-elevated'
                : 'text-highlighted hover:bg-elevated'"
          :disabled="isMonthDisabled(idx + 1)"
          @click="selectMonth(idx + 1)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <!-- ── Year View ─────────────────────────────────────────────────────── -->
    <div v-else-if="view === 'year'" class="w-[280px] p-2">
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
      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="year in yearGrid"
          :key="year"
          type="button"
          class="rounded-md py-2 text-center text-sm transition-colors"
          :class="isYearDisabled(year)
            ? 'cursor-not-allowed text-muted/40 opacity-40'
            : year === displayYear
              ? 'bg-primary font-semibold text-inverted hover:opacity-90'
              : year === today.getFullYear()
                ? 'ring-1 ring-primary text-highlighted hover:bg-elevated'
                : 'text-highlighted hover:bg-elevated'"
          :disabled="isYearDisabled(year)"
          @click="selectYear(year)"
        >
          {{ year }}
        </button>
      </div>
    </div>
  </div>
</template>
