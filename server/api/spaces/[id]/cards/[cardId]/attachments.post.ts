
export default eventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  const contentType = getHeader(event, 'content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      // Forward multipart/form-data as raw stream — do NOT parse with readBody
      const rawBody = await readRawBody(event)
      const res = await $fetch.raw(`${BACKEND}/spaces/${id}/cards/${cardId}/attachments`, {
        method: 'POST',
        headers: {
          ...authHeader,
          'content-type': contentType,
        },
        body: rawBody,
      })
      return res._data
    }

    // JSON body (link attachment)
    return await $fetch(`${BACKEND}/spaces/${id}/cards/${cardId}/attachments`, {
      method: 'POST',
      headers: authHeader,
      body: await readBody(event),
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal upload attachment',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})
