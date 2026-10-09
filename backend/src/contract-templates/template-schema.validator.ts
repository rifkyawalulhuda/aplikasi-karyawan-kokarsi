import { BadRequestException } from '@nestjs/common'
import { hasInlineMarks, validateInlineMarks } from '../contracts/inline-marks'
import { INLINE_RUN_ALIGN_VALUES, type InlineRunAlign } from '../contracts/inline-run-layout'
import { MAX_BLOCK_SPACE_AFTER, normalizeBlockSpaceAfter } from '../contracts/block-spacing'

/** Tipe blok yang didukung renderer V1 */
export const BLOCK_TYPES = [
  'title',
  'subtitle',
  'paragraph',
  'article',
  'list',
  'table',
  'pageBreak',
  'signature',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const LIST_STYLES = ['bullet', 'numbered', 'alphabetic'] as const
export const TABLE_FORMATS = ['text', 'number', 'currency', 'date'] as const

/**
 * Nilai `align` yang sah untuk properti blok.
 *
 * Dialias ke `INLINE_RUN_ALIGN_VALUES` supaya hanya ada SATU daftar nilai yang
 * sah di seluruh kodebase — pola yang sama dengan `PkwtAlign` dan `MitraAlign`
 * yang juga mengalias `InlineRunAlign`. Bila daftar di renderer berubah, di
 * sini pun ikut berubah tanpa risiko dua daftar menyimpang.
 */
export const BLOCK_ALIGN_VALUES = INLINE_RUN_ALIGN_VALUES
export type BlockAlign = InlineRunAlign

/**
 * Hanya blok ini yang boleh membawa properti `align`.
 *
 * `list` dan `table` punya perataan sendiri per-item/per-kolom, dan
 * `title`/`subtitle`/`signature`/`pageBreak` perataannya milik renderer
 * (judul selalu center, tanda tangan milik layout footer). Menerima `align` di
 * sana hanya akan membuat admin mengira perubahannya berpengaruh.
 */
export const ALIGN_CAPABLE_BLOCKS = ['paragraph', 'article'] as const

/** Normalisasi `block.align`; nilai tak dikenal → `undefined` (perilaku lama). */
export function blockAlign(value: unknown): BlockAlign | undefined {
  return typeof value === 'string' && (BLOCK_ALIGN_VALUES as readonly string[]).includes(value)
    ? (value as BlockAlign)
    : undefined
}

/**
 * Blok konten MITRA yang boleh membawa `spaceAfter` (jarak vertikal tambahan di
 * bawah blok, satuan pt).
 *
 * `pageBreak` dikecualikan karena ia sendiri sudah memaksa halaman baru, dan
 * `signature` dikecualikan karena dirender di luar kotak kolom (footer). Jarak
 * pada keduanya tidak bermakna bagi tata letak.
 */
export const SPACE_CAPABLE_BLOCKS = ['title', 'subtitle', 'paragraph', 'article', 'list', 'table'] as const

/**
 * Blok konten PKWT yang boleh membawa `spaceAfter`.
 *
 * Hanya blok yang BENAR-BENAR mengalir ke kolom: `blocksToPkwtParagraphs`
 * mengubah `paragraph`/`article`/`list` menjadi paragraf ber-kolom, dan `table`
 * menjadi blok tabel ber-border; sedangkan `title`/`subtitle` menjadi kop
 * (chrome). Memberi jarak pada yang tidak dirender hanya akan membuat admin
 * mengira perubahannya berpengaruh.
 */
export const PKWT_SPACE_CAPABLE_BLOCKS = ['paragraph', 'article', 'list', 'table'] as const

/**
 * Blok yang mendukung `spaceAfter` untuk keluarga tertentu.
 *
 * MITRA dan PKWT mengalirkan konten dengan cara berbeda (MITRA mengalirkan blok
 * dua-kolom; PKWT mengunci baris ID/EN per blok), jadi himpunan tipe yang
 * bermakna pun berbeda.
 */
export function spaceCapableBlocks(family: 'MITRA' | 'PKWT'): readonly string[] {
  return family === 'PKWT' ? PKWT_SPACE_CAPABLE_BLOCKS : SPACE_CAPABLE_BLOCKS
}

/**
 * Normalisasi `block.spaceAfter` — dialias ke modul bersama `contracts/block-spacing.ts`
 * supaya validator dan engine tata letak memakai SATU sumber kebenaran.
 */
export { MAX_BLOCK_SPACE_AFTER, normalizeBlockSpaceAfter as blockSpaceAfter } from '../contracts/block-spacing'
export interface BlockValidationIssue {
  blockId: string
  message: string
  /** Lokasi spesifik pada contentDefinition, mis. languages.id[2].text. */
  fieldPath?: string
}

export interface InlineMarkWarning {
  blockId: string
  fieldPath: string
  message: string
}

/** Placeholder regex: {{path.to.value}} — camelCase diizinkan (employee.fullName) */
export const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g

/** Placeholder custom yang dibuat admin (snake_case): {{custom.nama_field}} */
const CUSTOM_PLACEHOLDER_REGEX = /\{\{\s*custom\.([a-z][a-z0-9_]*)\s*\}\}/g

/**
 * Judul pasal (blok `article`) dirancang TEPAT maksimal 2 baris
 * ("PASAL 7\nKEADAAN MEMAKSA"). Batas ini bukan sekadar kosmetik: mesin tata
 * letak MITRA mengukur tinggi judul dengan asumsi 2 baris supaya judul tidak
 * terpisah dari uraiannya. Baris ke-3, baris kosong di atas judul, atau spasi
 * berlebih di ujung akan membuat paginasi salah hitung.
 */
export const MAX_ARTICLE_HEADING_LINES = 2

/** Normalisasi satu judul pasal agar aman bagi tata letak PDF. */
export function normalizeArticleHeading(heading: string): string {
  // Samakan CRLF/CR menjadi LF supaya hitungan baris konsisten.
  const lines = heading
    .replace(/\r\n?/g, '\n')
    .split('\n')
    // Buang spasi/tab berlebih di ujung tiap baris (tidak mengubah redaksi).
    .map(line => line.replace(/[^\S\n]+$/g, ''))
    // Buang baris kosong (mis. dari tempel-teks Word) di posisi mana pun —
    // baris kosong hanya menambah tinggi tanpa isi.
    .filter(line => line.trim() !== '')
    .slice(0, MAX_ARTICLE_HEADING_LINES)

  // Seluruh baris kosong: pertahankan judul kosong (bukan string berisi "\n").
  return lines.length === 0 ? '' : lines.join('\n')
}

/**
 * Normalisasi judul pasal pada SELURUH blok `article`, in-place.
 *
 * Menutup celah yang tidak terjangkau penjagaan tombol Enter di editor:
 * tempel-teks (paste) dari Word/Docs dapat membawa `\n\n` maupun 3+ baris,
 * sehingga judul pasal tersimpan lebih dari 2 baris dan tata letak PDF rusak.
 *
 * @returns jumlah blok yang judulnya benar-benar berubah.
 */
export function normalizeArticleHeadings(content: any): number {
  let changed = 0
  const languages = content?.languages
  if (!languages || typeof languages !== 'object') return 0
  for (const lang of Object.keys(languages)) {
    const blocks = languages[lang]
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      if (!block || typeof block !== 'object' || block.type !== 'article') continue
      if (typeof block.heading !== 'string') continue
      const normalized = normalizeArticleHeading(block.heading)
      if (normalized !== block.heading) {
        block.heading = normalized
        changed += 1
      }
    }
  }
  return changed
}

