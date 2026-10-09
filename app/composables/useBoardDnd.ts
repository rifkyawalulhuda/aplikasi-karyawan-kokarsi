import type { InjectionKey, Ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'

export interface BoardDndContext {
  draggingCardId: Ref<number | null>
  draggingColumnId: Ref<number | null>
  grabbedCardId: Ref<number | null>
  grabbedColumnId: Ref<number | null>
  isDragging: Ref<boolean>
  onCardPointerDown: (e: PointerEvent, cardId: number, columnId: number) => void
  onColumnPointerDown: (e: PointerEvent, columnId: number) => void
  onCardKeyDown: (e: KeyboardEvent, cardId: number) => void
  onColumnKeyDown: (e: KeyboardEvent, columnId: number) => void
}

export const BOARD_DND_KEY: InjectionKey<BoardDndContext> = Symbol('board-dnd')

/** Akses konteks drag board dari komponen kartu/kolom. Null bila tidak tersedia. */
export function useBoardDndContext(): BoardDndContext | null {
  return inject(BOARD_DND_KEY, null)
}

// ── Konstanta interaksi ──────────────────────────────────────────────────────
/** Gerakan minimal (px) sebelum pointerdown dianggap drag, bukan klik. */
const DRAG_THRESHOLD = 6
/** Jarak (px) dari tepi sebelum auto-scroll aktif. */
const AUTOSCROLL_EDGE = 64
/** Kecepatan auto-scroll (px per frame). */
const AUTOSCROLL_SPEED = 12

export interface BoardColumnLayout {
  id: number
  cardIds: number[]
}

export interface CardMoveIntent {
  cardId: number
  fromColumnId: number
  toColumnId: number
  position: number
}

export interface UseBoardDndOptions {
  boardRef: Ref<HTMLElement | null>
  /** Layout logika saat ini (sumber kebenaran indeks). */
  getLayout: () => BoardColumnLayout[]
  /** Pindahkan kartu di data lokal (dengan FLIP) — dipanggil live selama drag. */
  moveCard: (intent: CardMoveIntent) => void
  /** Kartu dijatuhkan — panggil API di sini. */
  commitCard: (cardId: number) => void
  /** Urutkan kolom di data lokal (dengan FLIP). */
  moveColumn: (columnId: number, toIndex: number) => void
  /** Kolom dijatuhkan — panggil API di sini. */
  commitColumn: (columnId: number) => void
  /** Kartu diklik (gerakan di bawah ambang). */
  onCardClick: (cardId: number) => void
  /** Umumkan ke aria-live. */
  announce: (message: string) => void
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el?.closest('button, a, input, textarea, select, [contenteditable], [data-no-drag]')
}

function cloneWithSize(el: HTMLElement): HTMLElement {
  const rect = el.getBoundingClientRect()
  const ghost = el.cloneNode(true) as HTMLElement
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '9999',
    pointerEvents: 'none'
  } satisfies Partial<CSSStyleDeclaration>)
  ghost.classList.add('board-drag-ghost')
  return ghost
}

/**
 * Mesin drag & drop board Kanban: kartu (antar kolom + posisi presisi) dan
 * kolom (reorder). Pointer Events murni — mouse, sentuh, dan pena.
 *
 * Kartu yang diangkat tetap di DOM (redup) sebagai penunjuk posisi, ghost
 * penuh mengikuti kursor, dan kartu lain bergerak halus lewat FLIP.
 */
