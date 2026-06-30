import { defineEventHandler, getCookie, getMethod, getRouterParam, readBody } from 'h3'

const BACKEND = 'http://localhost:3001/api'

const ALLOWED = ['work-locations', 'job-roles', 'job-levels', 'tax-status']

export default defineEventHandler(async (event) => {
  const resource = getRouterParam(event, 'resource')
  if (!resource || !ALLOWED.includes(resource)) {
    throw createError({ statusCode: 404, message: 'Resource tidak ditemukan' })
  }

  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` } as Record<string, string>
    : {} as Record<string, string>

  const body = method !== 'GET' ? await readBody(event) : undefined

  return $fetch(`${BACKEND}/lookups/${resource}`, {
    method: method as any,
    headers: authHeader,
    body,
    ignoreResponseError: true,
  })
})
