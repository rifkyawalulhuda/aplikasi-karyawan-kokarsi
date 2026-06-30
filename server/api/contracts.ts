const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.expiring) params.set('expiring', String(query.expiring))

  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await $fetch(`${BACKEND}/contracts${qs}`, {
    method: method as any,
    headers: authHeader,
    body: method !== 'GET' ? await readBody(event) : undefined,
    ignoreResponseError: true,
  })

  return res
})
