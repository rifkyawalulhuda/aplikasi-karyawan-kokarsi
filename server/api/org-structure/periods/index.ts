import { defineEventHandler, getCookie, getMethod, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const body = method !== 'GET' ? await readBody(event) : undefined

  try {
    return await $fetch(`${BACKEND}/org-structure/periods`, {
      method: method as any,
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    const msg = error?.data?.message
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: typeof msg === 'string' ? msg : 'Gagal memproses periode struktur organisasi',
      data: { message: typeof msg === 'string' ? msg : 'Gagal memproses periode struktur organisasi' },
    })
  }
})
