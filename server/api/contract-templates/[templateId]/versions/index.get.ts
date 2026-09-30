import { defineEventHandler, getCookie, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const templateId = getRouterParam(event, 'templateId')
  const token = getCookie(event, 'auth_token') ?? ''
  return $fetch(`${BACKEND}/contract-templates/${templateId}/versions`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
})