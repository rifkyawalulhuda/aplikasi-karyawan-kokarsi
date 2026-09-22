import { defineEventHandler, getCookie, getHeader, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const id = getRouterParam(event, 'id')
  return $fetch(`${BACKEND}/operational-vehicle-usages/${id}/cancel`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
