export default eventHandler(async (event) => {
  const query = getQuery(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.search) params.set('search', String(query.search))
  if (query.status) params.set('status', String(query.status))
  const qs = params.toString() ? `?${params.toString()}` : ''

  try {
    return await $fetch(`${BACKEND}/employee-documents/summary${qs}`, {
      headers: authHeader,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal memuat data',
    })
  }
})
