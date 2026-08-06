
export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const body = await readBody(event)

  try {
    return await $fetch(`${BACKEND}/spaces/${id}/members`, {
      method: 'POST',
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal menambah member',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})
