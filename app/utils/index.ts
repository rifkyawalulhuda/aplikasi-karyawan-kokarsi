export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!
}

/**
 * Ambil pesan error yang bisa ditampilkan ke pengguna dari error `$fetch`/`ofetch`.
 *
 * Nuxt proxy (`server/api/**`) meneruskan error backend sebagai `FetchError` dengan
 * properti `data` berisi body backend `{ message, statusCode }`, sehingga
 * `error.data.message` sering hanya berisi string "[POST] \"http://localhost:3001/...\": 400 Bad Request".
 * Helper ini memprioritaskan pesan sebenarnya dari backend.
 */
interface ApiErrorLike {
  data?: { message?: unknown, data?: { message?: unknown } } | null
  response?: { _data?: { message?: unknown, data?: { message?: unknown } } | null } | null
  message?: unknown
}

export function apiErrorMessage(error: unknown, fallback = 'Terjadi kesalahan'): string {
  if (!error) return fallback

  const source = error as ApiErrorLike
  const normalize = (value: unknown): string => {
    if (typeof value === 'string') return value.trim()
    if (Array.isArray(value)) return value.map(item => normalize(item)).filter(Boolean).join(', ')
    return ''
  }

  const candidates: unknown[] = [
    source.data?.data?.message,
    source.data?.message,
    source.response?._data?.data?.message,
    source.response?._data?.message,
    source.message
  ]

  for (const candidate of candidates) {
    const message = normalize(candidate)
    if (!message) continue
    // Tanda paling khas pesan pembungkus h3/ofetch: tidak ada detail selain status HTTP.
    if (/^\[(GET|POST|PUT|PATCH|DELETE)\]\s/m.test(message)) continue
    if (/^\d{3}\s/.test(message)) continue
    return message
  }

  return fallback
}
