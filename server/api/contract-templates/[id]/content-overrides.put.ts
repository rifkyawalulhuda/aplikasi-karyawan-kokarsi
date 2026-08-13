import { defineEventHandler, getCookie, getRouterParam, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
  const body = await readBody(event)

  const res = await $fetch.raw(`${BACKEND}/contract-templates/${id}/content-overrides`, {
    method: 'PUT',
    headers: authHeader,
    body,
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
