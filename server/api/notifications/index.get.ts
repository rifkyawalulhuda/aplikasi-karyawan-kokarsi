import { defineEventHandler, getCookie, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const query = getQuery(event)
  const params = new URLSearchParams()
  if (query.limit) params.set('limit', String(query.limit))
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
