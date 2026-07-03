import 'dotenv/config'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule) as any

  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors({ origin: 'http://localhost:3000', credentials: true })
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' })

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`Backend running on http://localhost:${port}/api`)
}
bootstrap()
