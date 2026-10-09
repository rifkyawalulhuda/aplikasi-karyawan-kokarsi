/**
 * Normalisasi `block.spaceAfter` — jarak vertikal TAMBAHAN di bawah sebuah blok
 * (pt), di atas jarak bawaan renderer.
 *
 * Modul daun (tanpa PDFKit/NestJS/Prisma) supaya dipakai bersama oleh:
 *  - validator (`contract-templates/template-schema.validator.ts`), dan
 *  - engine tata letak MITRA & PKWT (`contracts/*-layout.engine.ts`).
 *
 * Diletakkan di `contracts/` (bukan di `contract-templates/`) karena
 * `contract-templates/` bergantung pada `contracts/`; mengimpor ke arah
 * sebaliknya akan membuat siklus modul.
 */

/** Batas atas `spaceAfter` (pt). Cukup lega untuk jarak antar-pasal, tetap aman. */
export const MAX_BLOCK_SPACE_AFTER = 40

/**
 * Normalisasi nilai `spaceAfter` mentah.
 *
 * Hanya bilangan bulat `0..MAX_BLOCK_SPACE_AFTER` yang sah; selain itu →
 * `undefined` (perilaku lama: tanpa jarak tambahan). Nilai `0` SAH dan berarti
 * "rapat" (eksplisit tanpa jarak tambahan).
 */
export function normalizeBlockSpaceAfter(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined
  if (value < 0 || value > MAX_BLOCK_SPACE_AFTER) return undefined
  return value
}

/**
 * Jarak efektif untuk renderer: nilai sah `> 0`, selain itu `0`.
 *
 * Aman terhadap data lama/rusak — nilai tak dikenal tidak pernah mengubah tata
 * letak, sehingga template tanpa `spaceAfter` menghasilkan PDF yang sama persis.
 */
export function blockSpaceAfterPts(value: unknown): number {
  const n = normalizeBlockSpaceAfter(value)
  return n === undefined ? 0 : n
}
