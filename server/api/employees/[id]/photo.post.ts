import { defineEventHandler, getRouterParam, getCookie, proxyRequest } from 'h3'

const BACKEND = 'http://localhost:3001'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  // proxyRequest streams raw body ke backend tanpa parse/recreate
  // Tambah Authorization header dari cookie (backend butuh Bearer token)
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }
  return proxyRequest(event, BACKEND + '/api/employees/' + id + '/photo', {
    headers,
  })
})
