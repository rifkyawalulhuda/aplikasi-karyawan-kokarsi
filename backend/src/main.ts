import 'dotenv/config'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { uploadsAccess, uploadsMountPath } from './uploads-access'

async function bootstrap() {
  const app = await NestFactory.create(AppModule) as any

  app.use(cookieParser())
  const express = require('express')
  const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.NUXT_ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter(Boolean)

  // Bulk employee import is the only JSON endpoint allowed to exceed the normal request limit.
  app.use('/api/employees/bulk-import', express.json({ limit: '10mb' }))
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ limit: '1mb', extended: true }))
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Origin tidak diizinkan oleh kebijakan CORS'))
    },
    credentials: true,
  })
  app.use(uploadsMountPath, uploadsAccess)

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}/api`)
}
bootstrap()
