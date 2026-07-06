import { defineEventHandler, getCookie, getRouterParam } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  return $fetch(`${BACKEND}/contracts/${id}/document-preview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
