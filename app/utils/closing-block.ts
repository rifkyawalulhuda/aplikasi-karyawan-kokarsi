/**
 * Blok "Penutup" (tempat/tanggal + organisasi) — SISI FRONTEND.
 *
 * Blok ini dicetak SEKALI di luar kotak kolom, tetapi harus TERLIHAT di kedua
 * tab bahasa (Indonesia & English) karena admin perlu menemukannya di mana pun
 * ia sedang mengedit. Backend tetap satu-satunya yang menentukan hasil PDF
 * (`resolveClosingLines` di `pkwt-document.renderer.ts`): ia memakai blok kolom
 * ID lebih dulu, lalu jatuh ke EN.
 *
 * Karena itu salinan di kedua bahasa harus SELALU identik (id, teks, dan
 * `fieldSpacing`). Modul ini murni (tanpa Vue/DOM) supaya mudah diuji dan
 * dipakai baik saat memuat versi, menambah blok, mengedit teks, maupun
 * menghapusnya.
 */

export const CLOSING_BLOCK_TYPE = 'closing'

/** Bentuk minimal blok yang dibaca/ditulis helper ini. */
export interface ClosingBlockLike {
  id?: string
  type?: string
  text?: string
  [key: string]: unknown
}

/** Bahasa yang mungkin ada di `contentDefinition.languages`. */
type Languages = Record<string, unknown[]>

/** Cari blok penutup pertama pada satu daftar blok. */
export function findClosingBlock(blocks: unknown[] | undefined): ClosingBlockLike | undefined {
  if (!Array.isArray(blocks)) return undefined
  return blocks.find((block): block is ClosingBlockLike =>
    !!block && typeof block === 'object' && (block as ClosingBlockLike).type === CLOSING_BLOCK_TYPE
  )
}

/**
 * Salin blok penutup dari `sourceLang` ke SELURUH bahasa lain.
 *
 * Aturan:
 *  - Sumber = blok penutup di `sourceLang`; bila tidak ada, bahasa pertama yang
 *    memilikinya (urutan `Object.keys`) dipakai supaya blok yang telanjur hanya
 *    ada di EN tetap menyebar ke ID.
 *  - Salinan memakai `id` dan `text` yang SAMA. `id` yang sama penting: daftar
 *    blok memakai `id` sebagai key Vue, dan menyamakannya membuat blok terasa
 *    sebagai satu entitas di kedua tab.
 *  - `fieldSpacing` ikut disalin: hanya SATU blok penutup yang dicetak, jadi
 *    jarak yang diatur di tab mana pun harus terasa di PDF. Tanpa ini, mengatur
 *    jarak di tab English tidak berpengaruh karena renderer memakai blok ID.
 *  - Salinan baru disisipkan TEPAT SEBELUM blok `signature` (kalau ada) agar
 *    urutannya tetap masuk akal di daftar; tanpa signature, ditambahkan di akhir.
 *  - Blok penutup duplikat dalam satu bahasa dibuang, menyisakan yang pertama.
 *
 * @returns jumlah bahasa yang isinya berubah (0 = sudah sinkron).
 */
export function syncClosingBlockLanguages(languages: Languages | undefined, sourceLang = 'id'): number {
  if (!languages || typeof languages !== 'object') return 0

  const codes = Object.keys(languages)
  if (codes.length === 0) return 0

  const sourceBlocks = languages[sourceLang]
  let source = findClosingBlock(sourceBlocks)
  if (!source) {
    for (const code of codes) {
      source = findClosingBlock(languages[code])
      if (source) break
    }
  }
  if (!source) return 0

  const id = typeof source.id === 'string' && source.id
    ? source.id
    : `closing-${Date.now().toString(36)}`
  // Pastikan blok SUMBER juga punya id: id dipakai sebagai key Vue dan oleh
  // penyaring "blok rusak" di editor. Data lama tanpa id akan dinormalkan di
  // sini, bukan dibiarkan tersembunyi.
  if (source.id !== id) source.id = id
  const text = typeof source.text === 'string' ? source.text : ''
  // `undefined` = perilaku bawaan; dibedakan dari `0` (rapat eksplisit).
  const fieldSpacing = source.fieldSpacing

  let changed = 0
  for (const code of codes) {
    const blocks = languages[code]
    if (!Array.isArray(blocks)) continue

    // Buang duplikat lebih dulu: dua blok penutup dalam satu bahasa ditolak
    // validator dan membingungkan di editor.
    let kept: ClosingBlockLike | undefined
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i] as ClosingBlockLike | null
      if (!block || typeof block !== 'object' || block.type !== CLOSING_BLOCK_TYPE) continue
      if (!kept) {
        kept = block
        continue
      }
      blocks.splice(i, 1)
      changed += 1
    }

    if (!kept) {
      const copy: ClosingBlockLike = {
        ...source,
        type: CLOSING_BLOCK_TYPE,
        text,
        id
      }
      const signatureIndex = blocks.findIndex(block =>
        !!block && typeof block === 'object' && (block as ClosingBlockLike).type === 'signature'
      )
      if (signatureIndex >= 0) blocks.splice(signatureIndex, 0, copy)
      else blocks.push(copy)
      changed += 1
      continue
    }

    const idChanged = kept.id !== id
    const textChanged = kept.text !== text
    const spacingChanged = kept.fieldSpacing !== fieldSpacing
    if (idChanged || textChanged || spacingChanged) {
      kept.id = id
      kept.text = text
      if (fieldSpacing === undefined) delete kept.fieldSpacing
      else kept.fieldSpacing = fieldSpacing
      changed += 1
    }
  }

  return changed
}

/**
 * Hapus blok penutup dari SELURUH bahasa.
 *
 * Dipakai saat admin menghapus blok di salah satu tab: kalau hanya tab aktif
 * yang dibersihkan, salinan di bahasa lain akan muncul kembali (dan membuat
 * admin mengira penghapusan gagal).
 *
 * @returns jumlah blok yang benar-benar dihapus.
 */
export function removeClosingBlockEverywhere(languages: Languages | undefined): number {
  if (!languages || typeof languages !== 'object') return 0
  let removed = 0
  for (const code of Object.keys(languages)) {
    const blocks = languages[code]
    if (!Array.isArray(blocks)) continue
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i] as ClosingBlockLike | null
      if (!block || typeof block !== 'object' || block.type !== CLOSING_BLOCK_TYPE) continue
      blocks.splice(i, 1)
      removed += 1
    }
  }
  return removed
}
