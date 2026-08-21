import { defineEventHandler, getCookie, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const body = await readBody(event)

  const res = await $fetch.raw(`${BACKEND}/auth/change-password`, {
    method: 'PUT',
    headers: authHeader,
    body,
    ignoreResponseError: true,
  })

  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: (res._data as any)?.message ?? 'Gagal mengubah password',
      data: { message: (res._data as any)?.message ?? 'Gagal mengubah password' },
    })
  }

  return res._data
})
