import { defineEventHandler, getCookie, getRouterParam, readMultipartFormData } from 'h3'

const BACKEND = 'http://localhost:3001'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? ''

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) {
    return { statusCode: 400, message: 'File tidak ditemukan' }
  }

  const filePart = parts.find(p => p.name === 'photo')
  if (!filePart) {
    return { statusCode: 400, message: 'Field photo tidak ditemukan' }
  }

  // Forward multipart ke backend menggunakan FormData via fetch
  const formData = new FormData()
  const blob = new Blob([filePart.data], { type: filePart.type ?? 'image/jpeg' })
  formData.append('photo', blob, filePart.filename ?? 'photo.jpg')

  const res = await fetch(`${BACKEND}/api/employees/${id}/photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  return res.json()
})
