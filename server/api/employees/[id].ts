const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const method = getMethod(event)
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const res = await $fetch(`${BACKEND}/employees/${id}`, {
    method: method as any,
    headers: authHeader,
    body: method !== 'GET' ? await readBody(event) : undefined,
    ignoreResponseError: true,
  })

  return res
})
