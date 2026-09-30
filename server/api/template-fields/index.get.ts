import { defineEventHandler, getCookie, getHeader, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const query = getQuery(event)
  const qs = query.includeInactive === 'true' ? '?includeInactive=true' : ''
  return $fetch(`${BACKEND}/template-fields${qs}`, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
  })
})