/** Kumpulkan semua placeholder unik dari teks. */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(PLACEHOLDER_REGEX.source, 'g')
  while ((m = re.exec(text)) !== null) {
    found.add(m[1])
  }
  return [...found]
}

/** Placeholder yang terbuka/tidak valid, mis. {{abc (tanpa tutup) atau {{a b}} (spasi di dalam). */
export function findBrokenPlaceholders(text: string): boolean {
  // {{ tanpa }} sama sekali di string
  if (/\{\{(?:(?!\}\}).)*$/.test(text)) return true
  // ada {{...}} yang TIDAK cocok dengan pola placeholder valid
  const re = /\{\{([^}]*)\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const inner = m[1].trim()
    const isValid =
      /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(inner) ||
      /^custom\.[a-z][a-z0-9_]*$/.test(inner)
    if (!isValid) return true
  }
  return false
}

/**
 * Validasi contentDefinition sebelum publish.
 * fieldKeys = daftar key field yang valid (dari katalog + snapshot).
 * throws BadRequestException dengan detail issues jika invalid.
 */
export function validateContentDefinition(
  content: any,
  fieldKeys: string[],
  family: 'MITRA' | 'PKWT',
): {
  placeholderCount: number
  blockCount: number
  markedBlockCount: number
  alignedBlockCount: number
  spacedBlockCount: number
  inlineMarkWarnings: InlineMarkWarning[]
} {
  const issues: BlockValidationIssue[] = []
  const inlineMarkWarnings: InlineMarkWarning[] = []
  const validKeys = new Set(fieldKeys)
  let placeholderCount = 0
  let blockCount = 0
  let markedBlockCount = 0
  let alignedBlockCount = 0
  let spacedBlockCount = 0

  const validateText = (blockId: string, text: string, fieldPath: string, allowMarks: boolean): boolean => {
    const result = validateInlineMarks(text, { allowMarks, location: fieldPath })
    for (const markIssue of result.issues) {
      if (markIssue.severity === 'error') {
        issues.push({ blockId, fieldPath, message: markIssue.message })
      } else {
        inlineMarkWarnings.push({ blockId, fieldPath, message: markIssue.message })
      }
    }
    return allowMarks && hasInlineMarks(text)
  }

  const validateAlign = (block: any, id: string, fieldPath: string) => {
    if (block.align === undefined) return
    if (blockAlign(block.align) === undefined) {
      issues.push({ blockId: id, fieldPath, message: `Nilai align "${String(block.align)}" tidak valid. Gunakan left, center, right, atau justify.` })
      return
    }
    if (!(ALIGN_CAPABLE_BLOCKS as readonly string[]).includes(block.type)) {
      issues.push({ blockId: id, fieldPath, message: `Properti align tidak didukung pada blok ${block.type}. Hanya paragraph dan article yang dapat diratakan.` })
      return
    }
    alignedBlockCount += 1
  }

  /**
   * `headingAlign` (khusus blok `article`): perataan judul pasal yang LEPAS
   * dari `align` blok, sehingga admin bisa menengahkan HANYA judul "PASAL 1"
   * tanpa menggeser perataan uraian. Nilai sah sama dengan `align`.
   */
  const validateHeadingAlign = (block: any, id: string, fieldPath: string) => {
    if (block.headingAlign === undefined) return
    if (blockAlign(block.headingAlign) === undefined) {
      issues.push({ blockId: id, fieldPath, message: `Nilai headingAlign "${String(block.headingAlign)}" tidak valid. Gunakan left, center, right, atau justify.` })
      return
    }
    if (block.type !== 'article') {
      issues.push({ blockId: id, fieldPath, message: `Properti headingAlign hanya didukung pada blok article (judul pasal).` })
    }
  }

  /**
   * `spaceAfter`: jarak vertikal TAMBAHAN di bawah blok, di atas jarak bawaan
   * renderer. Hanya blok konten yang benar-benar mengalir ke dokumen — himpunan
   * tipe berbeda per keluarga (`spaceCapableBlocks`).
   */
  const validateSpaceAfter = (block: any, id: string, fieldPath: string) => {
    if (block.spaceAfter === undefined) return
    if (normalizeBlockSpaceAfter(block.spaceAfter) === undefined) {
      issues.push({
        blockId: id,
        fieldPath,
        message: `Nilai spaceAfter "${String(block.spaceAfter)}" tidak valid. Gunakan bilangan bulat 0–${MAX_BLOCK_SPACE_AFTER} (pt).`,
      })
      return
    }
    if (!spaceCapableBlocks(family).includes(block.type)) {
      issues.push({
        blockId: id,
        fieldPath,
        message: `Properti spaceAfter tidak didukung pada blok ${block.type} untuk template ${family}.`,
      })
      return
    }
    spacedBlockCount += 1
  }

  if (!content || typeof content !== 'object' || !content.languages) {
    throw new BadRequestException('contentDefinition harus memiliki struktur { languages: { id: [], en: [] } }')
  }

  const langs: string[] = family === 'PKWT' ? ['id', 'en'] : ['id']
  for (const lang of langs) {
    const blocks = content.languages?.[lang]
    if (!Array.isArray(blocks) || blocks.length === 0) {
      throw new BadRequestException(`Bahasa "${lang}" harus memiliki minimal satu blok`)
    }

    const seenIds = new Set<string>()
    let hasSignature = false
    let hasContent = false
    /** Hitung blok signature: hanya SATU yang diizinkan per bahasa. */
    let signatureCount = 0

    blocks.forEach((block: any, idx: number) => {
      const id = String(block?.id ?? `index-${idx}`)
      blockCount += 1

      if (seenIds.has(id)) issues.push({ blockId: id, message: `ID blok duplikat` })
      seenIds.add(id)

      if (!BLOCK_TYPES.includes(block?.type)) {
        issues.push({ blockId: id, message: `Tipe blok "${block?.type}" tidak didukung` })
        return
      }

      const blockPath = `languages.${lang}[${idx}]`
      validateAlign(block, id, `${blockPath}.align`)
      validateHeadingAlign(block, id, `${blockPath}.headingAlign`)
      validateSpaceAfter(block, id, `${blockPath}.spaceAfter`)
      let blockHasInlineMarks = false

      if (block.type === 'signature' || block.type === 'pageBreak') {
        for (const [key, value] of Object.entries(block)) {
          if (typeof value === 'string') validateText(id, value, `${blockPath}.${key}`, false)
        }
      }

      if ((block.type === 'title' || block.type === 'subtitle') && typeof block.text === 'string') {
        validateText(id, block.text, `${blockPath}.text`, false)
      }

      if (block.type === 'article' && typeof block.heading === 'string') {
        validateText(id, block.heading, `${blockPath}.heading`, false)
      }
      if (block.type === 'list' && Array.isArray(block.items)) {
        for (const [itemIndex, item] of block.items.entries()) {
          const text = typeof item === 'string' ? item : item?.text
          const itemPath = `${blockPath}.items[${itemIndex}]${typeof item === 'string' ? '' : '.text'}`
          if (typeof text === 'string') validateText(id, text, itemPath, false)
        }
      }
      if (block.type === 'table') {
        for (const [columnIndex, column] of (block.columns ?? []).entries()) {
          if (typeof column?.label === 'string') {
            validateText(id, column.label, `${blockPath}.columns[${columnIndex}].label`, false)
          }
        }
        for (const [rowIndex, row] of (block.rows ?? []).entries()) {
          for (const [key, value] of Object.entries(row ?? {})) {
            if (typeof value === 'string') validateText(id, value, `${blockPath}.rows[${rowIndex}].${key}`, false)
          }
        }
      }
      if (block.type === 'paragraph' && typeof block.text === 'string') {
        blockHasInlineMarks = validateText(id, block.text, `${blockPath}.text`, true) || blockHasInlineMarks
      }
      if (block.type === 'article') {
        for (const [paragraphIndex, paragraph] of (block.paragraphs ?? []).entries()) {
          if (typeof paragraph === 'string') {
            blockHasInlineMarks = validateText(id, paragraph, `${blockPath}.paragraphs[${paragraphIndex}]`, true) || blockHasInlineMarks
          }
        }
      }
      if (blockHasInlineMarks) markedBlockCount += 1

      if (block.type === 'signature') {
        hasSignature = true
        signatureCount += 1
        if (signatureCount > 1) {
          issues.push({
            blockId: id,
            message: 'Hanya satu blok tanda tangan yang diizinkan. Hapus blok tanda tangan duplikat.',
          })
        }
        return
      }

      switch (block.type) {
        case 'title':
        case 'subtitle':
          if (typeof block.text !== 'string' || block.text.trim().length === 0) {
            issues.push({ blockId: id, message: 'Blok title/subtitle memerlukan field text' })
          }
          hasContent = hasContent || true
          break

        case 'paragraph':
          if (typeof block.text !== 'string' || block.text.trim().length === 0) {
            issues.push({ blockId: id, message: 'Blok paragraph memerlukan field text' })
          }
          hasContent = true
          break

        case 'article':
          if (typeof block.heading !== 'string' || block.heading.trim().length === 0) {
            issues.push({ blockId: id, message: 'Blok article memerlukan heading' })
          }
          if (!Array.isArray(block.paragraphs) || block.paragraphs.length === 0) {
            issues.push({ blockId: id, message: 'Blok article memerlukan minimal satu paragraf' })
          }
          hasContent = true
          break

        case 'list': {
          if (!LIST_STYLES.includes(block.style)) {
            issues.push({ blockId: id, message: `List style "${block.style}" tidak valid` })
          }
          if (!Array.isArray(block.items) || block.items.length === 0) {
            issues.push({ blockId: id, message: 'List memerlukan minimal satu item' })
            break
          }
          for (const item of block.items) {
            const text = typeof item === 'string' ? item : item?.text
            if (typeof text !== 'string' || text.trim().length === 0) {
              issues.push({ blockId: id, message: 'Item list tidak boleh kosong' })
            }
          }
          hasContent = true
          break
        }

        case 'table': {
          if (!Array.isArray(block.columns) || block.columns.length === 0) {
            issues.push({ blockId: id, message: 'Table memerlukan minimal satu kolom' })
            break
          }
          const colKeys = new Set<string>()
          for (const col of block.columns) {
            if (!col?.key || typeof col.label !== 'string') {
              issues.push({ blockId: id, message: 'Setiap kolom table memerlukan key dan label' })
              continue
            }
            if (colKeys.has(col.key)) {
              issues.push({ blockId: id, message: `Kolom duplikat: ${col.key}` })
            }
            colKeys.add(col.key)
            if (col.format && !TABLE_FORMATS.includes(col.format)) {
              issues.push({ blockId: id, message: `Format kolom "${col.format}" tidak valid` })
            }
          }
          if (!Array.isArray(block.rows) || block.rows.length === 0) {
            issues.push({ blockId: id, message: 'Table memerlukan minimal satu baris' })
            break
          }
          for (const row of block.rows) {
            for (const key of Object.keys(row ?? {})) {
              if (!colKeys.has(key)) {
                issues.push({ blockId: id, message: `Baris memiliki key kolom tidak dikenal: ${key}` })
              }
            }
          }
          hasContent = true
          break
        }

        case 'pageBreak':
          break

        default:
          break
      }

      // Placeholder validation pada teks block
      const texts: string[] = []
      if (typeof block.text === 'string') texts.push(block.text)
      if (typeof block.heading === 'string') texts.push(block.heading)
      if (Array.isArray(block.paragraphs)) texts.push(...block.paragraphs.filter((p: any) => typeof p === 'string'))
      if (Array.isArray(block.items)) {
        for (const item of block.items) texts.push(typeof item === 'string' ? item : (item?.text ?? ''))
      }
      if (Array.isArray(block.rows)) {
        for (const row of block.rows) {
          for (const v of Object.values(row ?? {})) {
            if (typeof v === 'string') texts.push(v)
          }
        }
      }
      for (const t of texts) {
        if (findBrokenPlaceholders(t)) {
          issues.push({ blockId: id, message: 'Placeholder tidak valid (sintaks {{...}} rusak)' })
        }
        for (const ph of extractPlaceholders(t)) {
          placeholderCount += 1
          if (!validKeys.has(ph)) {
            issues.push({
              blockId: id,
              message: `Placeholder "{{${ph}}}" tidak terdaftar di katalog field. `
                + 'Hapus placeholder ini, atau aktifkan field-nya untuk template ini lewat "Kelola" pada panel Field dinamis.',
            })
          }
        }
      }
    })

    if (!hasContent) {
      issues.push({ blockId: '-', message: `Bahasa "${lang}" tidak memiliki konten` })
    }
    if (!hasSignature) {
      issues.push({ blockId: '-', message: `Bahasa "${lang}" harus memiliki blok signature` })
    }
  }

  if (issues.length > 0) {
    const summary = issues.slice(0, 5).map(i => `[${i.blockId}] ${i.message}`).join('; ')
    const error: any = new BadRequestException(
      `Validasi template gagal (${issues.length} masalah): ${summary}`,
    )
    error.issues = issues
    throw error
  }

  return { placeholderCount, blockCount, markedBlockCount, alignedBlockCount, spacedBlockCount, inlineMarkWarnings }
}

