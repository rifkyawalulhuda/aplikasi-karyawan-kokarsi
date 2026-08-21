
export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    return await $fetch(`${BACKEND}/spaces/${id}/members/${userId}`, {
      method: 'DELETE',
      headers: authHeader,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal menghapus member',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})
