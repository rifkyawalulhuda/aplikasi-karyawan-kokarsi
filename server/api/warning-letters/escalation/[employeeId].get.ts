import { defineEventHandler, getCookie, getRouterParam } from 'h3'


export default defineEventHandler(async (event) => {
  const employeeId = getRouterParam(event, 'employeeId')
  const token = getCookie(event, 'auth_token') ?? ''

  return $fetch(`${BACKEND}/warning-letters/escalation/${employeeId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ignoreResponseError: true,
  })
})
