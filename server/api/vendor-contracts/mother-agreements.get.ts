import { defineEventHandler, getCookie, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}
  const query = getQuery(event)

  const params = new URLSearchParams()
  if (query.companyId) params.set('companyId', String(query.companyId))
  if (query.category) params.set('category', String(query.category))
  if (query.excludeId) params.set('excludeId', String(query.excludeId))
  const qs = params.toString() ? `?${params.toString()}` : ''

  return $fetch(`${BACKEND}/vendor-contracts/mother-agreements${qs}`, {
    headers: authHeader,
  })
})
