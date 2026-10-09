<script setup lang="ts">
import type { OrgNode, OrgChartDisplay } from '~/types/org-structure'

const props = defineProps<{
  nodes: OrgNode[]
  canManage?: boolean
  flatNodes?: OrgNode[]
  display?: OrgChartDisplay
  backgroundStyle?: Record<string, string>
  contrast?: 'light' | 'dark'
  periodId?: number
  highlightIds?: number[]
  revealIds?: number[]
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
const FIT_PADDING = 24

const viewport = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const panning = ref(false)

// Node yang diciutkan — dimiliki canvas agar bisa dipersist per periode.
const collapsed = reactive(new Set<number>())

const periodKey = computed(() => String(props.periodId ?? 'default'))
const { load: loadView, save: saveView } = useOrgChartView()

// ── Pointer state (multi-touch untuk pinch) ──────────────────────────────────
const pointers = new Map<number, { x: number, y: number }>()
let mode: 'none' | 'pan' | 'pinch' = 'none'
let panStart = { x: 0, y: 0, tx: 0, ty: 0 }
let pinchStart = { dist: 0, scale: 1, tx: 0, ty: 0 }

const zoomPercent = computed(() => Math.round(scale.value * 100))

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function viewportSize() {
  return { w: viewport.value?.clientWidth ?? 0, h: viewport.value?.clientHeight ?? 0 }
}

function contentSize() {
  return { w: stage.value?.scrollWidth ?? 0, h: stage.value?.scrollHeight ?? 0 }
}

/** Zoom terpusat pada titik kursor (clientX/clientY). */
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
  const { w, h } = viewportSize()
  const el = viewport.value
  const rect = el?.getBoundingClientRect()
  zoomTo(scale.value * ZOOM_STEP, (rect?.left ?? 0) + w / 2, (rect?.top ?? 0) + h / 2)
}

function zoomOut() {
  const { w, h } = viewportSize()
  const el = viewport.value
  const rect = el?.getBoundingClientRect()
  zoomTo(scale.value / ZOOM_STEP, (rect?.left ?? 0) + w / 2, (rect?.top ?? 0) + h / 2)
}

/** Pusatkan konten pada skala tertentu. */
function centerAt(nextScale: number) {
  const { w: vw, h: vh } = viewportSize()
  const { w: cw, h: ch } = contentSize()
  if (!vw || !vh || !cw || !ch) return
  scale.value = clamp(nextScale, MIN_SCALE, MAX_SCALE)
  tx.value = (vw - cw * scale.value) / 2
  ty.value = (vh - ch * scale.value) / 2
}

/** Fit seluruh bagan ke dalam viewport (dengan sedikit padding). */
function fit() {
  const { w: vw, h: vh } = viewportSize()
  const { w: cw, h: ch } = contentSize()
  if (!vw || !vh || !cw || !ch) return
  const s = Math.min((vw - FIT_PADDING * 2) / cw, (vh - FIT_PADDING * 2) / ch)
  centerAt(clamp(s, MIN_SCALE, MAX_SCALE))
}

function zoomTo100() {
  centerAt(1)
}

/** Geser agar node tertentu berada di tengah viewport (untuk pencarian). */
function panTo(nodeId: number) {
  const el = viewport.value
  const target = el?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
  if (!el || !target) return
  const er = el.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  const cx = tr.left - er.left + tr.width / 2
  const cy = tr.top - er.top + tr.height / 2
  tx.value += el.clientWidth / 2 - cx
  ty.value += el.clientHeight / 2 - cy
}

// ── Pointer handling ─────────────────────────────────────────────────────────
function startPan(x: number, y: number) {
  mode = 'pan'
  panStart = { x, y, tx: tx.value, ty: ty.value }
}

function startPinch() {
  const pts = [...pointers.values()]
  if (pts.length < 2) return
  const [a, b] = pts as [{ x: number, y: number }, { x: number, y: number }]
  mode = 'pinch'
  pinchStart = {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    scale: scale.value,
    tx: tx.value,
    ty: ty.value,
  }
}

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('[data-canvas-control]')) return

  const onNode = !!target.closest('.org-node')

  if (e.pointerType === 'mouse') {
    const isMiddle = e.button === 1
    const isBackgroundLeft = e.button === 0 && !onNode
    if (!isMiddle && !isBackgroundLeft) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startPan(e.clientX, e.clientY)
    panning.value = true
    viewport.value?.setPointerCapture(e.pointerId)
    return
  }

  // Touch / pen: mulai geser hanya dari latar kosong (di kartu = tap / long-press).
  if (onNode) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    startPan(e.clientX, e.clientY)
    panning.value = true
  } else if (pointers.size === 2) {
    startPinch()
  }
  viewport.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (mode === 'pinch' && pointers.size >= 2) {
    const pts = [...pointers.values()]
    const [a, b] = pts as [{ x: number, y: number }, { x: number, y: number }]
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const el = viewport.value
    const rect = el?.getBoundingClientRect()
    const mx = (a.x + b.x) / 2 - (rect?.left ?? 0)
    const my = (a.y + b.y) / 2 - (rect?.top ?? 0)
    const next = clamp(pinchStart.scale * (dist / pinchStart.dist), MIN_SCALE, MAX_SCALE)
    const k = next / pinchStart.scale
    tx.value = mx - (mx - pinchStart.tx) * k
    ty.value = my - (my - pinchStart.ty) * k
    scale.value = next
    return
  }

  if (mode === 'pan') {
    const p = pointers.get(e.pointerId)
    if (!p) return
    tx.value = panStart.tx + (p.x - panStart.x)
    ty.value = panStart.ty + (p.y - panStart.y)
  }
}

