import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const id = getRouterParam(event, 'id')
  const method = getMethod(event)
  return $fetch(`${BACKEND}/general-archives/${id}`, {
    method: method as any,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: method === 'PUT' ? await readBody(event) : undefined,
  })
})
