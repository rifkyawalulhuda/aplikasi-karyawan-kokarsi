import { defineEventHandler, getCookie, getHeader, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const action = getRouterParam(event, 'action')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  // preview/publish/rollback tidak memakai payload. Body non-JSON (mis. request tanpa
  // Content-Type) tidak boleh diteruskan mentah karena ofetch gagal menyerialisasinya
  // dan backend hanya menerima 500 "Cannot convert object to primitive value".
  const payload = await readBody(event).catch(() => undefined)
  const body = payload !== null && typeof payload === 'object' && !Array.isArray(payload) && !Buffer.isBuffer(payload)
    ? { ...payload }
    : undefined
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}/${action}`, {
    method: 'POST', headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
    body
  })
})
