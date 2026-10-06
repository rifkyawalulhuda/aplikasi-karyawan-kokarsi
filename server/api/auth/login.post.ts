export default eventHandler(async (event) => {
  const body = await readBody(event)
  const remember = body?.remember !== false
  const credentials = { employeeNo: body?.employeeNo, password: body?.password }

  try {
    const res = await $fetch<BackendTokenResponse>(`${BACKEND}/auth/login`, {
      method: 'POST',
      body: credentials
    })

    if (res?.access_token) {
      // Access token pendek (15 menit) — diperbarui otomatis via refresh token.
      // remember=false → cookie sesi (hilang saat browser ditutup).
      setAccessCookie(event, res.access_token, remember)
      if (res.refresh_token) setRefreshCookie(event, res.refresh_token, remember)
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
