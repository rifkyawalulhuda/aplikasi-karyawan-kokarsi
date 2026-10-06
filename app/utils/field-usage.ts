/**
 * Pencarian pemakaian Field Dinamis di dalam blok-blok contentDefinition.
 *
 * Mengapa modul terpisah (bukan langsung di `TemplateContentModal.vue`):
 * `app/` tidak punya infrastruktur tes sama sekali (tanpa Vitest/Jest, tanpa
 * spec). Dengan menaruh logika pemindaian sebagai fungsi murni di sini, bagian
 * yang paling mudah salah — normalisasi prefix `custom.` dan penguraian path
 * sub-bagian — bisa diuji tanpa merender komponen.
 *
 * Sumber kebenaran pemindaian adalah objek blok dari editor (`blocks.value`),
 * yaitu `draft ?? versi terpilih`. Sengaja TIDAK memakai `usedInContent` dari
 * backend karena `listTemplateBindings()` membaca versi PUBLISHED lebih dulu
 * (`template-fields.service.ts:226`), sehingga basi saat pengguna mengedit
 * draft — dan bernilai salah di mode baca yang memilih versi PUBLISHED.
 */

/** Satu kemunculan field di dalam sebuah blok. */
export interface FieldUsageOccurrence {
  /** `block.id` dari contentDefinition — dipakai untuk auto-expand blok. */
  blockId: string
  /** Indeks blok (0-based). */
  blockIndex: number
  /** Key field yang dipakai, SUDAH dinormalisasi (prefix `custom.` dibuang). */
  key: string
  /** Path sub-bagian mentah, mis. `art:2`, `item:0`, `row:1:0`, atau `null`. */
  path: string | null
  /** Label sub-bagian untuk pengguna, mis. "paragraf 3". */
  locationLabel: string
  /** Teks sumber tempat placeholder ditemukan (untuk kutipan/konteks). */
  text: string
}

/** Hasil pemindaian untuk seluruh blok. */
export interface FieldUsageScan {
  /** Seluruh kemunculan, urut sesuai urutan blok lalu urutan isi. */
  occurrences: FieldUsageOccurrence[]
  /** Peta key dinormalisasi → kemunculan, untuk pencarian O(1). */
  byKey: Map<string, FieldUsageOccurrence[]>
  /** Bentuk placeholder yang terlihat di konten tetapi ditolak validator. */
  malformed: FieldUsageOccurrence[]
}

/**
 * Bentuk placeholder yang sah: `{{a.b}}` / `{{single}}`.
 *
 * Sengaja meniru pola placeholder backend (`template-schema.validator.ts`)
 * supaya daftar "rusak" di editor sepakat dengan penolakan saat publish.
 */
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)?)\s*\}\}/g

/** Placeholder `{{...}}` apa pun, untuk mendeteksi sintaks yang rusak. */
const ANY_MUSTACHE_RE = /\{\{([^{}]*)\}\}/g

/**
 * Bentuk blok `contentDefinition` yang benar-benar dipindai.
 *
 * Sengaja longgar (bukan tipe ketat per jenis blok) karena bentuknya berbeda
 * antar tipe (`paragraphs`/`items`/`rows`/`columns`) dan satu blok bisa membawa
 * lebih dari satu kunci. `[k: string]: unknown` menjaga akses properti tetap
 * type-safe tanpa perlu `any`.
 */
interface BlockLike {
  id?: string
  type?: string
  text?: string
  heading?: string
  paragraphs?: unknown[]
  items?: unknown[]
  columns?: Array<{ key?: string, label?: string }>
  rows?: Array<Record<string, unknown>>
  /** Jarak vertikal tambahan di bawah blok (pt) — khusus MITRA. */
  spaceAfter?: number
  [key: string]: unknown
}

export type { BlockLike }

/**
 * Apakah field ini termasuk "Field Dinamis".
 *
 * Field dinamis = `sourceType === 'CONTRACT_INPUT'`: satu-satunya jenis yang
 * disimpan TANPA prefix `custom.` di katalog, tetapi muncul DENGAN prefix di
 * konten (lihat `fieldPlaceholderKey()` di `TemplateContentModal.vue`).
 */
export function isDynamicField(field: { sourceType?: unknown } | null | undefined): boolean {
  return field?.sourceType === 'CONTRACT_INPUT'
}

/**
 * Buang prefix `custom.` agar key konten (`custom.ktp_issued_date`) dapat
 * dicocokkan dengan key katalog (`ktp_issued_date`) dan sebaliknya.
 *
 * Tanpa normalisasi ini, pencarian SELALU melaporkan 0 hasil meski field jelas
 * dipakai — karena katalog menyimpan key tanpa prefix.
 */
export function normalizeFieldKey(key: unknown): string {
  return String(key ?? '').trim().replace(/^custom\./, '')
}

/** Label sub-bagian yang ramah pengguna, meniru gaya `focusedLocationLabel`. */
export function locationLabelFor(path: string | null, blockType?: string): string {
  if (!path) {
    if (blockType === 'article') return 'paragraf 1'
    if (blockType === 'list') return 'poin 1'
    if (blockType === 'table') return 'sel pertama'
    return 'isi blok'
  }
  const parts = path.split(':')
  const n = Number(parts[parts.length - 1])
  if (path.startsWith('art:')) return `paragraf ${Number.isInteger(n) ? n + 1 : 1}`
  if (path.startsWith('item:')) return `poin ${Number.isInteger(n) ? n + 1 : 1}`
  if (path.startsWith('row:')) return `sel tabel (baris ${Number(parts[1]) + 1})`
  if (path.startsWith('head:')) return 'judul pasal'
  if (path.startsWith('col:')) return 'judul kolom'
  return 'isi blok'
}

