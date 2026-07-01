import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://kokarsi:kokarsi2026@localhost:5435/kokarsi_karyawan',
  },
})
