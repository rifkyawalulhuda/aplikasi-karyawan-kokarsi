import { defineEventHandler, getCookie, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
})