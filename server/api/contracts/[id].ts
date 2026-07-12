import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  const res = await $fetch.raw(`${BACKEND}/contracts/${id}`, {
    method: method as any,
    headers: authHeader,
    body,
    ignoreResponseError: true,
  })

  if (res.status >= 400) {
    const errMessage = (res._data as any)?.message ?? res.statusText ?? 'Terjadi kesalahan'
    throw createError({
      statusCode: res.status,
      statusMessage: errMessage,
      data: { message: errMessage },
    })
  }

  return res._data
})
