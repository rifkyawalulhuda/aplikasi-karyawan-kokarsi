import path from 'path'
import { defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

// Eksplisit load .env dari direktori backend agar DATABASE_URL terbaca dengan benar
// Tanpa ini, prisma.config.ts menggunakan fallback hardcoded dan mengabaikan .env
loadEnv({ path: path.join(__dirname, '.env') })

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan',
  },
})
