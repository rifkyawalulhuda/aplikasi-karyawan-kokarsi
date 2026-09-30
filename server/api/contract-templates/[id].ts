import { createError, defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  const res = await $fetch.raw(`${BACKEND}/contract-templates/${id}`, {
    method: method as any,
    headers: authHeader,
    body,
    ignoreResponseError: true
  })

  // Teruskan status backend apa adanya. Tanpa ini, kegagalan (mis. template masih
  // dipakai kontrak) kembali sebagai 200 dan UI menampilkan notifikasi sukses palsu.
  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: res.statusText,
      data: res._data
    })
  }

  return res._data
})
