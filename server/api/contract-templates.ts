import { createError } from 'h3'

export default eventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const params = new URLSearchParams()
  if (query.activeOnly) params.set('activeOnly', String(query.activeOnly))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await $fetch.raw(`${BACKEND}/contract-templates${qs}`, {
    method: method as any,
    headers: authHeader,
    body: method !== 'GET' ? await readBody(event) : undefined,
    ignoreResponseError: true
  })

  // Teruskan status backend apa adanya. Tanpa ini, kegagalan (mis. kode template
  // duplikat) kembali sebagai 200 dan UI menampilkan notifikasi sukses palsu.
  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: res.statusText,
      data: res._data
    })
  }

  return res._data
})