/** Ambil semua placeholder dari contentDefinition (untuk matching dengan fieldDefinitions). */
export function collectAllPlaceholders(content: any): string[] {
  const out = new Set<string>()
  const langs = ['id', 'en']
  for (const lang of langs) {
    const blocks = content?.languages?.[lang]
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      const texts: string[] = []
      if (typeof block.text === 'string') texts.push(block.text)
      if (typeof block.heading === 'string') texts.push(block.heading)
      if (Array.isArray(block.paragraphs)) texts.push(...block.paragraphs.filter((p: any) => typeof p === 'string'))
      if (Array.isArray(block.items)) {
        for (const item of block.items) texts.push(typeof item === 'string' ? item : (item?.text ?? ''))
      }
      if (Array.isArray(block.rows)) {
        for (const row of block.rows) {
          for (const v of Object.values(row ?? {})) {
            if (typeof v === 'string') texts.push(v)
          }
        }
      }
      for (const t of texts) {
        for (const ph of extractPlaceholders(t)) out.add(ph)
      }
    }
  }
  return [...out]
}

/**
 * Perbaiki placeholder field dinamis yang ditulis TANPA prefix `custom.`.
 *
 * Editor lama menyisipkan `{{ktp_issued_date}}` (key mentah field
 * `CONTRACT_INPUT`), padahal sintaks yang sah adalah `{{custom.ktp_issued_date}}`.
 * Placeholder tanpa prefix ditolak validator ("sintaks {{...}} rusak") dan tidak
 * pernah ter-resolve, sehingga publish gagal.
 *
 * Fungsi ini MENYELARASKAN konten secara in-place: hanya key yang benar-benar
 * ada di `customKeys` (= daftar field CONTRACT_INPUT katalog) yang diberi prefix,
 * jadi tidak ada teks lain yang ikut berubah.
 *
 * @returns jumlah placeholder yang diperbaiki.
 */
