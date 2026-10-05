/**
 * Tata letak teks BER-RUN (bold/italic/underline) untuk kedua engine kontrak.
 *
 * Modul ini MURNI: hanya menerima `doc` sebagai parameter (pola sama dengan
 * `table-layout.helpers.ts`), tanpa PDFKit/NestJS/Prisma yang di-import. Itu
 * membuatnya mudah diuji dengan dokumen tiruan dan tidak mungkin membuat siklus
 * modul. Modul ini dipakai oleh:
 *  - `pkwt-layout.engine.ts`   (kolom ID/EN terkunci per baris)
 *  - `mitra-layout.engine.ts`  (dua kolom ber-border)
 *
 * ATURAN PENTING (semuanya diuji di `inline-run-layout.spec.ts`):
 *
 *  1. **Dual path.** Modul ini HANYA dipanggil bila teks benar-benar bermark
 *     (`hasInlineMarks()`). Teks tanpa mark tetap lewat jalur lama
 *     (`doc.text` / `drawJustifiedLine` / `wrapCellLines`), sehingga template
 *     yang sudah ada menghasilkan PDF yang sama persis.
 *
 *  2. **Normalisasi spasi mengikuti `wrapCellLines`.** Deret spasi/tab/newline
 *     dalam satu baris dipadatkan menjadi SATU spasi, sama seperti jalur lama.
 *     Ini yang membuat pemecahan baris teks bermark tidak "tiba-tiba" berbeda.
 *
 *  3. **Tinggi baris bersumber dari SATU font acuan, bukan maksimum antar-run.**
 *     `measureRunsLine()` memakai font yang diberikan pemanggil (praktisnya
 *     regular). Alasannya: bold/italic punya metrik ascender/descender yang
 *     sedikit berbeda, dan kalau tinggi baris dihitung per-run maka baris
 *     bermark bisa berbeda tinggi dari baris tanpa mark. Dengan font acuan,
 *     jumlah baris == jumlah tinggi baris, sehingga **paginasi tidak bergeser**.
 *
 *  4. **`center`/`right` hanya menggeser titik awal** — tidak ada perentangan
 *     celah, sehingga jumlah baris tidak berubah. Titik awal DIBATASI minimal
 *     `x` supaya teks yang lebih lebar dari kotak tidak bocor ke luar kolom.
 *
 *  5. **`justify` meniru `drawJustifiedLine()`** — celah = (width − natural) /
 *     (jumlah kata − 1), dan jatuh kembali ke rata-kiri bila celah ≤ 0 atau
 *     baris hanya punya satu kata. Kata tidak pernah ditumpuk.
 */
import type { InlineRun } from './inline-marks'

/** Nama font logis per peran. `boldItalic` opsional (MITRA bisa belum punya). */
export interface RunFonts {
  regular: string
  bold: string
  italic: string
  boldItalic?: string
}

/** Nilai perataan yang sah. Empat nilai; `center`/`right` bukan lagi milik renderer saja. */
export const INLINE_RUN_ALIGN_VALUES = ['left', 'center', 'right', 'justify'] as const
export type InlineRunAlign = (typeof INLINE_RUN_ALIGN_VALUES)[number]

/**
 * Font untuk sebuah run.
 *
 * `bold+italic` jatuh ke `bold` bila `boldItalic` tidak tersedia (mis. font
 * MITRA belum mendaftarkannya). Sengaja TIDAK jatuh ke `italic`: teks yang
 * diminta tebal harus tetap terlihat tebal.
 */
export function runFont(run: InlineRun, fonts: RunFonts): string {
  if (run.bold && run.italic) return fonts.boldItalic ?? fonts.bold
  if (run.bold) return fonts.bold
  if (run.italic) return fonts.italic
  return fonts.regular
}

/** Satu kata (atau spasi) beserta gayanya. Unit internal modul ini. */
interface RunWord {
  text: string
  run: InlineRun
}

