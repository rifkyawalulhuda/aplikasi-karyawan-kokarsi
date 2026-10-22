import { defineEventHandler, getRouterParam, getCookie, proxyRequest } from 'h3'

/**
 * Hapus dokumen scan tanda tangan kontrak.
 *
 * Terpisah dari `PUT /contracts/:id` karena tindakan ini juga menghapus file
 * dari disk dan hanya boleh dilakukan ADMIN (dijaga di backend).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  return proxyRequest(event, `${BACKEND}/contracts/${id}/document`, {
    headers,
  })
})
