/**
 * Pemformatan inline (Bold / Italic / Underline) — SISI FRONTEND.
 *
 * Cermin logika `backend/src/contracts/inline-marks.ts`. Aturan parsenya HARUS
 * identik agar apa yang dilihat admin di pratinjau editor sama dengan hasil
 * PDF. Backend tetap satu-satunya otoritatif: keputusan valid/error saat simpan
 * & publish tetap di `template-schema.validator.ts`; modul ini hanya untuk UX
 * (toolbar B/I/U, pratinjau inline, ringkasan kartu).
 *
 * Fungsi murni — tanpa Vue, tanpa Nuxt, tanpa DOM — supaya bisa diuji langsung
 * lewat `scripts/check-inline-marks.mjs` (Node murni) persis seperti
 * `app/utils/field-usage.ts`.
 *
 * ATURAN (sama dengan backend, ringkas):
 *  1. Placeholder `{{...}}` OPAQUE — isinya tidak pernah dibaca sebagai markup.
 *  2. Delimiter tanpa pasangan → teks literal (tidak dibuang).
 *  3. Pasangan tanpa isi (`a****b`) → teks literal.
 *  4. `_` tunggal BUKAN delimiter; underline butuh `__` → `snake_case` aman.
 *  5. Escape `\*` `\_` `\\` menghasilkan karakter literal.
 */

export type InlineMark = 'bold' | 'italic' | 'underline'

/** Satu potongan teks dengan gaya seragam (hasil parse, untuk pratinjau). */
export interface InlineMarkRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** Delimiter kanonik per jenis mark — sama dengan backend. */
export const INLINE_MARK_DELIMITERS: Record<InlineMark, string> = {
  bold: '**',
  italic: '*',
  underline: '__'
}

const INLINE_MARK_KINDS: InlineMark[] = ['bold', 'italic', 'underline']

/** Karakter yang boleh di-escape dengan `\`. */
const ESCAPABLE = '*_\\'

interface Atom {
  text: string
  delimiter?: InlineMark
  /** Bentuk mentah delimiter (dipakai saat delimiter di-demote jadi literal). */
  raw?: string
  /** Offset di teks mentah — dipakai untuk pemetaan seleksi & toggle. */
  start: number
  end: number
}

/** Pasangan delimiter (indeks atom) yang sah. */
interface IndexRange {
  kind: InlineMark
  open: number
  close: number
}

/** Rentang mark dalam offset teks mentah. */
interface MarkRange {
  kind: InlineMark
  openStart: number
  openEnd: number
  closeStart: number
  closeEnd: number
}

/** Tokenisasi — identik dengan backend (urutan: placeholder → escape → `**`/`__` → `*`). */
function tokenize(text: string): Atom[] {
  const atoms: Atom[] = []
  const src = String(text ?? '')
  let i = 0
  let buffer = ''
  let bufferStart = 0

  const flush = () => {
    if (buffer) {
      atoms.push({ text: buffer, start: bufferStart, end: bufferStart + buffer.length })
      buffer = ''
    }
  }

  while (i < src.length) {
    const ch = src[i]

    // 1. Placeholder {{...}} — OPAQUE.
    if (ch === '{' && src[i + 1] === '{') {
      const close = src.indexOf('}}', i + 2)
      if (close !== -1) {
        flush()
        atoms.push({ text: src.slice(i, close + 2), start: i, end: close + 2 })
        i = close + 2
        continue
      }
      // `{{` tanpa penutup: bukan placeholder, jatuh ke teks literal.
    }

    // 2. Escape: `\*` `\_` `\\` → satu karakter literal.
    const next = src[i + 1]
    if (ch === '\\' && next !== undefined && i + 1 < src.length && ESCAPABLE.includes(next)) {
      if (!buffer) bufferStart = i
      buffer += next
      i += 2
      continue
    }

    // 3. Delimiter dua karakter lebih dulu (longest match).
    if (src.startsWith('**', i)) {
      flush()
      atoms.push({ text: '', delimiter: 'bold', raw: '**', start: i, end: i + 2 })
      i += 2
      continue
    }
    if (src.startsWith('__', i)) {
      flush()
      atoms.push({ text: '', delimiter: 'underline', raw: '__', start: i, end: i + 2 })
      i += 2
      continue
    }

    // 4. Delimiter satu karakter: HANYA `*` (italic).
    if (ch === '*') {
      flush()
      atoms.push({ text: '', delimiter: 'italic', raw: '*', start: i, end: i + 1 })
      i += 1
      continue
    }

    if (!buffer) bufferStart = i
    buffer += ch
    i += 1
  }

  flush()
  return atoms
}

