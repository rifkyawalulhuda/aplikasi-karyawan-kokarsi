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

/**
 * Gambar SATU baris rata kanan-kiri (justified).
 *
 * RIWAYAT BUG (penting): pernah tercatat bahwa `doc.text({align:'justify'})`
 * pada pdfkit 0.19.1 "membuang glyph spasi" sehingga muncul
 * `3.AtasPekerjaanyangdilakukan`. Itu **KELIRU**. Justifikasi pdfkit menulis
 * celah antar-kata sebagai **offset numerik di dalam operator `TJ`**
 * (`<-wordSpacing>`, lihat pdfkit.js:3717), bukan sebagai glyph spasi (0x20).
 * Jadi, per byte, memang tidak ada byte spasi — padahal secara visual maupun
 * saat diekstrak oleh pembaca PDF nyata (pdfplumber/PyMuPDF), spasinya UTUH.
 *
 * Konsekuensinya untuk kode di bawah: jarak antar-kata diukur ulang secara
 * eksplisit (jarak = (width - natural) / jumlahCelah), bukan mengandalkan
 * glyph spasi tetap, sehingga hasilnya identik dengan justifikasi pdfkit.
 *
 * Bila lebar natural baris sudah melebihi `width`, justifikasi dilewati
 * (jarak negatif akan menumpuk kata) dan baris digambar apa adanya.
 *
 * @returns `true` bila baris benar-benar dijustifikasi.
 */
export function drawJustifiedLine(
  doc: any,
  line: string,
  x: number,
  y: number,
  width: number,
  opts: { font?: string; size?: number } = {},
): boolean {
  const text = String(line ?? '')
  const words = text.split(/\s+/).filter(Boolean)
  if (opts.font) doc.font(opts.font)
  if (opts.size != null) doc.fontSize(opts.size)

  // Tanpa kata atau hanya satu kata, tidak ada celah yang bisa direntangkan.
  if (words.length <= 1) {
    doc.text(text, x, y)
    return false
  }

  const natural = words.reduce((acc, w) => acc + doc.widthOfString(w), 0)
  const gap = (width - natural) / (words.length - 1)
  if (!Number.isFinite(gap) || gap <= 0) {
    doc.text(text, x, y)
    return false
  }

  let cx = x
  for (let i = 0; i < words.length; i++) {
    doc.text(words[i], cx, y, { lineBreak: false })
    cx += doc.widthOfString(words[i])
    if (i < words.length - 1) cx += gap
  }
  return true
}
