import { defineEventHandler, getCookie, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const id = getRouterParam(event, 'id')
  return $fetch(`${BACKEND}/template-fields/${id}/archive`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
})