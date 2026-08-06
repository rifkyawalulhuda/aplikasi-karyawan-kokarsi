
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  // SSE: proxy langsung ke backend dengan cookie auth
  const backendUrl = `${BACKEND_ROOT}/api/spaces/${id}/stream`

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  // Proxy SSE dari backend ke client
  const response = await fetch(backendUrl, {
    headers: token ? { Cookie: `auth_token=${token}` } : {},
  })

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: 'SSE connection failed' })
  }

  // Stream body ke client
  return sendStream(event, response.body as any)
})
