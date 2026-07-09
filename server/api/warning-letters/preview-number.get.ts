export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const query = getQuery(event)
  const qs = query.letterDate ? `?letterDate=${encodeURIComponent(String(query.letterDate))}` : ''
  return $fetch(`${BACKEND}/warning-letters/preview-number${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
