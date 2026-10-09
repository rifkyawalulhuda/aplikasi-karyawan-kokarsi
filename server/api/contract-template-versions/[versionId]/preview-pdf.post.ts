import { defineEventHandler, getCookie, getHeader, getRouterParam, proxyRequest } from 'h3'

/**
 * Proxy pratinjau PDF pratinjau template (respons biner).
 *
 * Memakai `proxyRequest` (bukan `$fetch` JSON) supaya byte PDF diteruskan apa
 * adanya — pola yang sama dengan `contracts/[id]/download-pdf.get.ts`.
 *
 * Auth: `auth_token` (cookie httpOnly) TIDAK diteruskan otomatis sebagai
 * Bearer oleh `proxyRequest`, sedangkan backend memvalidasi lewat
 * `Authorization: Bearer` (`jwt.strategy.ts`). Karena itu token dikonversi
 * eksplisit di sini; tanpa ini backend membalas 401.
 *
 * Backend: `POST /contract-template-versions/:versionId/preview-pdf`
 * Body: `{ contentDefinition? }` (agar editan belum tersimpan ikut terlihat).
 */
export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const headers = token
    ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
    : undefined
  return proxyRequest(event, `${BACKEND}/contract-template-versions/${versionId}/preview-pdf`, {
    headers,
  })
})
