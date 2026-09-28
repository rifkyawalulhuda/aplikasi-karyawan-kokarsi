import { existsSync } from 'fs'
import { extname, isAbsolute, normalize, relative, resolve, sep } from 'path'
import type { NextFunction, Request, Response } from 'express'
import { verify } from 'jsonwebtoken'

const UPLOAD_ROOT = resolve(process.cwd(), 'uploads')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
}

type CookieRequest = Request & { cookies?: Record<string, string> }

function resolveInsideUploads(urlPath: string): string | null {
  let decoded = urlPath
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null

  const rel = normalize(decoded).replace(/^[/\\]+/, '')
  if (!rel || rel === '.' || isAbsolute(rel)) return null

  const abs = resolve(UPLOAD_ROOT, rel)
  const fromRoot = relative(UPLOAD_ROOT, abs)
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null
  return abs
}

function isPublicBranding(abs: string): boolean {
  const fromRoot = relative(UPLOAD_ROOT, abs)
  return fromRoot === 'settings' || fromRoot.startsWith(`settings${sep}`)
}

function hasValidToken(req: CookieRequest): boolean {
  const secret = process.env.JWT_SECRET
  if (!secret) return false

  const header = req.headers.authorization
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null
  const token = bearer || req.cookies?.auth_token
  if (!token) return false

  try {
    verify(token, secret)
    return true
  } catch {
    return false
  }
}

export function uploadsAccess(req: CookieRequest, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).end()
    return
  }

  const abs = resolveInsideUploads(req.path)
  if (!abs) {
    res.status(403).end()
    return
  }

  if (!isPublicBranding(abs) && !hasValidToken(req)) {
    res.status(401).end()
    return
  }

  if (!existsSync(abs)) {
    res.status(404).end()
    return
  }

  const type = MIME[extname(abs).toLowerCase()]
  // SVG is intentionally unsupported: never serve legacy or manually placed SVG files.
  if (extname(abs).toLowerCase() === '.svg') {
    res.status(404).end()
    return
  }
  if (type) res.type(type)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', isPublicBranding(abs) ? 'public, max-age=3600' : 'private, no-store')
  res.sendFile(abs, { dotfiles: 'deny' }, (err) => {
    if (err) next(err)
  })
}

export const uploadsMountPath = '/uploads'