/** Lebar teks dengan font milik run-nya. Font doc disetel ulang setiap panggilan. */
function widthOf(doc: any, text: string, run: InlineRun, fonts: RunFonts, size: number): number {
  doc.font(runFont(run, fonts)).fontSize(size)
  return doc.widthOfString(text)
}

/**
 * Pecah run menjadi token kata dan token spasi.
 *
 * Dua aturan yang harus dipegang bersama `wrapCellLines` (supaya pemecahan baris
 * tidak menyimpang dari jalur lama):
 *  1. Deret spasi dipadatkan menjadi SATU spasi.
 *  2. Setiap token mewarisi gaya run TEMPAT karakter itu berada — bukan gaya run
 *     sebelum atau sesudahnya. Ini yang membuat `'a __b__ c'` tidak menyalakan
 *     garis bawah pada spasi sebelum `c`.
 *
 * Token spasi disimpan (bukan dibuang) karena dua alasan: ia ikut dihitung saat
 * membungkus baris, dan jalur `justify` membuangnya sendiri lalu menggantinya
 * dengan celah yang direntangkan.
 */
function toWords(runs: InlineRun[]): RunWord[] {
  const words: RunWord[] = []
  const isSpaceText = (text: string) => /^\s*$/.test(text)

  const push = (text: string, run: InlineRun) => {
    const style: InlineRun = {
      text,
      bold: run.bold === true,
      italic: run.italic === true,
      underline: run.underline === true,
    }
    const prev = words[words.length - 1]
    // Gabung hanya bila jenisnya sama (kata↔kata, spasi↔spasi) DAN gayanya sama.
    // Menggabung spasi ke dalam kata akan merusak pemisahan kata saat `justify`.
    if (
      prev
      && isSpaceText(prev.text) === isSpaceText(text)
      && prev.run.bold === style.bold
      && prev.run.italic === style.italic
      && prev.run.underline === style.underline
    ) {
      prev.text += text
      return
    }
    words.push({ text, run: style })
  }

  for (const run of runs ?? []) {
    const text = String(run?.text ?? '')
    if (!text) continue
    // Pecah per transisi spasi ↔ non-spasi, MEMPERTAHANKAN karakter aslinya.
    //
    // Versi sebelumnya menyisipkan spasi buatan di antara kata dengan gaya run
    // SEBELUMNYA. Itu salah: pada `'a __b__ c'` spasi sebelum `c` berasal dari
    // run `' c'` (regular), bukan dari run `__b__`, sehingga spasi itu ikut
    // bergaris bawah — bug yang tertangkap uji. Dengan memakai karakter asli,
    // setiap token mewarisi gaya run tempat ia benar-benar berada.
    for (const part of text.split(/(\s+)/)) {
      if (part === '') continue
      // Deret spasi dipadatkan menjadi satu, sama seperti `wrapCellLines`.
      push(isSpaceText(part) ? ' ' : part, run)
    }
  }

  return words
}

/** Bungkus SATU paragraf (tanpa `\n`) menjadi baris-baris run. */
function wrapParagraph(
  doc: any,
  runs: InlineRun[],
  width: number,
  fonts: RunFonts,
  size: number,
  firstLineWidth: number,
): InlineRun[][] {
  const words = toWords(runs)
  if (words.length === 0) return [[{ text: '', bold: false, italic: false, underline: false }]]

  const lines: RunWord[][] = []
  let cur: RunWord[] = []
  let curWidth = 0

  for (const word of words) {
    const wordWidth = widthOf(doc, word.text, word.run, fonts, size)
    const isSpace = /^\s+$/.test(word.text)

    if (isSpace) {
      // Spasi tidak pernah memulai baris baru.
      if (cur.length === 0) continue
      cur.push(word)
      curWidth += wordWidth
      continue
    }

    // Baris PERTAMA boleh memakai lebar berbeda (hanging indent: baris pertama
    // menjorok lebih sedikit dari baris lanjutan).
    const limit = lines.length === 0 ? firstLineWidth : width
    // `cur.length > 0` menjaga kata yang lebih panjang dari `width` tetap utuh,
    // persis seperti `wrapCellLines`.
    if (cur.length > 0 && curWidth + wordWidth > limit) {
      lines.push(cur)
      cur = [word]
      curWidth = wordWidth
      continue
    }

    cur.push(word)
    curWidth += wordWidth
  }

  if (cur.length > 0) lines.push(cur)
  if (lines.length === 0) lines.push([])

  return lines.map(lineToRuns)
}

