import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { usePreferredReducedMotion, useTransition } from '@vueuse/core'

/**
 * Animasi angka naik (count-up) untuk nilai KPI.
 *
 * Menghormati `prefers-reduced-motion`: bila user meminta gerak minimal,
 * nilai langsung ditampilkan tanpa transisi.
 */
export function useCountUp(source: MaybeRefOrGetter<number>, duration = 700): ComputedRef<number> {
  const reducedMotion = usePreferredReducedMotion()
  const value = computed(() => {
    const n = Number(toValue(source))
    return Number.isFinite(n) ? n : 0
  })

  const transitioned = useTransition(value, {
    duration,
    transition: [0.25, 0.1, 0.25, 1]
  })

  return computed(() => {
    const n = reducedMotion.value === 'reduce' ? value.value : transitioned.value
    return Math.round(n)
  })
}
