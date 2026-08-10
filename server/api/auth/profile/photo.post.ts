import { defineEventHandler, getCookie, getHeader, proxyRequest, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = 'Bearer ' + token
  }

  try {
    // proxyRequest men-streaming multipart mentah tanpa decode binary (pola fix attachment)
    return await proxyRequest(event, `${BACKEND}/auth/profile/photo`, { headers })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode ?? error?.response?.status ?? 500,
      statusMessage: error?.data?.message ?? error?.message ?? 'Gagal upload foto profil',
      data: { message: error?.data?.message ?? error?.message ?? 'Gagal upload foto profil' },
    })
  }
})