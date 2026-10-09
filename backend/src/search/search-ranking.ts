/**
 * Peringkat relevansi pencarian global — fungsi murni, tanpa Prisma.
 *
 * Dipisah dari `search.service.ts` supaya dapat diuji tanpa menyentuh database
 * dan supaya aturan urutan hasil tinggal di satu tempat.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Skor relevansi satu nilai terhadap query (0 = tidak cocok).
 *
 * Persis 100, awalan 80, batas kata 60, substring 40. Batas kata memakai
 * pemisah non-alfanumerik sehingga "sankyu" cocok dengan "PT Sankyu Int'l"
 * tetapi "ank" tidak dianggap batas kata.
 */
export function scoreValue(value: unknown, q: string): number {
  const v = String(value ?? '').toLowerCase()
  if (!v) return 0
  const s = q.toLowerCase()
  if (!s) return 0
  if (v === s) return 100
  if (v.startsWith(s)) return 80
  if (new RegExp(`(^|[\\s\\W])${escapeRegExp(s)}`).test(v)) return 60
  if (v.includes(s)) return 40
  return 0
}

/** Skor tertinggi dari sekumpulan nilai (entitas diwakili field-nya). */
export function bestScore(values: unknown[], q: string): number {
  let best = 0
  for (const value of values) {
    const score = scoreValue(value, q)
    if (score > best) best = score
    if (best === 100) break
  }
  return best
}
