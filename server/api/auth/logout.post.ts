import { deleteCookie, defineEventHandler, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (token) {
    await $fetch(`${BACKEND}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined)
  }
  deleteCookie(event, 'auth_token', { path: '/' })
  deleteCookie(event, 'auth_admin', { path: '/' })
  return { success: true }
})
