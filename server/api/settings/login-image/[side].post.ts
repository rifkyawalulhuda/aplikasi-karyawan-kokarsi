import { defineEventHandler, getCookie, proxyRequest } from 'h3'

const BACKEND = 'http://localhost:3001'

export default defineEventHandler(async (event) => {
  const side = event.context.params?.side ?? ''
  const token = getCookie(event, 'auth_token') ?? ''
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }
  return proxyRequest(event, BACKEND + '/api/settings/login-image/' + side, { headers })
})
