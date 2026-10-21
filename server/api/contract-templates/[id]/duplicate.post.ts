import { defineEventHandler, getCookie, getHeader, getRouterParam, readBody, createError } from 'h3'

/**
 * Duplikat template: menyalin template BESERTA versi terbit terakhirnya sebagai
 * DRAFT baru. Bukan `POST /contract-templates` biasa — endpoint itu tidak
 * menyentuh versi, sehingga salinannya tampil dengan konten default.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  const payload = await readBody(event).catch(() => undefined)

  const res = await $fetch.raw(`${BACKEND}/contract-templates/${id}/duplicate`, {
    method: 'POST',
    headers: token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {},
    body: payload,
    ignoreResponseError: true
  })

  // Teruskan status backend apa adanya: kode duplikat (409) dan "sumber belum
  // punya versi terbit" (400) harus sampai ke UI dengan pesannya, bukan
  // berubah menjadi notifikasi sukses palsu.
  if (res.status >= 400) {
    throw createError({
      statusCode: res.status,
      statusMessage: res.statusText,
      data: res._data
    })
  }

  return res._data
})
