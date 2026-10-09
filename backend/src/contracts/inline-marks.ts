/**
 * Pemformatan inline (Bold / Italic / Underline) untuk teks Template Kontrak.
 *
 * Modul ini MURNI: tanpa PDFKit, tanpa NestJS, tanpa Prisma. Itu disengaja —
 * ia dipakai oleh kedua engine render (PKWT & MITRA), oleh validator, dan oleh
 * harness frontend, sehingga tidak boleh menyeret dependensi apa pun dan tidak
 * mungkin membuat siklus modul.
 *
 * REPRESENTASI: teks tetap `string`. Pemformatan ditulis sebagai markup inline
 * (`**bold**`, `*italic*`, `__underline__`). Konsekuensi penting:
 *  - schema `contentDefinition` TIDAK berubah, jadi versi template `PUBLISHED`
 *    yang sudah tersimpan tetap valid tanpa migrasi;
 *  - `list`/`table` yang tidak mendukung mark tetap aman (teksnya polos).
 *
 * ATURAN (semuanya diuji di `inline-marks.spec.ts`):
 *  1. Placeholder `{{...}}` bersifat OPAQUE — isinya tidak pernah dipindai
 *     sebagai markup. Ini melindungi key ber-underscore seperti
 *     `{{custom.ktp_issued_date}}`.
 *  2. Delimiter TANPA PASANGAN menjadi teks literal, bukan dibuang. Dokumen
 *     legal tidak boleh kehilangan satu karakter pun.
 *  3. Pasangan TANPA ISI (`a****b`) juga menjadi teks literal — kalau tidak,
 *     keempat bintang itu hilang tanpa jejak.
 *  4. `_` tunggal BUKAN delimiter; hanya `__` dan `*`. Jadi `snake_case_field`
 *     tidak pernah salah tafsir dan escape tidak perlu menyentuhnya.
 *  5. Tidak ada normalisasi saat simpan. Renderer mem-parse secara lenient dan
 *     validator hanya melaporkan (prinsip PASSTHROUGH — kode tidak mengubah
 *     redaksi yang tersimpan).
 *  6. Mark boleh melintasi `\n`; pemecahan baris dilakukan renderer, bukan di sini.
 *
 * Yang TIDAK ditangani modul ini: perataan (`align`) — itu properti tingkat
 * blok, dibaca langsung oleh renderer dan divalidasi `template-schema.validator`.
 */

/** Jenis mark yang didukung. Sengaja hanya tiga; ukuran/warna font bukan domain admin. */
export type InlineMarkKind = 'bold' | 'italic' | 'underline'

/** Satu potongan teks dengan gaya seragam. Bentuk internal render, bukan bentuk tersimpan. */
export interface InlineRun {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** Delimiter kanonik per jenis mark. */
export const INLINE_MARK_DELIMITERS: Record<InlineMarkKind, string> = {
  bold: '**',
  italic: '*',
  underline: '__',
}

export const INLINE_MARK_KINDS: InlineMarkKind[] = ['bold', 'italic', 'underline']

/** Karakter yang boleh di-escape dengan `\`. */
const ESCAPABLE = '*_\\'

/** Satu unit hasil tokenisasi. */
interface Atom {
  /** Teks yang disumbangkan ke output; `''` untuk delimiter. */
  text: string
  /** Diisi hanya bila atom ini adalah delimiter mark. */
  delimiter?: InlineMarkKind
  /** Bentuk mentah delimiter (dipakai saat delimiter di-demote jadi literal). */
  raw?: string
}

/**
 * Apakah `text` berisi delimiter mark di luar placeholder.
 *
 * Dipakai validator untuk lokasi yang TIDAK boleh bermark (`article.heading`,
 * `list.items[]`, sel `table`). Mark di lokasi itu akan tercetak literal di PDF,
 * jadi lebih baik ditolak daripada dibiarkan diam-diam.
 */
export function containsMarkDelimiters(text: string): boolean {
  if (!text) return false
  return tokenize(text).some(atom => atom.delimiter !== undefined)
}

/**
 * Tokenisasi. Placeholder `{{...}}` diambil utuh sebagai SATU atom teks.
 *
 * Urutan pemeriksaan penting: placeholder lebih dulu, lalu escape, lalu
 * delimiter `**`/`__` (dua karakter) sebelum `*` (satu karakter) — supaya
 * `**bold**` tidak terbaca sebagai dua italic.
 */
function tokenize(text: string): Atom[] {
  const atoms: Atom[] = []
  const src = String(text ?? '')
  let i = 0
  /** Penyangga karakter literal, di-flush agar atom tidak berjumlah satu per karakter. */
  let buffer = ''

  const flush = () => {
    if (buffer) {
      atoms.push({ text: buffer })
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
        atoms.push({ text: src.slice(i, close + 2) })
        i = close + 2
        continue
      }
      // `{{` tanpa penutup: bukan placeholder, jatuh ke teks literal.
    }

    // 2. Escape: `\*` `\_` `\\` -> satu karakter literal.
    if (ch === '\\' && i + 1 < src.length && ESCAPABLE.includes(src[i + 1])) {
      buffer += src[i + 1]
      i += 2
      continue
    }

    // 3. Delimiter dua karakter lebih dulu (longest match).
    if (src.startsWith('**', i)) {
      flush()
      atoms.push({ text: '', delimiter: 'bold', raw: '**' })
      i += 2
      continue
    }
    if (src.startsWith('__', i)) {
      flush()
      atoms.push({ text: '', delimiter: 'underline', raw: '__' })
      i += 2
      continue
    }

    // 4. Delimiter satu karakter: HANYA `*` (italic). `_` tunggal adalah teks
    //    biasa — underline butuh `__`, jadi `snake_case` tidak pernah salah tafsir.
    if (ch === '*') {
      flush()
      atoms.push({ text: '', delimiter: 'italic', raw: '*' })
      i += 1
      continue
    }

    buffer += ch
    i += 1
  }

