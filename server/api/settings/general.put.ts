import { defineEventHandler, getCookie, readBody } from 'h3'

const BACKEND = 'http://localhost:3001/api'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''
  const body = await readBody(event)

  const res = await $fetch.raw(`${BACKEND}/settings/general`, {
    method: 'PUT',
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
