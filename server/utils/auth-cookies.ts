import { deleteCookie, setCookie, type H3Event } from 'h3'

/**
 * Cookie & helper sesi (sliding session).
 *
 * TTL di sini HARUS sinkron dengan default backend:
 *  - ACCESS  ↔ JWT_ACCESS_EXPIRES_IN  (backend/src/auth/auth.service.ts)
 *  - REFRESH ↔ JWT_REFRESH_EXPIRES_IN (backend/src/auth/auth.service.ts)
 */
export const ACCESS_COOKIE = 'auth_token'
export const REFRESH_COOKIE = 'refresh_token'
export const ADMIN_COOKIE = 'auth_admin'

const ACCESS_TTL_SECONDS = 60 * 15 // 15 menit
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 hari

function isProd() {
  return process.env.NODE_ENV === 'production'
}

export function setAccessCookie(event: H3Event, token: string) {
  setCookie(event, ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'strict',
    maxAge: ACCESS_TTL_SECONDS,
    path: '/'
  })
}

export function setRefreshCookie(event: H3Event, token: string) {
  setCookie(event, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'strict',
    maxAge: REFRESH_TTL_SECONDS,
    path: '/'
  })
}

export function clearAuthCookies(event: H3Event) {
  deleteCookie(event, ACCESS_COOKIE, { path: '/' })
  deleteCookie(event, REFRESH_COOKIE, { path: '/' })
  deleteCookie(event, ADMIN_COOKIE, { path: '/' })
}

/** Decode payload JWT tanpa verifikasi tanda tangan — hanya untuk cek `exp`
 *  di middleware Nuxt (verifikasi tanda tangan tetap dilakukan backend). */
export function decodeJwtPayload(token: string): { exp?: number, type?: string, sub?: number } | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

/** Bentuk response token dari backend (login & refresh). */
export interface BackendTokenResponse {
  access_token?: string
  refresh_token?: string
  admin?: {
    id: number
    employeeNo: string
    fullName: string
    role: string
    accountType?: string
    photoUrl?: string | null
  }
}

/** Ekstrak status + pesan error dari $fetch ke backend (ofetch.FetchError). */
export function extractBackendError(error: unknown, fallbackMessage: string): { statusCode: number, message: string } {
  const e = error as {
    statusCode?: number
    data?: { message?: string }
    response?: { status?: number, _data?: { message?: string } }
    message?: string
  }
  return {
    statusCode: e?.response?.status ?? e?.statusCode ?? 500,
    message: e?.data?.message ?? e?.response?._data?.message ?? e?.message ?? fallbackMessage
  }
}
