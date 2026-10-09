import { defineEventHandler, getCookie, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const id = getRouterParam(event, 'id')
  return $fetch(`${BACKEND}/template-fields/${id}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: await readBody(event),
  })
})