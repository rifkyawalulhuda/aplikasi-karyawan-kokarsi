
export default eventHandler(async (event) => {
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    if (method === 'GET') {
      return await $fetch(`${BACKEND}/spaces`, { headers: authHeader })
    }
    return await $fetch(`${BACKEND}/spaces`, {
      method: 'POST',
      headers: authHeader,
      body: await readBody(event),
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal memuat spaces',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal memuat spaces' },
    })
  }
})
