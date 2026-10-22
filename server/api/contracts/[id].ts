import { defineEventHandler, getCookie, getMethod, getQuery, getRouterParam, readBody } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  // Query diteruskan apa adanya: `?withRenewEligibility=true` dipakai modal
  // Preview Dokumen untuk meminta status kelayakan Perpanjang sekaligus.
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(getQuery(event))) {
    if (typeof value === 'string') params.set(key, value)
  }
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await $fetch.raw(`${BACKEND}/contracts/${id}${qs}`, {
    method: method as any,
    headers: authHeader,
    body,
    ignoreResponseError: true,
  })

  if (res.status >= 400) {
    const rawMessage = (res._data as any)?.message
    const errMessage = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : res.statusText || 'Terjadi kesalahan'
    throw createError({
      statusCode: res.status,
      statusMessage: errMessage,
      data: { message: errMessage },
    })
  }

  return res._data
})
