import { defineEventHandler, getCookie, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const body = await readBody(event)

  try {
    return await $fetch(`${BACKEND}/org-structure/nodes/${id}/move`, {
      method: 'POST',
      headers: authHeader,
      body,
    })
  } catch (error: any) {
    const msg = error?.data?.message
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: typeof msg === 'string' ? msg : 'Gagal memindahkan jabatan',
      data: { message: typeof msg === 'string' ? msg : 'Gagal memindahkan jabatan' },
    })
  }
})
