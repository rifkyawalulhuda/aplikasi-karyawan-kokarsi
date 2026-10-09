/**
 * Sliding session (server-side): sebelum request /api/** diproses, cek apakah
 * access token sudah/balik mau habis. Jika iya, refresh diam-diam memakai
 * cookie refresh_token lalu perbarui cookie request agar handler proxy di
 * bawahnya membaca access token yang baru.
 *
 * Verifikasi tanda tangan tetap dilakukan backend — di sini hanya cek `exp`
 * agar refresh hanya terjadi saat benar-benar dibutuhkan.
 */
export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/')) return
  // Jangan refresh untuk endpoint auth itu sendiri (hindari rekursi).
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/refresh')) return

  const access = getCookie(event, ACCESS_COOKIE)
  const payload = access ? decodeJwtPayload(access) : null
  // Refresh 30 detik sebelum exp agar token tidak mati di tengah request.
  const isExpiring = !payload?.exp || payload.exp * 1000 <= Date.now() + 30_000
  if (!isExpiring) return

  const refresh = getCookie(event, REFRESH_COOKIE)
  if (!refresh) return

  try {
    const res = await $fetch<BackendTokenResponse>(`${BACKEND}/auth/refresh`, {
      method: 'POST',
      body: { refreshToken: refresh }
    })

    if (res?.access_token) {
      setAccessCookie(event, res.access_token)
      if (res.refresh_token) setRefreshCookie(event, res.refresh_token)

      // Perbarui cookie pada request supaya handler proxy membaca token baru.
      const cookies = parseCookies(event) as Record<string, string>
      cookies[ACCESS_COOKIE] = res.access_token
      if (res.refresh_token) cookies[REFRESH_COOKIE] = res.refresh_token
      event.node.req.headers.cookie = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    }
  } catch {
    // Refresh gagal (token dicabut/kadaluarsa) — biarkan handler menerima 401
    // dari backend; client akan diarahkan ke halaman login.
  }
})
