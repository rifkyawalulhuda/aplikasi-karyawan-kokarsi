<script setup lang="ts">
import type { OrgNode, OrgChartDisplay } from '~/types/org-structure'
import { orgChartKey, type OrgChartContext } from '~/composables/useOrgChartContext'

const props = defineProps<{
  nodes: OrgNode[]
  canManage?: boolean
  flatNodes?: OrgNode[]
  display?: OrgChartDisplay
  collapsed?: Set<number>
  highlightIds?: number[]
  revealIds?: number[]
}>()

const emit = defineEmits<{
  move: [payload: { id: number, parentId: number | null, sortOrder: number }]
  select: [node: OrgNode]
  addChild: [node: OrgNode]
  edit: [node: OrgNode]
  remove: [node: OrgNode]
}>()

const injected = inject(orgChartKey, null)

let ctx: OrgChartContext

if (injected) {
  ctx = injected
} else {
  const dragId = ref<number | null>(null)
  const dropTargetId = ref<number | null>(null)
  const collapsed = props.collapsed ?? reactive(new Set<number>())
  const flat = computed(() => props.flatNodes ?? props.nodes ?? [])

  function descendantIds(rootId: number): Set<number> {
    const set = new Set<number>()
    const walk = (id: number) => {
      for (const n of flat.value) {
        if (n.parentId === id && !set.has(n.id)) {
          set.add(n.id)
          walk(n.id)
        }
      }
    }
    walk(rootId)
    return set
  }

  const resetDrag = () => {
    dragId.value = null
    dropTargetId.value = null
  }

  ctx = {
    canManage: props.canManage ?? false,
    collapsed,
    dragId,
    dropTargetId,
    allNodes: flat.value,
    lastDragAt: 0,
    canDrop: (drag, target) => drag !== target && !descendantIds(drag).has(target),
    onDragStart: (node) => { dragId.value = node.id },
    onDragEnd: resetDrag,
    onDropOn: (target) => {
      const drag = dragId.value
      if (drag == null || !ctx.canDrop(drag, target.id)) {
        resetDrag()
        return
      }
      const siblings = flat.value.filter(n => n.parentId === target.id)
      const nextOrder = siblings.length ? Math.max(...siblings.map(s => s.sortOrder)) + 1 : 0
      emit('move', { id: drag, parentId: target.id, sortOrder: nextOrder })
      ctx.lastDragAt = Date.now()
      resetDrag()
    },
    toggle: (id) => { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id) },
    select: (node) => {
      // Abaikan klik yang tak sengaja terpicu tepat setelah drag (touch long-press).
      if (Date.now() - ctx.lastDragAt < 300) return
      emit('select', node)
    },
    addChild: (node) => emit('addChild', node),
    edit: (node) => emit('edit', node),
    remove: (node) => emit('remove', node),
  }
  provide(orgChartKey, ctx)

  // Jaga daftar seluruh node tetap segar untuk pencarian drop target (touch).
  watchEffect(() => { ctx.allNodes = flat.value })
}

const revealSet = computed(() => new Set(props.revealIds ?? []))
const highlightSet = computed(() => new Set(props.highlightIds ?? []))

const isDragTarget = (node: OrgNode) => ctx.dropTargetId.value === node.id && ctx.dragId.value !== node.id
const isDragging = (node: OrgNode) => ctx.dragId.value === node.id
const isCollapsed = (id: number) => ctx.collapsed.has(id) && !revealSet.value.has(id)

// ── Drag dengan mouse (HTML5 DnD) ────────────────────────────────────────────
function onDragStart(e: DragEvent, node: OrgNode) {
  if (!ctx.canManage) return
  ctx.onDragStart(node)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(node.id))
  }
}

function onDragOver(e: DragEvent, node: OrgNode) {
  if (!ctx.canManage || ctx.dragId.value == null) return
  e.preventDefault()
  if (ctx.canDrop(ctx.dragId.value, node.id)) {
    ctx.dropTargetId.value = node.id
  }
}