/**
 * Pasangkan delimiter PER JENIS MARK secara independen (mark boleh bersarang).
 * Identik dengan backend. Delimiter ganjil & pasangan tanpa isi dikembalikan
 * sebagai indeks agar di-demote menjadi teks literal.
 */
function pairDelimiters(atoms: Atom[]): { ranges: IndexRange[], unpaired: number[] } {
  const ranges: IndexRange[] = []
  const unpaired: number[] = []

  for (const kind of INLINE_MARK_KINDS) {
    let open = -1
    for (let i = 0; i < atoms.length; i++) {
      if (atoms[i]?.delimiter !== kind) continue
      if (open === -1) {
        open = i
      } else {
        ranges.push({ kind, open, close: i })
        open = -1
      }
    }
    if (open !== -1) unpaired.push(open)
  }

  // Pasangan TANPA ISI (`a****b`) bukan mark — delimiternya jadi teks literal.
  const effective: IndexRange[] = []
  for (const range of ranges) {
    const hasContent = atoms
      .slice(range.open + 1, range.close)
      .some(atom => atom.delimiter === undefined && atom.text !== '')
    if (hasContent) {
      effective.push(range)
    } else {
      unpaired.push(range.open, range.close)
    }
  }

  return { ranges: effective, unpaired }
}

type RunWithOffsets = InlineMarkRun & { start: number, end: number }

interface ParsedInline {
  runs: RunWithOffsets[]
  markRanges: MarkRange[]
}

/** Parse lengkap: run bergaya dengan offset mentah + rentang mark yang sah. */
function parseInline(src: string): ParsedInline {
  const atoms = tokenize(src)
  const { ranges, unpaired } = pairDelimiters(atoms)

  // Delimiter yang tidak menjadi pasangan sah dicetak apa adanya.
  const literal = new Set(unpaired)

  const marksPerAtom: Array<Set<InlineMark>> = atoms.map(() => new Set<InlineMark>())
  for (const range of ranges) {
    for (let i = range.open + 1; i < range.close; i++) marksPerAtom[i]?.add(range.kind)
  }

  const markRanges: MarkRange[] = ranges.flatMap((range) => {
    const openAtom = atoms[range.open]
    const closeAtom = atoms[range.close]
    if (!openAtom || !closeAtom) return []
    return [{
      kind: range.kind,
      openStart: openAtom.start,
      openEnd: openAtom.end,
      closeStart: closeAtom.start,
      closeEnd: closeAtom.end
    }]
  })

  const runs: RunWithOffsets[] = []
  const push = (text: string, start: number, bold: boolean, italic: boolean, underline: boolean) => {
    const prev = runs[runs.length - 1]
    // Atom saling menyambung, jadi penggabungan run bergaya sama itu aman.
    if (prev && prev.bold === bold && prev.italic === italic && prev.underline === underline) {
      prev.text += text
      prev.end = start + text.length
    } else {
      runs.push({ text, start, end: start + text.length, bold, italic, underline })
    }
  }

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]
    if (!atom) continue
    if (atom.delimiter === undefined) {
      if (atom.text !== '') {
        const marks = marksPerAtom[i]
        push(
          atom.text,
          atom.start,
          marks?.has('bold') ?? false,
          marks?.has('italic') ?? false,
          marks?.has('underline') ?? false
        )
      }
      continue
    }
    if (literal.has(i)) push(atom.raw ?? '', atom.start, false, false, false)
  }

  if (runs.length === 0) {
    runs.push({ text: '', start: 0, end: 0, bold: false, italic: false, underline: false })
  }

  return { runs, markRanges }
}

/**
 * Parse teks menjadi run bergaya untuk pratinjau editor.
 * Selalu mengembalikan minimal satu run — bentuk sama dengan `parseInlineRuns()`
 * di backend.
 */
export function parseInlineMarks(text: string): InlineMarkRun[] {
  return parseInline(String(text ?? '')).runs.map(
    ({ start: _start, end: _end, ...run }) => run
  )
}