export function useBoardDnd(opts: UseBoardDndOptions) {
  const reducedMotion = usePreferredReducedMotion()

  const draggingCardId = ref<number | null>(null)
  const draggingColumnId = ref<number | null>(null)
  const grabbedCardId = ref<number | null>(null)
  const grabbedColumnId = ref<number | null>(null)

  const isDragging = computed(() => draggingCardId.value !== null || draggingColumnId.value !== null)

  let ghost: HTMLElement | null = null
  let ghostOffsetX = 0
  let ghostOffsetY = 0
  let originRect: DOMRect | null = null
  let pointerId: number | null = null
  let kind: 'card' | 'column' | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let activated = false
  let rafScroll = 0
  let rafReorder = 0
  let busy = false

  let pendingCard: { cardId: number, columnId: number, el: HTMLElement } | null = null
  let pendingColumn: { columnId: number, el: HTMLElement } | null = null

  // ── Helper DOM ─────────────────────────────────────────────────────────────
  function columnEls(): HTMLElement[] {
    if (!opts.boardRef.value) return []
    return [...opts.boardRef.value.querySelectorAll<HTMLElement>('[data-col-id]')]
  }

  function columnEl(id: number): HTMLElement | null {
    return opts.boardRef.value?.querySelector<HTMLElement>(`[data-col-id="${id}"]`) ?? null
  }

  function cardEl(id: number): HTMLElement | null {
    return opts.boardRef.value?.querySelector<HTMLElement>(`[data-card-id="${id}"]`) ?? null
  }

  // ── Aktivasi ───────────────────────────────────────────────────────────────
  function activate(target: HTMLElement, id: number, dragKind: 'card' | 'column', e: PointerEvent) {
    kind = dragKind
    activated = true
    originRect = target.getBoundingClientRect()

    // Offset grab point di dalam elemen supaya ghost tidak "melompat".
    ghostOffsetX = e.clientX - originRect.left
    ghostOffsetY = e.clientY - originRect.top

    ghost = cloneWithSize(target)
    ghost.style.transform = 'translate3d(0px, 0px, 0) rotate(1.5deg)'
    document.body.appendChild(ghost)

    target.style.opacity = '0.4'

    document.addEventListener('pointermove', onPointerMove, { passive: false })
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('resize', cancelDrag)
    window.addEventListener('blur', cancelDrag)
    document.body.classList.add('board-dragging')

    if (dragKind === 'card') draggingCardId.value = id
    else draggingColumnId.value = id

    startAutoScroll()
  }

  function onCardPointerDown(e: PointerEvent, cardId: number, columnId: number) {
    if (isDragging.value || grabbedCardId.value !== null) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (isInteractiveTarget(e.target)) return

    const el = cardEl(cardId)
    if (!el) return

    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    lastX = e.clientX
    lastY = e.clientY

    // Mouse: tunggu ambang gerakan (agar klik tetap membuka detail).
    // Sentuh/pena: hanya lewat handle grip (touch-action: none) → langsung drag.
    if (e.pointerType === 'mouse') {
      pendingCard = { cardId, columnId, el }
      document.addEventListener('pointermove', onPendingMove, { passive: false })
      document.addEventListener('pointerup', onPendingUp)
      document.addEventListener('pointercancel', onPendingUp)
    } else {
      activate(el, cardId, 'card', e)
      e.preventDefault()
    }
  }

  function onColumnPointerDown(e: PointerEvent, columnId: number) {
    if (isDragging.value || grabbedColumnId.value !== null) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (isInteractiveTarget(e.target)) return

    const el = columnEl(columnId)
    if (!el) return

    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    lastX = e.clientX
    lastY = e.clientY

    if (e.pointerType === 'mouse') {
      pendingColumn = { columnId, el }
      document.addEventListener('pointermove', onPendingMove, { passive: false })
      document.addEventListener('pointerup', onPendingUp)
      document.addEventListener('pointercancel', onPendingUp)
    } else {
      activate(el, columnId, 'column', e)
      e.preventDefault()
    }
  }

  function onPendingMove(e: PointerEvent) {
    const dx = Math.abs(e.clientX - startX)
    const dy = Math.abs(e.clientY - startY)
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return
    detachPending()

    if (pendingCard) {
      activate(pendingCard.el, pendingCard.cardId, 'card', e)
      pendingCard = null
    } else if (pendingColumn) {
      activate(pendingColumn.el, pendingColumn.columnId, 'column', e)
      pendingColumn = null
    }
  }

  function onPendingUp(e: MouseEvent) {
    detachPending()
    // Gerakan di bawah ambang = klik kartu → buka detail.
    if (pendingCard) {
      const dx = Math.abs((e as unknown as PointerEvent).clientX - startX)
      const dy = Math.abs((e as unknown as PointerEvent).clientY - startY)
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) opts.onCardClick(pendingCard.cardId)
    }
    pendingCard = null
    pendingColumn = null
  }

  function detachPending() {
    document.removeEventListener('pointermove', onPendingMove)
    document.removeEventListener('pointerup', onPendingUp)
    document.removeEventListener('pointercancel', onPendingUp)
  }

  // ── Hit-test ───────────────────────────────────────────────────────────────
  /** Kolom yang ditunjuk pointer (berdasarkan rentang horizontal). */
  function columnAtPoint(px: number): number | null {
    const cols = columnEls()
    let closest: { id: number, dist: number } | null = null
    for (const el of cols) {
      const r = el.getBoundingClientRect()
      if (px >= r.left && px <= r.right) return Number(el.dataset.colId)
      const dist = px < r.left ? r.left - px : px - r.right
      if (!closest || dist < closest.dist) closest = { id: Number(el.dataset.colId), dist }
    }
    return closest?.id ?? null
  }

  /**
   * Indeks sisip di dalam kolom, dihitung pada daftar TANPA kartu yang sedang
   * di-drag — sehingga `moveCard` bisa menyisipkan langsung tanpa penyesuaian.
   * Kartu tersembunyi (terfilter) tetap dihitung: indeks adalah posisi LOGIS.
   */
  function insertionIndex(columnId: number, py: number, draggedCardId: number): number {
    const layout = opts.getLayout()
    const col = layout.find(c => c.id === columnId)
    if (!col) return 0
    let index = 0
    for (const cardId of col.cardIds) {
      if (cardId === draggedCardId) continue
      const el = cardEl(cardId)
      const r = el?.getBoundingClientRect()
      if (!r) {
        index++
        continue
      }
      if (py < r.top + r.height / 2) return index
      index++
    }
    return index
  }

  /** Indeks kolom target untuk reorder. */
  function columnInsertIndex(draggedColumnId: number, px: number): number {
    const cols = columnEls()
    let index = 0
    for (const el of cols) {
      const id = Number(el.dataset.colId)
      if (id === draggedColumnId) continue
      const r = el.getBoundingClientRect()
      const mid = r.left + r.width / 2
      if (px < mid) return index
      index++
    }
    return index
  }

  // ── Gerakan pointer ────────────────────────────────────────────────────────
  function onPointerMove(e: PointerEvent) {
    if (!activated || !ghost) return
    if (pointerId !== null && e.pointerId !== pointerId) return

    lastX = e.clientX
    lastY = e.clientY
    ghost.style.transform = `translate3d(${e.clientX - startX - ghostOffsetX}px, ${e.clientY - startY - ghostOffsetY}px, 0) rotate(1.5deg)`
    scheduleReorder()
    e.preventDefault()
  }

  function scheduleReorder() {
    if (rafReorder || busy) return
    rafReorder = requestAnimationFrame(async () => {
      rafReorder = 0
      if (!activated || busy) return

      if (kind === 'card' && draggingCardId.value !== null) {
        const cardId = draggingCardId.value
        const toColumnId = columnAtPoint(lastX)
        if (toColumnId === null) return
        const layout = opts.getLayout()
        const fromCol = layout.find(c => c.cardIds.includes(cardId))
        if (!fromCol) return
        const position = insertionIndex(toColumnId, lastY, cardId)
        const currentIndex = fromCol.cardIds.indexOf(cardId)
        // No-op: posisi sama persis di kolom yang sama.
        if (fromCol.id === toColumnId && currentIndex === position) return

        busy = true
        opts.moveCard({ cardId, fromColumnId: fromCol.id, toColumnId, position })
        await nextTick()
        busy = false
      } else if (kind === 'column' && draggingColumnId.value !== null) {
        const toIndex = columnInsertIndex(draggingColumnId.value, lastX)
        const currentIndex = opts.getLayout().findIndex(c => c.id === draggingColumnId.value)
        if (toIndex === currentIndex) return

        busy = true
        opts.moveColumn(draggingColumnId.value, toIndex)
        await nextTick()
        busy = false
      }
    })
  }

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  function startAutoScroll() {
    if (!rafScroll) rafScroll = requestAnimationFrame(autoScrollStep)
  }

  function stopAutoScroll() {
    if (rafScroll) cancelAnimationFrame(rafScroll)
    rafScroll = 0
  }

  function autoScrollStep() {
    if (!activated) return

    // Horizontal: container board.
    const board = opts.boardRef.value
    if (board) {
      const r = board.getBoundingClientRect()
      if (lastX < r.left + AUTOSCROLL_EDGE) board.scrollLeft -= AUTOSCROLL_SPEED
      else if (lastX > r.right - AUTOSCROLL_EDGE) board.scrollLeft += AUTOSCROLL_SPEED
    }

    // Vertikal: daftar kartu kolom yang ditunjuk.
    if (kind === 'card') {
      const colId = columnAtPoint(lastX)
      const list = colId !== null
        ? columnEl(colId)?.querySelector<HTMLElement>('[data-col-list]')
        : null
      if (list) {
        const r = list.getBoundingClientRect()
        if (lastY < r.top + AUTOSCROLL_EDGE) list.scrollTop -= AUTOSCROLL_SPEED
        else if (lastY > r.bottom - AUTOSCROLL_EDGE) list.scrollTop += AUTOSCROLL_SPEED
      }
    }

    rafScroll = requestAnimationFrame(autoScrollStep)
  }

  // ── Selesai drag ───────────────────────────────────────────────────────────
  async function finishDrag(commit: boolean) {
    stopAutoScroll()
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('resize', cancelDrag)
    window.removeEventListener('blur', cancelDrag)

    const target = kind === 'card' && draggingCardId.value !== null
      ? cardEl(draggingCardId.value)
      : (kind === 'column' && draggingColumnId.value !== null ? columnEl(draggingColumnId.value) : null)

    if (ghost && target && originRect) {
      const r = target.getBoundingClientRect()
      if (reducedMotion.value !== 'reduce') {
        ghost.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1), opacity 180ms ease-out'
        ghost.style.transform = `translate3d(${r.left - originRect.left}px, ${r.top - originRect.top}px, 0) rotate(0deg)`
        ghost.style.opacity = '0.6'
        await new Promise<void>(resolve => setTimeout(resolve, 180))
      }
      ghost.remove()
    } else {
      ghost?.remove()
    }

    if (target) target.style.opacity = ''

    const wasCard = kind === 'card'
    const id = wasCard ? draggingCardId.value : draggingColumnId.value

    ghost = null
    originRect = null
    kind = null
    activated = false
    pointerId = null
    draggingCardId.value = null
    draggingColumnId.value = null
    document.body.classList.remove('board-dragging')

    if (commit && id !== null) {
      if (wasCard) opts.commitCard(id)
      else opts.commitColumn(id)
    }
  }

  function onPointerUp() {
    if (!activated) {
      detachPending()
      return
    }
    void finishDrag(true)
  }

  function onPointerCancel() {
    if (activated) void finishDrag(false)
    else detachPending()
  }

  function cancelDrag() {
    if (activated) void finishDrag(false)
  }

  // ── Mode keyboard (WCAG 2.5.7 — alternatif drag) ───────────────────────────
  function onCardKeyDown(e: KeyboardEvent, cardId: number) {
    if (e.key === ' ' || e.key === 'Enter') {
      if (grabbedCardId.value === null) {
        grabbedCardId.value = cardId
        opts.announce('Kartu diangkat. Panah atas/bawah memindah dalam kolom, kiri/kanan pindah kolom. Spasi untuk melepas, Escape untuk batal.')
      } else if (grabbedCardId.value === cardId) {
        grabbedCardId.value = null
        opts.commitCard(cardId)
        opts.announce('Kartu dilepas di posisi baru.')
      }
      e.preventDefault()
      return
    }
    if (grabbedCardId.value !== cardId) return

    const layout = opts.getLayout()
    const fromCol = layout.find(c => c.cardIds.includes(cardId))
    if (!fromCol) return
    const fromIndex = fromCol.cardIds.indexOf(cardId)

    let moved = false
    if (e.key === 'ArrowUp' && fromIndex > 0) {
      opts.moveCard({ cardId, fromColumnId: fromCol.id, toColumnId: fromCol.id, position: fromIndex - 1 })
      opts.announce(`Posisi ${fromIndex} dari ${fromCol.cardIds.length}.`)
      moved = true
    } else if (e.key === 'ArrowDown' && fromIndex < fromCol.cardIds.length - 1) {
      opts.moveCard({ cardId, fromColumnId: fromCol.id, toColumnId: fromCol.id, position: fromIndex + 1 })
      opts.announce(`Posisi ${fromIndex + 2} dari ${fromCol.cardIds.length}.`)
      moved = true
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const colIndex = layout.findIndex(c => c.id === fromCol.id)
      const targetCol = layout[colIndex + (e.key === 'ArrowLeft' ? -1 : 1)]
      if (targetCol) {
        opts.moveCard({ cardId, fromColumnId: fromCol.id, toColumnId: targetCol.id, position: 0 })
        opts.announce('Pindah ke kolom bersebelahan, posisi 1.')
        moved = true
      }
    } else if (e.key === 'Escape') {
      grabbedCardId.value = null
      opts.announce('Pemindahan dibatalkan.')
      e.preventDefault()
      return
    }

    if (moved) e.preventDefault()
  }

  function onColumnKeyDown(e: KeyboardEvent, columnId: number) {
    if (e.key === ' ' || e.key === 'Enter') {
      if (grabbedColumnId.value === null) {
        grabbedColumnId.value = columnId
        opts.announce('Kolom diangkat. Panah kiri/kanan memindah kolom. Spasi untuk melepas, Escape untuk batal.')
      } else if (grabbedColumnId.value === columnId) {
        grabbedColumnId.value = null
        opts.commitColumn(columnId)
        opts.announce('Kolom dilepas di posisi baru.')
      }
      e.preventDefault()
      return
    }
    if (grabbedColumnId.value !== columnId) return

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const layout = opts.getLayout()
      const index = layout.findIndex(c => c.id === columnId)
      const toIndex = index + (e.key === 'ArrowLeft' ? -1 : 1)
      if (toIndex >= 0 && toIndex < layout.length) {
        opts.moveColumn(columnId, toIndex)
        opts.announce(`Posisi kolom ${toIndex + 1} dari ${layout.length}.`)
      }
      e.preventDefault()
    } else if (e.key === 'Escape') {
      grabbedColumnId.value = null
      opts.announce('Pemindahan kolom dibatalkan.')
      e.preventDefault()
    }
  }

  onScopeDispose(() => {
    detachPending()
    stopAutoScroll()
    if (rafReorder) cancelAnimationFrame(rafReorder)
    ghost?.remove()
    document.body.classList.remove('board-dragging')
  })

  return {
    draggingCardId,
    draggingColumnId,
    grabbedCardId,
    grabbedColumnId,
    isDragging,
    onCardPointerDown,
    onColumnPointerDown,
    onCardKeyDown,
    onColumnKeyDown
  }
}