  flush()
  return atoms
}

/** Rentang pasangan delimiter yang sah. */
interface MarkRange {
  kind: InlineMarkKind
  open: number
  close: number
}

/**
 * Pasangkan delimiter PER JENIS MARK secara independen.
 *
 * Kenapa per jenis (bukan satu tumpukan global): mark boleh bersarang dan
 * tumpang tindih (`**tebal *dan miring***`). Dengan pemasangan per jenis,
 * bold dan italic masing-masing punya pasangannya sendiri dan hasilnya tetap
 * terdefinisi tanpa aturan tumpukan yang rumit.
 *
 * Delimiter ganjil (tidak berpasangan) dikembalikan sebagai indeks agar pemanggil
 * dapat mengembalikannya menjadi teks literal — dokumen legal tidak boleh
 * kehilangan karakter.
 */
function pairDelimiters(atoms: Atom[]): { ranges: MarkRange[], unpaired: number[] } {
  const ranges: MarkRange[] = []
  const unpaired: number[] = []

  for (const kind of INLINE_MARK_KINDS) {
    let open = -1
    for (let i = 0; i < atoms.length; i++) {
      if (atoms[i].delimiter !== kind) continue
      if (open === -1) {
        open = i
      } else {
        ranges.push({ kind, open, close: i })
        open = -1
      }
    }
    // Pembuka tanpa penutup: jangan tebak-tebakan — perlakukan sebagai teks.
    if (open !== -1) unpaired.push(open)
  }

  // Pasangan TANPA isi (mis. `a****b`) bukan mark. Kalau dibiarkan, keempat
  // bintang itu HILANG dari dokumen legal. Penandanya dikembalikan jadi teks.
  const effective: MarkRange[] = []
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

/** Ubah delimiter yang tidak berpasangan kembali menjadi teks literal. */
function demoteUnpaired(atoms: Atom[], unpaired: number[]): Atom[] {
  if (unpaired.length === 0) return atoms
  const set = new Set(unpaired)
  return atoms.map((atom, i) => (set.has(i) ? { text: atom.raw ?? '' } : atom))
}

/**
 * Parse teks menjadi run bergaya.
 *
 * Selalu mengembalikan minimal SATU run (teks kosong menghasilkan satu run
 * kosong), supaya renderer tidak perlu menangani kasus "tanpa run".
 */
export function parseInlineRuns(text: string): InlineRun[] {
  const atoms = tokenize(text)
  const { ranges, unpaired } = pairDelimiters(atoms)
  const resolved = demoteUnpaired(atoms, unpaired)

  // Tandai jenis mark aktif per indeks atom, dari pasangan yang SAH saja.
  const marksPerAtom: Array<Set<InlineMarkKind>> = resolved.map(() => new Set<InlineMarkKind>())
  for (const range of ranges) {
    for (let i = range.open + 1; i < range.close; i++) marksPerAtom[i].add(range.kind)
  }

  const runs: InlineRun[] = []
  for (let i = 0; i < resolved.length; i++) {
    const atom = resolved[i]
    // Delimiter yang berpasangan tidak menyumbang teks.
    if (atom.delimiter !== undefined) continue
    if (atom.text === '') continue

    const marks = marksPerAtom[i]
    const run: InlineRun = {
      text: atom.text,
      bold: marks.has('bold'),
      italic: marks.has('italic'),
      underline: marks.has('underline'),
    }

    const prev = runs[runs.length - 1]
    if (prev && prev.bold === run.bold && prev.italic === run.italic && prev.underline === run.underline) {
      prev.text += run.text
    } else {
      runs.push(run)
    }
  }

  return runs.length > 0 ? runs : [{ text: '', bold: false, italic: false, underline: false }]
}

/**
 * Escape karakter yang bermakna khusus agar tercetak apa adanya.
 *
 * PENTING: `_` tunggal TIDAK di-escape. Parser hanya mengenal `__` sebagai
 * underline, sehingga `snake_case_field` harus keluar utuh — kalau tidak,
 * invariant "teks tanpa mark identik" langsung rusak.
 */
export function escapeInlineMarks(text: string): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/(__)/g, '\\_\\_')
}

