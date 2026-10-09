import { defineEventHandler, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const refresh = getCookie(event, REFRESH_COOKIE)
  if (refresh) {
    // Cabut seluruh sesi via refresh token (bekerja walau access token expired).
    await $fetch(`${BACKEND}/auth/revoke`, {
      method: 'POST',
      body: { refreshToken: refresh }
    }).catch(() => undefined)
  } else {
    // Fallback sesi lama yang belum punya refresh token.
    const token = getCookie(event, ACCESS_COOKIE)
    if (token) {
      await $fetch(`${BACKEND}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => undefined)
    }
  }
  clearAuthCookies(event)
  return { success: true }
})
