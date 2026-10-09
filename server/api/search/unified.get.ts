import { defineEventHandler, getCookie, getHeader, getQuery } from 'h3'

/**
 * Proxy pencarian global terpadu.
 *
 * Menggantikan fan-out 9 request di `/api/search` dengan SATU panggilan ke
 * `${BACKEND}/search` yang sudah di-ranking & dipotong per kategori. Endpoint
 * lama tetap ada untuk kompatibilitas.
 *
 * `limit` = jumlah item per kategori (5 → 15 → 30 → 50 dari tombol "muat lebih
 * banyak" di command palette).
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
    : {}

  const { q, limit } = getQuery(event)
  const query = String(q ?? '').trim()
  const perCategory = limit ? String(limit) : '5'

  if (query.length < 2) {
    return { q: query, limit: Number(perCategory), categories: {} }
  }

  return $fetch(`${BACKEND}/search`, {
    headers: authHeader,
    query: { q: query, limit: perCategory },
  })
})
