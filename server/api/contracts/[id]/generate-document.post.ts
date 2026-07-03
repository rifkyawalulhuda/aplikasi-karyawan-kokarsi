import { defineEventHandler, getCookie, getRouterParam } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  return $fetch(`${BACKEND}/contracts/${id}/generate-document`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
