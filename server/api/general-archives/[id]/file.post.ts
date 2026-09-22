import { defineEventHandler, getCookie, getRouterParam, proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const id = getRouterParam(event, 'id')
  return proxyRequest(event, `${BACKEND}/general-archives/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
})
