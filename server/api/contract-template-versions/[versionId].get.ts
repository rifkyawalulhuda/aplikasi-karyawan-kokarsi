import { defineEventHandler, getCookie, getHeader, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}`, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
  })
})