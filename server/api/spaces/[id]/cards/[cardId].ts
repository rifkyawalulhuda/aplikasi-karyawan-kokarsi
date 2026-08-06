
export default eventHandler(async (event) => {
  const method = getMethod(event)
  const id = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    if (method === 'GET') {
      return await $fetch(`${BACKEND}/spaces/${id}/cards/${cardId}`, { headers: authHeader })
    }
    if (method === 'PUT') {
      return await $fetch(`${BACKEND}/spaces/${id}/cards/${cardId}`, {
        method: 'PUT', headers: authHeader, body: await readBody(event),
      })
    }
    if (method === 'DELETE') {
      return await $fetch(`${BACKEND}/spaces/${id}/cards/${cardId}`, { method: 'DELETE', headers: authHeader })
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})
