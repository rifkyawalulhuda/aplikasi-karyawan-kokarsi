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

/**
 * Batas atas `fieldSpacing` (pt). Sama dengan `spaceAfter` supaya kedua kontrol
 * spasi di editor punya rentang yang identik.
 */
export const MAX_FIELD_SPACING = MAX_BLOCK_SPACE_AFTER

/**
 * Blok yang boleh membawa `fieldSpacing` (jarak ANTAR field di dalam satu blok).
 *
 * Hanya blok yang benar-benar merender beberapa sub-elemen bertumpuk:
 *  - `article` → judul ↔ uraian, dan uraian ↔ uraian
 *  - `list`    → poin ↔ poin
 *  - `table`   → baris ↔ baris (menambah tinggi baris)
 *  - `closing` → baris logis ↔ baris logis
 *
 * `title`/`subtitle`/`paragraph` hanya punya SATU field, dan `signature` adalah
 * tabel dua kolom sejajar (bukan tumpukan field), jadi keduanya tidak didukung.
 * Sama untuk MITRA maupun PKWT — himpunannya sengaja seragam.
 */
export const FIELD_SPACING_CAPABLE_BLOCKS = ['article', 'list', 'table', 'closing'] as const

/**
 * Normalisasi nilai `fieldSpacing` mentah.
 *
 * Aturan sama dengan `spaceAfter`: hanya bilangan bulat `0..MAX_FIELD_SPACING`.
 * Selain itu → `undefined` (perilaku lama: tanpa jarak tambahan).
 */
export function normalizeFieldSpacing(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined
  if (value < 0 || value > MAX_FIELD_SPACING) return undefined
  return value
}

/**
 * Jarak efektif antar field untuk renderer: nilai sah `> 0`, selain itu `0`.
 *
 * Template tanpa `fieldSpacing` mengeksekusi jalur lama apa adanya, sehingga
 * output PDF-nya identik dengan sebelum fitur ini ada.
 */
export function fieldSpacingPts(value: unknown): number {
  const n = normalizeFieldSpacing(value)
  return n === undefined ? 0 : n
}
