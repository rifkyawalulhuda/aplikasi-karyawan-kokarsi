import { defineEventHandler, getRouterParam, getCookie, proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  // proxyRequest streams raw body (multipart) ke backend tanpa parse/recreate
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }
  return proxyRequest(event, BACKEND + '/org-structure/nodes/' + id + '/photo', {
    headers,
  })
})
