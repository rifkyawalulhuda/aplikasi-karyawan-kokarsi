import { defineEventHandler, getCookie, getHeader, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  // Nama param harus konsisten dengan [id].ts / [id]/** lain di folder ini.
  // radix3 memilih placeholder berdasarkan maxDepth, sehingga dua nama param berbeda
  // (:id dan :templateId) pada posisi yang sama membuat route yang lebih dalam gagal cocok.
  const templateId = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  // Normalisasi body: request tanpa body/Content-Type JSON tidak boleh diteruskan mentah
  // karena ofetch gagal menyerialisasinya (backend menerima 500, bukan error yang jelas).
  const payload = await readBody(event).catch(() => undefined)
  const body = payload !== null && typeof payload === 'object' && !Array.isArray(payload) && !Buffer.isBuffer(payload)
    ? { ...payload }
    : undefined
  return $fetch(`${BACKEND}/contract-templates/${templateId}/versions`, {
    method: 'POST',
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined,
    body
  })
})
