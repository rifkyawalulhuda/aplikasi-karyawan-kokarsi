import { defineEventHandler, getCookie, getRouterParam, proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = 'Bearer ' + token
  return proxyRequest(event, `${BACKEND}/vendor-contracts/${id}/file`, { headers })
})