function onPointerUp(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.delete(e.pointerId)
  viewport.value?.releasePointerCapture?.(e.pointerId)

  if (pointers.size === 0) {
    mode = 'none'
    panning.value = false
  } else if (pointers.size === 1) {
    const p = [...pointers.values()][0]!
    startPan(p.x, p.y)
  }
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  zoomTo(scale.value * factor, e.clientX, e.clientY)
}

// ── Persistensi state tampilan per periode ───────────────────────────────────
function applyStoredView(): boolean {
  const st = loadView(periodKey.value)
  if (!st) return false
  scale.value = clamp(st.scale, MIN_SCALE, MAX_SCALE)
  tx.value = st.tx
  ty.value = st.ty
  collapsed.clear()
  for (const id of st.collapsed ?? []) collapsed.add(id)
  return true
}

function persistView() {
  saveView(periodKey.value, {
    scale: scale.value,
    tx: tx.value,
    ty: ty.value,
    collapsed: [...collapsed],
  })
}

watch([scale, tx, ty, () => [...collapsed].sort((a, b) => a - b).join(',')], persistView)

watch(periodKey, () => {
  if (!applyStoredView()) {
    nextTick(() => requestAnimationFrame(fit))
  }
})

onMounted(async () => {
  if (!applyStoredView()) {
    await nextTick()
    requestAnimationFrame(fit)
  }
})

// Fit ulang saat ukuran viewport berubah (mis. sidebar collapse) bila belum ada state tersimpan.
const ro = import.meta.client ? new ResizeObserver(() => {
  if (!loadView(periodKey.value)) fit()
}) : null
onMounted(() => viewport.value && ro?.observe(viewport.value))
onBeforeUnmount(() => ro?.disconnect())

defineExpose({ fit, panTo, zoomTo100 })

// ── Legenda status ───────────────────────────────────────────────────────────
const legend = [
  { label: 'Aktif', color: 'bg-success' },
  { label: 'Akan Berakhir', color: 'bg-warning' },
  { label: 'Expired', color: 'bg-error' },
  { label: 'Tidak Aktif', color: 'bg-muted' },
]
</script>

<template>
  <div
    ref="viewport"
    class="org-canvas relative h-[70vh] min-h-120 w-full overflow-hidden rounded-xl border border-default bg-elevated/20"
    :class="panning ? 'cursor-grabbing' : 'cursor-grab'"
    :data-contrast="contrast ?? 'light'"
    :style="backgroundStyle"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @mousedown.middle.prevent
  >
    <!-- Panggung yang di-pan & di-zoom -->
    <div
      ref="stage"
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
        :display="display"
        :collapsed="collapsed"
        :highlight-ids="highlightIds"
        :reveal-ids="revealIds"
        @move="emit('move', $event)"
        @select="emit('select', $event)"
        @add-child="emit('addChild', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </div>

    <!-- Legenda status -->
    <div
      data-canvas-control
      class="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-default bg-default/95 px-2.5 py-1.5 text-[11px] text-muted shadow-sm backdrop-blur"
    >
      <span v-for="item in legend" :key="item.label" class="inline-flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="item.color" />
        {{ item.label }}
      </span>
    </div>

    <!-- Kontrol zoom -->
    <div
      data-canvas-control
      class="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border border-default bg-default/95 p-1 shadow-sm backdrop-blur"
      @pointerdown.stop
      @wheel.stop
    >
      <UButton
        icon="i-lucide-minus"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Zoom out"
        :disabled="scale <= MIN_SCALE"
        @click="zoomOut"
      />
      <button
        type="button"
        class="min-w-11 rounded px-1 text-center text-xs font-medium tabular-nums text-muted transition hover:text-highlighted"
        title="Kembalikan ke 100%"
        @click="zoomTo100"
      >
        {{ zoomPercent }}%
      </button>
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Zoom in"
        :disabled="scale >= MAX_SCALE"
        @click="zoomIn"
      />
      <USeparator orientation="vertical" class="h-5" />
      <UButton
        icon="i-lucide-scan"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Sesuaikan ke layar"
        title="Sesuaikan ke layar"
        @click="fit"
      />
    </div>

    <!-- Petunjuk singkat -->
    <div class="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted sm:flex">
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-move" class="size-3" /> Geser latar
      </span>
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-zoom-in" class="size-3" /> Ctrl + scroll / cubit
      </span>
    </div>
  </div>
</template>

<style scoped>
.org-canvas {
  user-select: none;
  touch-action: none;
}

/* Auto-kontras: saat latar gelap, override token agar kartu & kontrol ikut gelap. */
.org-canvas[data-contrast='dark'] {
  --ui-bg: #1e293b;
  --ui-bg-muted: #1e293b;
  --ui-bg-elevated: #334155;
  --ui-bg-accented: #475569;
  --ui-border: #334155;
  --ui-border-muted: #334155;
  --ui-border-accented: #475569;
  --ui-text-highlighted: #f8fafc;
  --ui-text: #e2e8f0;
  --ui-text-muted: #94a3b8;
  --ui-text-dimmed: #64748b;
}

.org-canvas__stage {
  will-change: transform;
}
</style>
