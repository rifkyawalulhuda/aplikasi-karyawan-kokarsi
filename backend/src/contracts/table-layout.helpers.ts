/**
 * Utilitas tabel yang dipakai BERSAMA oleh kedua renderer kontrak:
 *  - `mitra-layout.engine.ts`   (Perjanjian Kemitraan, dua kolom ber-border)
 *  - `contract-block-renderer.ts` (renderer blok generik / PKWT)
 *
 * Modul ini murni (tanpa PDFKit/NestJS) supaya mudah diuji dan tidak mungkin
 * menyimpang antar-renderer.
 */

/** Kolom tabel sebagaimana disimpan di `contentDefinition` blok `table`. */
export interface TableColumnLike {
  key?: unknown
  label?: unknown
  /** Bobot lebar kolom (relatif). Lihat `computeColumnWidths`. */
  width?: unknown
  format?: unknown
  align?: unknown
}

/**
 * Hitung lebar tiap kolom dari bobot `width`-nya.
 *
 * RIWAYAT BUG: `width` dulu diperlakukan sebagai **persen mentah** dari lebar
 * kolom, padahal setiap kolom baru dibuat editor dengan `width: 100`. Akibatnya
 * tabel 3 kolom meminta 300% ruang dan meluber keluar halaman.
 *
 * Karena itu `width` kini diperlakukan sebagai **bobot relatif** lalu
 * dinormalisasi agar totalnya SELALU sama dengan `totalWidth`. Ini juga
 * memperbaiki tabel lama tanpa migrasi data:
 *   [100, 100, 100] -> [1/3, 1/3, 1/3]  (sebelumnya 3x lebar penuh)
 *   [50, 30, 20]    -> [50%, 30%, 20%]  (proporsi tetap dihormati)
 *
 * Kolom tanpa `width` (atau <= 0 / bukan angka) diberi bobot 1 agar tetap dapat
 * bagian yang wajar.
 */
export function computeColumnWidths(columns: TableColumnLike[], totalWidth: number): number[] {
  if (!Array.isArray(columns) || columns.length === 0) return []
  const weights = columns.map(col => {
    const raw = Number(col?.width)
    return Number.isFinite(raw) && raw > 0 ? raw : 1
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  // `sum` dijamin > 0 karena minimal bernilai 1 per kolom.
  return weights.map(w => (totalWidth * w) / sum)
}

/**
 * Tinggi baris tabel untuk satu set sel.
 * Dipakai agar kedua renderer memakai rumus tinggi yang identik.
 */
export function computeRowHeight(
  doc: any,
  cells: string[],
  widths: number[],
  fontSize: number,
  padding = 8,
  extra = 6,
): number {
  const heights = widths.map((w, i) => doc.heightOfString(cells[i] ?? '', { width: Math.max(w - padding, 1) }))
  return Math.max(...heights, fontSize) + extra
}

/**
 * Bungkus teks satu sel menjadi baris-baris yang muat pada `width`, memakai
 * pengukuran nyata PDFKit. Menghormati newline eksplisit (`\n`).
 *
 * Dipakai untuk memecah baris tabel yang terlalu tinggi agar dapat mengalir
 * lintas halaman tanpa kehilangan teks.
 */
export function wrapCellLines(doc: any, text: string, width: number, font: string, size: number): string[] {
  doc.font(font).fontSize(size)
  const lines: string[] = []
  const paragraphs = String(text ?? '').split('\n')
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) { lines.push(''); continue }
    let cur = ''
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word
      if (doc.widthOfString(test) <= width || cur === '') {
        cur = test
      } else {
        lines.push(cur)
        cur = word
      }
    }
    if (cur) lines.push(cur)
  }
  return lines.length ? lines : ['']
}
