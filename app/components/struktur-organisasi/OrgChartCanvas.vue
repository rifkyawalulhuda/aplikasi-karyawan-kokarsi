<script setup lang="ts">
import type { OrgNode } from '~/types/org-structure'

const props = defineProps<{
  nodes: OrgNode[]
  canManage?: boolean
  flatNodes?: OrgNode[]
}>()

const emit = defineEmits<{
  move: [payload: { id: number; parentId: number | null; sortOrder: number }]
  select: [node: OrgNode]
  addChild: [node: OrgNode]
  edit: [node: OrgNode]
  remove: [node: OrgNode]
}>()

const MIN_SCALE = 0.25
const MAX_SCALE = 2
const ZOOM_STEP = 1.2

const viewport = ref<HTMLElement | null>(null)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const panning = ref(false)

let startX = 0
let startY = 0
let startTx = 0
let startTy = 0
let activePointer: number | null = null

const zoomPercent = computed(() => Math.round(scale.value * 100))

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Zoom terpusat pada titik kursor (clientX/clientY) agar titik di bawah kursor tetap di tempat. */
function zoomTo(nextScale: number, clientX?: number, clientY?: number) {
  const el = viewport.value
  const next = clamp(nextScale, MIN_SCALE, MAX_SCALE)
  if (next === scale.value) return
  if (el && clientX != null && clientY != null) {
    const rect = el.getBoundingClientRect()
    const px = clientX - rect.left
    const py = clientY - rect.top
    const k = next / scale.value
    tx.value = px - (px - tx.value) * k
    ty.value = py - (py - ty.value) * k
  }
  scale.value = next
}

function zoomIn() {
  zoomTo(scale.value * ZOOM_STEP)
}

function zoomOut() {
  zoomTo(scale.value / ZOOM_STEP)
}

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function onWheel(e: WheelEvent) {
  // Ctrl/Cmd + scroll = zoom (juga pinch-zoom trackpad). Scroll biasa = gulir halaman.
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  zoomTo(scale.value * factor, e.clientX, e.clientY)
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const target = e.target as HTMLElement
  // Tombol tengah selalu pan; tombol kiri hanya bila mulai dari latar (bukan kartu/aksi).
  const isMiddle = e.button === 1
  const isBackgroundLeft = e.button === 0 && !target.closest('.org-node')
  if (!isMiddle && !isBackgroundLeft) return

  e.preventDefault()
  panning.value = true
  activePointer = e.pointerId
  startX = e.clientX
  startY = e.clientY
  startTx = tx.value
  startTy = ty.value
  viewport.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!panning.value || e.pointerId !== activePointer) return
  tx.value = startTx + (e.clientX - startX)
  ty.value = startTy + (e.clientY - startY)
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== activePointer) return
  panning.value = false
  activePointer = null
  viewport.value?.releasePointerCapture?.(e.pointerId)
}
</script>

<template>
  <div
    ref="viewport"
    class="org-canvas relative h-[70vh] min-h-120 w-full overflow-hidden rounded-xl border border-default bg-elevated/20"
    :class="panning ? 'cursor-grabbing' : 'cursor-grab'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @mousedown.middle.prevent
  >
    <!-- Latar grid (tidak ikut transform agar tetap terlihat sebagai kanvas) -->
    <div class="org-canvas__grid pointer-events-none absolute inset-0" aria-hidden="true" />

    <!-- Panggung yang di-pan & di-zoom -->
    <div
      class="org-canvas__stage absolute top-0 left-0 p-8"
      :style="{
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        transformOrigin: '0 0',
      }"
    >
      <StrukturOrganisasiOrgChart
        :nodes="nodes"
        :can-manage="canManage"
        :flat-nodes="flatNodes"
        @move="emit('move', $event)"
        @select="emit('select', $event)"
        @add-child="emit('addChild', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </div>

    <!-- Kontrol zoom -->
    <div
      class="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border border-default bg-default/95 p-1 shadow-sm backdrop-blur"
      @pointerdown.stop
      @wheel.stop
    >
      <UButton
        icon="i-lucide-minus"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Zoom out"
        :disabled="scale <= MIN_SCALE"
        @click="zoomOut"
      />
      <button
        type="button"
        class="min-w-11 rounded px-1 text-center text-xs font-medium tabular-nums text-muted transition hover:text-highlighted"
        title="Reset ke 100%"
        @click="reset"
      >
        {{ zoomPercent }}%
      </button>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Zoom in"
        :disabled="scale >= MAX_SCALE"
        @click="zoomIn"
      />
      <USeparator orientation="vertical" class="h-5" />
      <UButton
        icon="i-lucide-maximize"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Reset tampilan"
        title="Reset tampilan (100%)"
        @click="reset"
      />
    </div>

    <!-- Petunjuk singkat -->
    <div class="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted sm:flex">
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-move" class="size-3" /> Geser latar atau tombol tengah
      </span>
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-zoom-in" class="size-3" /> Ctrl + scroll untuk zoom
      </span>
    </div>
  </div>
</template>

<style scoped>
.org-canvas {
  user-select: none;
  touch-action: pan-y;
}

.org-canvas__grid {
  background-image:
    linear-gradient(to right, color-mix(in oklab, var(--ui-border) 100%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklab, var(--ui-border) 100%, transparent) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.5;
}

.org-canvas__stage {
  will-change: transform;
}
</style>
