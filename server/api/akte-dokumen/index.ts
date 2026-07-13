import { defineEventHandler, getCookie, getMethod, getQuery, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.search) params.set('search', String(query.search))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const body = method !== 'GET' ? await readBody(event) : undefined

  try {
    return await $fetch(`${BACKEND}/akte-dokumen${qs}`, {
      method: method as any,
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    const msg = error?.data?.message
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: typeof msg === 'string' ? msg : 'Gagal memproses akte dokumen',
    })
  }
})
