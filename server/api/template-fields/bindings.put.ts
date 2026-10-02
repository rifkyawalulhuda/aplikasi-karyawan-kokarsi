import { defineEventHandler, getCookie, getHeader, readBody } from 'h3'

/**
 * Ubah binding field pada template: pakai/lepas + flag wajib.
 *
 * Body: `{ templateId, fieldId, bound, required? }`.
 * Field SYSTEM ditolak backend (selalu dipakai & wajib, tidak dapat diubah).
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const body = await readBody(event)
  return $fetch(`${BACKEND}/template-fields/bindings`, {
    method: 'PUT',
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
    body,
  })
})
