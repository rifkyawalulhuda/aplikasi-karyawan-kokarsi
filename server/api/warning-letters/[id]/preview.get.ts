import { createError, defineEventHandler, getCookie, getRouterParam, send, setResponseHeaders } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  try {
    const pdf = await $fetch<ArrayBuffer>(`${BACKEND}/warning-letters/${id}/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'arrayBuffer'
    })

    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="SP-${id}.pdf"`,
      'Cache-Control': 'private, no-store'
    })

    return send(event, Buffer.from(pdf))
  } catch (error: unknown) {
    const details = error && typeof error === 'object' ? error as Record<string, unknown> : {}
    const data = details.data && typeof details.data === 'object' ? details.data as Record<string, unknown> : {}
    const message = data.message ?? details.message ?? 'Gagal membuat preview surat peringatan'
    const statusCode = typeof details.statusCode === 'number'
      ? details.statusCode
      : typeof details.status === 'number' ? details.status : 500
    throw createError({
      statusCode,
      statusMessage: Array.isArray(message) ? message.join(', ') : String(message)
    })
  }
})