function onDrop(e: DragEvent, node: OrgNode) {
  if (!ctx.canManage) return
  e.preventDefault()
  ctx.onDropOn(node)
}

function onRootDrop(e: DragEvent) {
  if (!ctx.canManage) return
  const drag = ctx.dragId.value
  if (drag == null) return
  e.preventDefault()
  const roots = (props.flatNodes ?? []).filter(n => n.parentId === null)
  const nextOrder = roots.length ? Math.max(...roots.map(s => s.sortOrder)) + 1 : 0
  emit('move', { id: drag, parentId: null, sortOrder: nextOrder })
  ctx.lastDragAt = Date.now()
  ctx.onDragEnd()
}

// ── Drag dengan sentuh (long-press) ──────────────────────────────────────────
const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 10
let lpTimer: ReturnType<typeof setTimeout> | null = null
let lpStart = { x: 0, y: 0 }
let touchDragging = false

function clearLp() {
  if (lpTimer) {
    clearTimeout(lpTimer)
    lpTimer = null
  }
}

function onNodePointerDown(e: PointerEvent, node: OrgNode) {
  if (e.pointerType !== 'touch' || !ctx.canManage) return
  lpStart = { x: e.clientX, y: e.clientY }
  touchDragging = false
  clearLp()
  lpTimer = setTimeout(() => {
    touchDragging = true
    ctx.onDragStart(node)
    ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
    if (import.meta.client && navigator.vibrate) navigator.vibrate(15)
  }, LONG_PRESS_MS)
}

function onNodePointerMove(e: PointerEvent, _node: OrgNode) {
  if (e.pointerType !== 'touch') return
  if (!touchDragging) {
    if (Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > MOVE_CANCEL_PX) clearLp()
    return
  }
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  const targetEl = el?.closest('.org-node') as HTMLElement | null
  const tid = targetEl?.dataset.nodeId ? Number(targetEl.dataset.nodeId) : null
  const drag = ctx.dragId.value
  if (tid && drag != null && ctx.canDrop(drag, tid)) {
    ctx.dropTargetId.value = tid
  } else {
    ctx.dropTargetId.value = null
  }
}

function onNodePointerUp(e: PointerEvent, _node: OrgNode) {
  if (e.pointerType !== 'touch') return
  clearLp()
  if (!touchDragging) return
  touchDragging = false
  const tid = ctx.dropTargetId.value
  const target = tid != null ? ctx.allNodes.find(n => n.id === tid) : null
  if (target) {
    ctx.onDropOn(target)
  } else {
    ctx.lastDragAt = Date.now()
    ctx.onDragEnd()
  }
}
</script>

