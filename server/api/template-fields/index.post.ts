import { defineEventHandler, getCookie, getHeader, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  return $fetch(`${BACKEND}/template-fields`, {
    method: 'POST',
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
    body: await readBody(event),
  })
})