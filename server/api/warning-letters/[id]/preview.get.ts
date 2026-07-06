import { defineEventHandler, getCookie, getRouterParam, proxyRequest } from 'h3'


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  return proxyRequest(event, `${BACKEND}/warning-letters/${id}/preview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
