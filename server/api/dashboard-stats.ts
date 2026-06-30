const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  return $fetch(`${BACKEND}/employees/dashboard-stats`, {
    headers: authHeader,
  })
})
