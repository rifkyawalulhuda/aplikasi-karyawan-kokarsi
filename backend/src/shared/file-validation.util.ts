import { BadRequestException } from '@nestjs/common'
import { fromBuffer } from 'file-type'

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Verifikasi magic bytes file gambar (jpg, png, webp).
 * Mencegah bypass validasi dengan memalsukan Content-Type header.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<void> {
  const type = await fromBuffer(buffer)
  if (!type || !ALLOWED_IMAGE_MIMES.includes(type.mime)) {
    throw new BadRequestException('File bukan gambar yang valid (jpg, png, webp)')
  }
}

/**
 * Verifikasi magic bytes file gambar termasuk SVG.
 * SVG tidak punya magic bytes, jadi validasi dilakukan via konten XML.
 */
export async function validateImageOrSvgBuffer(buffer: Buffer): Promise<void> {
  const type = await fromBuffer(buffer)

  if (type && ALLOWED_IMAGE_MIMES.includes(type.mime)) {
    return // valid image
  }

  // SVG tidak terdeteksi oleh file-type, cek via konten
  const text = buffer.toString('utf-8', 0, 512).trimStart()
  const isSvg = text.startsWith('<svg') || text.startsWith('<?xml')
  if (!isSvg) {
    throw new BadRequestException('File bukan gambar yang valid (jpg, png, webp, svg)')
  }
}

/**
 * Verifikasi magic bytes file PDF.
 */
export async function validatePdfBuffer(buffer: Buffer): Promise<void> {
  const type = await fromBuffer(buffer)
  if (!type || type.mime !== 'application/pdf') {
    throw new BadRequestException('File bukan PDF yang valid')
  }
}

export { ALLOWED_IMAGE_MIMES }
