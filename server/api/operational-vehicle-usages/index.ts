import { defineEventHandler, getCookie, getHeader, getMethod, getQuery, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const method = getMethod(event)
  const query = getQuery(event)
  const body = method === 'POST' ? await readBody(event) : undefined
  return $fetch(`${BACKEND}/operational-vehicle-usages`, {
    method: method as any,
    query: method === 'GET' ? { month: query.month, year: query.year } : undefined,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  })
})
