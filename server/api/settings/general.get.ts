import { defineEventHandler, getCookie } from 'h3'


export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''

  return $fetch(`${BACKEND}/settings/general`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
