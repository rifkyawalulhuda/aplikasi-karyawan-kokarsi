import { defineEventHandler, getCookie, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const action = getRouterParam(event, 'action')
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}/${action}`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: await readBody(event).catch(() => undefined),
  })
})