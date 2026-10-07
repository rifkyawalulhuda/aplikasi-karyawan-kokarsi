import type { InjectionKey, Ref } from 'vue'

/** Jarak (px) pointer harus bergerak sebelum long-press dibatalkan. */
const LONG_PRESS_MS = 200
const LONG_PRESS_MOVE_TOLERANCE = 8
/** Ambang (px) dari tepi scroll-parent untuk memulai auto-scroll. */
const AUTOSCROLL_EDGE = 80
const AUTOSCROLL_SPEED = 14

export interface DashboardDragContext {
  /** Id widget yang sedang di-drag dengan pointer (null bila tidak ada). */
  activeId: Ref<string | null>
  /** Id widget yang sedang diangkat lewat keyboard (mode grab). */
  grabbedId: Ref<string | null>
  /** True saat pointer drag berlangsung. */
  isDragging: Ref<boolean>
  /** Dipanggil dari handle grip saat pointerdown. */
  onHandlePointerDown: (e: PointerEvent, widgetId: string) => void
  /** Dipanggil dari handle grip saat keydown (mode grab keyboard). */
  onHandleKeyDown: (e: KeyboardEvent, widgetId: string) => void
}

export const DASHBOARD_DRAG_KEY: InjectionKey<DashboardDragContext> = Symbol('dashboard-drag')

/** Ambil konteks drag dari ancestor (DashboardGrid). Null bila tidak ada. */
export function useDashboardDragContext(): DashboardDragContext | null {
  return inject(DASHBOARD_DRAG_KEY, null)
}

