import { defineEventHandler, getCookie, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const query = getQuery(event)
  const params = new URLSearchParams()
  for (const key of ['limit', 'cursor', 'category', 'severity', 'unread', 'q'] as const) {
    const value = query[key]
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await $fetch.raw(`${BACKEND}/notifications${qs}`, {
    headers: authHeader,
    ignoreResponseError: true,
  })

  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: res.statusText,
      data: res._data,
    })
  }

  return res._data
})
