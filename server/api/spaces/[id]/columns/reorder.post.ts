
export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    return await $fetch(`${BACKEND}/spaces/${id}/columns/reorder`, {
      method: 'POST',
      headers: authHeader,
      body: await readBody(event),
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal reorder kolom',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal reorder kolom' },
    })
  }
})
