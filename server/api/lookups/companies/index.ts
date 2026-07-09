import { defineEventHandler, getCookie, getMethod, getQuery, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const body = method !== 'GET' ? await readBody(event) : undefined

  try {
    return await $fetch(`${BACKEND}/lookups/companies`, {
      method: method as any,
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    const msg = error?.data?.message
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: typeof msg === 'string' ? msg : 'Gagal memproses data perusahaan',
    })
  }
})
