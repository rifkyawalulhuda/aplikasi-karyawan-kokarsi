import { defineEventHandler, getRouterParam, getCookie, proxyRequest } from 'h3'

const BACKEND = 'http://localhost:3001'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  return proxyRequest(event, `${BACKEND}/api/contracts/${id}/document`, {
    headers,
  })
})
