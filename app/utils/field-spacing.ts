/**
 * Helper editor untuk `block.fieldSpacing` — jarak ANTAR field di dalam satu blok.
 *
 * Disimpan di `app/utils/` (bukan di komponen) supaya aturan "kapan kontrol
 * ditampilkan" dapat diuji dan tidak tersebar di template.
 */

/**
 * Pitch baseline grid MITRA (pt).
 *
 * HARUS sama dengan `mitraPitch()` di `backend/src/contracts/mitra-layout.engine.ts`
 * (tinggi baris Times 12pt + `lineGap` 2.0 ≈ 15.7988). Nilai di sini hanya untuk
 * MENAMPILKAN hasil efektif ("1 baris · 15.8 pt"), bukan untuk menghitung tata
 * letak — pembulatan sesungguhnya dilakukan engine.
 */
export const MITRA_GRID_PITCH = 15.8

/** Bentuk minimal blok yang dibaca helper ini (tanpa `any`). */
export interface SpacingBlockLike {
  type?: unknown
  heading?: unknown
  paragraphs?: unknown
  items?: unknown
  rows?: unknown
  text?: unknown
}

/**
 * Berapa banyak field yang dimiliki sebuah blok.
 *
 * Dipakai untuk menyembunyikan kontrol "Spasi antar isi" pada blok yang hanya
 * punya satu isi (jaraknya tidak akan pernah tercetak):
 * - `article` → judul (bila ada) + uraian yang tidak kosong
 * - `list`    → poin yang tidak kosong
 * - `table`   → baris data (header bukan field)
 * - `closing` → baris logis (dipisah Enter) yang tidak kosong
 */
export function fieldSpacingFieldCount(block: SpacingBlockLike | null | undefined): number {
  if (!block || typeof block !== 'object') return 0
  const filled = (v: unknown) => String(v ?? '').replace(/\r\n?/g, '\n').trim() !== ''
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

  switch (block.type) {
    case 'article': {
      const heading = filled(block.heading) ? 1 : 0
      const paragraphs = list(block.paragraphs).filter(filled).length
      return heading + paragraphs
    }
    case 'list':
      return list(block.items).filter(filled).length
    case 'table':
      return list(block.rows).length
    case 'closing':
      return String(block.text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter(line => line.trim() !== '')
        .length
    default:
      return 0
  }
}

/**
 * Pitch grid yang dipakai untuk menampilkan hasil efektif, atau `undefined` bila
 * blok TIDAK mengalir di baseline grid.
 *
 * Tabel dan penutup berada di luar grid (tabel di-snap setelahnya, penutup
 * dicetak di luar kotak), jadi jaraknya dipakai apa adanya dalam pt.
 */
export function fieldSpacingGridPitch(
  block: SpacingBlockLike | null | undefined,
  family: 'MITRA' | 'PKWT'
): number | undefined {
  if (family !== 'MITRA') return undefined
  return block?.type === 'article' || block?.type === 'list' ? MITRA_GRID_PITCH : undefined
}

/**
 * Jumlah baris grid yang benar-benar dipakai (pembulatan KE ATAS), atau `null`
 * bila tidak ada pembulatan yang perlu ditampilkan.
 *
 * Toleransi `1e-6` mencegah nilai yang PERSIS kelipatan grid (mis. 15.8) tampil
 * sebagai 2 baris hanya karena selisih floating point.
 */
export function effectiveGridLines(value: unknown, pitch: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  if (!pitch || pitch <= 0) return null
  return Math.ceil(value / pitch - 1e-6)
}