/**
 * Bungkus run menjadi baris-baris, menghormati `\n` eksplisit.
 *
 * Pengganti `wrapCellLines` untuk teks bermark. Untuk teks tanpa mark, hasilnya
 * sama dengan `wrapCellLines` (dijamin oleh aturan 2 dan diuji langsung).
 *
 * @param opts.firstLineWidth lebar baris PERTAMA yang berbeda — dipakai untuk
 *        hanging indent (baris pertama menjorok lebih sedikit). Hanya berlaku
 *        pada baris pertama dari SELURUH teks, bukan tiap paragraf `\n`.
 */
export function wrapRunsToLines(
  doc: any,
  runs: InlineRun[],
  width: number,
  fonts: RunFonts,
  size: number,
  opts: { firstLineWidth?: number } = {},
): InlineRun[][] {
  const firstWidth = opts.firstLineWidth ?? width
  const paragraphs: InlineRun[][] = [[]]

  for (const run of runs ?? []) {
    const parts = String(run?.text ?? '').split('\n')
    parts.forEach((part, index) => {
      if (index > 0) paragraphs.push([])
      if (part !== '') paragraphs[paragraphs.length - 1].push({ ...run, text: part })
    })
  }

  const lines: InlineRun[][] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push([{ text: '', bold: false, italic: false, underline: false }])
      continue
    }
    // Lebar baris-pertama hanya dipakai bila BELUM ada baris sama sekali.
    const limit = lines.length === 0 ? firstWidth : width
    for (const line of wrapParagraph(doc, paragraph, width, fonts, size, limit)) lines.push(line)
  }

  return lines.length > 0 ? lines : [[{ text: '', bold: false, italic: false, underline: false }]]
}

/**
 * Tinggi SATU baris run.
 *
 * Memakai SATU font acuan (aturan 3), BUKAN maksimum antar-run. Pemanggil harus
 * mengirim font yang sama dengan yang dipakai jalur lama (regular) supaya baris
 * bermark setinggi baris tanpa mark — itulah yang menjaga paginasi.
 */
export function measureRunsLine(doc: any, font: string, size: number, lineGap = 0): number {
  doc.font(font).fontSize(size)
  return doc.heightOfString('Xg', { lineGap })
}

/** Gambar potongan-potongan berurutan mulai `x`, tanpa perentangan celah. */
function drawTokens(doc: any, tokens: RunWord[], x: number, y: number, fonts: RunFonts, size: number): void {
  let cx = x
  for (const token of tokens) {
    const w = widthOf(doc, token.text, token.run, fonts, size)
    drawPiece(doc, token.text, cx, y, token.run, fonts, size, w)
    cx += w
  }
}

/**
 * Gambar satu potong teks pada posisi eksplisit.
 *
 * Garis bawah digambar MANUAL, dan itu bukan pilihan gaya — ini keharusan.
 *
 * `doc.text(text, x, y, { underline: true })` **tidak dapat dipakai** di sini:
 * PDFKit hanya mengisi `options.textWidth`/`options.wordCount` pada jalur
 * `options.width` (LineWrapper, lihat `emitLine()` di `mixins/text.js`).
 * Tanpa `width`, `_fragment` menghitung
 * `renderedWidth = options.textWidth + ...` → `NaN` → `lineTo(NaN)` → PDFKit
 * melempar `unsupported number: NaN`. Bug ini tertangkap oleh uji PDF NYATA
 * (dokumen tiruan tidak bisa menangkapnya) — lihat
 * `pkwt-document.renderer.spec.ts` kasus `__garis__`.
 *
 * Karena kita sudah tahu `x` dan lebar potongan tepat, menggambar garisnya
 * sendiri justru lebih pasti: rumusnya sama dengan yang dipakai PDFKit
 * (`lineWidth`, `y + currentLineHeight() - lineWidth`) tetapi tidak bergantung
 * pada jalur pembungkusan.
 */