/**
 * Serialisasi kanonik run menjadi markup.
 *
 * Dipakai HANYA oleh helper editor (toolbar) untuk membangun string; jalur
 * simpan tidak pernah memanggilnya, sehingga tidak ada normalisasi tersembunyi
 * pada redaksi yang sudah tersimpan.
 */
export function runsToText(runs: InlineRun[]): string {
  let out = ''
  for (const run of runs) {
    if (!run.text) continue
    const body = escapeInlineMarks(run.text)
    const open: string[] = []
    if (run.bold) open.push(INLINE_MARK_DELIMITERS.bold)
    if (run.italic) open.push(INLINE_MARK_DELIMITERS.italic)
    if (run.underline) open.push(INLINE_MARK_DELIMITERS.underline)
    if (open.length === 0) {
      out += body
      continue
    }
    out += open.join('') + body + [...open].reverse().join('')
  }
  return out
}

/** Teks tanpa markup — untuk pengukuran lebar, pencarian placeholder, dan ringkasan kartu. */
export function stripInlineMarks(text: string): string {
  return parseInlineRuns(text).map(run => run.text).join('')
}

/** Apakah ada minimal satu mark aktif. Renderer memakai ini untuk memilih jalur. */
export function hasInlineMarks(text: string): boolean {
  return parseInlineRuns(text).some(run => run.bold || run.italic || run.underline)
}

/** Satu temuan validasi mark. */
export interface InlineMarkIssue {
  severity: 'error' | 'warning'
  kind: 'forbidden' | 'unpaired'
  message: string
}

/**
 * Laporkan masalah mark TANPA melempar.
 *
 * - `allowMarks: false` (mis. `article.heading`, `list.items[]`, sel `table`)
 *   membuat mark **yang benar-benar sah** menjadi **error**. Perhatikan: yang
 *   diperiksa adalah `hasInlineMarks()`, BUKAN `containsMarkDelimiters()` —
 *   tanda `*` tunggal yang tidak berpasangan tetap lolos karena ia tercetak apa
 *   adanya, sehingga template lama yang memuat karakter itu tidak mendadak
 *   gagal publish.
 * - Delimiter tanpa pasangan hanya **warning**: teksnya tetap tampil apa adanya
 *   (aturan 2), jadi tidak ada alasan memblokir publish.
 *
 * `ok` berarti "tidak ada error"; warning tetap dilaporkan di `issues`.
 */
export function validateInlineMarks(
  text: string,
  opts: { allowMarks?: boolean, location?: string } = {},
): { ok: boolean, issues: InlineMarkIssue[] } {
  const issues: InlineMarkIssue[] = []
  const where = opts.location ? ` di ${opts.location}` : ''
  const src = String(text ?? '')

  if (opts.allowMarks === false) {
    if (hasInlineMarks(src)) {
      issues.push({
        severity: 'error',
        kind: 'forbidden',
        message: `Pemformatan teks (**, *, __) tidak didukung${where}. `
          + 'Hapus penanda tersebut; bila dibiarkan, penanda akan tercetak apa adanya.',
      })
    }
    return { ok: issues.length === 0, issues }
  }

  const atoms = tokenize(src)
  const { unpaired } = pairDelimiters(atoms)
  for (const index of unpaired) {
    issues.push({
      severity: 'warning',
      kind: 'unpaired',
      message: `Penanda "${atoms[index].raw}"${where} tidak memiliki pasangan, `
        + 'sehingga dicetak sebagai teks biasa.',
    })
  }

  // `ok` = tidak ada ERROR. Warning (penanda tak berpasangan) tidak memblokir
  // publish karena teksnya tetap tampil apa adanya.
  return { ok: !issues.some(issue => issue.severity === 'error'), issues }
}

