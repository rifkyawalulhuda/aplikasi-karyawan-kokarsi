import { defineEventHandler, getCookie, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}`, {
    method: 'PUT', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: await readBody(event),
  })
})