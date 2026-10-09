<script setup lang="ts">
import type { Employee } from '~/types'
import type { EmployeeDocumentLike } from '~/utils/employee-metrics'

const props = withDefaults(defineProps<{
  open: boolean
  employee: Employee
  employeeDocs?: EmployeeDocumentLike[]
}>(), {
  employeeDocs: () => []
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const localOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val)
})

// Default nonaktif: CV modern umumnya tidak memuat catatan disipliner.
const includeWarningLetters = ref(false)

const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.5
const STEP = 0.1
/** Lebar A4 dalam px CSS (210mm @ 96dpi) — dipakai untuk hitung "sesuaikan lebar". */
const A4_WIDTH_PX = 794

const zoom = ref(1)
const viewportRef = ref<HTMLElement | null>(null)

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

/** Skalakan dokumen agar pas lebar area preview. */
function fitToWidth() {
  const el = viewportRef.value
  if (!el) return
  const available = el.clientWidth - 32
  if (available > 0) zoom.value = clampZoom(available / A4_WIDTH_PX)
}

function zoomIn() {
  zoom.value = clampZoom(zoom.value + STEP)
}

function zoomOut() {
  zoom.value = clampZoom(zoom.value - STEP)
}

function printNow() {
  window.print()
}

onMounted(() => {
  nextTick(fitToWidth)
  window.addEventListener('resize', fitToWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitToWidth)
})

watch(localOpen, (value) => {
  if (value) nextTick(fitToWidth)
})
</script>

<template>
  <UModal v-model:open="localOpen" :ui="{ content: 'max-w-6xl w-full' }">
    <template #header>
      <div class="flex flex-1 items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <UIcon name="i-lucide-file-text" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span class="truncate text-sm font-medium">Cetak CV — {{ employee.fullName }}</span>
        </div>
        <div class="no-print flex shrink-0 items-center gap-1">
          <UButton
            icon="i-lucide-minus"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Perkecil"
            :disabled="zoom <= MIN_ZOOM"
            @click="zoomOut"
          />
          <span class="w-11 text-center text-xs tabular-nums text-muted">{{ Math.round(zoom * 100) }}%</span>
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Perbesar"
            :disabled="zoom >= MAX_ZOOM"
            @click="zoomIn"
          />
          <UButton
            icon="i-lucide-maximize"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Sesuaikan lebar"
            @click="fitToWidth"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div
        ref="viewportRef"
        class="max-h-[72vh] overflow-auto rounded-lg border border-default bg-elevated/40 p-4"
      >
        <div class="mx-auto w-fit" :style="{ zoom }">
          <div class="cv-preview">
            <KaryawanDetailCvDocument
              :employee="employee"
              :employee-docs="employeeDocs"
              :include-warning-letters="includeWarningLetters"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="no-print flex w-full flex-wrap items-center justify-between gap-3">
        <USwitch
          v-model="includeWarningLetters"
          label="Sertakan surat peringatan"
          size="sm"
        />
        <div class="flex items-center gap-2">
          <UButton
            label="Tutup"
            color="neutral"
            variant="ghost"
            @click="localOpen = false"
          />
          <UButton
            label="Cetak / Simpan PDF"
            icon="i-lucide-printer"
            color="primary"
            @click="printNow"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Teleport ke body tanpa ancestor fixed/overflow agar print multi-halaman berjalan -->
  <Teleport to="body">
    <div class="print-only-cv">
      <KaryawanDetailCvDocument
        :employee="employee"
        :employee-docs="employeeDocs"
        :include-warning-letters="includeWarningLetters"
      />
    </div>
  </Teleport>
</template>