function drawPiece(
  doc: any,
  text: string,
  x: number,
  y: number,
  run: InlineRun,
  fonts: RunFonts,
  size: number,
  width: number,
): void {
  doc.font(runFont(run, fonts)).fontSize(size)
  doc.text(text, x, y, { lineBreak: false })

  if (run.underline !== true) return

  const lineWidth = size < 10 ? 0.5 : Math.floor(size / 10)
  const lineY = y + doc.currentLineHeight() - lineWidth
  doc.save()
  doc.lineWidth(lineWidth)
  doc.strokeColor('#000000')
  doc.moveTo(x, lineY)
  doc.lineTo(x + width, lineY)
  doc.stroke()
  doc.restore()
}

/**
 * Gambar SATU baris run dengan perataan.
 *
 * `justify` mengikuti `drawJustifiedLine()` (aturan 5): celah dihitung dari
 * jumlah kata, spasi asli dibuang. `left`/`center`/`right` mempertahankan spasi
 * asli dan hanya menggeser titik awal (aturan 4).
 */
export function drawRunsLine(
  doc: any,
  runs: InlineRun[],
  x: number,
  y: number,
  width: number,
  fonts: RunFonts,
  size: number,
  align: InlineRunAlign = 'left',
): void {
  const tokens = toWords(runs ?? [])
  if (tokens.length === 0) return

  doc.fillColor('#000000')

  if (align === 'justify') {
    const words = tokens.filter(token => !/^\s+$/.test(token.text))
    if (words.length <= 1) {
      drawTokens(doc, tokens, x, y, fonts, size)
      return
    }
    const natural = words.reduce((acc, word) => acc + widthOf(doc, word.text, word.run, fonts, size), 0)
    const gap = (width - natural) / (words.length - 1)
    if (!Number.isFinite(gap) || gap <= 0) {
      drawTokens(doc, tokens, x, y, fonts, size)
      return
    }
    let cx = x
    for (const word of words) {
      const w = widthOf(doc, word.text, word.run, fonts, size)
      drawPiece(doc, word.text, cx, y, word.run, fonts, size, w)
      cx += w + gap
    }
    return
  }

  const natural = tokens.reduce((acc, token) => acc + widthOf(doc, token.text, token.run, fonts, size), 0)
  let startX = x
  if (align === 'center') startX = x + (width - natural) / 2
  else if (align === 'right') startX = x + width - natural

  // Teks lebih lebar dari kotak (mis. pembulatan font) tidak boleh bocor keluar kolom.
  if (!Number.isFinite(startX) || startX < x) startX = x

  drawTokens(doc, tokens, startX, y, fonts, size)
}

/** Gabungkan kata-kata satu baris kembali menjadi run, tanpa spasi di ujung kanan. */
function lineToRuns(words: RunWord[]): InlineRun[] {
  const trimmed = [...words]
  while (trimmed.length > 0 && /^\s+$/.test(trimmed[trimmed.length - 1].text)) trimmed.pop()

  const out: InlineRun[] = []
  for (const word of trimmed) {
    const prev = out[out.length - 1]
    if (prev && prev.bold === word.run.bold && prev.italic === word.run.italic && prev.underline === word.run.underline) {
      prev.text += word.text
      continue
    }
    out.push({
      text: word.text,
      bold: word.run.bold === true,
      italic: word.run.italic === true,
      underline: word.run.underline === true,
    })
  }

  return out.length > 0 ? out : [{ text: '', bold: false, italic: false, underline: false }]
}
