export default eventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const query = getQuery(event)

  try {
    return await $fetch(`${BACKEND}/dashboard/engagement`, {
      headers: authHeader,
      query,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal memuat data engagement',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal memuat data engagement' },
    })
  }
})
