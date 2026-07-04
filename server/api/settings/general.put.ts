import { defineEventHandler, getCookie, readBody } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const body = await readBody(event)

  return $fetch(`${BACKEND}/settings/general`, {
    method: 'PUT',
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
