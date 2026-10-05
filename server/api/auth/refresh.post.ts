/**
 * Proxy refresh ke backend: tukar cookie refresh_token dengan pasangan token baru.
 * Dipakai plugin client (app/plugins/auth-refresh.client.ts) dan middleware
 * server (server/middleware/auth-refresh.ts) untuk sliding session.
 */
export default defineEventHandler(async (event) => {
  const refresh = getCookie(event, REFRESH_COOKIE)
  if (!refresh) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Tidak ada sesi aktif',
      data: { message: 'Tidak ada sesi aktif' }
    })
  }

  try {
    const res = await $fetch<BackendTokenResponse>(`${BACKEND}/auth/refresh`, {
      method: 'POST',
      body: { refreshToken: refresh }
    })

    if (res?.access_token) setAccessCookie(event, res.access_token)
    if (res?.refresh_token) setRefreshCookie(event, res.refresh_token)

    return { admin: res.admin }
  } catch (error: unknown) {
    // Refresh token invalid/kadaluarsa — bersihkan semua cookie sesi.
    clearAuthCookies(event)
    const { statusCode, message } = extractBackendError(error, 'Sesi berakhir, silakan login kembali')
    throw createError({
      statusCode: statusCode === 500 ? 401 : statusCode,
      statusMessage: message,
      data: { message }
    })
  }
})
