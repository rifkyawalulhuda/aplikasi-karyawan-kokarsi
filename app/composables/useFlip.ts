import { usePreferredReducedMotion } from '@vueuse/core'

interface FlipOptions {
  /** Durasi transisi (ms). */
  duration?: number
  /** Easing CSS. */
  easing?: string
}

/**
 * Animasi FLIP (First → Last → Invert → Play).
 *
 * `first` mengukur posisi elemen SEBELUM mutasi DOM; `play` dipanggil SETELAH
 * mutasi (dan `await nextTick()`) untuk mengukur posisi baru lalu menggeser
 * elemen dari posisi lama ke posisi baru. Hanya `transform` yang dianimasikan
 * sehingga tidak memicu layout ulang — halus di 60fps.
 *
 * Menghormati `prefers-reduced-motion`: bila user meminta gerak minimal,
 * `play` menjadi no-op (urutan tetap berubah, hanya tanpa animasi).
 */
export function useFlip(options: FlipOptions = {}) {
  const duration = options.duration ?? 220
  const easing = options.easing ?? 'cubic-bezier(0.2, 0, 0, 1)'
  const reducedMotion = usePreferredReducedMotion()

  /** Ukur rect semua elemen (dipetakan lewat `data-flip-key`). */
  function first(elements: HTMLElement[]): Map<string, DOMRect> {
    const map = new Map<string, DOMRect>()
    for (const el of elements) {
      const key = el.dataset.flipKey
      if (key) map.set(key, el.getBoundingClientRect())
    }
    return map
  }

  /** Animasikan dari posisi `prev` ke posisi sekarang. Panggil setelah `nextTick()`. */
  function play(prev: Map<string, DOMRect>, elements: HTMLElement[]): void {
    if (reducedMotion.value === 'reduce') return
    if (typeof window === 'undefined') return

    const animated: HTMLElement[] = []
    for (const el of elements) {
      const key = el.dataset.flipKey
      if (!key) continue
      const before = prev.get(key)
      if (!before) continue
      const after = el.getBoundingClientRect()
      const dx = before.left - after.left
      const dy = before.top - after.top
      if (dx === 0 && dy === 0) continue

      el.style.transition = 'none'
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      el.style.willChange = 'transform'
      animated.push(el)
    }

    if (animated.length === 0) return

    // Paksa reflow agar transform awal "terpasang" sebelum transisi dimulai.
    void document.body.offsetHeight

    requestAnimationFrame(() => {
      for (const el of animated) {
        el.style.transition = `transform ${duration}ms ${easing}`
        el.style.transform = 'translate3d(0, 0, 0)'
      }
      window.setTimeout(() => {
        for (const el of animated) {
          el.style.transition = ''
          el.style.transform = ''
          el.style.willChange = ''
        }
      }, duration + 30)
    })
  }

  return { first, play }
}
