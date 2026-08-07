import type { Ref, ComputedRef } from 'vue'

interface DocStats {
  wordCount: ComputedRef<number>
  charCount: ComputedRef<number>
}

/**
 * Menghitung word count dan character count dari konten ProseMirror JSON.
 * @param contentRef - Ref berisi JSON string konten editor
 */
export function useDocStats(contentRef: Ref<string>): DocStats {
  /**
   * Ekstrak semua teks dari struktur ProseMirror JSON secara rekursif.
   */
  function extractText(node: any): string {
    if (!node) return ''

    // Node text langsung
    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text
    }

    // Rekursif ke children
    if (Array.isArray(node.content)) {
      return node.content.map(extractText).join(' ')
    }

    return ''
  }

  const wordCount = computed(() => {
    const raw = contentRef.value
    if (!raw || !raw.trim()) return 0

    let text = ''

    // Coba parse sebagai JSON (ProseMirror format)
    try {
      const parsed = JSON.parse(raw)
      text = extractText(parsed)
    } catch {
      // Fallback: treat as plain text
      text = raw
    }

    const trimmed = text.trim()
    if (!trimmed) return 0

    // Split by whitespace, filter empty strings
    return trimmed.split(/\s+/).filter(Boolean).length
  })

  const charCount = computed(() => {
    const raw = contentRef.value
    if (!raw || !raw.trim()) return 0

    let text = ''

    try {
      const parsed = JSON.parse(raw)
      text = extractText(parsed)
    } catch {
      text = raw
    }

    // Count tanpa leading/trailing whitespace, tapi termasuk whitespace di tengah
    return text.trim().length
  })

  return {
    wordCount,
    charCount,
  }
}
