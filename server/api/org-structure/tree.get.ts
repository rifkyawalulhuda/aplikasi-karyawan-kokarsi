import { defineEventHandler, getCookie, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const params = new URLSearchParams()
  if (query.periodId !== undefined && query.periodId !== null) {
    params.set('periodId', String(query.periodId))
  }
  const qs = params.toString() ? `?${params.toString()}` : ''

  try {
    return await $fetch(`${BACKEND}/org-structure/tree${qs}`, {
      headers: authHeader,
    })
  } catch (error: any) {
    const msg = error?.data?.message
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: typeof msg === 'string' ? msg : 'Gagal memuat bagan struktur organisasi',
      data: { message: typeof msg === 'string' ? msg : 'Gagal memuat bagan struktur organisasi' },
    })
  }
})
