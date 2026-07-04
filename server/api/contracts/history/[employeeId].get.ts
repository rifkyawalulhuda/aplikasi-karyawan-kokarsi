import { defineEventHandler, getCookie, getRouterParam } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const employeeId = getRouterParam(event, 'employeeId')
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const res = await $fetch.raw(`${BACKEND}/contracts/history/${employeeId}`, {
    headers: authHeader,
    ignoreResponseError: true,
  })

  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: res.statusText,
      data: res._data,
    })
  }

  return res._data
})
