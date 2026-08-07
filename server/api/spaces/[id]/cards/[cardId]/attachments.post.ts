import { defineEventHandler, getRouterParam, getCookie, getHeader, proxyRequest, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  try {
    // proxyRequest men-streaming body mentah (multipart, JSON, dst) tanpa decode ke text,
    // sehingga file binary (gambar/PDF) tidak ter-corrupt saat diteruskan ke backend.
    return await proxyRequest(
      event,
      `${BACKEND}/spaces/${id}/cards/${cardId}/attachments`,
      { headers }
    )
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal upload attachment',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal' },
    })
  }
})