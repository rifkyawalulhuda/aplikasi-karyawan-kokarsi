import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const body = method !== 'GET' && method !== 'DELETE' ? await readBody(event) : undefined

  return $fetch(`${BACKEND}/contract-templates/${id}`, {
    method: method as any,
    headers: authHeader,
    body,
    ignoreResponseError: true,
  })
})
