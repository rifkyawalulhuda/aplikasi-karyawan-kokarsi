import { defineEventHandler, getCookie, getHeader, getQuery, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  // Nama param harus konsisten dengan [id].ts / [id]/** lain di folder ini.
  // radix3 memilih placeholder berdasarkan maxDepth, sehingga dua nama param berbeda
  // (:id dan :templateId) pada posisi yang sama membuat route yang lebih dalam gagal cocok.
  const templateId = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const query = getQuery(event)
  const endpoint = query.published === 'true'
    ? `${BACKEND}/contract-templates/${templateId}/versions/published`
    : `${BACKEND}/contract-templates/${templateId}/versions`
  return $fetch(endpoint, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined
  })
})
