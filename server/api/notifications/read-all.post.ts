import { defineEventHandler, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const res = await $fetch.raw(`${BACKEND}/notifications/read-all`, {
    method: 'POST',
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
