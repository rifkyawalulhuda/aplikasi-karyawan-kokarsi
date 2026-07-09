export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const query = getQuery(event)
  const qs = query.startDate ? `?startDate=${encodeURIComponent(String(query.startDate))}` : ''
  return $fetch(`${BACKEND}/contracts/preview-number${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