/** Teks tanpa markup — untuk ringkasan kartu dan peringatan isi kosong. */
export function stripInlineMarks(text: string): string {
  return parseInlineMarks(text).map(run => run.text).join('')
}

/** Apakah ada minimal satu mark yang benar-benar aktif pada teks ini. */
export function hasInlineMarks(text: string): boolean {
  return parseInlineMarks(text).some(run => run.bold || run.italic || run.underline)
}

/**
 * Mark yang aktif pada posisi kursor `pos` (untuk status tombol toolbar).
 *
 * Posisi tepat di tepi isi mark (tepat sebelum delimiter penutup, atau tepat
 * pada delimiter pembuka) tetap dianggap aktif — kursor yang baru selesai
 * mengetik di dalam span bold harus tetap menyalakan tombol **B**.
 */
export function activeMarksAt(text: string, pos: number): Set<InlineMark> {
  const { markRanges } = parseInline(String(text ?? ''))
  const active = new Set<InlineMark>()
  for (const range of markRanges) {
    if (pos >= range.openEnd && pos <= range.closeStart) active.add(range.kind)
  }
  return active
}

/** Mark aktif untuk SELURUH isi seleksi `[start, end)` — dipakai status toolbar. */
export function activeMarksForRange(text: string, start: number, end: number): Set<InlineMark> {
  const src = String(text ?? '')
  if (start >= end) return activeMarksAt(src, start)

  const { runs } = parseInline(src)
  const active = new Set<InlineMark>(INLINE_MARK_KINDS)
  let overlap = false
  for (const run of runs) {
    if (!run.text || run.end <= start || run.start >= end) continue
    overlap = true
    if (!run.bold) active.delete('bold')
    if (!run.italic) active.delete('italic')
    if (!run.underline) active.delete('underline')
  }
  return overlap ? active : new Set<InlineMark>()
}

/**
 * Terapkan / lepas satu mark pada rentang seleksi.
 *
 * - Jika seleksi BERTAPIS dengan rentang mark jenis yang sama yang sudah ada →
 *   delimiter rentang yang tersapu DIHAPUS (toggle off; seluruh span ikut
 *   lepas — perilaku standar editor dokumen).
 * - Jika tidak → delimiter disisipkan mengapit seleksi (toggle on). Seleksi
 *   kosong menyisipkan pasangan delimiter dan mengembalikan kursor di
 *   antaranya, siap diketik.
 *
 * Mengembalikan teks baru + seleksi baru (tetap menunjuk isi mark yang sama).
 * Fungsi TIDAK pernah membuang karakter: seperti backend, delimiter yang
 * tidak berpasangan dibiarkan menjadi teks literal.
 */
export function toggleMark(
  text: string,
  start: number,
  end: number,
  mark: InlineMark
): { text: string, selectionStart: number, selectionEnd: number } {
  const src = String(text ?? '')
  const from = Math.max(0, Math.min(start, end))
  const to = Math.min(src.length, Math.max(start, end))

  const { markRanges } = parseInline(src)
  const sameKind = markRanges.filter(range => range.kind === mark)
  const hit = sameKind.find(range => from < range.closeEnd && to > range.openStart)

  // ── Toggle OFF: hapus delimiter semua rentang yang tersapu seleksi ──────────
  if (hit) {
    const deletions = sameKind
      .filter(range => from < range.closeEnd && to > range.openStart)
      .flatMap(range => [[range.openStart, range.openEnd], [range.closeStart, range.closeEnd]] as const)
      .sort((a, b) => a[0] - b[0])

    let out = ''
    let prev = 0
    for (const [delStart, delEnd] of deletions) {
      out += src.slice(prev, delStart)
      prev = delEnd
    }
    out += src.slice(prev)

    const shift = (pos: number) => deletions.reduce(
      (acc, [delStart, delEnd]) => (delEnd <= pos ? acc + (delEnd - delStart) : acc),
      0
    )
    return {
      text: out,
      selectionStart: Math.max(0, from - shift(from)),
      selectionEnd: Math.max(0, to - shift(to))
    }
  }

  // ── Toggle ON: sisipkan delimiter mengapit seleksi ──────────────────────────
  const delimiter = INLINE_MARK_DELIMITERS[mark]
  return {
    text: src.slice(0, from) + delimiter + src.slice(from, to) + delimiter + src.slice(to),
    selectionStart: from + delimiter.length,
    selectionEnd: to + delimiter.length
  }
}