export interface UseDashboardDragOptions {
  /** Elemen grid tempat widget berada. */
  container: Ref<HTMLElement | null>
  /** Urutan transien (dimutasi selama drag). */
  order: Ref<string[]>
  /** Drag hanya aktif saat edit mode. */
  isEnabled: Ref<boolean>
  /** Terapkan urutan baru + animasi FLIP (mengubah `order.value`). */
  reorder: (ids: string[]) => void
  /** Dipanggil sekali saat drop (persist + announce). */
  onDrop: (id: string) => void
  /** Announce ke aria-live. */
  announce: (message: string) => void
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Mesin drag & drop untuk reorder widget dashboard.
 *
 * Berbasis Pointer Events (mouse + touch + pen) dengan FLIP untuk pergerakan
 * widget lain, ghost element mengikuti jari/kursor, long-press di perangkat
 * sentuh, auto-scroll di tepi, dan mode "grab" keyboard untuk aksesibilitas.
 */
export function useDashboardDrag(opts: UseDashboardDragOptions): DashboardDragContext {
  const { container, order, isEnabled, reorder, onDrop, announce } = opts

  const activeId = ref<string | null>(null)
  const grabbedId = ref<string | null>(null)
  const isDragging = ref(false)

  let pointerId: number | null = null
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let ghost: HTMLElement | null = null
  let originRect: DOMRect | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let scrollParent: HTMLElement | null = null
  let rafReorder = 0
  let rafAutoScroll = 0
  let reorderBusy = false
  /** True bila pointer benar-benar bergerak (bukan sekadar klik handle). */
  let moved = false

  function widgetEls(): HTMLElement[] {
    if (!container.value) return []
    return [...container.value.querySelectorAll<HTMLElement>('[data-widget-id]')]
  }

  function widgetEl(id: string): HTMLElement | null {
    if (!container.value) return null
    return container.value.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`)
  }

  function findScrollParent(el: HTMLElement): HTMLElement | null {
    let p = el.parentElement
    while (p) {
      const style = getComputedStyle(p)
      if (/(auto|scroll|overlay)/.test(style.overflowY) && p.scrollHeight > p.clientHeight + 1) return p
      p = p.parentElement
    }
    return null
  }

  /** Tentukan id widget yang menjadi titik sisip (insert sebelum id ini; null = paling akhir). */
  function computeTargetId(px: number, py: number): string | null {
    for (const el of widgetEls()) {
      const id = el.dataset.widgetId
      if (!id || id === activeId.value) continue
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const inRowBand = py >= r.top && py <= r.bottom
      const before = py < r.top ? true : (inRowBand ? px < cx : false)
      if (before) return id
    }
    return null
  }

  /** Susun urutan baru berdasarkan id target; null bila tidak berubah. */
  function reorderByTarget(targetId: string | null): string[] | null {
    const id = activeId.value
    if (!id) return null
    const next = order.value.filter(x => x !== id)
    if (targetId === null) next.push(id)
    else {
      const idx = next.indexOf(targetId)
      if (idx === -1) next.push(id)
      else next.splice(idx, 0, id)
    }
    if (next.length === order.value.length && next.every((x, i) => x === order.value[i])) return null
    return next
  }

  function scheduleReorder() {
    if (rafReorder) return
    rafReorder = requestAnimationFrame(async () => {
      rafReorder = 0
      if (!isDragging.value || reorderBusy) return
      const next = reorderByTarget(computeTargetId(lastX, lastY))
      if (!next) return
      reorderBusy = true
      reorder(next)
      await nextTick()
      reorderBusy = false
    })
  }

  function autoScrollStep() {
    if (!isDragging.value) return
    const scroller = scrollParent
    if (scroller) {
      const r = scroller.getBoundingClientRect()
      if (lastY < r.top + AUTOSCROLL_EDGE) scroller.scrollTop -= AUTOSCROLL_SPEED
      else if (lastY > r.bottom - AUTOSCROLL_EDGE) scroller.scrollTop += AUTOSCROLL_SPEED
    } else {
      const h = window.innerHeight
      if (lastY < AUTOSCROLL_EDGE) window.scrollBy(0, -AUTOSCROLL_SPEED)
      else if (lastY > h - AUTOSCROLL_EDGE) window.scrollBy(0, AUTOSCROLL_SPEED)
    }
    rafAutoScroll = requestAnimationFrame(autoScrollStep)
  }

  function startAutoScroll() {
    if (!rafAutoScroll) rafAutoScroll = requestAnimationFrame(autoScrollStep)
  }

  function stopAutoScroll() {
    if (rafAutoScroll) cancelAnimationFrame(rafAutoScroll)
    rafAutoScroll = 0
  }

  function clearPending() {
    if (longPressTimer) clearTimeout(longPressTimer)
    longPressTimer = null
    window.removeEventListener('pointermove', onPendingMove)
    window.removeEventListener('pointerup', onPendingUp)
    window.removeEventListener('pointercancel', onPendingUp)
  }

  function onPendingMove(e: PointerEvent) {
    if (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_TOLERANCE) {
      clearPending()
    }
  }

  function onPendingUp() {
    clearPending()
  }

  function activate(id: string, e: PointerEvent) {
    clearPending()
    const el = widgetEl(id)
    if (!el) return

    activeId.value = id
    isDragging.value = true
    pointerId = e.pointerId
    originRect = el.getBoundingClientRect()
    lastX = e.clientX
    lastY = e.clientY
    moved = false

    const clone = el.cloneNode(true) as HTMLElement
    clone.classList.add('dashboard-drag-ghost')
    clone.removeAttribute('data-widget-id')
    clone.removeAttribute('data-flip-key')
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${originRect.left}px`,
      top: `${originRect.top}px`,
      width: `${originRect.width}px`,
      height: `${originRect.height}px`,
      margin: '0',
      zIndex: '9999',
      pointerEvents: 'none'
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.appendChild(clone)
    ghost = clone

    el.style.visibility = 'hidden'

    document.addEventListener('pointermove', onPointerMove, { passive: false })
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', cancelDrag)
    window.addEventListener('blur', cancelDrag)
    document.body.classList.add('dashboard-dragging')

    scrollParent = findScrollParent(el)
    startAutoScroll()
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value || !ghost) return
    if (pointerId !== null && e.pointerId !== pointerId) return
    lastX = e.clientX
    lastY = e.clientY
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) moved = true
    ghost.style.transform = `translate3d(${e.clientX - startX}px, ${e.clientY - startY}px, 0) scale(1.02) rotate(1deg)`
    scheduleReorder()
    e.preventDefault()
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging.value) {
      clearPending()
      return
    }
    if (pointerId !== null && e.pointerId !== pointerId) return
    void finishDrag(true)
  }

  async function finishDrag(commit: boolean) {
    stopAutoScroll()
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('resize', cancelDrag)
    window.removeEventListener('blur', cancelDrag)
    if (rafReorder) {
      cancelAnimationFrame(rafReorder)
      rafReorder = 0
    }
    reorderBusy = false

    const id = activeId.value
    const el = id ? widgetEl(id) : null
    const g = ghost
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (g && el && originRect) {
      const r = el.getBoundingClientRect()
      if (!reduced) {
        g.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1), opacity 200ms ease-out'
        g.style.transform = `translate3d(${r.left - originRect.left}px, ${r.top - originRect.top}px, 0) scale(1) rotate(0deg)`
        g.style.opacity = '0.65'
        await wait(200)
      }
      g.remove()
    } else if (g) {
      g.remove()
    }

    if (el) el.style.visibility = ''
    ghost = null
    originRect = null
    activeId.value = null
    isDragging.value = false
    pointerId = null
    document.body.classList.remove('dashboard-dragging')

    if (commit && id && moved) onDrop(id)
    moved = false
  }

  function cancelDrag() {
    void finishDrag(false)
  }

  function onHandlePointerDown(e: PointerEvent, widgetId: string) {
    if (!isEnabled.value || isDragging.value) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    startX = e.clientX
    startY = e.clientY
    pointerId = e.pointerId

    if (e.pointerType === 'mouse') {
      activate(widgetId, e)
      return
    }

    longPressTimer = setTimeout(() => activate(widgetId, e), LONG_PRESS_MS)
    window.addEventListener('pointermove', onPendingMove, { passive: true })
    window.addEventListener('pointerup', onPendingUp, { passive: true })
    window.addEventListener('pointercancel', onPendingUp, { passive: true })
  }

  function onHandleKeyDown(e: KeyboardEvent, widgetId: string) {
    if (!isEnabled.value) return

    if (e.key === ' ' || e.key === 'Enter') {
      if (!grabbedId.value) {
        grabbedId.value = widgetId
        announce('Widget diangkat. Gunakan tombol panah untuk memindah, spasi untuk lepas, Escape untuk batal.')
      } else if (grabbedId.value === widgetId) {
        grabbedId.value = null
        onDrop(widgetId)
      }
      e.preventDefault()
      return
    }

    if (grabbedId.value !== widgetId) return

    const dir = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
      ? -1
      : (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0)

    if (dir) {
      const idx = order.value.indexOf(widgetId)
      const j = idx + dir
      if (j >= 0 && j < order.value.length) {
        const next = [...order.value]
        const [item] = next.splice(idx, 1)
        next.splice(j, 0, item!)
        reorder(next)
        announce(`Posisi ${j + 1} dari ${next.length}.`)
      }
      e.preventDefault()
    } else if (e.key === 'Escape') {
      grabbedId.value = null
      announce('Pemindahan dibatalkan.')
      e.preventDefault()
    }
  }

  onScopeDispose(() => {
    clearPending()
    stopAutoScroll()
    if (rafReorder) cancelAnimationFrame(rafReorder)
    if (ghost) ghost.remove()
    document.body.classList.remove('dashboard-dragging')
  })

  return { activeId, grabbedId, isDragging, onHandlePointerDown, onHandleKeyDown }
}
