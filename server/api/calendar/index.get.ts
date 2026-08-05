import { defineEventHandler, getQuery, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/calendar`, {
    query: { start: query.start, end: query.end },
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
})
