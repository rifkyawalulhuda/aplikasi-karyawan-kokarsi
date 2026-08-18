import { defineEventHandler, getCookie, getMethod, getQuery, readBody } from 'h3'


export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const params = new URLSearchParams()
  if (query.search) params.set('search', String(query.search))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.page) params.set('page', String(query.page))
  if (query.employeeId) params.set('employeeId', String(query.employeeId))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const body = method !== 'GET' ? await readBody(event) : undefined

  try {
    return await $fetch(`${BACKEND}/warning-letters${qs}`, {
      method: method as any,
      headers: authHeader,
      body,
      ignoreResponseError: true,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: error?.data?.message ?? 'Gagal memproses surat peringatan',
    })
  }
})
