import { defineEventHandler, getCookie, getHeader, getRouterParam } from 'h3'

/**
 * Hapus versi template (ARCHIVED / DRAFT).
 *
 * Backend menolak versi PUBLISHED dan versi yang masih dipakai kontrak — pesan
 * penolakannya diteruskan apa adanya agar modal bisa menampilkannya ke admin.
 *
 * `auth_token` (cookie httpOnly) tidak otomatis menjadi Bearer, jadi dikonversi
 * eksplisit seperti proxy lain (lihat `calendar/[id].delete.ts`).
 */
export default defineEventHandler(async (event) => {
  const versionId = getRouterParam(event, 'versionId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  return $fetch(`${BACKEND}/contract-template-versions/${versionId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : undefined
  })
})
