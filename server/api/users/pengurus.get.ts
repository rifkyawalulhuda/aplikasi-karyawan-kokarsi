const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    return await $fetch(`${BACKEND}/users/pengurus`, {
      headers: authHeader,
      ignoreResponseError: true,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data pengurus',
      data: {
        message: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data pengurus',
      },
    })
  }
})
