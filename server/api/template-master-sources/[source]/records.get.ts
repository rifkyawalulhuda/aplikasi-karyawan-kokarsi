import { defineEventHandler, getCookie, getHeader, getQuery, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const source = getRouterParam(event, 'source')
  const query = getQuery(event)
  const qs = query.q ? `?q=${encodeURIComponent(String(query.q))}` : ''
  return $fetch(`${BACKEND}/template-master-sources/${source}/records${qs}`, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
  })
})