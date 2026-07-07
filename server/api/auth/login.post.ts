
export default eventHandler(async (event) => {
  const body = await readBody(event)

  try {
    const res: any = await $fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      body,
    })

    if (res?.access_token) {
      setCookie(event, 'auth_token', res.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 8,
        path: '/',
      })
    }

    return res
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
