import { defineEventHandler, getRouterParam, getCookie, getHeader, proxyRequest, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  try {
    // proxyRequest men-streaming body multipart mentah ke backend tanpa decode,
    // sehingga file binary (gambar) tidak ter-corrupt. Backend menyimpan & serve
    // file via /uploads/** (konsisten dengan seluruh upload lain).
    return await proxyRequest(
      event,
      `${BACKEND}/spaces/${id}/documents/upload-image`,
      { headers }
    )
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal upload gambar',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal upload gambar' },
    })
  }
})