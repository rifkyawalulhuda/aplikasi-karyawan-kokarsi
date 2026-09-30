import { BadRequestException } from '@nestjs/common'

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

export interface BlockValidationIssue {
  blockId: string
  message: string
}

/** Placeholder regex: {{path.to.value}} — camelCase diizinkan (employee.fullName) */
export const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g

/** Placeholder custom yang dibuat admin (snake_case): {{custom.nama_field}} */
const CUSTOM_PLACEHOLDER_REGEX = /\{\{\s*custom\.([a-z][a-z0-9_]*)\s*\}\}/g

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
): { placeholderCount: number; blockCount: number } {
  const issues: BlockValidationIssue[] = []
  const validKeys = new Set(fieldKeys)
  let placeholderCount = 0
  let blockCount = 0

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

    blocks.forEach((block: any, idx: number) => {
      const id = String(block?.id ?? `index-${idx}`)
      blockCount += 1

      if (seenIds.has(id)) issues.push({ blockId: id, message: `ID blok duplikat` })
      seenIds.add(id)

      if (!BLOCK_TYPES.includes(block?.type)) {
        issues.push({ blockId: id, message: `Tipe blok "${block?.type}" tidak didukung` })
        return
      }

      if (block.type === 'signature') {
        hasSignature = true
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
            issues.push({ blockId: id, message: `Placeholder "{{${ph}}}" tidak terdaftar di katalog field` })
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

  return { placeholderCount, blockCount }
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
