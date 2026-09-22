import { defineEventHandler, getCookie, getMethod, getQuery, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const method = getMethod(event)
  const query = getQuery(event)
  return $fetch(`${BACKEND}/general-archives`, {
    method: method as any,
    query: method === 'GET' ? { page: query.page, limit: query.limit, search: query.search } : undefined,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: method === 'POST' || method === 'PUT' ? await readBody(event) : undefined,
  })
})