<template>
  <div class="org-chart" :class="{ 'org-chart--root': !injected }">
    <div
      v-if="!injected && ctx.canManage && nodes.length"
      class="mb-3 flex items-center justify-center rounded-lg border border-dashed border-default px-4 py-2 text-xs text-muted transition"
      :class="ctx.dragId.value != null ? 'border-primary text-primary bg-primary/5' : ''"
      @dragover.prevent
      @drop="onRootDrop"
    >
      <UIcon name="i-lucide-corner-left-up" class="mr-1.5 size-3.5" />
      Lepas di sini untuk menjadikan jabatan tertinggi
    </div>

    <ul v-if="nodes.length" class="org-tree" :class="{ 'org-tree--root': !injected }">
      <li
        v-for="node in nodes"
        :key="node.id"
        class="org-branch"
      >
        <div
          class="org-node"
          :data-node-id="node.id"
          :class="{
            'org-node--dragging': isDragging(node),
            'org-node--drop': isDragTarget(node),
            'org-node--highlighted': highlightSet.has(node.id),
          }"
          :draggable="ctx.canManage"
          @dragstart="onDragStart($event, node)"
          @dragend="ctx.onDragEnd()"
          @dragover="onDragOver($event, node)"
          @dragleave="isDragTarget(node) && (ctx.dropTargetId.value = null)"
          @drop="onDrop($event, node)"
          @pointerdown="onNodePointerDown($event, node)"
          @pointermove="onNodePointerMove($event, node)"
          @pointerup="onNodePointerUp($event, node)"
          @pointercancel="onNodePointerUp($event, node)"
        >
          <StrukturOrganisasiOrgNodeCard
            :node="node"
            :can-manage="ctx.canManage"
            :has-children="!!(node.children && node.children.length)"
            :collapsed="isCollapsed(node.id)"
            :display="display"
            :highlighted="highlightSet.has(node.id)"
            @toggle="ctx.toggle(node.id)"
            @select="ctx.select(node)"
            @add-child="ctx.addChild(node)"
            @edit="ctx.edit(node)"
            @remove="ctx.remove(node)"
          />
        </div>

        <div
          v-if="node.children && node.children.length && !isCollapsed(node.id)"
          class="org-children"
        >
          <StrukturOrganisasiOrgChart
            :nodes="node.children"
            :display="display"
            :highlight-ids="highlightIds"
            :reveal-ids="revealIds"
          />
        </div>
      </li>
    </ul>

    <div v-else class="flex flex-col items-center gap-2 py-16 text-muted">
      <UIcon name="i-lucide-network" class="size-10 opacity-40" />
      <p class="text-sm">Belum ada jabatan pada periode ini</p>
    </div>
  </div>
</template>

<style scoped>
/* ── Token garis bagan ────────────────────────────────────────────────────── */
.org-chart {
  --org-line-w: 2.5px;
  --org-line: var(--ui-text-muted);
  --org-elbow-r: 12px;
}

.org-tree {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 0;
  margin: 0;
  list-style: none;
}

.org-branch {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 12px 0;
  list-style: none;
}

/* Horizontal + elbow connectors */
.org-branch::before,
.org-branch::after {
  content: '';
  position: absolute;
  top: 0;
  right: 50%;
  width: 50%;
  height: 24px;
  border-top: var(--org-line-w) solid var(--org-line);
}

.org-branch::after {
  right: auto;
  left: 50%;
  border-left: var(--org-line-w) solid var(--org-line);
}

.org-branch:only-child::after,
.org-branch:only-child::before {
  display: none;
}

.org-branch:only-child {
  padding-top: 24px;
}

.org-branch:first-child::before,
.org-branch:last-child::after {
  border: 0 none;
}

.org-branch:last-child::before {
  border-right: var(--org-line-w) solid var(--org-line);
  border-radius: 0 var(--org-elbow-r) 0 0;
}

.org-branch:first-child::after {
  border-radius: var(--org-elbow-r) 0 0 0;
}

/* Root level: no connectors above top-level nodes */
.org-tree--root > .org-branch {
  padding-top: 0;
}

.org-tree--root > .org-branch::before,
.org-tree--root > .org-branch::after {
  display: none;
}

/* Vertical line from parent card down to children row. */
.org-children {
  position: relative;
}

.org-children::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: var(--org-line-w);
  height: 24px;
  background: var(--org-line);
  border-radius: 0 0 var(--org-elbow-r) var(--org-elbow-r);
  transform: translateX(calc(var(--org-line-w) / -2));
}

.org-node {
  position: relative;
  border-radius: 0.75rem;
}

.org-node--dragging {
  opacity: 0.4;
}

.org-node--drop {
  outline: 2px dashed var(--ui-primary);
  outline-offset: 4px;
  border-radius: 0.75rem;
}

.org-node--highlighted {
  border-radius: 0.75rem;
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
  animation: org-pulse 1.4s ease-in-out infinite;
}

@keyframes org-pulse {
  0%, 100% { outline-color: color-mix(in oklab, var(--ui-primary) 100%, transparent); }
  50% { outline-color: color-mix(in oklab, var(--ui-primary) 40%, transparent); }
}

@media (prefers-reduced-motion: reduce) {
  .org-node--highlighted { animation: none; }
}
</style>
