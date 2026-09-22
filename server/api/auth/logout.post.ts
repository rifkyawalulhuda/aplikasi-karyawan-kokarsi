import { deleteCookie, defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  deleteCookie(event, 'auth_token', { path: '/' })
  deleteCookie(event, 'auth_admin', { path: '/' })
  return { success: true }
})
