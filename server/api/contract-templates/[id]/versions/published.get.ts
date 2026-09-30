import { defineEventHandler, getCookie, getHeader, getRouterParam } from 'h3'

/**
 * Proxy versi PUBLISHED efektif untuk sebuah template.
 *
 * Backend `GET /contract-templates/:id/versions/published` melakukan bootstrap lazy:
 * template yang belum punya snapshot versi (mis. baru dibuat lewat Master Template)
 * akan dibuatkan snapshot versi 1 berstatus PUBLISHED. Route ini menjaga perilaku itu
 * tetap dapat dipakai editor tanpa harus membaca seluruh daftar versi.
 */
export default defineEventHandler(async (event) => {
  // Nama param harus konsisten dengan [id].ts / [id]/** lain di folder ini.
  // radix3 memilih placeholder berdasarkan maxDepth, sehingga dua nama param berbeda
  // (:id dan :templateId) pada posisi yang sama membuat route yang lebih dalam gagal cocok.
  const templateId = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  return $fetch(`${BACKEND}/contract-templates/${templateId}/versions/published`, {
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined
  })
})