export function normalizeCustomPlaceholders(content: any, customKeys: Iterable<string>): number {
  const keys = new Set<string>()
  for (const k of customKeys) keys.add(String(k).replace(/^custom\./, ''))
  if (keys.size === 0) return 0

  let fixed = 0
  const fixText = (text: string): string =>
    text.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (whole, inner: string) => {
      if (!keys.has(inner)) return whole
      fixed += 1
      return `{{custom.${inner}}}`
    })

  const languages = content?.languages
  if (!languages || typeof languages !== 'object') return 0
  for (const lang of Object.keys(languages)) {
    const blocks = languages[lang]
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue
      if (typeof block.text === 'string') block.text = fixText(block.text)
      if (typeof block.heading === 'string') block.heading = fixText(block.heading)
      if (Array.isArray(block.paragraphs)) {
        block.paragraphs = block.paragraphs.map((p: any) => (typeof p === 'string' ? fixText(p) : p))
      }
      if (Array.isArray(block.items)) {
        block.items = block.items.map((it: any) =>
          typeof it === 'string' ? fixText(it) : (it && typeof it === 'object' && typeof it.text === 'string' ? { ...it, text: fixText(it.text) } : it),
        )
      }
      if (Array.isArray(block.rows)) {
        block.rows = block.rows.map((row: any) => {
          if (!row || typeof row !== 'object') return row
          const out: Record<string, unknown> = { ...row }
          for (const [k, v] of Object.entries(row)) {
            if (typeof v === 'string') out[k] = fixText(v)
          }
          return out
        })
      }
    }
  }
  return fixed
}
