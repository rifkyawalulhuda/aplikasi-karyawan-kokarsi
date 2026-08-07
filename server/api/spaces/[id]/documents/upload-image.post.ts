import { defineEventHandler, getRouterParam, getCookie, getHeader, createError, readMultipartFormData } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/avif'
]

export default defineEventHandler(async (event) => {
  const spaceId = getRouterParam(event, 'id')
  const token = getCookie(event, 'auth_token') ?? getHeader(event, 'authorization') ?? ''
  
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { message: 'Token tidak ditemukan' },
    })
  }

  try {
    const formData = await readMultipartFormData(event)
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: { message: 'Tidak ada file yang diupload' },
      })
    }

    const imageField = formData.find(f => f.name === 'image')
    if (!imageField || !imageField.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: { message: 'Field "image" tidak ditemukan' },
      })
    }

    const { data, type, filename } = imageField

    // Validate file type
    if (!type || !ALLOWED_TYPES.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: { message: `Tipe file tidak didukung: ${type}. Gunakan JPG, PNG, GIF, WebP, atau SVG` },
      })
    }

    // Validate file size
    if (data.length > MAX_FILE_SIZE) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: { message: `Ukuran file terlalu besar. Maksimal 5MB, file Anda ${(data.length / 1024 / 1024).toFixed(2)}MB` },
      })
    }

    // Generate unique filename
    const ext = filename?.split('.').pop() || type.split('/')[1] || 'jpg'
    const uniqueName = `doc-${spaceId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    
    // Upload directory - relative to project root
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'documents')
    
    // Create directory if not exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Write file
    const filePath = join(uploadDir, uniqueName)
    await writeFile(filePath, data)

    // Return URL (accessible via /uploads/documents/...)
    const url = `/uploads/documents/${uniqueName}`

    return { url }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { message: error?.message ?? 'Gagal upload gambar' },
    })
  }
})