/** Kumpulkan pasangan (path, teks) dari sebuah blok, menurut jenisnya. */
export function textsOfBlock(block: BlockLike | null | undefined): Array<{ path: string | null, text: string }> {
  const out: Array<{ path: string | null, text: string }> = []
  const push = (path: string | null, value: unknown) => {
    if (typeof value === 'string' && value) out.push({ path, text: value })
  }
  // Blok teks tunggal (`paragraph`/`title`/`subtitle`) memakai `text`; blok
  // `article` memakai `heading`. Teks pada blok `signature` tetap dipindai agar
  // placeholder warisan tidak hilang diam-diam (publish tetap akan menolaknya).
  push(null, block?.text)
  push(block?.type === 'article' ? 'head:0' : null, block?.heading)
  if (Array.isArray(block?.paragraphs)) {
    block.paragraphs.forEach((p, i) => push(`art:${i}`, p))
  }
  if (Array.isArray(block?.items)) {
    // Item daftar bisa berupa string (bentuk lama) atau objek `{ text }`
    // (bentuk ber-`items` dengan metadata) — lihat `collectAllPlaceholders()`
    // backend yang juga menerima keduanya.
    block.items.forEach((item, i) => {
      if (typeof item === 'string') {
        push(`item:${i}`, item)
        return
      }
      const text = (item as { text?: unknown } | null | undefined)?.text
      if (typeof text === 'string') push(`item:${i}`, text)
    })
  }
  if (Array.isArray(block?.columns)) {
    block.columns.forEach((c, i) => push(`col:${i}`, c?.label))
  }
  if (Array.isArray(block?.rows)) {
    block.rows.forEach((row, r) => {
      // Urutan kunci mengikuti `columns` supaya indeks kolom stabil, sama
      // seperti yang dipakai editor saat menyisipkan (`row:<r>:<c>`).
      const keys = Array.isArray(block?.columns) && block.columns.length
        ? block.columns.map(c => c?.key).filter((k): k is string => typeof k === 'string')
        : Object.keys(row ?? {})
      keys.forEach((k, c) => push(`row:${r}:${c}`, row?.[k]))
    })
  }
  return out
}

/**
 * Pindai blok dan temukan setiap field yang dipakai beserta lokasinya.
 *
 * @param blocks daftar blok bahasa aktif (`contentDefinition.languages[lang]`).
 */
export function scanFieldUsage(blocks: readonly BlockLike[] | null | undefined): FieldUsageScan {
  const occurrences: FieldUsageOccurrence[] = []
  const malformed: FieldUsageOccurrence[] = []

  ;(blocks ?? []).forEach((block, blockIndex) => {
    const blockId = String(block?.id ?? `__index_${blockIndex}`)
    for (const { path, text } of textsOfBlock(block)) {
      const validSpans: Array<[number, number]> = []
      PLACEHOLDER_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
        validSpans.push([m.index, m.index + m[0].length])
        occurrences.push({
          blockId,
          blockIndex,
          key: normalizeFieldKey(m[1]),
          path,
          locationLabel: locationLabelFor(path, block?.type),
          text
        })
      }
      // Placeholder bersintaks rusak (mis. `{{ktp_issued_date.x.y}}`) tetap
      // dilaporkan agar tidak tersembunyi — publish akan menolaknya, jadi
      // menyembunyikannya dari pencarian hanya menunda kegagalan.
      ANY_MUSTACHE_RE.lastIndex = 0
      while ((m = ANY_MUSTACHE_RE.exec(text)) !== null) {
        const start = m.index
        const end = start + m[0].length
        const insideValid = validSpans.some(([s, e]) => start >= s && end <= e)
        if (insideValid) continue
        malformed.push({
          blockId,
          blockIndex,
          key: normalizeFieldKey(m[1]).trim(),
          path,
          locationLabel: locationLabelFor(path, block?.type),
          text
        })
      }
    }
  })

  const byKey = new Map<string, FieldUsageOccurrence[]>()
  for (const occurrence of occurrences) {
    const list = byKey.get(occurrence.key) ?? []
    list.push(occurrence)
    byKey.set(occurrence.key, list)
  }

  return { occurrences, byKey, malformed }
}

/**
 * Ringkas lokasi blok unik untuk ditampilkan sebagai chip "Blok N".
 *
 * @returns daftar `{ blockIndex, count }` terurut menaik menurut nomor blok.
 */
export function uniqueBlockLabels(
  occurrences: readonly FieldUsageOccurrence[]
): Array<{ blockIndex: number, count: number }> {
  const map = new Map<number, number>()
  for (const occurrence of occurrences) {
    map.set(occurrence.blockIndex, (map.get(occurrence.blockIndex) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([blockIndex, count]) => ({ blockIndex, count }))
    .sort((a, b) => a.blockIndex - b.blockIndex)
}
