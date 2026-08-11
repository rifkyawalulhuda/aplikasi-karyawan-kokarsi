import { defineEventHandler, getCookie, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const query = getQuery(event)
  const params = new URLSearchParams()
  if (query.start) params.set('start', String(query.start))
  if (query.end) params.set('end', String(query.end))
  const qs = params.toString() ? `?${params.toString()}` : ''

  try {
    return await $fetch(`${BACKEND}/holidays${qs}`, {
      headers: authHeader,
    })
  } catch (error: any) {
    // Fail-silent — kalender tetap tampil tanpa data libur
    return []
  }
})
