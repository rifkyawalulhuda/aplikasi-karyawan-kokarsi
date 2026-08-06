
export default eventHandler(async (event) => {
  const method = getMethod(event)
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    if (method === 'GET') {
      return await $fetch(`${BACKEND}/spaces/${id}/documents`, {
        headers: authHeader,
      })
    }
    if (method === 'POST') {
      return await $fetch(`${BACKEND}/spaces/${id}/documents`, {
        method: 'POST',
        headers: authHeader,
        body: await readBody(event),
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})
