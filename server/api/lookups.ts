const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const res = await $fetch(`${BACKEND}/lookups`, {
    headers: authHeader,
    ignoreResponseError: true,
  })

  return res
})
