export default eventHandler(async (event) => {
  const body = await readBody(event)

  try {
    const res = await $fetch<BackendTokenResponse>(`${BACKEND}/auth/login`, {
      method: 'POST',
      body
    })

    if (res?.access_token) {
      // Access token pendek (15 menit) — diperbarui otomatis via refresh token.
      setAccessCookie(event, res.access_token)
      if (res.refresh_token) setRefreshCookie(event, res.refresh_token)
    }

    // refresh_token TIDAK dikembalikan di body — hanya via cookie httpOnly.
    return { admin: res.admin }
  } catch (error: unknown) {
    const { statusCode, message } = extractBackendError(error, 'Login gagal')
    throw createError({
      statusCode,
      statusMessage: message,
      data: { message }
    })
  }
})
