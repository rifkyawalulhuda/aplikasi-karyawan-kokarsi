import type { H3Event } from 'h3'

/**
 * Browser-side security policy for the Nuxt origin.
 *
 * The frontend talks to the backend through same-origin Nitro routes, while
 * private files are served through the same-origin /uploads proxy. The backend
 * URL is therefore intentionally not present in connect-src or img-src.
 */
export default defineEventHandler((event: H3Event) => {
  const headers = event.node.res

  headers.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Nuxt SSR and Nuxt UI currently emit inline bootstrap/style content.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "object-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  )
})