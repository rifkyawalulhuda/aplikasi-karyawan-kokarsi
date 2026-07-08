import { defineEventHandler, getCookie, proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = 'Bearer ' + token
  return proxyRequest(event, `${BACKEND}/lookups/companies/import-template`, { headers })
})
