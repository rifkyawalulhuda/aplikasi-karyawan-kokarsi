import { defineEventHandler, getCookie } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''

  return $fetch(`${BACKEND}/settings/general`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
