const BACKEND = 'http://localhost:3001/api'

export default eventHandler(async (event) => {
  const body = await readBody(event)

  try {
    return await $fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      body,
    })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Login gagal',
      data: {
        message: error?.data?.message ?? error?.response?._data?.message ?? error?.message ?? 'Login gagal',
      },
    })
  }
})
