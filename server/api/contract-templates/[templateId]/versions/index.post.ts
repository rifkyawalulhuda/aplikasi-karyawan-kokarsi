import { defineEventHandler, getCookie, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const templateId = getRouterParam(event, 'templateId')
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/contract-templates/${templateId}/versions`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: await readBody(event),
  })
})