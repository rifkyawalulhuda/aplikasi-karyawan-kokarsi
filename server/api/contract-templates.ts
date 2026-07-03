const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const params = new URLSearchParams()
  if (query.activeOnly) params.set('activeOnly', String(query.activeOnly))
  const qs = params.toString() ? `?${params.toString()}` : ''

  return $fetch(`${BACKEND}/contract-templates${qs}`, {
    method: method as any,
    headers: authHeader,
    body: method !== 'GET' ? await readBody(event) : undefined,
    ignoreResponseError: true,
  })
})
