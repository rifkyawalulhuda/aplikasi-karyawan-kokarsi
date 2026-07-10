import { defineEventHandler, getCookie, setResponseHeaders } from 'h3'
import * as http from 'node:http'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? ''

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  // BACKEND_ROOT = 'http://localhost:3001' (no /api suffix) — auto-imported from server/utils/backend.ts
  const backendUrl = new URL('/api/notifications/stream', BACKEND_ROOT)

  return new Promise<void>((resolve) => {
    const req = http.request(
      {
        hostname: backendUrl.hostname,
        port: Number(backendUrl.port) || 3001,
        path: backendUrl.pathname,
        method: 'GET',
        headers: {
          Cookie: `auth_token=${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      },
      (res) => {
        res.pipe(event.node.res, { end: true })
        res.on('end', resolve)
        res.on('error', (err) => {
          console.error('[SSE proxy] backend error:', err.message)
          resolve()
        })
      },
    )

    req.on('error', (err) => {
      console.error('[SSE proxy] request error:', err.message)
      resolve()
    })

    // Clean up when client disconnects
    event.node.req.on('close', () => {
      req.destroy()
      resolve()
    })

    req.end()
  })
})
