
export default eventHandler(async (event) => {
  const method = getMethod(event)
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  try {
    const res = await $fetch.raw(`${BACKEND}/users`, {
      method: method as any,
      headers: authHeader,
      body: method !== 'GET' ? await readBody(event) : undefined,
      ignoreResponseError: true,
    })

    if (res.status >= 400) {
      throw createError({
        statusCode: res.status,
        statusMessage: (res._data as any)?.message ?? 'Gagal memproses permintaan user',
        data: {
          message: (res._data as any)?.message ?? 'Gagal memproses permintaan user',
        },
      })
    }

    return res._data
  } catch (error: any) {
    // Rethrow createError tanpa wrapping ulang
    if (error.statusCode) throw error
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data user',
      data: {
        message: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Gagal memuat data user',
      },
    })
  }
})
